// remoteaccess_tabs.js
// What every Remote Access page shares, kept in one place so the pages never disagree.

import { createConfigPage, confirmDialog, createTranslations, formatText, loadTranslations, setTabs, SECRET_KEPT } from './configurationpage?name=remoteaccess_jpkribs_shared.js';

export const PLUGIN_ID = '8150dce5-6153-4924-a985-a6927be95baa';

// The endpoint the pages load their strings from.
export const TRANSLATIONS_URL = 'RemoteAccess/Translations';

// The tab bar, with each tab's English for the moment before the strings load. Each page passes its own position
// here as its tabIndex.
export const TABS = [
    { href: 'configurationpage?name=remoteaccess_dashboard', nameKey: 'TabDashboard', name: 'Dashboard' },
    { href: 'configurationpage?name=remoteaccess_configuration', nameKey: 'TabConfiguration', name: 'Configuration' },
    { href: 'configurationpage?name=remoteaccess_advanced', nameKey: 'TabAdvanced', name: 'Advanced' }
];

// The page's strings in the viewer's language. Empty until translatedPage loads them, so a string read too early
// shows its key.
export let t = createTranslations({});

// setTranslations
// Sets the strings every helper here reads, as translatedPage does once they load.
//
// Inputs
// handle [object]: A translations handle from loadTranslations or createTranslations.
export function setTranslations(handle) {
    t = handle;
}

// tabs
// The tab bar in the viewer's language, or in English before the strings load.
//
// Output
// [object[]]: Tabs of { href, name }.
export function tabs() {
    return TABS.map(function (tab) { return { href: tab.href, name: t.tr(tab.nameKey, tab.name) }; });
}

// translatedPage
// Wires a config page with createConfigPage once its strings have loaded. The markup is translated first, then
// bind and load run, so every component is built in the viewer's language. The English markup shows until then.
//
// Inputs
// view [HTMLElement]: The page element.
// opts [object]: The createConfigPage options. Its tabs are the shared tab bar.
//
// Output
// [object]: The page handle createConfigPage returns.
export function translatedPage(view, opts) {
    var visible = false;
    var bound = null;
    view.addEventListener('viewshow', function () { visible = true; });
    view.addEventListener('viewhide', function () { visible = false; });
    var ready = loadTranslations(TRANSLATIONS_URL).then(function (handle) {
        setTranslations(handle);
        handle.apply(view);
        if (visible) setTabs(opts.tabsKey, opts.tabIndex || 0, tabs);
    });
    return createConfigPage(view, Object.assign({}, opts, {
        tabs: tabs,
        bind: function (shared, page) {
            bound = ready.then(function () { if (opts.bind) opts.bind(shared, page); });
        },
        load: function (shared, page) {
            // A page left before its strings loaded starts no poller, since its cleanups already ran.
            bound.then(function () { if (visible && opts.load) opts.load(shared, page); });
        }
    }));
}

// saveBarText
// The Save Bar's words in the viewer's language, for createSaveBar.
//
// Output
// [object]: { saveText, pendingText, savingText, savedText, failedText, invalidText }.
export function saveBarText() {
    return {
        saveText: t.tr('Save'),
        pendingText: t.tr('SaveBarPending'),
        savingText: t.tr('SaveBarSaving'),
        savedText: t.tr('MessageChangesSaved'),
        failedText: t.tr('ErrorSave'),
        invalidText: t.tr('SaveBarInvalid')
    };
}

// tableText
// A Data Table's own words in the viewer's language, for createDataTable.
//
// Output
// [object]: { allText, resizeText }, where {label} and {value} are filled by the table.
export function tableText() {
    return { allText: t.tr('TableAll'), resizeText: t.tr('TableResize') };
}

// listText
// Joins names into a list in the viewer's language, such as "80 and 443".
//
// Inputs
// items [any[]]: The names.
//
// Output
// [string]: The list.
export function listText(items) {
    var list = (items || []).map(String);
    try {
        return new Intl.ListFormat(t.language || 'en', { type: 'conjunction' }).format(list);
    } catch (e) {
        return list.join(', ');
    }
}

// linkHtml
// A link for a sentence built with htmlFormat, named by a string.
//
// Inputs
// shared [object]: The shared bag, for escapeHtml.
// href [string]: Where it goes. A link off the dashboard opens in a new tab.
// key [string]: The key of the link's text.
//
// Output
// [string]: The link as HTML.
export function linkHtml(shared, href, key) {
    var external = /^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
    return '<a class="ra-link" href="' + shared.escapeHtml(href) + '"' + external + '>' + shared.escapeHtml(t.tr(key)) + '</a>';
}

