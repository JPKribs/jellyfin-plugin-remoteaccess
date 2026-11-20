// remoteaccess_tabs.js
// What every Remote Access page shares, kept in one place so the pages never disagree.

import { confirmDialog, SECRET_KEPT } from './configurationpage?name=remoteaccess_jpkribs_shared.js';

export const PLUGIN_ID = '8150dce5-6153-4924-a985-a6927be95baa';

// The tab bar. Each page passes its own position here as its tabIndex.
export const TABS = [
    { href: 'configurationpage?name=remoteaccess_dashboard', name: 'Dashboard' },
    { href: 'configurationpage?name=remoteaccess_configuration', name: 'Configuration' },
    { href: 'configurationpage?name=remoteaccess_advanced', name: 'Advanced' }
];

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
    var message = 'Trust the proxy? Jellyfin adds this machine to its known proxies, turns on remote access and restarts once, with its ports unchanged. ' +
        'Forward only ports 80 and 443 to this server, since anyone who reaches Jellyfin\'s own ports directly gets past the proxy.';
    return confirmDialog(message, { title: 'Trust the Proxy', confirmText: 'Trust' }).then(function (ok) {
        if (!ok) return false;
        return Promise.resolve(prepare ? prepare() : true).then(function (ready) {
            if (!ready) return false;
            shared.setStatus(statusId, 'Checking the proxy can reach Jellyfin…', false, { timeout: 0 });
            return shared.apiRequest('Proxy/TakeOver', 'POST').then(function (result) {
                var worked = !!(result && result.Success);
                shared.setStatus(statusId, (result && result.Message) || 'Done.', !worked, { timeout: 0 });
                return worked;
            }).catch(function () {
                shared.setStatus(statusId, 'Trusting the proxy failed.', true, { timeout: 0 });
                return false;
            });
        });
    });
}

// What to forward on the router by hand, as HTML built from the status.
export function routerInstructionHtml(shared, st) {
    var cert = st.Certificate || {};
    var lan = st.LanAddress || st.DetectedLanAddress || 'this server';
    // The internet always uses 80 and 443. Only a changed proxy port needs the router to translate.
    var target = '<strong>' + shared.escapeHtml(lan) + '</strong>';
    var external = st.HttpPort === 80 && st.HttpsPort === 443
        ? 'Forward TCP ports <strong>80</strong> and <strong>443</strong> to ' + target + '.'
        : 'Forward TCP port <strong>443</strong> to ' + target + ' port <strong>' + st.HttpsPort + '</strong>, and port <strong>80</strong> to port <strong>' + st.HttpPort + '</strong>.';
    var test = st.PublicUrl
        ? '<br>Then open <span class="base-mono">' + shared.escapeHtml(st.PublicUrl) + '</span> on a phone with Wi-Fi turned off.'
        : '';
    // Port 80 sends http:// links on to HTTPS, and is where Let's Encrypt checks the address.
    var httpCheck = cert.Mode === 'Automatic' && (st.Acme || {}).Method !== 'Dns';
    var port80 = '<br>Port 80 sends http:// links on to HTTPS' + (httpCheck ? ' and lets Let\'s Encrypt check your address.' : '.');
    return external + port80 + test;
}

// What the router's automatic forwarding is doing, in a sentence or two. Empty when the server does not say.
export function routerStateText(router) {
    if (!router) return '';
    if (router.BehindCgnat) return 'Your provider shares your public IP, so the internet cannot reach this server. Ask them for a public IP.';
    if (router.Mapped) {
        // Any device on the network can answer a UPnP search, so the one that did is named for the person to check.
        var ports = (router.Ports || []).join(' and ');
        var who = router.Device ? 'The device at ' + router.Device : 'A device on your network';
        var text = who + ' answered' + (router.Method ? ' through ' + router.Method : '') + ' and says it forwards ' +
            (ports ? 'ports ' + ports : 'the ports') + ' to this server.';
        if (router.Device && !router.DeviceIsGateway) text += ' It is not this server\'s default gateway, so check it is your router.';
        return text + ' Confirm the rule on your router\'s port forwarding page.';
    }
    if (!router.Enabled) return 'Automatic port forwarding is off.';
    return 'The router did not open the ports automatically.';
}

// ===== The DDNS record =====

// A server keeps one DDNS record. When an older setup saved several, the one shown and kept is the first enabled
// record, else the first. The rest are dropped on the next save.
export function primaryRecord(records) {
    var list = records || [];
    return list.find(function (r) { return r && r.Enabled !== false; }) || list[0] || null;
}

// Every field a provider can use, for a provider this page does not know.
var DEFAULT_FIELDS = { h: 'Hostname', l: 'Login', p: 'Password', z: 'Zone', s: true, t: true, v6: true, a: ['wildcard', 'static', 'mx', 'backupmx'] };

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
            specFor: function (provider) { return fields[provider] || DEFAULT_FIELDS; },
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
    { key: 'people', label: 'Users', color: 'blue', field: 'PeopleByCountry', column: 'users', icon: 'person' },
    { key: 'failed', label: 'Failures', color: 'red', field: 'FailedByCountry', column: 'failures', icon: 'warning' },
    { key: 'blocked', label: 'Blocked', color: 'purple', field: 'BlockedByCountry', column: 'blocked', icon: 'block' }
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
    return [{ value: 'local', label: 'Local' }].concat(codes.map(function (c) { return { value: c, label: names[c] }; }));
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
