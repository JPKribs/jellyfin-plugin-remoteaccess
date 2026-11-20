// A stand-in ApiClient, LibraryMenu, and Dashboard with generic sample data for the Remote Access doc screenshots.
// Addresses are from the documentation ranges and names from example.com. The page's ?state= picks a variant of the
// status, named in STATES below.
window.__errs = [];
window.addEventListener('error', function (e) { __errs.push(String(e.message)); });
window.addEventListener('unhandledrejection', function (e) { __errs.push('rejection: ' + String(e.reason && e.reason.stack || e.reason)); });
(function () { var ce = console.error; console.error = function () { __errs.push([].join.call(arguments, ' ')); ce.apply(console, arguments); }; })();

var now = Date.now();
function ago(min) { return new Date(now - min * 60000).toISOString(); }
function ahead(min) { return new Date(now + min * 60000).toISOString(); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
var STATE = new URLSearchParams(location.search).get('state') || '';
var KEPT = '__JPK_DDNS_SECRET_KEPT__';
var HOST = 'media.example.com';
var PUBLIC_IP = '198.51.100.10';

// ===== Configuration: the one DDNS record and the detection settings =====

function record(o) {
    return Object.assign({
        Id: '5f0c2a7e9b1d4e3c8a6f2b4d7e9c1a03', Name: HOST, Provider: 'Cloudflare', Hostname: HOST, Enabled: true,
        UpdateIPv4: true, UpdateIPv6: false, Login: KEPT, Password: KEPT, Zone: 'example.com', Server: '', Ttl: 1,
        Proxied: false, Wildcard: false, Mx: '', BackupMx: false, Static: false,
        LastCheckedUtc: ago(12), LastSuccess: true, LastStatus: 'set to ' + PUBLIC_IP
    }, o);
}
var ddns = {
    Records: [STATE === 'dyndns'
        ? record({ Provider: 'DynDns2', Login: KEPT, Password: KEPT, Zone: '', Wildcard: true, Mx: 'mail.example.com' })
        : record({})],
    IPv4DetectionUrl: '', IPv6DetectionUrl: '', ForceUpdateHours: 0, SkipInternalAddresses: true,
    BackoffAfterFailures: 3, BackoffHours: 24, RequestTimeoutSeconds: 15,
    LastDetectedIPv4: PUBLIC_IP, LastDetectedIPv6: '', LastDetectionMessage: ''
};

// ===== Proxy settings and status =====

var proxySettings = {
    Enabled: true, Hostnames: [HOST],
    Certificate: { Mode: 'Automatic', Path: '', KeyPath: '', AcceptTerms: true, Password: '' },
    Advanced: { CountryMode: 'ServerCountry', Countries: ['CA'] }
};
var DEFAULT_VALUES = {
    HttpPort: 80, HttpsPort: 443, LanAddress: '', AutoPortForwarding: true, HstsEnabled: true, HstsMaxAgeDays: 180,
    SameOriginFramesOnly: true, JellyfinLoopbackOnly: false, TrustedNetworks: [], BlockedAddresses: [], BanFailures: 5,
    BanWindowMinutes: 10, BanMinutes: 60, CountryMode: 'ServerCountry', Countries: [], BlockUnknownCountries: false,
    BlockWithoutDatabase: false, EnableHttp2: true, KeepAliveSeconds: 130, RequestHeadersTimeoutSeconds: 15,
    MaxRequestHeadersKb: 32, MaxConnections: 2000, MaxConnectionsPerIp: 64, MaxRequestBodyMbWan: 100,
    MaxRequestBodyMbLan: 0, MinResponseBytesPerSecond: 240, BackendActivityTimeoutSeconds: 300
};
var defaults = {
    Values: DEFAULT_VALUES, Standard: DEFAULT_VALUES,
    LowMemory: Object.assign({}, DEFAULT_VALUES, { MaxConnections: 500, MaxConnectionsPerIp: 32, KeepAliveSeconds: 60 }),
    IsLowMemory: false, MemoryMb: 16384, LowMemoryBelowMb: 3072
};

function status() {
    var st = {
        Enabled: true, Running: true, StartedUtc: ago(300), Addresses: [], Error: '', Backend: 'http://127.0.0.1:8096',
        JellyfinHttpPort: 8096, JellyfinHttpsPort: 8920, JellyfinTrustsProxy: false, DisableFlagPresent: false, DisableFlagPath: '',
        Certificate: { Mode: 'Automatic', Loaded: true, Subject: 'CN=' + HOST, Issuer: 'CN=R11, O=Let\'s Encrypt, C=US',
            NotAfterUtc: ahead(60 * 24 * 74), NotBeforeUtc: ago(60 * 24 * 16), Names: [HOST], UncoveredHostnames: [], Error: '' },
        Acme: { Issuing: false, LastError: '', LastSuccessUtc: ago(60 * 24 * 16), NextAttemptUtc: null, RateLimited: false, Names: [HOST], Method: 'Http', DnsProviders: [] },
        TakeoverPhase: 'Unmanaged', TakeoverAppliedUtc: null, TakeoverError: '', DetectedLanAddress: '192.0.2.20',
        HttpPort: 80, HttpsPort: 443, LanAddress: '', PublicUrl: 'https://' + HOST, CountryRefused: { CN: 9, RU: 3 },
        CountryDatabaseLoaded: true, ServerCountry: 'United States', JellyfinExposedAt: '', CountryRule: 'ServerCountry',
        FolderProblem: '', EveryoneLooksLocal: false,
        Router: { Enabled: false, Method: '', Mapped: false, Ports: [], Device: '', DeviceIsGateway: false, LanAddress: '192.0.2.20',
            ExternalAddress: '', BehindCgnat: false, CgnatReason: '', Error: '', RenewedUtc: null },
        Name: { Hostname: HOST, Resolves: true, Addresses: [PUBLIC_IP], PublicAddress: PUBLIC_IP, Error: '' },
        Reachability: { CheckedUtc: null, Reachable: null, Error: '', Nodes: [] }
    };
    if (STATE === 'cgnat') {
        st.Router = { Enabled: true, Method: 'UPnP', Mapped: false, Ports: [], Device: '192.0.2.1', DeviceIsGateway: true, LanAddress: '192.0.2.20',
            ExternalAddress: '203.0.113.99', BehindCgnat: true, CgnatReason: 'Shared', Error: '', RenewedUtc: null };
    }
    if (STATE === 'reach') {
        st.Router = { Enabled: true, Method: 'UPnP', Mapped: true, Ports: [80, 443], Device: '192.0.2.1', DeviceIsGateway: true,
            LanAddress: '192.0.2.20', ExternalAddress: PUBLIC_IP, BehindCgnat: false, CgnatReason: '', Error: '', RenewedUtc: ago(20) };
        st.TakeoverPhase = 'Managed';
        st.JellyfinTrustsProxy = true;
        st.Reachability = { CheckedUtc: ago(2), Reachable: true, Error: '', Nodes: [
            { Location: 'Frankfurt, Germany', Ok: true, Error: '' },
            { Location: 'London, United Kingdom', Ok: true, Error: '' },
            { Location: 'Tokyo, Japan', Ok: true, Error: '' }
        ] };
    }
    return st;
}

// ===== People: the Dashboard tab =====

function row(type, user, ip, device, country, code, min, o) {
    return Object.assign({ Type: type, User: user, Ip: ip, Device: device, Host: 'https://' + HOST, CountryCode: code, Country: country,
        City: '', IsLocal: false, LastUtc: ago(min), Count: 1, Reason: null, Listed: false, Covered: false, Banned: false,
        CountryBlocked: false, Exempt: false }, o);
}
var activity = [
    row('User', 'alex', '192.0.2.20', 'Desktop, Jellyfin Web', '', '', 4, { IsLocal: true, Exempt: true, Host: 'http://192.0.2.20:8096' }),
    row('User', 'jordan', '198.51.100.24', 'Phone, Jellyfin Mobile', 'United States', 'US', 18),
    row('Blocked', '', '203.0.113.77', '', 'China', 'CN', 41, { CountryBlocked: true }),
    row('Failure', 'admin', '203.0.113.7', 'Firefox, Linux', 'Netherlands', 'NL', 66, { Banned: true }),
    row('User', 'sam', '198.51.100.52', 'Living Room TV, Jellyfin Android TV', 'Canada', 'CA', 95),
    row('Blocked', '', '203.0.113.140', '', 'Russia', 'RU', 130, { CountryBlocked: true }),
    row('Seen', '', '192.0.2.188', 'python-requests', 'Singapore', 'SG', 210),
    row('Failure', 'jordan', '198.51.100.24', 'Phone, Jellyfin Mobile', 'United States', 'US', 260),
    row('User', 'alex', '198.51.100.31', 'Laptop, Jellyfin Media Player', 'Germany', 'DE', 480),
    row('Blocked', '', '203.0.113.201', '', 'Brazil', 'BR', 760, { Listed: true }),
    row('User', 'sam', '198.51.100.52', 'Tablet, Jellyfin Web', 'Canada', 'CA', 1500)
];
var people = {
    Activity: activity,
    Banned: [
        { Ip: '203.0.113.7', CountryCode: 'NL', Country: 'Netherlands', Failures: 5, BannedUtc: ago(64), UntilUtc: ahead(56) },
        { Ip: '203.0.113.58', CountryCode: 'RU', Country: 'Russia', Failures: 8, BannedUtc: ago(190), UntilUtc: null }
    ],
    PeopleByCountry: [
        { CountryCode: 'US', Country: 'United States', Count: 4, LastUtc: ago(18) },
        { CountryCode: 'CA', Country: 'Canada', Count: 2, LastUtc: ago(95) },
        { CountryCode: 'DE', Country: 'Germany', Count: 1, LastUtc: ago(480) }
    ],
    FailedByCountry: [
        { CountryCode: 'NL', Country: 'Netherlands', Count: 5, LastUtc: ago(66) },
        { CountryCode: 'US', Country: 'United States', Count: 1, LastUtc: ago(260) },
        { CountryCode: 'RU', Country: 'Russia', Count: 8, LastUtc: ago(190) }
    ],
    BlockedByCountry: [
        { CountryCode: 'CN', Country: 'China', Count: 9, LastUtc: ago(41) },
        { CountryCode: 'RU', Country: 'Russia', Count: 3, LastUtc: ago(130) },
        { CountryCode: 'BR', Country: 'Brazil', Count: 1, LastUtc: ago(760) }
    ],
    Settings: { Enabled: true, HistoryDays: 90, Location: 'Country' },
    Recording: true,
    Location: { Detail: 'Country', Loaded: true, BuiltUtc: ago(60 * 24 * 12), Error: '', Downloading: false },
    Attribution: 'IP geolocation by DB-IP'
};

function peopleFor(url) {
    var q = new URLSearchParams(url.split('?')[1] || '');
    var type = q.get('type'), place = q.get('place');
    var d = clone(people);
    d.Activity = d.Activity.filter(function (r) {
        if (type && r.Type !== type) return false;
        if (place === 'local') return r.IsLocal;
        if (place) return r.CountryCode === place;
        return true;
    });
    return d;
}

// ===== The ApiClient the pages call =====

function answer(url, type) {
    var path = url.replace(/^\/RemoteAccess\//, '').split('?')[0];
    switch (path) {
        case 'Configuration': return ddns;
        case 'Share': return { Url: 'https://' + HOST, HomeOnly: false };
        case 'People': return peopleFor(url);
        case 'Proxy/Settings': return type === 'GET' ? proxySettings : { Settings: proxySettings, Status: status(), Restart: '' };
        case 'Proxy/Status': return status();
        case 'Proxy/Defaults': return defaults;
        case 'Proxy/DdnsHostnames': return [{ RecordId: ddns.Records[0].Id, Hostname: HOST }];
        default: return {};
    }
}

window.ApiClient = {
    serverAddress: function () { return location.origin; },
    getUrl: function (p) { return '/' + String(p).replace(/^\//, ''); },
    getCurrentUserId: function () { return '3f0c9a1e5b7d4c2a8e6f1b3d5a7c9e01'; },
    getPluginConfiguration: function () { return Promise.resolve({}); },
    updatePluginConfiguration: function () { return Promise.resolve({}); },
    getUsers: function () { return Promise.resolve([]); },
    getScheduledTasks: function () { return Promise.resolve([]); },
    getJSON: function (url) { return ApiClient.fetch({ url: url, type: 'GET' }); },
    ajax: function (o) { return ApiClient.fetch(o); },
    fetch: function (o) {
        var url = o.url || '';
        // The provider list comes from the server, which reads it from the plugin's provider classes.
        if (/\/RemoteAccess\/Providers/.test(url)) return fetch(url).then(function (r) { return r.json(); });
        return Promise.resolve(clone(answer(url, o.type || 'GET')));
    },
    getUserImageUrl: function () { return ''; },
    sendMessage: function () {}, sendWebSocketMessage: function () {}
};
window.Dashboard = { alert: function (m) { console.error('Dashboard.alert used: ' + m); }, processPluginConfigurationUpdateResult: function () {}, showLoadingMsg: function () {}, hideLoadingMsg: function () {} };

// Draws the dashboard header and its tabs, as Jellyfin's LibraryMenu.setTabs does for a plugin page.
window.LibraryMenu = {
    setTabs: function (key, index, getTabs) {
        var tabs = typeof getTabs === 'function' ? getTabs() : getTabs;
        var host = document.getElementById('jfTabs');
        if (!host) return;
        host.innerHTML = (tabs || []).map(function (t, i) {
            return '<a class="jfTab' + (i === index ? ' jfTabActive' : '') + '">' + t.name + '</a>';
        }).join('');
    }
};