// htmlFormat
// Fills a string's placeholders with HTML, with the string itself escaped, for a sentence that holds bold text.
//
// Inputs
// shared [object]: The shared bag, for escapeHtml.
// key [string]: The string's key.
// args [string[]]: HTML for each placeholder.
//
// Output
// [string]: The sentence as HTML.
export function htmlFormat(shared, key, args) {
    return formatText.apply(null, [shared.escapeHtml(t.tr(key))].concat(args || []));
}

// problemText
// Reads the problems out of a failed save, which this plugin's endpoints list in Errors, or falls back to a message.
//
// Inputs
// err [any]: The rejected request.
// fallback [string]: The message when the reply names no problem.
//
// Output
// [Promise<string>]: The message to show.
export function problemText(err, fallback) {
    if (err && typeof err.json === 'function') {
        return err.json().then(function (body) {
            return body && body.Errors && body.Errors.length ? body.Errors.join(' ') : fallback;
        }).catch(function () { return fallback; });
    }
    return Promise.resolve(fallback);
}

// Puts a message in a box and shows the box, or hides it when there is no message.
export function showText(shared, id, text) {
    var el = shared.getEl(id);
    el.textContent = text || '';
    shared.setVisible(el, !!text);
}

// Trust the Proxy, as step 5 of the Configuration tab offers it: confirm, run an optional step first such as saving
// the form, then ask Jellyfin to trust the proxy. Resolves to true once Jellyfin answered that it worked.
export function trustTheProxy(shared, statusId, prepare) {
    var options = { title: t.tr('HeaderTrustProxy'), confirmText: t.tr('ButtonTrust'), cancelText: t.tr('ButtonCancel') };
    return confirmDialog(t.tr('ConfirmTrustProxy'), options).then(function (ok) {
        if (!ok) return false;
        return Promise.resolve(prepare ? prepare() : true).then(function (ready) {
            if (!ready) return false;
            shared.setStatus(statusId, t.tr('StatusCheckingProxy'), false, { timeout: 0 });
            return shared.apiRequest('Proxy/TakeOver', 'POST').then(function (result) {
                var worked = !!(result && result.Success);
                shared.setStatus(statusId, (result && result.Message) || t.tr('MessageDone'), !worked, { timeout: 0 });
                return worked;
            }).catch(function () {
                shared.setStatus(statusId, t.tr('ErrorTrustProxy'), true, { timeout: 0 });
                return false;
            });
        });
    });
}

// What to forward on the router by hand, as HTML built from the status.
export function routerInstructionHtml(shared, st) {
    var cert = st.Certificate || {};
    var lan = st.LanAddress || st.DetectedLanAddress || t.tr('TextThisServer');
    var bold = function (value) { return '<strong>' + shared.escapeHtml(String(value)) + '</strong>'; };
    // The internet always uses 80 and 443. Only a changed proxy port needs the router to translate.
    var external = st.HttpPort === 80 && st.HttpsPort === 443
        ? htmlFormat(shared, 'RouterForwardPorts', [bold(80), bold(443), bold(lan)])
        : htmlFormat(shared, 'RouterForwardChangedPorts', [bold(443), bold(lan), bold(st.HttpsPort), bold(80), bold(st.HttpPort)]);
    var test = st.PublicUrl
        ? '<br>' + htmlFormat(shared, 'RouterTestFromPhone', ['<span class="base-mono">' + shared.escapeHtml(st.PublicUrl) + '</span>'])
        : '';
    // Port 80 sends http:// links on to HTTPS, and is where Let's Encrypt checks the address.
    var httpCheck = cert.Mode === 'Automatic' && (st.Acme || {}).Method !== 'Dns';
    var port80 = '<br>' + shared.escapeHtml(t.tr(httpCheck ? 'RouterPort80Check' : 'RouterPort80'));
    return external + port80 + test;
}

// What the router's automatic forwarding is doing, in a sentence or two. Empty when the server does not say.
export function routerStateText(router) {
    if (!router) return '';
    if (router.BehindCgnat) return t.tr('RouterBehindCgnat');
    if (router.Mapped) {
        // Any device on the network can answer a UPnP search, so the one that did is named for the person to check.
        var ports = (router.Ports || []).length ? t.format('RouterPortList', listText(router.Ports)) : t.tr('RouterThePorts');
        var text = router.Device
            ? (router.Method ? t.format('RouterMappedDeviceMethod', router.Device, router.Method, ports) : t.format('RouterMappedDevice', router.Device, ports))
            : (router.Method ? t.format('RouterMappedMethod', router.Method, ports) : t.format('RouterMapped', ports));
        if (router.Device && !router.DeviceIsGateway) text += ' ' + t.tr('RouterNotGateway');
        return text + ' ' + t.tr('RouterConfirmRule');
    }
    if (!router.Enabled) return t.tr('RouterAutomaticOff');
    return t.tr('RouterNotOpenedAutomatically');
}

