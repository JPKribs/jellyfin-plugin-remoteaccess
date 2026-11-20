"""Remote Access screenshot server: serves the plugin pages, Base and jellyfin-web the way Jellyfin does, and answers
RemoteAccess/Translations and RemoteAccess/Providers the way the plugin does.

Usage: python3 -I server.py [port]   (default 8866)
Base comes from the NuGet cache at the version the plugin's csproj names. The strings come from the plugin's last
build in obj/, so run dotnet build on the plugin first. JELLYFIN_WEB picks the jellyfin-web folder.
"""
import glob, http.server, json, os, re, sys, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__))
PLUGIN = os.path.abspath(os.path.join(HERE, '..', '..', 'Jellyfin.Plugin.RemoteAccess'))
WEB = os.path.join(PLUGIN, 'Web')
JF = os.environ.get('JELLYFIN_WEB', '/Applications/Jellyfin.app/Contents/Resources/jellyfin-web')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8866
BASEVER = re.search(r'Include="JPKribs\.Jellyfin\.Base"\s+Version="([^"]+)"', open(os.path.join(PLUGIN, 'Jellyfin.Plugin.RemoteAccess.csproj')).read()).group(1)
BASE = os.path.expanduser('~/.nuget/packages/jpkribs.jellyfin.base/%s/assets' % BASEVER.lower())
TYPES = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.woff2': 'font/woff2',
         '.woff': 'font/woff', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.png': 'image/png'}


def built_strings():
    """The newest strings the plugin's build wrote: every language file and the casing list, in obj/."""
    found = sorted(glob.glob(os.path.join(PLUGIN, 'obj', '*', '*', 'base-translations', 'languages', 'en-us.json')), key=os.path.getmtime)
    if not found:
        sys.exit('No built strings in %s. Run dotnet build on the plugin first.' % os.path.join(PLUGIN, 'obj'))
    return os.path.dirname(found[-1]), os.path.join(os.path.dirname(os.path.dirname(found[-1])), 'casing.json')


for path, what in ((BASE, 'Base %s (run dotnet restore on the plugin)' % BASEVER), (os.path.join(JF, 'index.html'), 'jellyfin-web (set JELLYFIN_WEB)')):
    if not os.path.exists(path):
        sys.exit('Missing %s: %s' % (what, path))
LANGUAGES, CASING = built_strings()


def translations(language):
    """What GET RemoteAccess/Translations answers: the plugin's strings, the Jellyfin strings it declares and Base's own,
    in one language with US English behind it, and the casing list."""
    english = json.load(open(os.path.join(LANGUAGES, 'en-us.json'), encoding='utf-8'))
    path = os.path.join(LANGUAGES, '%s.json' % language)
    strings = dict(english, **json.load(open(path, encoding='utf-8'))) if language != 'en-us' and os.path.isfile(path) else english
    casing = json.load(open(CASING, encoding='utf-8')) if os.path.isfile(CASING) else []
    return {'language': language, 'strings': strings, 'casing': casing}


def providers():
    """What GET RemoteAccess/Providers answers, read from each provider's class: its kind, label, hint and fields, with
    the strings in US English, sorted by label."""
    english = json.load(open(os.path.join(LANGUAGES, 'en-us.json'), encoding='utf-8'))
    out = []
    for path in glob.glob(os.path.join(PLUGIN, 'Providers', 'Implementations', '*.cs')):
        src = open(path, encoding='utf-8').read()
        kind = re.search(r'Kind => DNSProviderKind\.(\w+);', src)
        label = re.search(r'Label => "([^"]+)";', src)
        hint = re.search(r'Hint => TranslationKeys\.(\w+);', src)
        body = re.search(r'ProviderFields Fields => new\(\)\s*\{(.*?)\};', src, re.S)
        if not (kind and label and body):
            continue
        fields = {'Hostname': None, 'Login': None, 'Password': None, 'Zone': None, 'Server': False, 'Ttl': False, 'IPv6': True, 'Advanced': []}
        for name, value in re.findall(r'(\w+)\s*=\s*(TranslationKeys\.\w+|true|false|new\[\]\s*\{[^}]*\})', body.group(1)):
            if value.startswith('TranslationKeys.'):
                fields[name] = english.get(value.split('.', 1)[1], value)
            elif value in ('true', 'false'):
                fields[name] = value == 'true'
            else:
                fields[name] = re.findall(r'"([^"]+)"', value)
        out.append({'value': kind.group(1), 'label': label.group(1), 'hint': english.get(hint.group(1), '') if hint else '', 'fields': fields})
    return sorted(out, key=lambda p: p['label'].lower())


def stylesheets():
    """jellyfin-web's stylesheets in load order: index.html's own, the dark theme, then every chunk. A chunk that sets
    the root font to anything but the dashboard's 93% belongs to another layout, such as TV, and is left out."""
    head = re.findall(r'href="([^"?]+\.css)', open(os.path.join(JF, 'index.html')).read())
    rest = []
    for name in sorted(os.listdir(JF)):
        if not name.endswith('.css') or name in head:
            continue
        sizes = re.findall(r'html\{[^}]*?font-size:([^;}!]+)', open(os.path.join(JF, name), encoding='utf-8', errors='ignore').read())
        if any(size.strip() != '93%' for size in sizes):
            continue
        rest.append(name)
    return ''.join('<link rel="stylesheet" href="/jf/%s">' % n for n in head + ['themes/dark/theme.css'] + rest)


class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        if u.path == '/RemoteAccess/Translations':
            return self.send(json.dumps(translations((q.get('language') or ['en-us'])[0])).encode(), 'application/json')
        if u.path == '/RemoteAccess/Providers':
            return self.send(json.dumps(providers()).encode(), 'application/json')
        if u.path.endswith('configurationpage') and 'name' in q:
            name = q['name'][0]
            if 'jpkribs_shared' in name:
                path = os.path.join(BASE, 'jpkribs_shared' + os.path.splitext(name)[1])
            else:
                path = os.path.join(WEB, name if '.' in name else name + '.html')
        elif u.path.startswith('/jf/'):
            path = os.path.join(JF, urllib.parse.unquote(u.path[4:]))
        else:
            path = os.path.join(HERE, u.path.lstrip('/') or 'index.html')
        if not os.path.isfile(path):
            return self.send_error(404)
        data = open(path, 'rb').read()
        if path.endswith('.html') and os.path.dirname(path) == HERE:
            data = data.replace(b'<!--STYLESHEETS-->', stylesheets().encode())
        self.send(data, TYPES.get(os.path.splitext(path)[1], 'application/octet-stream'))

    def send(self, data, kind):
        self.send_response(200)
        self.send_header('Content-Type', kind)
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)


http.server.ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
