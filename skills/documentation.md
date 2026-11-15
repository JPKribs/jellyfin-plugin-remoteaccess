# Documentation

How to write the README, the docs site, screenshots, and release notes for this plugin. It applies to every page under `docs/`, to `README.md`, and to the `changelog` in `build.yaml`.

## The One Rule

Documentation describes the release it ships with. It reads as if this version were the only one that ever existed.

* Write what the plugin does. Never write what it used to do, what it no longer does, or what it now does.
* Write how a feature works. Never write that a bug was fixed, a problem is gone, or a limit was lifted.
* History belongs in the release notes. See [Release Notes](#release-notes).

| Do not write | Write |
| :--- | :--- |
| Bans now survive a restart. | Bans survive a restart. |
| The Copy URL button was removed. | Leave it out. |
| Fixed an issue where the map missed countries. | The map shades every country with a count. |
| New in 12.4.5.0, the Dashboard shows... | The Dashboard shows... |

"Now" and "no longer" are fine when they describe state rather than history. "The address no longer points here" describes what the plugin sees, so it stays.

A version number belongs in docs only when the reader needs it to act, such as the minimum Jellyfin version or the oldest release that can upgrade directly. Keep those facts in [Installation](../docs/Installation.md) and [Versioning](../docs/Versioning.md), and name the version outright instead of "this release" or "an older release".

Remove compatibility notes for Jellyfin versions the plugin no longer supports. The plugin requires Jellyfin 12.4.

## Writing Style

### Sentences

* Use present tense and plain declarative sentences.
* Describe the system in the third person. "Remote Access sends the new IP to the provider."
* Address the reader in the second person only in steps. "Turn on **Enabled** in step 1."
* State one fact per sentence. Aim for 20 words or fewer and split anything over 30.
* Use no contractions. Write "cannot", not "can't".
* Use no em dashes, en dashes as dashes, or semicolons. Split the sentence, or join it with a comma and "and".
* Use colons only to introduce a list or a code block.
* Use parentheses rarely. Move the aside into its own sentence.
* End every sentence with a period.
* Write compounds as separate words the way the UI does, such as "one time setup" and "sign in".
* Write one paragraph per line. Never hard wrap prose.
* Use no marketing words such as "powerful", "seamless", "easily", or "simply".
* Write examples with generic names. Use `media.example.com`, `example.com`, documentation addresses such as `203.0.113.10` and `192.168.1.5`, and the user `viewer`, never a real server, domain, person, or address.

### Headings

* Use Title Case for every heading. "## Automatic Port Forwarding". Older pages still use sentence case, per [style.md](style.md#hand-built-pieces), and move to Title Case when they are next changed.
* Page titles are `#` and appear once per page.
* Name the thing, not the action, unless the section is a procedure. "## Settings" and "## Add the Plugin Repository" are both correct.
* Never rename a heading without fixing its anchors. `mkdocs build --strict` fails on a broken anchor.

### UI Names

* Write a label exactly as the page shows it, in bold. **Ban Window**.
* Write a path through the UI with `>` between the steps, in bold. **Remote Access > Advanced > Blocking**.
* Write a tab as its label, in bold. **Dashboard**, **Configuration**, **Advanced**.
* Quote activity log names and on-screen messages in double quotes. "Nothing recorded yet."
* Write routes, files, settings keys, and values in code. `POST /RemoteAccess/People/Unban`.

A docs page and the UI must use the same word for the same thing. When a label changes, search `docs/` for the old one and change it everywhere in the same commit.

## Site Structure

The docs site is MkDocs with the Material theme, built from `docs/` by `mkdocs.yml` and published to `https://jpkribs.github.io/jellyfin-plugin-remoteaccess/`.

### Navigation

Keep the nav in this order.

1. **Overview** (`index.md`) and the **Beginner's Guide**.
2. **Getting Started**. Installation and the DDNS record.
3. **Features**. Remote Access, and the Dashboard.
4. **Providers**. An overview, then one page per provider.
5. **Reference**. Settings, Security, and Versioning.
6. **Contributing**. Contributing, and Creating a Provider.

Name page files in PascalCase with no spaces, such as `LiveChanges.md`.

## Pages to Keep True

* [Settings](../docs/Settings.md) lists every setting on every tab. Change it with any setting.
* [Security](../docs/Security.md) says how credentials, keys, and certificates are stored. Change it with any storage change.
* [Dashboard](../docs/Dashboard.md) and [Remote Access](../docs/RemoteAccess.md) describe the pages step by step. Change them with any page change.
* A provider page under `docs/providers/` says which fields that provider uses. Change it with the provider's class.

Name classes and files exactly as the code does, in code format. Never link to source files, since the docs build refuses links outside `docs/`.

### Page Templates

A feature page opens with one sentence on what the feature is, then one section per question a reader asks, then **Security** and **Limitations** where they apply.

A provider page follows `docs/contributors/PROVIDERS.md`.

### Settings References

List settings as bullets in the order the page shows them. Start each with the label in bold and follow it with a verb.

```markdown
* **Ban Window** counts failed sign-ins over this many minutes.
```

When a page has many settings with defaults, use a table instead.

| Setting | What it does | Default |
| :--- | :--- | :--- |
| **Ban Window** | Counts failed sign-ins over this many minutes | 15 |

Table cells have no closing period. Keep them to one sentence.

### Troubleshooting

Write trouble as a table of what the reader sees and what to do.

| Reason | What to do |
| :--- | :--- |
| *name* does not point anywhere yet | Wait a few minutes after creating the record, then select **Update Now** |

Put the exact on-screen text in the first column. Use italics for a placeholder inside it, such as *server*.

### Admonitions

Give every admonition a short title.

```markdown
!!! warning "Use at your own risk"
    One or two sentences.
```

* `note` for a detail the reader needs.
* `tip` for a better way to do something.
* `warning` for anything that can lose data or break a server.
* `info` for a requirement, such as both servers running the plugin.

### Links

* Link pages relatively with their `.md` name, such as `[Remote Access](RemoteAccess.md#recovery)`.
* End a Getting Started page with one "Next" line, such as `Next: [The DDNS Record](Records.md).`
* Link to Base's README for a shared component instead of describing it again.

## README

The README is a landing page. The docs site holds the detail.

1. The icon, `<img src="docs/assets/icon.png" alt="Remote Access" width="96" align="left">`, then a one paragraph pitch and `<br clear="left">`.
2. `## Documentation`. One sentence on what the docs cover, a bold link to the site, then the repository URL for Jellyfin in a code block.
3. The considerations a reader must know before relying on the plugin.

Use `##` for README headings. Keep the README under 40 lines.

## Screenshots

### What to Capture

* Capture every page and dialog a docs page describes.
* Capture the dark theme only, which is Jellyfin's default.
* Capture from a test server, or from the page harness in [testing.md](testing.md#looking-at-a-page), so every name is generic.
* Capture with history recorded, so the map, tables, and badges are filled.
* Hide nothing with editing. When a value is private, change the test data instead. Check every shot for a real name before saving it.

### Sizes

| Kind | Size | How |
| :--- | :--- | :--- |
| Dialog | 800 wide | The browser at 800 px, cropped to the dialog |
| Full page | 1920 wide | The browser at 1920 px, cropped to the content area |
| Phone | 375 wide at 2x | The browser's device mode at 375 px |

Save every capture as PNG. Crop out the browser frame and the Jellyfin header unless the header is the subject.

### Names and Placement

* Save to `docs/screenshots/`.
* Name the file in Title Case after what it shows, with spaces. `Share Card.png`, `Router Step.png`.
* Link with `%20` for spaces and alt text that names the subject. `![Share Card](screenshots/Share%20Card.png)`.
* Place two related shots side by side in a table whose header row holds the captions.

```markdown
| Dashboard | Dashboard on a phone |
| :---: | :---: |
| ![Dashboard](screenshots/Dashboard.png) | ![Dashboard on a phone](screenshots/Dashboard%20Phone.png) |
```

### When to Retake

Retake a screenshot in the same commit as any change that alters what it shows, including a label, a tab, a layout, or the Jellyfin version in the header. A new Base version changes how every component looks, so retake every screenshot when it is raised. A screenshot that shows a tab or label the plugin no longer has is a bug.

## Installing a Build by Hand

```bash
./build.sh
```

The zip lands in `dist/`. Unzip it into `<config>/plugins/Remote Access_<version>/` on any Jellyfin 12.4 server and restart the server.

## Building the Docs

```bash
pip install mkdocs==1.6.1 mkdocs-material==9.7.7
```

```bash
mkdocs serve -a 127.0.0.1:8765
```

```bash
mkdocs build --strict
```

Run the strict build before every docs commit. CI runs the same build and refuses broken links, anchors, and nav entries.

## Release Notes

Release notes live in the `changelog` of `build.yaml`, under four keys. The publish workflow copies them into `manifest.json`, so every line reaches users' plugin catalogs.

| Key | Holds | Voice |
| :--- | :--- | :--- |
| `added` | A feature that did not exist | The feature name, then what it does |
| `changed` | Behavior a user will notice | The new behavior, in present tense |
| `fixed` | A bug | What went wrong in past tense, then the fix in present tense |
| `developer` | Routes, schema, tests, and tooling | Plain statements for other developers |

```yaml
changelog:
  changed:
    - The Configuration steps show how far setup has come in one bar, and the first step that needs something opens on its own
  fixed:
    - The arrows on collapsible sections were too large. They are back to their usual size
```

* This is the one place that may say "now", "no longer", and "was".
* Write full sentences with no closing period.
* Write one entry per change a user would notice. Fold internal steps into the change they serve.
* Use only the keys that have entries.
* Name UI labels exactly as the page shows them, without bold or backticks.
* Name the Base version in `developer`, with what it replaced locally.
* Give a new or changed route or query parameter a `developer` line.

## Commit Messages

* Write an imperative sentence in sentence case with no closing period. "Record the username tried on failed sign-ins".
* Describe the behavior, not the files. Use no prefixes such as `fix:` or `feat:`.
* Add a body of plain paragraphs, wrapped at 72 characters, when the reason is not obvious.
* Commit docs and screenshots with the change they describe.

## Checklist

* [ ] Nothing describes an earlier version, a removed feature, or a fixed bug.
* [ ] Every UI label matches the page exactly and is bold.
* [ ] Every heading is Title Case.
* [ ] No em dashes, semicolons, or contractions.
* [ ] Every screenshot matches the current UI and uses pool data.
* [ ] [Settings](../docs/Settings.md) and the pages the change touches match the code.
* [ ] Every term matches [glossary.md](glossary.md).
* [ ] `mkdocs build --strict` passes.
* [ ] `build.yaml` has a changelog entry for any change a user would notice.