// ===== The DDNS record =====

// A server keeps one DDNS record. When an older setup saved several, the one shown and kept is the first enabled
// record, else the first. The rest are dropped on the next save.
export function primaryRecord(records) {
    var list = records || [];
    return list.find(function (r) { return r && r.Enabled !== false; }) || list[0] || null;
}

// Every field a provider can use, for a provider this page does not know.
function defaultFields() {
    return { h: t.tr('LabelHostname'), l: t.tr('GuideProviderLogin'), p: t.tr('LabelPassword'), z: t.tr('LabelZone'), s: true, t: true, v6: true, a: ['wildcard', 'static', 'mx', 'backupmx'] };
}

// The provider list, hints and the fields each provider uses, from GET RemoteAccess/Providers, so each provider's
// fields are defined once, in its C# class. Resolves to { options, hints, specFor, normalize }.
export function loadProviders(shared) {
    return shared.apiRequest('Providers', 'GET').then(function (list) {
        list = list || [];
        var values = list.map(function (p) { return p.value; });
        var hints = {};
        var fields = {};
        list.forEach(function (p) {
            hints[p.value] = p.hint || '';
            var f = p.fields || {};
            fields[p.value] = {
                h: f.Hostname || null, l: f.Login || null, p: f.Password || null,
                z: f.Zone || null, s: !!f.Server, t: !!f.Ttl, v6: f.IPv6 !== false, a: f.Advanced || []
            };
        });
        return {
            options: list.map(function (p) { return [p.value, p.label]; }),
            hints: hints,
            specFor: function (provider) { return fields[provider] || defaultFields(); },
            normalize: function (value) {
                if (typeof value === 'number') return values[value] || 'Cloudflare';
                return values.indexOf(value) >= 0 ? value : 'Cloudflare';
            }
        };
    });
}

// The DDNS endpoints keep their own credential markers. A bound secret field reads the shared kept marker while
// untouched and empty once cleared, so both are turned into the markers the DDNS endpoints know.
var DDNS_KEPT = '__JPK_DDNS_SECRET_KEPT__';
var DDNS_CLEAR = '__JPK_DDNS_SECRET_CLEAR__';

export function readDdnsSecret(shared, id) {
    var el = shared.getEl(id);
    var value = shared.readSecretField(id);
    if (value === SECRET_KEPT) return DDNS_KEPT;
    if (!value && el.dataset.baseSecretCleared) return DDNS_CLEAR;
    return value;
}

// ===== The proxy's addresses =====

// The proxy answers on the names the DDNS record covers followed by any other addresses, so Configuration and
// Advanced build the list the same way and never undo each other.

function cleanName(name) {
    return String(name || '').trim().toLowerCase().replace(/\.$/, '');
}

// Addresses typed one per line, cleaned the way the server stores them.
export function addressLines(text) {
    return String(text || '').split(/\r?\n/).map(cleanName).filter(function (x) { return x; });
}

// The names the record covers, its own name and the wildcard under it when it updates one, as the server works
// them out. With no record id, the names of every record.
export function recordNames(shared, recordId) {
    return shared.apiRequest('Proxy/DdnsHostnames', 'GET').then(function (items) {
        return (items || []).filter(function (h) { return !recordId || h.RecordId === recordId; })
            .map(function (h) { return cleanName(h.Hostname); });
    });
}

// The stored addresses that are not the record's names.
export function otherAddresses(hostnames, names) {
    return (hostnames || []).map(cleanName).filter(function (n) { return n && names.indexOf(n) < 0; });
}

// The record's names followed by the other addresses, without duplicates.
export function proxyHostnames(names, others) {
    return (names || []).concat(others || []).map(cleanName)
        .filter(function (n, i, all) { return n && all.indexOf(n) === i; });
}

// Saves the proxy settings with its addresses: the names the saved record covers now, followed by the other
// addresses. Without others given, they are the stored addresses that were not the record's names before the
// change. A mutate callback may change the rest of the freshly read settings first. Resolves to the server's reply.
export function saveProxyHostnames(shared, namesBefore, others, mutate) {
    return Promise.all([recordNames(shared), shared.apiRequest('Proxy/Settings', 'GET')]).then(function (results) {
        var fresh = results[1];
        if (!fresh) { throw new Error('settings unavailable'); }
        var kept = others || otherAddresses(fresh.Hostnames, namesBefore || []);
        if (mutate) fresh = mutate(fresh) || fresh;
        fresh.Hostnames = proxyHostnames(results[0], kept);
        return shared.apiRequest('Proxy/Settings', 'POST', fresh);
    });
}

