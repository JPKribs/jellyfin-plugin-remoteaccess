// Captures the Remote Access documentation screenshots at 2x into docs/screenshots.
// Run python3 -I server.py in the background, then node shoot.mjs [file name ...] to take all or only the named ones.
// PLAYWRIGHT_CORE points at playwright-core's index.mjs, CHROMIUM at the Chromium binary, PORT at the server (default 8866).
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

let chromium;
try {
  ({ chromium } = await import(process.env.PLAYWRIGHT_CORE || 'playwright-core'));
} catch (e) {
  console.error(`Cannot load playwright-core (${e.message}). Set PLAYWRIGHT_CORE to playwright-core's index.mjs.`);
  process.exit(1);
}
const exe = process.env.CHROMIUM || `${homedir()}/Library/Caches/ms-playwright/chromium-1148/chrome-mac/Chromium.app/Contents/MacOS/Chromium`;
if (!existsSync(exe)) {
  console.error(`No Chromium at ${exe}. Set CHROMIUM to a Chromium binary.`);
  process.exit(1);
}
const OUT = fileURLToPath(new URL('../../docs/screenshots/', import.meta.url));
const ROOT = `http://127.0.0.1:${process.env.PORT || 8866}/`;
const PAD = 8;

const b = await chromium.launch({ executablePath: exe });

// One tab of the harness at 800 px wide, once its data has drawn. state picks a variant of the sample status in stub.js.
async function open(page, state = '', vp = { width: 800, height: 900 }) {
  const p = await b.newPage({ viewport: vp, deviceScaleFactor: 2 });
  await p.goto(`${ROOT}index.html?page=${page}&state=${state}`);
  await p.waitForFunction(() => window.__ready);
  await p.waitForTimeout(1200);
  return p;
}

// The whole tab, from the top of the window to the bottom of the given element.
async function whole(p, file, bottom) {
  const h = await p.evaluate((sel) => document.querySelector(sel).getBoundingClientRect().bottom + scrollY, bottom);
  await p.screenshot({ path: `${OUT}${file}.png`, fullPage: true, clip: { x: 0, y: 0, width: 800, height: Math.ceil(h + 24) } });
}

// A part of the tab, from the top of one element to the bottom of another, without the fixed header over it.
async function part(p, file, top, bottom = top) {
  await p.evaluate(() => { document.getElementById('jfHeader').style.display = 'none'; });
  const r = await p.evaluate(([t, b]) => {
    const a = (typeof t === 'string' ? document.querySelector(t) : t).getBoundingClientRect();
    const z = (typeof b === 'string' ? document.querySelector(b) : b).getBoundingClientRect();
    return { x: Math.min(a.left, z.left), y: a.top + scrollY, w: Math.max(a.right, z.right) - Math.min(a.left, z.left), h: z.bottom - a.top };
  }, [top, bottom]);
  await p.screenshot({ path: `${OUT}${file}.png`, fullPage: true, clip: { x: Math.max(0, r.x - PAD), y: Math.max(0, r.y - PAD), width: r.w + 2 * PAD, height: r.h + 2 * PAD } });
}

// Opens one Configuration step by its title, and folds the rest, so the step reads on its own.
async function step(p, title) {
  await p.evaluate((title) => {
    document.querySelectorAll('.base-setup-step').forEach((s) => {
      const header = s.querySelector('.base-collapsible-header');
      const open = header.getAttribute('aria-expanded') === 'true';
      const mine = s.querySelector('.base-collapsible-title').textContent.trim() === title;
      if (open !== mine) header.click();
    });
  }, title);
  await p.waitForTimeout(500);
  return p.evaluateHandle((title) => [...document.querySelectorAll('.base-setup-step')]
    .find((s) => s.querySelector('.base-collapsible-title').textContent.trim() === title), title);
}

// Opens one Advanced section by its title.
async function section(p, title) {
  await p.evaluate((title) => {
    const s = [...document.querySelectorAll('.base-collapsible-section')].find((x) => x.querySelector('.base-collapsible-title').textContent.trim() === title);
    const header = s.querySelector('.base-collapsible-header');
    if (header.getAttribute('aria-expanded') !== 'true') header.click();
  }, title);
  await p.waitForTimeout(500);
  return p.evaluateHandle((title) => [...document.querySelectorAll('.base-collapsible-section')]
    .find((x) => x.querySelector('.base-collapsible-title').textContent.trim() === title), title);
}

// A Configuration step on its own.
async function stepShot(s) {
  const p = await open('configuration', s.state);
  await part(p, s.file, await step(p, s.step));
  return p;
}

