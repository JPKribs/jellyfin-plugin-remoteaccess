"""Takes the Activity Log screenshot: the plugin's entries on Jellyfin's own Activity page, which only a real server draws.

Usage: python3 -I activity.py   (run ./build.sh first, so dist/ holds the plugin ZIP)
It starts a throwaway Jellyfin in Docker with the plugin from the newest ZIP in dist/, makes a generic admin with a
random password, and has shoot.mjs open the Activity page. Once that browser's session is logged, it changes the Dynamic DNS, proxy and
history settings and blocks 203.0.113.7 through the plugin's own endpoints, so each writes its entry as the newest
rows. Nothing is sent to a DNS provider.
The container and its folder are removed afterwards. IMAGE, PORT (default 8869) and the shoot.mjs variables
(PLAYWRIGHT_CORE, CHROMIUM) can be set in the environment.
"""
import glob, json, os, re, secrets, shutil, subprocess, sys, tempfile, time, urllib.error, urllib.request, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
IMAGE = os.environ.get('IMAGE', 'jellyfin/jellyfin:12.4.20261026-211555')
PORT = int(os.environ.get('PORT', '8869'))
NAME = 'ra-activity-shot'
ROOT = 'http://127.0.0.1:%d' % PORT
AUTH = 'MediaBrowser Client="screenshots", Device="screenshots", DeviceId="ra-activity-shot", Version="1.0"'
# The entries the steps below write, by type. The shot shows this many rows.
TYPES = ['RemoteAccess.SettingsChanged', 'RemoteAccess.ProxySettingsChanged', 'RemoteAccess.AddressBlocked', 'RemoteAccess.HistorySettingsChanged']


def call(method, path, body=None, token=None):
    headers = {'Content-Type': 'application/json', 'Authorization': AUTH + (', Token="%s"' % token if token else '')}
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(urllib.request.Request(ROOT + path, data=data, method=method, headers=headers), timeout=30) as r:
            text = r.read().decode()
            return json.loads(text) if text.strip() else None
    except urllib.error.HTTPError as ex:
        ex.msg = '%s %s: %s' % (method, path, ex.read().decode()[:300])
        raise


def wait(what, check, timeout=180):
    end = time.time() + timeout
    while time.time() < end:
        try:
            if check():
                return
        except (urllib.error.URLError, ConnectionError, OSError):
            pass
        time.sleep(2)
    sys.exit('Timed out waiting for ' + what + '.')


zips = sorted(glob.glob(os.path.join(REPO, 'dist', '*.zip')), key=os.path.getmtime)
if not zips:
    sys.exit('No plugin ZIP in dist/. Run ./build.sh first.')
work = tempfile.mkdtemp(prefix='ra-activity-')
plugin_dir = os.path.join(work, 'config', 'plugins', 'RemoteAccess')
os.makedirs(plugin_dir)
os.makedirs(os.path.join(work, 'cache'))
with zipfile.ZipFile(zips[-1]) as z:
    z.extractall(plugin_dir)

subprocess.run(['docker', 'rm', '-f', NAME], capture_output=True)
user = ['--user', '%d:%d' % (os.getuid(), os.getgid())]
subprocess.run(['docker', 'run', '-d', '--name', NAME, *user, '-p', '%d:8096' % PORT, '-v', work + '/config:/config',
                '-v', work + '/cache:/cache', IMAGE], check=True, capture_output=True)
try:
    wait('the server', lambda: call('GET', '/System/Info/Public').get('Version'))
    wait('the startup wizard', lambda: call('GET', '/Startup/Configuration') is not None)
    password = secrets.token_urlsafe(16)
    call('POST', '/Startup/Configuration', {'UICulture': 'en-US', 'MetadataCountryCode': 'US', 'PreferredMetadataLanguage': 'en'})
    call('GET', '/Startup/User')
    call('POST', '/Startup/User', {'Name': 'admin', 'Password': password})
    call('POST', '/Startup/Complete')
    token = call('POST', '/Users/AuthenticateByName', {'Username': 'admin', 'Pw': password})['AccessToken']
    wait('the plugin', lambda: call('GET', '/RemoteAccess/Configuration', token=token) is not None)

    env = dict(os.environ, JELLYFIN_URL=ROOT, JELLYFIN_TOKEN=token, ACTIVITY_ROWS=str(len(TYPES)),
               JELLYFIN_USER=call('GET', '/Users/Me', token=token)['Id'], JELLYFIN_SERVER=call('GET', '/System/Info/Public')['Id'])
    shot = subprocess.Popen(['node', os.path.join(HERE, 'shoot.mjs'), 'Activity Log'], env=env)
    # The browser's own session entry comes first, so the plugin's entries are the newest rows.
    wait('the browser session', lambda: any(e['Type'] == 'SessionStarted' and 'Chrome' in e['Name']
                                            for e in call('GET', '/System/ActivityLog/Entries?limit=50', token=token)['Items']), 60)
    time.sleep(2)

    # Dynamic DNS: send the address again every 24 hours.
    ddns = call('GET', '/RemoteAccess/Configuration', token=token)
    ddns['ForceUpdateHours'] = 24
    call('POST', '/RemoteAccess/Configuration', ddns, token)
    # Proxy: a shorter HTTPS memory, with the proxy left off.
    proxy = call('GET', '/RemoteAccess/Proxy/Settings', token=token)
    proxy.setdefault('Advanced', {})['HstsMaxAgeDays'] = 30
    call('POST', '/RemoteAccess/Proxy/Settings', proxy, token)
    call('POST', '/RemoteAccess/People/Block?ip=203.0.113.7', token=token)
    call('POST', '/RemoteAccess/People/Settings', {'Enabled': True, 'HistoryDays': 30, 'Location': 'Country'}, token)
    if shot.wait(timeout=180) != 0:
        sys.exit('shoot.mjs failed.')
finally:
    subprocess.run(['docker', 'rm', '-f', NAME], capture_output=True)
    shutil.rmtree(work, ignore_errors=True)