// ===== The Dashboard's map and country table =====

// The map's layers, one per kind of count, in the colors the Activity badges use for the same kinds.
export const MAP_LAYERS = [
    { key: 'people', labelKey: 'HeaderUsers', color: 'blue', field: 'PeopleByCountry', column: 'users', icon: 'person' },
    { key: 'failed', labelKey: 'HeaderFailures', color: 'red', field: 'FailedByCountry', column: 'failures', icon: 'warning' },
    { key: 'blocked', labelKey: 'HeaderBlocked', color: 'purple', field: 'BlockedByCountry', column: 'blocked', icon: 'block' }
];

// countryCounts
// Turns the People totals into the world map's counts, by country code and then by layer.
//
// Inputs
// data [object]: The People reply, with PeopleByCountry, FailedByCountry and BlockedByCountry.
//
// Output
// [object]: { CODE: { people, failed, blocked } } with only the kinds that have a count.
export function countryCounts(data) {
    var counts = {};
    MAP_LAYERS.forEach(function (layer) {
        ((data && data[layer.field]) || []).forEach(function (t) {
            if (!t || !t.CountryCode || !t.Count) return;
            (counts[t.CountryCode] = counts[t.CountryCode] || {})[layer.key] = t.Count;
        });
    });
    return counts;
}

// countryRows
// One row per country for the table beside the map, counting only the layers that are on, most first.
//
// Inputs
// data [object]: The People reply.
// active [string[]]: The map layers that are on.
//
// Output
// [object[]]: Rows of { code, name, users, failures, blocked, total, last }, without countries that have nothing.
export function countryRows(data, active) {
    var rows = {};
    MAP_LAYERS.forEach(function (layer) {
        if ((active || []).indexOf(layer.key) < 0) return;
        ((data && data[layer.field]) || []).forEach(function (t) {
            if (!t || !t.CountryCode || !t.Count) return;
            var r = rows[t.CountryCode] || (rows[t.CountryCode] = {
                code: t.CountryCode, name: t.Country || t.CountryCode, users: 0, failures: 0, blocked: 0, total: 0, last: t.LastUtc
            });
            r[layer.column] = t.Count;
            r.total += t.Count;
            if (Date.parse(t.LastUtc) > Date.parse(r.last)) r.last = t.LastUtc;
        });
    });
    return Object.keys(rows).map(function (k) { return rows[k]; }).sort(function (x, y) {
        return y.total - x.total || x.name.localeCompare(y.name);
    });
}

// countryFilterOptions
// The choices of the Activity table's country filter: your network, then every country with any activity, from
// the full totals rather than the rows shown, by name.
//
// Inputs
// data [object]: The People reply.
// picked [string]: The country picked now, kept as a choice even when it has dropped out of the totals.
//
// Output
// [object[]]: Options of { value, label }.
export function countryFilterOptions(data, picked) {
    var names = {};
    MAP_LAYERS.forEach(function (layer) {
        ((data && data[layer.field]) || []).forEach(function (t) {
            if (t && t.CountryCode) names[t.CountryCode] = t.Country || t.CountryCode;
        });
    });
    if (picked && picked !== 'local' && !names[picked]) names[picked] = picked;
    var codes = Object.keys(names).sort(function (a, b) { return names[a].localeCompare(names[b]); });
    return [{ value: 'local', label: t.tr('OptionLocal') }].concat(codes.map(function (c) { return { value: c, label: names[c] }; }));
}

// activityQuery
// The path the Activity table asks for. The server applies the filters, so a flood of one kind never hides another
// behind the row limit.
//
// Inputs
// filters [object]: The Activity table's filters by name, each a list of picked values.
//
// Output
// [string]: The People path with its query.
export function activityQuery(filters) {
    var type = ((filters && filters.type) || [])[0] || '';
    var place = ((filters && filters.place) || [])[0] || '';
    var query = [];
    if (type) query.push('type=' + encodeURIComponent(type));
    if (place) query.push('place=' + encodeURIComponent(place));
    return 'People' + (query.length ? '?' + query.join('&') : '');
}

// ===== The Configuration checklist =====

// stepState
// The Setup Checklist state for a step's assessment. Green is done, orange and red need attention, a step that waits
// for the proxy is optional, and anything else is still to do.
//
// Inputs
// result [object]: { state, idle } where state is green, amber, red or gray.
//
// Output
// [string]: done, attention, optional or todo.
export function stepState(result) {
    if (!result) return 'todo';
    if (result.state === 'green') return 'done';
    if (result.state === 'amber' || result.state === 'red') return 'attention';
    return result.idle ? 'optional' : 'todo';
}