const shots = [
  { file: 'Dashboard', run: async (s) => { const p = await open('dashboard'); await whole(p, s.file, '#RemoteAccessDashboardForm'); return p; } },
  { file: 'Share Card', run: async (s) => { const p = await open('dashboard'); await part(p, s.file, '#shareHost'); return p; } },
  { file: 'Configuration', run: async (s) => { const p = await open('configuration'); await whole(p, s.file, '#RemoteAccessConfigurationForm'); return p; } },
  { file: 'Address Step', step: 'Address', run: stepShot },
  {
    file: 'Record Editor', run: async (s) => {
      const p = await open('configuration');
      await step(p, 'Address');
      await part(p, s.file, '#bodyAddress');
      return p;
    }
  },
  {
    file: 'Provider Picker', run: async (s) => {
      const p = await open('configuration');
      await step(p, 'Address');
      const top = await p.evaluateHandle(() => document.getElementById('recProvider').closest('.selectContainer'));
      await part(p, s.file, top, '#providerHint');
      return p;
    }
  },
  {
    file: 'Last Update', run: async (s) => {
      const p = await open('configuration');
      await step(p, 'Address');
      await part(p, s.file, '#recStatusCard');
      return p;
    }
  },
  { file: 'Router Step', step: 'Router', run: stepShot },
  { file: 'CGNAT', state: 'cgnat', step: 'Router', run: stepShot },
  { file: 'Outside Test', state: 'reach', step: 'Reachable from outside', run: stepShot },
  { file: 'Advanced', run: async (s) => { const p = await open('advanced'); await whole(p, s.file, '#RemoteAccessAdvancedForm'); return p; } },
  {
    file: 'Dynamic DNS', run: async (s) => {
      const p = await open('advanced');
      await part(p, s.file, await section(p, 'Dynamic DNS'));
      return p;
    }
  },
  {
    // The Record group for a DynDNS v2 record, which shows the dyndns family's own options.
    file: 'Advanced Options', run: async (s) => {
      const p = await open('advanced', 'dyndns');
      await section(p, 'Dynamic DNS');
      const top = await p.evaluateHandle(() => document.querySelector('#advDynamicDns .base-subsection-title'));
      await part(p, s.file, top, '#recordFields');
      return p;
    }
  },
  {
    // Jellyfin's own Activity page on the throwaway server activity.py starts, which passes it in JELLYFIN_*.
    file: 'Activity Log', server: true, run: async (s) => {
      const env = process.env;
      const p = await b.newPage({ viewport: { width: 1600, height: 800 }, deviceScaleFactor: 2, colorScheme: 'dark' });
      await p.addInitScript((c) => {
        window.__errs = [];
        localStorage.setItem('jellyfin_credentials', JSON.stringify({ Servers: [{ Id: c.server, ManualAddress: c.url, LocalAddress: c.url, UserId: c.user, AccessToken: c.token, LastConnectionMode: 2, ManualAddressOnly: true, DateLastAccessed: Date.now() }] }));
      }, { server: env.JELLYFIN_SERVER, url: env.JELLYFIN_URL, user: env.JELLYFIN_USER, token: env.JELLYFIN_TOKEN });
      // Opening the page starts this browser's session, which activity.py waits for before it writes the plugin's
      // entries, so they are the newest. The page asks again each time the window regains focus, which it is told
      // until they show, since a reload would end the session and log it again.
      await p.goto(env.JELLYFIN_URL + '/web/#/dashboard/activity');
      for (let i = 0; i < 60 && !(await p.$('text=Proxy settings changed')); i++) {
        await p.waitForTimeout(2000);
        await p.evaluate(() => { window.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); });
        await p.waitForTimeout(1000);
      }
      await p.waitForSelector('text=Proxy settings changed', { timeout: 10000 });
      await p.waitForTimeout(1000);
      // The plugin's entries are the newest, so the table is cut under them, above the sign-in rows.
      const r = await p.evaluate((count) => {
        const paper = (document.querySelector('.MuiTableContainer-root') || document.querySelector('table')).closest('.MuiPaper-root') || document.querySelector('table');
        const rows = [...paper.querySelectorAll('tbody tr')];
        const box = paper.getBoundingClientRect();
        return { x: box.left, y: box.top + scrollY, w: box.width, h: rows[count - 1].getBoundingClientRect().bottom - box.top };
      }, Number(env.ACTIVITY_ROWS || 4));
      await p.screenshot({ path: `${OUT}${s.file}.png`, clip: { x: r.x, y: r.y, width: r.w, height: r.h } });
      return p;
    }
  }
];

const only = process.argv.slice(2);
for (const name of only) {
  if (!shots.some((s) => s.file === name)) console.error(`No shot named ${name}.`);
}
for (const s of shots) {
  if (only.length ? !only.includes(s.file) : s.server) continue;
  if (s.server && !process.env.JELLYFIN_URL) { console.error(`${s.file} needs a server: run python3 -I activity.py.`); continue; }
  const p = await s.run(s);
  const errs = await p.evaluate(() => window.__errs.filter((e) => !/ResizeObserver/.test(e)));
  console.log(s.file, errs.length ? JSON.stringify(errs) : 'ok');
  await p.close();
}
await b.close();
