// remoteaccess_advanced.js
// The Advanced tab: Dynamic DNS tuning, the record's finer settings, addresses, security, blocking, history and limits.

import { confirmDialog, createChipSelect, createSaveBar, COUNTRY_CODES, WORLD } from './configurationpage?name=remoteaccess_jpkribs_shared.js';
import { PLUGIN_ID, t, translatedPage, saveBarText, htmlFormat, linkHtml, listText, problemText, showText, loadProviders, primaryRecord, recordNames, otherAddresses, addressLines, saveProxyHostnames } from './configurationpage?name=remoteaccess_tabs.js';

export default function (view) {
    'use strict';

    var Shared = null;
    var defaults = null;
    // Both default sets, standard and low-memory, and which one this server uses.
    var defaultSets = null;
    // The values as last loaded or saved, so a save only writes what was changed on this page.
    var loaded = {};
    var settingsLoaded = false;
    // Until the history settings load, saving would overwrite them with the form's defaults.
    var historyLoaded = false;
    // The history settings as last loaded or saved, to tell whether leaving would lose changes.
    var historyBaseline = '';
    // What the server said about restarting Jellyfin after the last save, if anything.
    var restartNote = '';
    var countries = null;
    var serverCountry = '';
    // Assumed loaded until the status says otherwise, so the warning never flashes up on a working server.
    var countryDatabaseLoaded = true;
    // The proxy settings as last loaded or saved, for the certificate request.
    var proxySettings = null;
    // The Save Bar at the bottom of the page, built once in bind.
    var saveBar = null;
    // The Dynamic DNS fine-tuning, saved through the DDNS configuration rather than the proxy settings. The form
    // as last loaded or saved, to tell whether it changed. Null until loaded.
    var raBaseline = null;
    var DDNS_IDS = ['ipv4Url', 'ipv6Url', 'forceUpdateHours', 'skipInternal', 'backoffAfterFailures', 'backoffHours', 'requestTimeout'];

    // The one DDNS record's finer settings, edited here and saved into the same record Configuration shows.
    // The record as last loaded or saved, or null when there is none.
    var record = null;
    // Records an older setup saved beyond the one shown. They are dropped on the next save.
    var extraCount = 0;
    var providers = null;
    var recordBaseline = null;
    var RECORD_FIELDS = [
        ['recEnabled', 'Enabled', 'on'], ['recUpdateIPv4', 'UpdateIPv4', 'on'], ['recUpdateIPv6', 'UpdateIPv6', 'check'],
        ['recServer', 'Server', 'text'], ['recTtl', 'Ttl', 'ttl'], ['recProxied', 'Proxied', 'check'],
        ['recWildcard', 'Wildcard', 'check'], ['recStatic', 'Static', 'check'], ['recMx', 'Mx', 'text'],
        ['recBackupMx', 'BackupMx', 'check']
    ];

    // The proxy's other addresses, its stored names that are not the record's, as last loaded or saved. Null until
    // loaded.
    var hostnamesBaseline = null;

    // modeNote
    // The note under the country rule for the picked rule.
    function modeNote(mode) {
        switch (mode) {
            case 'ServerCountry': return t.tr('CountryModeServer');
            case 'Block': return t.tr('CountryModeBlock');
            case 'AllowOnly': return t.tr('CountryModeAllowOnly');
            case 'Off': return t.tr('CountryModeOff');
            default: return '';
        }
    }

    // locationNote
    // The note under Location for the picked detail.
    function locationNote(detail) {
        switch (detail) {
            case 'Country': return t.tr('LocationNoteCountry');
            case 'City': return t.tr('LocationNoteCity');
            case 'Off': return t.tr('LocationNoteOff');
            default: return '';
        }
    }
    var HISTORY_DEFAULTS = { Enabled: true, HistoryDays: 90, Location: 'Country' };

    // Country names in the browser's language, falling back to the map's English name.
    function countryName(code) {
        try {
            var names = new Intl.DisplayNames([t.language || navigator.language || 'en'], { type: 'region' });
            return names.of(code) || (WORLD[code] && WORLD[code].name) || code;
        } catch (e) {
            return (WORLD[code] && WORLD[code].name) || code;
        }
    }

    function countryOptions() {
        return COUNTRY_CODES.map(function (code) { return { value: code, label: countryName(code) }; })
            .sort(function (a, b) { return a.label.localeCompare(b.label); });
    }

    function showCountryMode() {
        var mode = Shared.getEl('advCountryMode').value;
        var effective = mode || (defaults && defaults.CountryMode) || 'ServerCountry';
        var html = Shared.escapeHtml(modeNote(effective));
        // The server's country stands out in green, or the sentence turns yellow while it is still unknown.
        // Without the database the country cannot be known, and the warning below says why.
        if (effective === 'ServerCountry' && (serverCountry || countryDatabaseLoaded)) {
            html += ' ' + (serverCountry
                ? htmlFormat(Shared, 'CountryServerIn', ['<strong class="ra-country-known">' + Shared.escapeHtml(serverCountry) + '</strong>'])
                : '<strong class="ra-country-unknown">' + Shared.escapeHtml(t.tr('CountryUntilKnown')) + '</strong>');
        }
        // Country rules need the location database. Without it they do nothing, or refuse everyone, so say which.
        if (effective !== 'Off' && !countryDatabaseLoaded) {
            var blocks = Shared.getEl('advBlockWithoutDatabase').value === 'true';
            html += ' <strong class="ra-country-unknown">' + Shared.escapeHtml(t.tr(blocks ? 'DatabaseMissingBlocks' : 'DatabaseMissingAllows') +
                ' ' + t.tr('DatabaseMissingFix')) + '</strong>';
        }
        Shared.getEl('countryModeDescription').innerHTML = html;
        Shared.setVisible('countryPickerField', effective !== 'Off');
    }

    function refreshCountryStatus() {
        return Shared.apiRequest('Proxy/Status', 'GET').then(function (st) {
            if (!st) return;
            showCertRequest(st, proxySettings);
            serverCountry = st.ServerCountry || '';
            countryDatabaseLoaded = !!st.CountryDatabaseLoaded;
            showCountryMode();
            var refused = st.CountryRefused || {};
            var parts = Object.keys(refused).sort(function (a, b) { return refused[b] - refused[a]; }).map(function (code) {
                return t.format('NameExtraNumbered', code ? countryName(code) : t.tr('Unknown'), refused[code]);
            });
            var text = parts.length
                ? t.format('CountryRefusedSince', listText(parts))
                : t.tr('CountryNothingRefused');
            Shared.getEl('countryStatus').textContent = text;
        }).catch(function () { /* status is optional */ });
    }

    function fields() {
        return Array.prototype.slice.call(view.querySelectorAll('[data-adv]'));
    }

    // A value in the field's own unit.
    function valueText(v, unit) {
        switch (unit) {
            case 'onoff': return t.tr(v ? 'ValueOn' : 'ValueOff');
            case 'allowblock': return t.tr(v ? 'ValueBlock' : 'ValueAllow');
            case 'seconds': return t.format('ValueSeconds', v);
            case 'days': return t.format('ValueDays', v);
            case 'kb': return t.format('ValueKb', v);
            case 'mb': return v === 0 ? t.tr('ValueUnlimited') : t.format('ValueMb', v);
            case 'count': return v === 0 ? t.tr('ValueUnlimited') : String(v);
            case 'count-off':
            case 'bps': return v === 0 ? t.tr('ValueOff') : String(v);
            case 'minutes': return t.format('ValueMinuteCount', v);
            default: return String(v);
        }
    }

    // Settings whose default depends on the server's memory. Left empty, they show Auto and follow it.
    function isAuto(key) {
        return !!(defaultSets && defaultSets.Standard && defaultSets.LowMemory)
            && JSON.stringify(defaultSets.Standard[key]) !== JSON.stringify(defaultSets.LowMemory[key]);
    }

    // Says what the default is, and for an Auto setting, what Auto picks and why.
    function defaultText(key, unit) {
        var v = defaults ? defaults[key] : null;
        if (v == null) return '';
        if (!isAuto(key)) return t.format('DefaultIs', valueText(v, unit));
        var standard = valueText(defaultSets.Standard[key], unit);
        var low = valueText(defaultSets.LowMemory[key], unit);
        var gb = t.format('ValueGb', Math.round((defaultSets.LowMemoryBelowMb || 3072) / 1024));
        return defaultSets.IsLowMemory
            ? t.format('DefaultAutoLowMemory', low, gb, standard)
            : t.format('DefaultAuto', standard, low, gb);
    }

    function showDefaults() {
        Array.prototype.slice.call(view.querySelectorAll('[data-default]')).forEach(function (el) {
            el.textContent = defaultText(el.dataset.default, el.dataset.unit);
        });
        fields().forEach(function (el) {
            if (isAuto(el.dataset.adv)) el.setAttribute('placeholder', t.tr('Auto'));
        });
    }

    // A setting left unset shows the default it runs with, except an Auto one, which stays empty.
    function fill(advanced) {
        advanced = advanced || {};
        if (countries) countries.setValue((advanced.Countries || []).map(function (code) { return { value: code, label: countryName(code) }; }));
        fields().forEach(function (el) {
            var v = advanced[el.dataset.adv];
            if (v == null && defaults && !isAuto(el.dataset.adv)) v = defaults[el.dataset.adv];
            if (el.type === 'checkbox') el.checked = !!v;
            else if (el.dataset.kind === 'lines') el.value = (v || []).join('\n');
            else el.value = v == null ? '' : String(v);
        });
        showCountryMode();
    }

    function read() {
        var advanced = {};
        fields().forEach(function (el) {
            var key = el.dataset.adv;
            if (el.type === 'checkbox') {
                advanced[key] = el.checked;
                return;
            }
            var raw = el.value.trim();
            switch (el.dataset.kind) {
                case 'bool': advanced[key] = raw === '' ? null : raw === 'true'; break;
                case 'int': advanced[key] = raw === '' || isNaN(parseInt(raw, 10)) ? null : parseInt(raw, 10); break;
                case 'lines': advanced[key] = raw.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(function (x) { return x; }); break;
                case 'enum': advanced[key] = raw === '' ? null : raw; break;
                default: advanced[key] = raw;
            }
        });
        advanced.Countries = countries ? countries.getValue() : [];
        return advanced;
    }

    function showLocationNote() {
        Shared.getEl('locationDescription').textContent = locationNote(Shared.getEl('locationDetail').value);
    }

    function fillHistory(settings) {
        var s = settings || HISTORY_DEFAULTS;
        Shared.getEl('historyEnabled').checked = s.Enabled !== false;
        Shared.getEl('historyDays').value = s.HistoryDays || HISTORY_DEFAULTS.HistoryDays;
        Shared.getEl('locationDetail').value = s.Location || HISTORY_DEFAULTS.Location;
        showLocationNote();
    }

    function readHistory() {
        return {
            Enabled: Shared.getEl('historyEnabled').checked,
            HistoryDays: Math.max(1, parseInt(Shared.getEl('historyDays').value, 10) || HISTORY_DEFAULTS.HistoryDays),
            Location: Shared.getEl('locationDetail').value
        };
    }

    function showLocationStatus(loc) {
        loc = loc || {};
        var status;
        if (loc.Detail === 'Off') status = t.tr('LocationOff');
        else if (loc.Downloading) status = t.tr('LocationDownloading');
        else if (loc.Loaded) status = t.format('LocationReady', new Date(loc.BuiltUtc).toLocaleDateString());
        else if (loc.Error) status = loc.Error;
        else status = t.tr('LocationNotDownloaded');
        Shared.getEl('locationStatus').textContent = status;
    }

    function loadHistory() {
        return Shared.apiRequest('People', 'GET').then(function (d) {
            fillHistory(d && d.Settings);
            showLocationStatus(d && d.Location);
            historyLoaded = !!(d && d.Settings);
            historyBaseline = JSON.stringify(readHistory());
        }).catch(function () { /* the rest of the page still works */ });
    }

    function updateLocation() {
        Shared.setStatus('historyStatus', t.tr('StatusDownloading'), false, { timeout: 0 });
        Shared.apiRequest('People/Location/Update', 'POST').then(function (st) {
            Shared.setStatus('historyStatus', st && st.Loaded ? t.tr('LocationUpToDate') : (st && st.Error) || t.tr('LocationUpdateUnfinished'), !(st && st.Loaded));
            showLocationStatus(st);
        }).catch(function () {
            Shared.setStatus('historyStatus', t.tr('LocationUpdateFailed'), true);
        });
    }

    function clearHistory() {
        var options = { title: t.tr('HeaderClearHistory'), confirmText: t.tr('ButtonClear'), cancelText: t.tr('ButtonCancel'), destructive: true };
        confirmDialog(t.tr('ConfirmClearHistory'), options).then(function (ok) {
            if (!ok) return;
            Shared.apiRequest('People/History', 'DELETE').then(function () {
                Shared.setStatus('historyStatus', t.tr('MessageHistoryCleared'), false);
            }).catch(function () {
                Shared.setStatus('historyStatus', t.tr('ErrorClearHistory'), true);
            });
        });
    }

    function raState() {
        return JSON.stringify(DDNS_IDS.map(function (id) {
            var el = Shared.getEl(id);
            return el.type === 'checkbox' ? el.checked : el.value.trim();
        }));
    }

    function raDirty() {
        return raBaseline !== null && raState() !== raBaseline;
    }

    // Uses the plugin's own config endpoints, so credentials on the records are redacted in transit and kept as
    // they are on save.
    function loadDdns() {
        raBaseline = null;
        recordBaseline = null;
        var providersLoaded = providers ? Promise.resolve(providers)
            : loadProviders(Shared).then(function (p) { providers = p; return p; }).catch(function () { return null; });
        return Promise.all([Shared.apiRequest('Configuration', 'GET'), providersLoaded]).then(function (results) {
            var cfg = results[0];
            if (!cfg) { throw new Error('settings unavailable'); }
            fillRecord(primaryRecord(cfg.Records), (cfg.Records || []).length);
            Shared.getEl('ipv4Url').value = cfg.IPv4DetectionUrl || '';
            Shared.getEl('ipv6Url').value = cfg.IPv6DetectionUrl || '';
            // Select the matching preset, falling back to Off when the stored value is not one of them.
            var force = Shared.getEl('forceUpdateHours');
            force.value = String(cfg.ForceUpdateHours || 0);
            if (force.selectedIndex < 0) force.value = '0';
            Shared.getEl('skipInternal').checked = cfg.SkipInternalAddresses !== false;
            var bf = Shared.getEl('backoffAfterFailures');
            bf.value = String(cfg.BackoffAfterFailures == null ? 3 : cfg.BackoffAfterFailures);
            if (bf.selectedIndex < 0) bf.value = '3';
            var bh = Shared.getEl('backoffHours');
            bh.value = String(cfg.BackoffHours || 24);
            if (bh.selectedIndex < 0) bh.value = '24';
            Shared.getEl('requestTimeout').value = cfg.RequestTimeoutSeconds || 15;
            raBaseline = raState();
            showText(Shared, 'raLoadError', '');
        }).catch(function () {
            showText(Shared, 'raLoadError', t.tr('ErrorLoadDynamicDns'));
        });
    }

    // ===== The DDNS record =====

    function recordContainer(id) {
        var el = Shared.getEl(id);
        return el.closest('.inputContainer') || el.closest('.checkboxContainer');
    }

    // Hides what the record's provider does not use.
    function applyRecordFields() {
        if (!record || !providers) return;
        var spec = providers.specFor(providers.normalize(record.Provider));
        var adv = spec.a || [];
        var visible = {
            recUpdateIPv6: spec.v6 !== false, recServer: !!spec.s, recTtl: !!spec.t,
            recWildcard: adv.indexOf('wildcard') >= 0, recStatic: adv.indexOf('static') >= 0,
            recMx: adv.indexOf('mx') >= 0, recBackupMx: adv.indexOf('backupmx') >= 0
        };
        Object.keys(visible).forEach(function (id) {
            var box = recordContainer(id);
            if (box) box.classList.toggle('hidden', !visible[id]);
        });
    }

    function recordState() {
        return JSON.stringify(RECORD_FIELDS.map(function (f) {
            var el = Shared.getEl(f[0]);
            return el.type === 'checkbox' ? el.checked : el.value.trim();
        }));
    }

    function recordDirty() {
        return recordBaseline !== null && !!record && recordState() !== recordBaseline;
    }

    function fillRecord(r, total) {
        record = r || null;
        extraCount = Math.max(0, (total || 0) - (r ? 1 : 0));
        Shared.setVisible('recordFields', !!r);
        Shared.setVisible('recordEmpty', !r);
        var name = r ? (r.Hostname || r.Name || '') : '';
        Shared.getEl('recordIntro').textContent = !r ? '' : name ? t.format('RecordIntroNamed', name) : t.tr('RecordIntro');
        showText(Shared, 'extraRecords', !extraCount ? ''
            : extraCount === 1 ? t.tr('ExtraRecordHere')
                : t.format('ExtraRecordsHere', extraCount));
        if (r) {
            RECORD_FIELDS.forEach(function (f) {
                var el = Shared.getEl(f[0]);
                var v = r[f[1]];
                if (f[2] === 'on') el.checked = v !== false;
                else if (f[2] === 'check') el.checked = !!v;
                else if (f[2] === 'ttl') el.value = v || 1;
                else el.value = v || '';
            });
            applyRecordFields();
        }
        recordBaseline = recordState();
    }

    // Copies this page's record settings onto the server's copy of the record.
    function mergeRecord(base) {
        var r = JSON.parse(JSON.stringify(base));
        RECORD_FIELDS.forEach(function (f) {
            var el = Shared.getEl(f[0]);
            if (f[2] === 'on' || f[2] === 'check') r[f[1]] = el.checked;
            else if (f[2] === 'ttl') r[f[1]] = Math.max(1, parseInt(el.value, 10) || 1);
            else r[f[1]] = el.value.trim();
        });
        return r;
    }

    // The names the record covers now, which a save replaces in the proxy's addresses.
    function namesNow() {
        return record ? recordNames(Shared, record.Id).catch(function () { return []; }) : Promise.resolve([]);
    }

    function hostnamesDirty() {
        return hostnamesBaseline !== null && JSON.stringify(addressLines(Shared.getEl('hostnames').value)) !== hostnamesBaseline;
    }

    function fillHostnames(hostnames, names) {
        Shared.getEl('hostnames').value = otherAddresses(hostnames, names || []).join('\n');
        hostnamesBaseline = JSON.stringify(addressLines(Shared.getEl('hostnames').value));
    }

    // Removes the record, and its names from the proxy's addresses. The other addresses stay.
    function removeRecord() {
        var button = Shared.getEl('btnRemoveRecord');
        if (button.disabled || !record) return;
        var label = record.Hostname || record.Name;
        var options = { title: t.tr('HeaderRemoveRecord'), confirmText: t.tr('ButtonRemove'), cancelText: t.tr('ButtonCancel'), destructive: true };
        confirmDialog(label ? t.format('ConfirmRemoveRecordNamed', label) : t.tr('ConfirmRemoveRecord'), options).then(function (ok) {
            if (!ok) return;
            button.disabled = true;
            Shared.setStatus('recordStatus', t.tr('StatusRemoving'), false, { timeout: 0 });
            var before = [];
            var removed = false;
            namesNow().then(function (names) {
                before = names;
                return Shared.apiRequest('Configuration', 'GET');
            }).then(function (fresh) {
                if (!fresh) { throw new Error('settings unavailable'); }
                fresh.Records = [];
                return Shared.apiRequest('Configuration', 'POST', fresh);
            }).then(function (result) {
                if (!result) { throw new Error('no reply'); }
                removed = true;
                fillRecord(null, 0);
                return saveProxyHostnames(Shared, before);
            }).then(function (result) {
                if (result && result.Settings) {
                    proxySettings = result.Settings;
                    fillHostnames(result.Settings.Hostnames, []);
                }
                Shared.setStatus('recordStatus', t.tr('MessageRemoved'), false);
            }).catch(function (err) {
                return problemText(err, removed ? t.tr('ErrorAddressesNotUpdated') : t.tr('ErrorRemove')).then(function (text) {
                    Shared.setStatus('recordStatus', removed ? t.tr('ErrorRemovedAddressesNotUpdated') + ' ' + text : text, true, { timeout: 0 });
                });
            }).then(function () {
                button.disabled = false;
            });
        });
    }

    // ===== Request a New Certificate =====

    // Offered while the proxy runs with Let's Encrypt as the saved source and its terms accepted.
    var certRequestable = false;

    function showCertRequest(st, settings) {
        var cert = (st && st.Certificate) || {};
        certRequestable = cert.Mode === 'Automatic' && !!(settings && (settings.Certificate || {}).AcceptTerms) && !!(st && st.Running);
        Shared.getEl('btnRequestCert').disabled = !certRequestable;
    }

    function requestCertificate() {
        var button = Shared.getEl('btnRequestCert');
        if (button.disabled || !certRequestable) return;
        var options = { title: t.tr('HeaderRequestCertificate'), confirmText: t.tr('ButtonRequest'), cancelText: t.tr('ButtonCancel') };
        confirmDialog(t.tr('ConfirmRequestCertificate'), options).then(function (ok) {
            if (!ok) return;
            button.disabled = true;
            Shared.setStatus('certRequestStatus', t.tr('StatusRequesting'), false, { timeout: 0 });
            Shared.apiRequest('Proxy/Certificate/Request', 'POST').then(function (result) {
                Shared.setStatus('certRequestStatus', (result && result.Message) || t.tr('MessageDone'), !(result && result.Ok), { timeout: 0 });
            }).catch(function () {
                Shared.setStatus('certRequestStatus', t.tr('ErrorRequest'), true, { timeout: 0 });
            }).then(function () {
                button.disabled = !certRequestable;
            });
        });
    }

    // Saves the Dynamic DNS fields and the record onto the freshest DDNS configuration, only when something
    // changed or extra records are left to drop. The record is kept as the only one. Resolves to an error
    // message, or empty when it worked or there was nothing to save.
    function saveDdns() {
        if (!raDirty() && !recordDirty() && !extraCount) return Promise.resolve('');
        var posted = raState();
        var id = record ? record.Id : null;
        return Shared.apiRequest('Configuration', 'GET').then(function (fresh) {
            if (!fresh) { throw new Error('settings unavailable'); }
            fresh.IPv4DetectionUrl = Shared.getEl('ipv4Url').value.trim();
            fresh.IPv6DetectionUrl = Shared.getEl('ipv6Url').value.trim();
            fresh.ForceUpdateHours = Math.max(0, parseInt(Shared.getEl('forceUpdateHours').value, 10) || 0);
            fresh.SkipInternalAddresses = Shared.getEl('skipInternal').checked;
            fresh.BackoffAfterFailures = Math.max(0, parseInt(Shared.getEl('backoffAfterFailures').value, 10) || 0);
            fresh.BackoffHours = Math.max(1, parseInt(Shared.getEl('backoffHours').value, 10) || 24);
            fresh.RequestTimeoutSeconds = Math.max(1, parseInt(Shared.getEl('requestTimeout').value, 10) || 15);
            var list = fresh.Records || [];
            var base = id ? list.find(function (x) { return x.Id === id; }) : null;
            var keep = base ? mergeRecord(base) : primaryRecord(list);
            fresh.Records = keep ? [keep] : [];
            return Shared.apiRequest('Configuration', 'POST', fresh);
        }).then(function (result) {
            if (!result) { throw new Error('no reply'); }
            raBaseline = posted;
            fillRecord(primaryRecord(result.Records), (result.Records || []).length);
            return '';
        }).catch(function (err) {
            return problemText(err, t.tr('ErrorSave'));
        });
    }

    // Whether leaving now would lose changes, against the values last loaded or saved.
    function isDirty() {
        return (settingsLoaded && JSON.stringify(read()) !== JSON.stringify(loaded))
            || (historyLoaded && JSON.stringify(readHistory()) !== historyBaseline)
            || raDirty() || recordDirty() || hostnamesDirty();
    }

    function load() {
        settingsLoaded = false;
        historyLoaded = false;
        loadHistory();
        hostnamesBaseline = null;
        var raDone = loadDdns();
        var defaultsLoaded = defaultSets ? Promise.resolve(defaultSets) : Shared.apiRequest('Proxy/Defaults', 'GET');
        Promise.all([defaultsLoaded, Shared.apiRequest('Proxy/Settings', 'GET')]).then(function (results) {
            defaultSets = results[0] || {};
            defaults = defaultSets.Values || {};
            showDefaults();
            fill(results[1] && results[1].Advanced);
            loaded = read();
            settingsLoaded = true;
            proxySettings = results[1];
            refreshCountryStatus();
            // The other addresses are the stored ones that are not the record's, so the record has to be known.
            return raDone.then(namesNow).then(function (names) {
                fillHostnames((results[1] && results[1].Hostnames) || [], names);
            });
        }).catch(function () {
            saveBar.setState('failed', t.tr('ErrorLoadSettings'));
        });
    }

    // save
    // The Save Bar's onSave. Turning on Only Through the Proxy can cut off whoever uses Jellyfin's own address, this
    // page included, so it is confirmed first.
    //
    // Output
    // [Promise]: Resolves once saved, or rejects with an Error whose message the Save Bar shows.
    function save() {
        // Without the saved values to compare against, every field would look changed and be written empty.
        if (!settingsLoaded) return Promise.reject(new Error(t.tr('ErrorSettingsNotLoaded')));

        var current = read();
        var effective = function (v) { return v == null ? !!(defaults && defaults.JellyfinLoopbackOnly) : v; };
        if (!effective(current.JellyfinLoopbackOnly) || effective(loaded.JellyfinLoopbackOnly)) return doSave();
        var options = { title: t.tr('LabelLoopbackOnly'), confirmText: t.tr('ButtonTurnOn'), cancelText: t.tr('ButtonCancel') };
        return confirmDialog(t.tr('ConfirmLoopbackOnly'), options).then(function (ok) {
            if (!ok) throw new Error(t.tr('ErrorNothingSaved'));
            return doSave();
        });
    }

    // doSave
    // Saves the Dynamic DNS settings and the record first, so the proxy's addresses follow the record's names as now
    // saved, then the proxy and history settings. Each goes to its own endpoint, so one failing never stops the other.
    //
    // Output
    // [Promise]: Resolves once both saved, or rejects with an Error that names what was not saved.
    function doSave() {
        var raChanged = raDirty() || recordDirty() || extraCount > 0;
        var before = [];
        var raError = '';
        return namesNow().then(function (names) {
            before = names;
            return saveDdns();
        }).then(function (error) {
            raError = error;
            return saveProxy(before);
        }).then(function (proxy) {
            if (!raError && proxy.ok) {
                saveBar.setDirty(false);
                // A restart note or skipped history settings follow the saved line, once the Save Bar has drawn it.
                if (proxy.keep) setTimeout(function () { saveBar.setState(proxy.bad ? 'failed' : 'saved', proxy.text); }, 0);
                return;
            }
            var proxyFailed = t.tr('ErrorProxySettingsNotSaved') + ' ' + proxy.text;
            var text = !raError ? proxyFailed + (raChanged ? ' ' + t.tr('MessageDynamicDnsSaved') : '')
                : (proxy.ok ? proxy.text : proxyFailed) + ' ' + t.tr('ErrorDynamicDnsNotSaved') + ' ' + raError;
            throw new Error(text);
        });
    }

    // Saves the proxy settings onto the freshest ones, then the history settings. The proxy answers on the
    // record's names and the other addresses. Resolves to how it went.
    function saveProxy(before) {
        var others = hostnamesDirty() ? addressLines(Shared.getEl('hostnames').value) : null;
        return saveProxyHostnames(Shared, before, others, function (fresh) {
            // Settings this page does not show, such as the ports, are kept as they are.
            // Only fields changed here are written. The block list and countries can also change from the
            // Dashboard while this page is open, and those changes must survive a save made here.
            var current = read();
            fresh.Advanced = fresh.Advanced || {};
            Object.keys(current).forEach(function (key) {
                if (JSON.stringify(current[key]) === JSON.stringify(loaded[key])) return;
                // A value set back to the default is stored as unset, so it follows the default if that changes.
                // An Auto setting keeps a typed value, since the default it matches may not apply later.
                var isDefault = !Array.isArray(current[key]) && !isAuto(key) && defaults && current[key] === defaults[key];
                fresh.Advanced[key] = isDefault ? null : current[key];
            });
            return fresh;
        }).then(function (result) {
            if (result && result.Settings) {
                proxySettings = result.Settings;
                fill(result.Settings.Advanced);
                loaded = read();
            }
            restartNote = (result && result.Restart) || '';
            return namesNow().then(function (names) {
                if (result && result.Settings) fillHostnames(result.Settings.Hostnames, names);
                return historyLoaded ? Shared.apiRequest('People/Settings', 'POST', readHistory()) : null;
            });
        }).then(function (history) {
            if (history) fillHistory(history);
            // History settings that never loaded were not sent, so the page does not claim to have saved them.
            var skipped = !historyLoaded;
            loadHistory();
            var text = t.tr('MessageChangesSaved') + (skipped ? ' ' + t.tr('ErrorHistoryNotLoaded') : '') + (restartNote ? ' ' + restartNote : '');
            return { ok: true, bad: skipped, keep: skipped || !!restartNote, text: text };
        }).catch(function (err) {
            return problemText(err, t.tr('ErrorSave')).then(function (text) {
                return { ok: false, bad: true, keep: true, text: text };
            });
        });
    }

    // Lists you built up yourself are not tuning, so a reset keeps them.
    var KEPT_ON_RESET = ['TrustedNetworks', 'BlockedAddresses', 'CountryMode', 'Countries'];

    function reset() {
        var options = { title: t.tr('HeaderResetDefaults'), confirmText: t.tr('Reset'), cancelText: t.tr('ButtonCancel') };
        confirmDialog(t.tr('ConfirmResetDefaults'), options).then(function (ok) {
            if (!ok) return;
            var current = read();
            var kept = {};
            KEPT_ON_RESET.forEach(function (key) { kept[key] = current[key]; });
            fill(kept);
        });
    }

    function restartProxy() {
        Shared.setStatus('restartStatus', t.tr('StatusRestarting'), false);
        Shared.apiRequest('Proxy/Restart', 'POST').then(function (st) {
            var running = st && st.Running;
            Shared.setStatus('restartStatus', running ? t.tr('MessageProxyRunning') : (st && st.Error) || t.tr('ErrorProxyNotRunning'), !running);
        }).catch(function () {
            Shared.setStatus('restartStatus', t.tr('ErrorRestart'), true);
        });
    }

    function bind() {
        var bold = function (text) { return '<strong>' + Shared.escapeHtml(text) + '</strong>'; };
        Shared.getEl('ddnsIntro').innerHTML = htmlFormat(Shared, 'DescriptionDynamicDns', [bold(t.tr('TabScheduledTasks')), bold(t.tr('TaskUpdateDdns'))]);
        Shared.getEl('recordEmpty').innerHTML = htmlFormat(Shared, 'RecordEmpty', [linkHtml(Shared, '#/configurationpage?name=remoteaccess_configuration', 'TabConfiguration')]);
        countries = createChipSelect({
            options: countryOptions(),
            placeholder: t.tr('PlaceholderAddCountry'),
            removeText: t.tr('ButtonRemove'),
            noResultsText: t.tr('EmptyNoMatches'),
            errorText: t.tr('ErrorSearch')
        });
        Shared.getEl('countryPicker').appendChild(countries.element);
        Shared.getEl('advCountryMode').addEventListener('change', showCountryMode);
        Shared.getEl('advBlockWithoutDatabase').addEventListener('change', showCountryMode);
        saveBar = createSaveBar(Object.assign(saveBarText(), { fill: true, form: Shared.getEl('RemoteAccessAdvancedForm'), onSave: save }));
        Shared.getEl('saveBar').replaceWith(saveBar.element);
        ['input', 'change'].forEach(function (type) {
            view.addEventListener(type, function () { saveBar.setDirty(isDirty()); });
        });
        Shared.getEl('btnResetAdvanced').addEventListener('click', reset);
        Shared.getEl('btnRestartProxy').addEventListener('click', restartProxy);
        Shared.getEl('locationDetail').addEventListener('change', showLocationNote);
        Shared.getEl('btnUpdateLocation').addEventListener('click', updateLocation);
        Shared.getEl('btnDeleteAll').addEventListener('click', clearHistory);
        Shared.getEl('btnRemoveRecord').addEventListener('click', removeRecord);
        Shared.getEl('btnRequestCert').addEventListener('click', requestCertificate);
        Shared.initCollapsibles();
    }

    Shared = translatedPage(view, {
        pluginId: PLUGIN_ID,
        apiPrefix: 'RemoteAccess',
        tabsKey: 'remoteaccess',
        tabIndex: 2,
        bind: bind,
        load: load,
        isDirty: isDirty
    }).shared;
}
