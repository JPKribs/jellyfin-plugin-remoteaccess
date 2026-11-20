// remoteaccess_configuration.js
// The Configuration tab, a Setup Checklist from turning the proxy on to a test from outside.

import { confirmDialog, createSetupChecklist, createSaveBar } from './configurationpage?name=remoteaccess_jpkribs_shared.js';
import { PLUGIN_ID, t, translatedPage, htmlFormat, linkHtml, listText, problemText, showText, trustTheProxy, routerInstructionHtml, routerStateText, loadProviders, primaryRecord, readDdnsSecret, recordNames, saveProxyHostnames, stepState } from './configurationpage?name=remoteaccess_tabs.js';

// The Configuration tab: a checklist from turning the proxy on to a test from outside. Each step holds only what
// most people need: the proxy switch, the one DDNS record whose name is the proxy's address, the certificate, the
// router, Trust the proxy and the outside test. The finer settings are under Advanced. Every state is worked out
// from Proxy/Status and Proxy/Settings, plus the DDNS record for someone who only uses Dynamic DNS.
export default function (view) {
    'use strict';

    var Shared = null;

    // ===== Shared helpers =====

    function show(id, text) {
        showText(Shared, id, text);
    }

    function formatDate(value) {
        if (!value) return '';
        var d = new Date(value);
        return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
    }

    function formatTime(value) {
        if (!value) return '';
        var d = new Date(value);
        return isNaN(d.getTime()) ? '' : d.toLocaleString();
    }

    function expired(value) {
        return !!value && new Date(value).getTime() <= Date.now();
    }

    // Within two weeks of expiring, and not already expired.
    function soon(value) {
        return !!value && !expired(value) && new Date(value).getTime() - Date.now() < 14 * 86400000;
    }

    // ===== The DDNS record, in step 2 =====

    // A server keeps one record, whose names are the proxy's address. Only the fields every provider needs are
    // here: the provider, the hostname and the credentials it asks for. The rest of the record is under Advanced.

    // The provider list and the fields each provider uses, filled once by loadProviders.
    var providers = null;
    // The record as the server last sent it, or null when there is none. Its credentials hold the server's kept
    // marker or empty, never a value.
    var record = null;
    // Records an older setup saved beyond the one shown. They are dropped on the next save.
    var extraCount = 0;
    var recordsLoaded = false;
    // The detected public IP, from the DDNS configuration.
    var detected = {};
    // The record fields as last loaded or saved, to tell whether they changed. Null until loaded.
    var recordBaseline = null;

    var SECRET_IDS = ['recLogin', 'recPassword'];
    var CLEAR_BUTTONS = { recLogin: 'btnClearLogin', recPassword: 'btnClearPassword' };
    // The Setup Checklist that holds the steps, and the Save Bar under them, built once in bind.
    var checklist = null;
    var saveBar = null;

    // The plugin's own config endpoints send a kept marker in place of a stored credential and encrypt a typed one
    // on save, so secrets never reach the browser.
    function getConfig() { return Shared.apiRequest('Configuration', 'GET'); }
    function saveConfig(cfg) { return Shared.apiRequest('Configuration', 'POST', cfg); }

    function ensureProviders() {
        if (providers) return Promise.resolve(providers);
        return loadProviders(Shared).then(function (p) { providers = p; return p; });
    }

    function specFor(provider) {
        return providers.specFor(provider);
    }

    function newRecord() {
        return {
            Id: Shared.generateGuid(), Name: '', Provider: 'Cloudflare', Hostname: '', Enabled: true,
            UpdateIPv4: true, UpdateIPv6: true,
            Login: '', Password: '', Zone: '', Server: '', Ttl: 1,
            Proxied: false, Wildcard: false, Mx: '', BackupMx: false, Static: false
        };
    }

    function renderProviderOptions() {
        Shared.getEl('recProvider').innerHTML = providers.options.map(function (p) {
            return '<option value="' + Shared.escapeHtml(p[0]) + '">' + Shared.escapeHtml(p[1]) + '</option>';
        }).join('');
    }

    // Provider hint plus a link to that provider's setup doc on GitHub, named after the provider value.
    function applyHint() {
        var prov = Shared.getEl('recProvider').value;
        var hint = providers.hints[prov] || t.tr('ProviderHintDefault');
        var html = Shared.escapeHtml(hint);
        if (prov) {
            var url = 'https://github.com/JPKribs/jellyfin-plugin-remoteaccess/blob/master/docs/providers/' + encodeURIComponent(prov) + '.md';
            html += ' ' + linkHtml(Shared, url, 'ButtonQuickStartGuide');
        }
        Shared.getEl('providerHint').innerHTML = html;
    }

    // Shows a field with the provider's own label for it, or hides it when the provider does not use it.
    function setField(id, label) {
        var container = Shared.getEl(id).closest('.inputContainer');
        if (!container) return;
        if (label) {
            var lbl = container.querySelector('label');
            if (lbl) lbl.textContent = label;
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    }

    // Providers whose hostname field holds a record id rather than a name, the same list the server uses.
    var ID_PROVIDERS = ['DnsMadeEasy', 'Sitelutions'];

    // Whether the record's hostname can be the proxy's address. A provider without a hostname field, or one keyed
    // by a record id, needs the name under Other addresses instead.
    function namesTheProxy(provider) {
        return !!specFor(provider).h && ID_PROVIDERS.indexOf(provider) < 0;
    }

    function onProviderChange() {
        applyHint();
        var provider = Shared.getEl('recProvider').value;
        var spec = specFor(provider);
        Shared.getEl('recHostnameDescription').textContent = namesTheProxy(provider)
            ? t.tr('DescriptionHostname')
            : t.tr('DescriptionHostnameNotName');
        setField('recHostname', spec.h);
        setField('recLogin', spec.l);
        setField('recPassword', spec.p);
        setField('recZone', spec.z);
    }

    // Binds a credential field. Its clear button shows while a value is stored, and marks it for removal on the
    // next save. Typing a new value still replaces it.
    function bindSecret(id, stored) {
        Shared.bindSecretField(id, stored, { clearButton: Shared.getEl(CLEAR_BUTTONS[id]) });
    }

    // The record fields as typed, to tell whether they changed.
    function recordState() {
        return JSON.stringify({
            provider: Shared.getEl('recProvider').value,
            hostname: Shared.getEl('recHostname').value.trim(),
            zone: Shared.getEl('recZone').value.trim(),
            secrets: SECRET_IDS.map(function (id) { var el = Shared.getEl(id); return [el.value, !!el.dataset.baseSecretCleared]; })
        });
    }

    // Whether anything was typed for a record that does not exist yet.
    function hasRecordInput() {
        return ['recHostname', 'recZone'].concat(SECRET_IDS).some(function (id) { return !!Shared.getEl(id).value.trim(); });
    }

    function recordDirty() {
        if (!recordsLoaded || recordBaseline === null) return false;
        if (!record && !hasRecordInput()) return false;
        return recordState() !== recordBaseline;
    }

    // Changed fields are saved, and so are extra records, which the save drops.
    function recordNeedsSave() {
        return recordDirty() || (recordsLoaded && extraCount > 0);
    }

    function fillRecord(r) {
        record = r || null;
        Shared.getEl('recProvider').value = providers.normalize(r ? r.Provider : 'Cloudflare');
        Shared.getEl('recHostname').value = (r && r.Hostname) || '';
        Shared.getEl('recZone').value = (r && r.Zone) || '';
        bindSecret('recLogin', !!(r && r.Login));
        bindSecret('recPassword', !!(r && r.Password));
        onProviderChange();
        renderRecordStatus();
        recordBaseline = recordState();
    }

    function showExtras() {
        show('extraRecords', !extraCount ? ''
            : extraCount === 1 ? t.tr('ExtraRecordBelow')
                : t.format('ExtraRecordsBelow', extraCount));
    }

    function renderRecordStatus() {
        var parts = [detected.LastDetectedIPv4, detected.LastDetectedIPv6].filter(function (x) { return x; });
        Shared.getEl('stIp').textContent = parts.length ? parts.join(' / ') : t.tr('TextNotDetectedYet');
        show('detectionWarning', detected.LastDetectionMessage);

        var r = record;
        var checked = r && r.LastCheckedUtc ? new Date(r.LastCheckedUtc) : null;
        Shared.getEl('stChecked').textContent = !checked ? t.tr('TextNotYet') : isNaN(checked.getTime()) ? String(r.LastCheckedUtc) : checked.toLocaleString();

        var result = Shared.getEl('stResult');
        var text;
        var tone = '';
        if (!r) text = t.tr('TextNoRecordYet');
        else if (r.Enabled === false) text = t.tr('StepPaused');
        else if (!r.LastCheckedUtc) text = t.tr('TextNotSentYet');
        else {
            text = r.LastStatus || t.tr(r.LastSuccess ? 'ButtonOk' : 'LabelFailed');
            tone = r.LastSuccess ? ' base-ok' : ' base-bad';
        }
        result.textContent = text;
        result.className = 'base-mono' + tone;
    }

    // The record to save: the server's copy with the fields from this page. A record never saved starts from the
    // defaults. Its name follows the hostname unless it was given one of its own.
    function buildRecord(base) {
        var r = base ? JSON.parse(JSON.stringify(base)) : newRecord();
        var oldHost = r.Hostname || '';
        r.Provider = Shared.getEl('recProvider').value;
        // A provider that works the host out from the account hides the field, and stores no hostname.
        r.Hostname = specFor(r.Provider).h ? Shared.getEl('recHostname').value.trim() : '';
        r.Zone = Shared.getEl('recZone').value.trim();
        if (!r.Name || r.Name === oldHost) r.Name = r.Hostname;
        r.Login = readDdnsSecret(Shared, 'recLogin');
        r.Password = readDdnsSecret(Shared, 'recPassword');
        return r;
    }

    // A problem found on the page, shown as it is rather than as a server reply.
    function pageError(text) {
        var err = new Error(text);
        err.pageText = text;
        return err;
    }

    // Saves the record as the only one, onto the freshest configuration, so the detection settings saved under
    // Advanced are kept. Resolves once saved, or at once when nothing changed.
    function saveRecord() {
        if (!recordNeedsSave()) return Promise.resolve();
        var provider = Shared.getEl('recProvider').value;
        if (specFor(provider).h && !Shared.getEl('recHostname').value.trim() && (record || hasRecordInput())) {
            setStepOpen('Address');
            return Promise.reject(pageError(t.tr('ErrorEnterHostname')));
        }

        var id = record ? record.Id : null;
        return getConfig().then(function (fresh) {
            if (!fresh) { throw new Error('settings unavailable'); }
            var base = id ? (fresh.Records || []).find(function (x) { return x.Id === id; }) : null;
            // No record and nothing typed: the save only drops the extra records.
            fresh.Records = !record && !hasRecordInput() ? [] : [buildRecord(base || record)];
            return saveConfig(fresh);
        }).then(function (result) {
            if (!result || !result.Records) { throw new Error('no reply'); }
            detected = result;
            extraCount = Math.max(0, result.Records.length - 1);
            fillRecord(primaryRecord(result.Records));
            showExtras();
        });
    }

    function loadRecords() {
        recordsLoaded = false;
        recordBaseline = null;
        return ensureProviders().then(getConfig).then(function (cfg) {
            cfg = cfg || {};
            var list = cfg.Records || [];
            detected = cfg;
            renderProviderOptions();
            extraCount = Math.max(0, list.length - 1);
            fillRecord(primaryRecord(list));
            showExtras();
            recordsLoaded = true;
            show('loadError', '');
        }).catch(function () {
            show('loadError', t.tr('ErrorLoadProviders'));
        });
    }

    // ===== Update now, in step 2 =====

    // Says how the run went. With no result for the record, the configuration tells apart having no record, a
    // paused record and a run that left the record as it was.
    function runMessage(outcome, cfg) {
        var list = (outcome && outcome.Records) || [];
        var warnings = (outcome && outcome.Warnings) || [];
        var failed = list.some(function (x) { return !x.Success; });
        var text;
        if (list.length) {
            text = t.tr(failed ? 'RunRecordFailed' : 'RunRecordUpdated');
        } else if (warnings.length) {
            text = '';
        } else {
            var r = cfg ? primaryRecord(cfg.Records) : record;
            text = !r ? t.tr('RunNoRecord')
                : r.Enabled === false ? t.tr('RunRecordPaused')
                    : t.tr('RunRecordUnchanged');
        }

        return {
            text: [text].concat(warnings).filter(function (x) { return x; }).join(' '),
            bad: warnings.length > 0 || failed
        };
    }

    function runNow() {
        var button = Shared.getEl('btnRunNow');
        if (button.disabled) return;
        button.disabled = true;
        Shared.setStatus('runStatus', t.tr('StatusUpdating'), false, { timeout: 0 });
        Shared.apiRequest('RunNow', 'POST').then(function (outcome) {
            return getConfig().catch(function () { return null; }).then(function (fresh) {
                var result = runMessage(outcome, fresh);
                Shared.setStatus('runStatus', result.text, result.bad, result.bad ? { timeout: 0 } : undefined);
                if (fresh && recordsLoaded) {
                    detected = fresh;
                    // The run changed the record's status. Edits not saved yet stay as they are.
                    var latest = primaryRecord(fresh.Records);
                    extraCount = Math.max(0, (fresh.Records || []).length - 1);
                    if (recordDirty()) {
                        if (latest && record && latest.Id === record.Id) record = latest;
                        renderRecordStatus();
                    } else {
                        fillRecord(latest);
                    }
                    showExtras();
                    if (lastStatus) render(lastStatus);
                }
            });
        }).catch(function (err) {
            return problemText(err, t.tr('ErrorUpdate')).then(function (text) {
                Shared.setStatus('runStatus', text, true, { timeout: 0 });
            });
        }).then(function () {
            button.disabled = false;
        });
    }

    // ===== Proxy settings, in steps 1 to 3 =====

    var settings = null;
    // The last status shown, for the certificate actions and to redraw the steps.
    var lastStatus = null;
    // The self-signed root, fetched once while it is shown.
    var rootLoaded = false;
    var rootPem = '';
    // The form as last loaded or saved, to tell whether leaving would lose changes. Null until loaded.
    var baseline = null;

    // certNote
    // The note under the certificate source for the picked source.
    function certNote(mode) {
        switch (mode) {
            case 'Automatic': return t.tr('CertNoteAutomatic');
            case 'None': return t.tr('CertNoteNone');
            case 'PemFiles': return t.tr('CertNotePemFiles');
            case 'Pkcs12File': return t.tr('CertNotePkcs12File');
            case 'SelfSigned': return t.tr('CertNoteSelfSigned');
            default: return '';
        }
    }

    function getSettings() { return Shared.apiRequest('Proxy/Settings', 'GET'); }
    function getStatus() { return Shared.apiRequest('Proxy/Status', 'GET'); }

    // How Let's Encrypt will check the addresses: through the DDNS provider when it can publish TXT records.
    function describeMethod(st) {
        var acme = st.Acme || {};
        var automatic = (st.Certificate || {}).Mode === 'Automatic' && (acme.Names || []).length > 0;
        var text = !automatic ? ''
            : acme.Method === 'Dns'
                ? t.format('CertMethodDns', listText(acme.DnsProviders))
                : t.tr('CertMethodHttp');
        show('certMethod', text);
    }

    // What can be done with the certificate in use, shown only while its source is still the one picked above:
    // picking another source hides them before it is saved.
    function showCertActions() {
        var picked = Shared.getEl('certMode').value;
        var cert = (lastStatus && lastStatus.Certificate) || {};
        var selfSigned = picked === 'SelfSigned' && cert.Mode === 'SelfSigned' && !!cert.Loaded;
        Shared.setVisible('certRootField', selfSigned);
        Shared.setVisible('certRootExpiresRow', selfSigned);
        Shared.setVisible('certRootFingerprintRow', selfSigned);
        if (selfSigned && !rootLoaded) loadRoot();
    }

    function showCertFields() {
        var mode = Shared.getEl('certMode').value;
        Shared.getEl('certModeDescription').textContent = certNote(mode);
        Shared.setVisible('certTermsField', mode === 'Automatic');
        Shared.setVisible('certFileFields', mode === 'Pkcs12File' || mode === 'PemFiles');
        Shared.setVisible('certKeyField', mode === 'PemFiles');
        Shared.getEl('certPathDescription').textContent = t.tr(mode === 'PemFiles' ? 'DescriptionPemFile' : 'DescriptionPkcs12File');
        showCertActions();
    }

    // The form's current values, to tell whether leaving would lose changes.
    function formState() {
        return JSON.stringify(collect({}));
    }

    function proxyDirty() {
        return baseline !== null && formState() !== baseline;
    }

    function isDirty() {
        return recordDirty() || proxyDirty();
    }

    function fill(s) {
        settings = s;
        Shared.getEl('enabled').checked = !!s.Enabled;
        var cert = s.Certificate || {};
        Shared.getEl('certMode').value = cert.Mode || 'Automatic';
        Shared.getEl('certPath').value = cert.Path || '';
        Shared.getEl('certKeyPath').value = cert.KeyPath || '';
        Shared.getEl('certTerms').checked = !!cert.AcceptTerms;
        Shared.bindSecretField('certPassword', !!cert.Password);
        showCertFields();
        baseline = formState();
    }

    // The proxy's addresses are not on this page: the save sets them from the record's names and the other
    // addresses kept under Advanced.
    function collect(s) {
        s.Enabled = Shared.getEl('enabled').checked;
        s.Certificate = s.Certificate || {};
        s.Certificate.Mode = Shared.getEl('certMode').value;
        s.Certificate.Path = Shared.getEl('certPath').value.trim();
        s.Certificate.KeyPath = Shared.getEl('certKeyPath').value.trim();
        s.Certificate.AcceptTerms = Shared.getEl('certTerms').checked;
        s.Certificate.Password = Shared.readSecretField('certPassword');
        return s;
    }

    // The names the record covers now, which the save replaces in the proxy's addresses.
    function namesNow() {
        return record ? recordNames(Shared, record.Id).catch(function () { return []; }) : Promise.resolve([]);
    }

    function setSaving(on) {
        Shared.getEl('btnRunNow').disabled = on;
    }

    // Saves every step: the record first, when it changed, then the proxy settings onto the freshest ones so
    // changes made on the other tabs are kept. The proxy answers on the record's names and the other addresses.
    // save
    // Saves every step, the Save Bar's onSave. The record goes first, when it changed, then the proxy settings onto
    // the freshest ones so changes made on the other tabs are kept. The proxy answers on the record's names and the
    // other addresses.
    //
    // Output
    // [Promise]: Resolves once saved, or rejects with an Error whose message the Save Bar shows.
    function save() {
        // Let's Encrypt is only used once its terms are accepted, so with the proxy on the box has to be ticked to
        // choose it.
        if (Shared.getEl('enabled').checked && Shared.getEl('certMode').value === 'Automatic' && !Shared.getEl('certTerms').checked) {
            setStepOpen('Certificate');
            return Promise.reject(new Error(t.tr('ErrorAcceptTerms')));
        }

        setSaving(true);
        var recordSaved = false;
        var changedRecord = recordNeedsSave();
        var before = [];
        return namesNow().then(function (names) {
            before = names;
            return saveRecord();
        }).then(function () {
            recordSaved = true;
            return saveProxyHostnames(Shared, before, null, function (fresh) { return collect(fresh || settings); });
        }).then(function (result) {
            if (result && result.Settings) fill(result.Settings);
            if (result && result.Status) render(result.Status);
            saveBar.setDirty(false);
        }).catch(function (err) {
            var reply = err && err.pageText ? Promise.resolve(err.pageText) : problemText(err, t.tr('ErrorSave'));
            return reply.then(function (text) {
                var prefix = !recordSaved ? (changedRecord ? t.tr('ErrorRecordNotSaved') + ' ' : '')
                    : changedRecord ? t.tr('ErrorProxyNotSaved') + ' ' : '';
                throw new Error(prefix + text);
            });
        }).finally(function () {
            setSaving(false);
            refresh();
        });
    }

    function retryRouter() {
        var button = Shared.getEl('btnRouterRetry');
        if (button.disabled) return;
        button.disabled = true;
        Shared.setStatus('routerStatus', t.tr('StatusAskingRouter'), false, { timeout: 0 });
        Shared.apiRequest('Proxy/Router/Refresh', 'POST').then(function (r) {
            var text = !r ? t.tr('MessageDone')
                : r.Mapped ? routerStateText(r)
                    : r.BehindCgnat ? t.tr('RouterSharedAddress')
                        : r.Error || t.tr('RouterNotOpened');
            Shared.setStatus('routerStatus', text, !(r && r.Mapped), { timeout: 0 });
        }).catch(function () {
            Shared.setStatus('routerStatus', t.tr('ErrorAskRouter'), true, { timeout: 0 });
        }).then(function () {
            button.disabled = false;
            refresh();
        });
    }

    // The form is saved first, so Jellyfin is trusted with the settings shown here.
    function trust() {
        var button = Shared.getEl('btnTrust');
        if (button.disabled) return;
        button.disabled = true;
        trustTheProxy(Shared, 'trustStatus', function () { return saveBar.save(); }).then(function () {
            button.disabled = false;
            refresh();
        });
    }

    function restore() {
        var button = Shared.getEl('btnRestore');
        if (button.disabled) return;
        var options = { title: t.tr('HeaderUndoTrust'), confirmText: t.tr('ButtonUndo'), destructive: true };
        confirmDialog(t.tr('ConfirmUndoTrust'), options).then(function (ok) {
            if (!ok) return;
            button.disabled = true;
            Shared.apiRequest('Proxy/Restore', 'POST').then(function (result) {
                Shared.setStatus('trustStatus', (result && result.Message) || t.tr('MessageRestored'), !(result && result.Success), { timeout: 0 });
            }).catch(function () {
                Shared.setStatus('trustStatus', t.tr('ErrorRestore'), true, { timeout: 0 });
            }).then(function () {
                button.disabled = false;
                refresh();
            });
        });
    }

    function loadRoot() {
        rootLoaded = true;
        Shared.apiRequest('Proxy/Certificate/Root', 'GET').then(function (root) {
            rootPem = (root && root.Pem) || '';
            Shared.getEl('certRootExpires').textContent = root && root.NotAfterUtc ? formatDate(root.NotAfterUtc) : '';

            // Four lines of eight pairs, as phones and Keychain Access group them, so it can be read off and compared.
            var pairs = ((root && root.Fingerprint) || '').split(':');
            var lines = [];
            for (var i = 0; i < pairs.length; i += 8) lines.push(pairs.slice(i, i + 8).join(' '));
            Shared.getEl('certRootFingerprint').textContent = lines.join('\n');
        }).catch(function () {
            rootLoaded = false;
        });
    }

    // Saved as a .crt file, which Windows, macOS, iOS and Android all open as a certificate to install.
    function downloadRoot() {
        if (!rootPem) return;
        var blob = new Blob([rootPem], { type: 'application/x-x509-ca-cert' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'remote-access-root.crt';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(function () { URL.revokeObjectURL(url); }, 0);
    }

    // ===== The steps =====

    // The steps in order. The key names the step's elements: step, body, icon, state and text followed by the key.
    var STEPS = [
        { key: 'Power', titleKey: 'HeaderProxyOn' },
        { key: 'Address', titleKey: 'HeaderAddress' },
        { key: 'Certificate', titleKey: 'HeaderCertificate' },
        { key: 'Router', titleKey: 'HeaderRouter' },
        { key: 'Trust', titleKey: 'HeaderTrustProxy' },
        { key: 'Reach', titleKey: 'HeaderReachable' }
    ];

    // The last test from outside run from this page, kept until the status carries a newer one.
    var lastReach = null;
    // Steps are folded or opened once per visit, so the poller never folds a step someone is working in.
    var arranged = false;

    function step(state, word, text, idle) {
        return { state: state, word: word, text: text || '', idle: !!idle };
    }

    // A step that only matters once the proxy is on, while it is off. It waits quietly and starts folded.
    function idleStep() {
        return step('gray', t.tr('StepProxyOff'), t.tr('StepUsedOnceOn'), true);
    }

    // The names chosen for the proxy, or the one in its public address when the settings list none.
    function chosenNames(st) {
        var names = (settings && settings.Hostnames) || [];
        if (names.length) return names;
        var m = /^https?:\/\/([^/:]+)/i.exec(st.PublicUrl || '');
        return m ? [m[1]] : [];
    }

    // The newer of the test result kept here and the one in the status.
    function currentReach(st) {
        var fromStatus = st.Reachability || null;
        if (!lastReach) return fromStatus;
        if (!fromStatus || !fromStatus.CheckedUtc) return lastReach;
        return new Date(fromStatus.CheckedUtc).getTime() >= new Date(lastReach.CheckedUtc || 0).getTime() ? fromStatus : lastReach;
    }

    function assessPower(st) {
        if (st.Running) return step('green', t.tr('StepRunning'), t.format('StepOnPorts', st.HttpPort, st.HttpsPort));
        if (st.Enabled) return step('red', t.tr('StepNotRunning'), st.Error || t.tr('StepOnNotRunning'));
        return step('gray', t.tr('Off'), t.tr('StepTurnOn'));
    }

    // The name endings only a home network knows, the same list the server uses. Phones outside cannot open them.
    var PRIVATE_ENDINGS = ['lan', 'local', 'localdomain', 'localhost', 'home', 'internal', 'intranet', 'corp', 'private', 'test', 'invalid', 'example'];

    function isPublicName(name) {
        var labels = String(name || '').replace(/^\*\./, '').toLowerCase().split('.');
        if (labels.length < 2 || /^[0-9.]+$/.test(name) || name.indexOf(':') >= 0) return false;
        return PRIVATE_ENDINGS.indexOf(labels[labels.length - 1]) < 0 && !/\.home\.arpa$/.test(name);
    }

    // With the proxy off, the address step is only about the DDNS record.
    function assessRecord() {
        if (!recordsLoaded) return step('gray', t.tr('StepChecking'), t.tr('StepLoadingRecord'));
        var r = record;
        if (!r) return step('gray', t.tr('StepNoRecord'), t.tr('StepFillRecord'));
        if (r.Enabled === false) return step('gray', t.tr('StepPaused'), t.tr('StepUpdatesPaused'));
        if (!r.LastCheckedUtc) return step('gray', t.tr('StepNotUpdatedYet'), t.tr('StepSelectUpdateNow'));
        var checked = new Date(r.LastCheckedUtc).getTime();
        var recent = !isNaN(checked) && (Date.now() - checked) < 86400000;
        if (!r.LastSuccess || !recent) return step('red', t.tr('StepFailing'), t.tr('StepNotUpdatedInDay'));
        return step('green', t.tr('StepUpToDate'), t.tr('StepRecordPointsHere'));
    }

    function assessAddress(st) {
        if (!st.Enabled) return assessRecord();
        var names = chosenNames(st);
        if (!names.length) {
            var where = record && providers && !namesTheProxy(providers.normalize(record.Provider))
                ? t.tr('StepAddNameAdvanced')
                : t.tr('StepEnterHostname');
            return step('amber', t.tr('StepNotSet'), where);
        }
        if (!names.some(isPublicName)) return step('amber', t.tr('BadgeHomeOnly'), t.format('StepOnlyAtHome', listText(names)));
        var n = st.Name;
        // An older server does not look the name up, so a chosen name is as far as this can check.
        if (!n) return step('green', t.tr('StepChosen'), t.format('StepPeopleReach', listText(names)));
        var host = n.Hostname || names[0];
        if (n.Error) return step('red', t.tr('StepNotFound'), t.format('StepLookupFailed', host) + ' ' + n.Error);
        if (n.Resolves) return step('green', t.tr('StepReady'), t.format('StepPointsHere', host));
        if (!(n.Addresses || []).length) return step('amber', t.tr('StepNotPointedHere'), t.format('StepPointsNowhere', host));
        return step('amber', t.tr('StepNotPointedHere'), t.format('StepPointsElsewhere', host));
    }

    function assessCertificate(st) {
        if (!st.Enabled) return idleStep();
        var cert = st.Certificate || {};
        var acme = st.Acme || {};
        var chosen = (settings && settings.Certificate) || {};
        var mode = cert.Mode || chosen.Mode || 'Automatic';
        if (mode === 'Automatic' && !chosen.AcceptTerms) {
            return step('amber', t.tr('StepTerms'), t.tr('StepAcceptTerms'));
        }
        if (cert.Loaded) {
            if ((cert.UncoveredHostnames || []).length) return step('red', t.tr('StepWrongNames'), t.format('StepCertificateMissesNames', listText(cert.UncoveredHostnames)));
            if (expired(cert.NotAfterUtc)) return step('red', t.tr('StepExpired'), t.format('StepCertificateExpired', formatDate(cert.NotAfterUtc)));
            if (cert.Mode === 'SelfSigned') return step('amber', t.tr('OptionSelfSigned'), t.tr('StepSelfSigned'));
            if (cert.Error) return step('amber', t.tr('StepCheckFile'), t.tr('StepOldFileUsed'));
            if (soon(cert.NotAfterUtc)) return step('amber', t.tr('StepExpiresSoon'), t.format('StepCertificateExpires', formatDate(cert.NotAfterUtc)));
            return step('green', t.tr('StepReady'), certificateInUse(cert));
        }
        if (!st.Running) return step('gray', t.tr('StepNotChecked'), t.tr('StepCheckedOnceRunning'));
        if (mode === 'None') return step('amber', t.tr('StepNotSet'), t.tr('StepNoCertificate'));
        if (mode !== 'Automatic') return step('red', t.tr('StepCannotLoad'), t.tr('ErrorCertificateLoad') + (cert.Error ? ' ' + cert.Error : ''));
        if (acme.Issuing) return step('amber', t.tr('StepIssuing'), t.tr('StepLetsEncryptChecking'));
        if (acme.LastError) return step('red', t.tr('LabelFailed'), t.tr('StepLetsEncryptFailed') + ' ' + acme.LastError);
        if (!(acme.Names || []).length) return step('amber', t.tr('StepWaiting'), t.tr('StepNeedsAddress'));
        return step('amber', t.tr('StepRequested'), acme.Method === 'Dns'
            ? t.format('StepChecksThroughDns', listText(acme.DnsProviders))
            : t.tr('StepChecksOverPort80'));
    }

    // certificateInUse
    // Says which names the certificate in use covers and until when.
    function certificateInUse(cert) {
        var covers = listText(cert.Names);
        var until = formatDate(cert.NotAfterUtc);
        if (covers) return until ? t.format('StepCoversUntil', covers, until) : t.format('StepCovers', covers);
        return until ? t.format('StepInUseUntil', until) : t.tr('StepInUse');
    }

    function assessRouter(st) {
        if (!st.Enabled) return idleStep();
        var r = st.Router;
        var reach = currentReach(st);
        var reached = !!(reach && reach.Reachable === true);
        if (r && r.BehindCgnat) return step('red', t.tr('StepSharedAddress'), routerStateText(r));
        if (r && r.Mapped) return step('green', t.tr('StepForwarded'), routerStateText(r));
        // Ports forwarded by hand cannot be seen from here, but a test from outside that got through proves them.
        if (reached) return step('green', t.tr('StepForwarded'), t.tr('StepOutsideReached'));
        if (!r) return step('gray', t.tr('StepNotChecked'), t.tr('StepForwardByHandBelow'));
        return step('amber', t.tr('StepForwardByHand'), r.Enabled
            ? t.tr('RouterNotOpened') + ' ' + t.tr('StepForwardThemByHand')
            : t.tr('RouterAutomaticOff') + ' ' + t.tr('StepForwardByHandBelow'));
    }

    function assessTrust(st) {
        // Undo stays at hand while Jellyfin is still set up for the proxy, even with the proxy off.
        if (!st.Enabled && (!st.TakeoverPhase || st.TakeoverPhase === 'Unmanaged')) return idleStep();
        if (st.TakeoverPhase === 'Managed' && st.JellyfinTrustsProxy === false) return step('red', t.tr('StepNotTrusted'), t.tr('StepTrustAgain'));
        if (st.TakeoverPhase === 'Managed') return step('green', t.tr('StepTrusted'), t.tr('StepSeesRealAddress'));
        if (st.TakeoverPhase === 'PendingRestart') return step('amber', t.tr('StepRestarting'), t.tr('StepRestartingToTrust'));
        if (st.JellyfinTrustsProxy) return step('green', t.tr('StepTrusted'), t.tr('StepTrustsThroughSettings'));
        if (st.TakeoverError) return step('red', t.tr('LabelFailed'), t.tr('StepTrustFailed'));
        return step('amber', t.tr('TextNotYet'), t.tr('StepTurnedAwayUntil'));
    }

    function assessReach(st) {
        if (!st.Enabled) return idleStep();
        var reach = currentReach(st);
        if (!reach || (reach.Reachable == null && !reach.Error)) return step('gray', t.tr('StepNotTested'), t.tr('StepSelectTest'));
        var when = formatTime(reach.CheckedUtc);
        var nodes = reach.Nodes || [];
        var ok = nodes.filter(function (x) { return x.Ok; }).length;
        if (reach.Reachable === true) return step('green', t.tr('StepReachable'), nodes.length ? t.format('StepReachedFromPlaces', ok, nodes.length) : t.tr('StepReachedFromOutside'));
        if (reach.Reachable === false) return step('red', t.tr('StepNotReachable'), reach.Error || (when ? t.format('StepNothingReachedOn', when) : t.tr('StepNothingReached')));
        return step('amber', t.tr('StepTestFailed'), t.tr('ErrorTestRun') + ' ' + reach.Error);
    }

    // Opens a step, such as the one a save problem points to.
    function setStepOpen(key) {
        if (checklist) checklist.open(key);
    }

    // Writes each step's state into the checklist, and its word and reason at the top of its body, such as
    // Not pointed here. On the first render of a visit the first step that needs something opens.
    function renderSteps(results) {
        var states = {};
        STEPS.forEach(function (s, i) {
            states[s.key] = stepState(results[i]);
            var box = Shared.getEl('text' + s.key);
            var word = document.createElement('strong');
            word.textContent = results[i].word + '.';
            box.replaceChildren(word, document.createTextNode(results[i].text ? ' ' + results[i].text : ''));
        });
        checklist.setValue(states);
        if (arranged) return;
        arranged = true;
        var first = STEPS.filter(function (s) { return states[s.key] === 'attention' || states[s.key] === 'todo'; })[0];
        if (first) checklist.open(first.key);
    }

    // The note above the checklist, for someone using only Dynamic DNS or once every step is done.
    function renderSummary(st, results) {
        var box = Shared.getEl('summaryNote');
        var done = results.every(function (r) { return r.state === 'green'; });
        var text = '';
        box.className = 'base-info';
        if (!st.Enabled) {
            text = t.tr('SummaryProxyOff');
            box.className = 'base-neutral';
        } else if (done) {
            text = st.PublicUrl ? t.format('SummaryReachableAt', st.PublicUrl) : t.tr('SummaryReachable');
            box.className = 'base-success';
        }
        show('summaryNote', text);
    }

    function renderAddressDetails(st, result) {
        var n = st.Name;
        var mismatch = !!st.Enabled && !!n && result.state !== 'green' && !!n.Hostname && !n.Error;
        Shared.setVisible('nameDetails', mismatch);
        if (mismatch) {
            Shared.getEl('nameHostname').textContent = n.Hostname;
            Shared.getEl('nameAddresses').textContent = (n.Addresses || []).length ? listText(n.Addresses) : t.tr('TextNothingYet');
            Shared.getEl('namePublic').textContent = n.PublicAddress || '';
            Shared.setVisible('namePublicRow', !!n.PublicAddress);
        }
    }

    function renderCertificate(st) {
        describeMethod(st);
        var cert = st.Certificate || {};
        Shared.setVisible('certStatus', !!cert.Loaded);
        Shared.getEl('certNames').textContent = listText(cert.Names);
        Shared.getEl('certExpires').textContent = formatDate(cert.NotAfterUtc);
        // The issuer's common name alone. The rest of the distinguished name is noise here.
        var issuer = cert.Issuer || '';
        var cn = /(?:^|,\s*)CN=([^,]+)/.exec(issuer);
        Shared.getEl('certIssuer').textContent = cn ? cn[1].trim() : issuer;
        // The step's own text already names most problems. A file that failed to reload is the one it does not explain.
        show('certProblem', cert.Loaded && cert.Error ? t.tr('ErrorCertificateLoad') + ' ' + cert.Error : '');
        showCertActions();
    }

    function renderRouter(st, result) {
        var r = st.Router;
        show('routerError', r && !r.Mapped && !r.BehindCgnat ? r.Error : '');
        var manual = result.state === 'amber' || result.state === 'gray';
        Shared.setVisible('routerManual', manual);
        if (manual) {
            // The address the router itself reported is the one it would forward to.
            var target = Object.assign({}, st, { LanAddress: (r && r.LanAddress) || st.LanAddress || st.DetectedLanAddress });
            Shared.getEl('routerInstruction').innerHTML = routerInstructionHtml(Shared, target);
        }
    }

    function renderTrust(st, result) {
        show('trustError', result.state === 'green' ? '' : st.TakeoverError);
        show('jellyfinExposed', st.JellyfinExposedAt ? t.format('WarningJellyfinExposed', st.JellyfinExposedAt, st.JellyfinHttpPort) : '');
        var managed = st.TakeoverPhase === 'Managed' || st.TakeoverPhase === 'PendingRestart';
        Shared.setVisible('btnRestore', managed);
        // Trusting again keeps the original snapshot, so Undo still puts back what was there first.
        Shared.setVisible('btnTrust', !managed || (st.TakeoverPhase === 'Managed' && st.JellyfinTrustsProxy === false));
    }

    // The test's result as a titled card: when it ran, then each place it was tried from and how that went.
    function renderReachNodes(st) {
        var reach = currentReach(st);
        var nodes = (st.Enabled && reach && reach.Nodes) || [];
        var box = Shared.getEl('reachNodes');
        Shared.setVisible(box, nodes.length > 0);
        if (!nodes.length) { box.innerHTML = ''; return; }
        var when = formatTime(reach.CheckedUtc);
        var title = '<div class="base-record-row"><strong>' + Shared.escapeHtml(t.tr('HeaderOutsideCheck')) + '</strong>' +
            '<span class="base-record-label">' + Shared.escapeHtml(when) + '</span></div>';
        box.innerHTML = title + nodes.map(function (x) {
            var badge = Shared.badge(x.Ok ? 'green' : 'red', x.Ok ? t.tr('BadgeReached') : t.tr('LabelFailed'));
            var error = !x.Ok && x.Error ? '<span class="base-record-label">' + Shared.escapeHtml(x.Error) + '</span> ' : '';
            return '<div class="base-record-row"><span>' + Shared.escapeHtml(x.Location || t.tr('Unknown')) + '</span>' +
                '<span>' + error + badge + '</span></div>';
        }).join('');
    }

    function render(st) {
        if (!st || !settings) return;
        lastStatus = st;
        var results = [assessPower(st), assessAddress(st), assessCertificate(st), assessRouter(st), assessTrust(st), assessReach(st)];
        renderSummary(st, results);
        renderSteps(results);

        show('folderProblem', st.FolderProblem);
        show('everyoneLocal', st.Enabled && st.EveryoneLooksLocal
            ? t.tr('WarningEveryoneLocal')
            : '');
        renderCountryNote(st);

        renderAddressDetails(st, results[1]);
        renderCertificate(st);
        renderRouter(st, results[3]);
        renderTrust(st, results[4]);
        renderReachNodes(st);
    }

    function countryName(code) {
        try {
            return new Intl.DisplayNames([t.language || navigator.language || 'en'], { type: 'region' }).of(code) || code;
        } catch (e) {
            return code;
        }
    }

    // Names countries in bold, green for the ones let in and red for the ones refused.
    function countryList(names, css) {
        // The list is joined around markers, so the language's own words for "and" stay plain text.
        var marked = names.map(function (n, i) { return '\u0001' + i + '\u0002'; });
        return Shared.escapeHtml(listText(marked)).replace(/\u0001(\d+)\u0002/g, function (m, i) {
            return '<strong class="' + css + '">' + Shared.escapeHtml(names[+i]) + '</strong>';
        });
    }

    // Says which countries can connect, so it is clear access is limited, with the way to change it.
    function renderCountryNote(st) {
        var box = Shared.getEl('countryNote');
        var adv = (settings && settings.Advanced) || {};
        var mode = adv.CountryMode || 'ServerCountry';
        var chosen = (adv.Countries || []).map(countryName);
        var html = '';
        if (st.Enabled && mode === 'ServerCountry') {
            // {0} and {1} open and close the bold part of the sentence.
            var bold = ['<strong class="ra-country-unknown">', '</strong>'];
            html = st.ServerCountry
                ? htmlFormat(Shared, 'CountryOnlyFrom', [countryList([st.ServerCountry].concat(chosen), 'ra-country-known')])
                : chosen.length
                    ? htmlFormat(Shared, 'CountryUnknownPlus', bold.concat([countryList(chosen, 'ra-country-known')]))
                    : htmlFormat(Shared, 'CountryUnknown', bold);
        } else if (st.Enabled && mode === 'AllowOnly' && chosen.length) {
            html = htmlFormat(Shared, 'CountryOnlyFrom', [countryList(chosen, 'ra-country-known')]);
        } else if (st.Enabled && mode === 'Block' && chosen.length) {
            html = htmlFormat(Shared, 'CountryRefused', [countryList(chosen, 'ra-country-blocked')]);
        }
        Shared.setVisible('countryNote', !!html);
        if (html) box.innerHTML = html + ' ' + htmlFormat(Shared, 'CountryChangeIn', [linkHtml(Shared, '#/configurationpage?name=remoteaccess_advanced', 'LinkAdvancedBlocking')]);
    }

    function testReach() {
        var button = Shared.getEl('btnReach');
        if (button.disabled) return;
        button.disabled = true;
        Shared.setStatus('reachStatus', t.tr('StatusTestingOutside'), false, { timeout: 0 });
        Shared.apiRequest('Proxy/Reachability', 'POST').then(function (result) {
            if (result) lastReach = result;
            Shared.setStatus('reachStatus', '', false);
            if (lastStatus) render(lastStatus);
        }).catch(function () {
            Shared.setStatus('reachStatus', t.tr('ErrorTestRun'), true, { timeout: 0 });
        }).then(function () {
            button.disabled = false;
            refresh();
        });
    }

    // ===== Loading and polling =====

    // Reads both, since the address and certificate steps depend on the saved settings too. The form keeps
    // whatever is typed, so the poller never undoes a choice that is not saved yet.
    function refresh() {
        if (document.hidden) return Promise.resolve();
        return Promise.all([getSettings(), getStatus()]).then(function (results) {
            if (results[0]) settings = results[0];
            render(results[1]);
        }).catch(function () { /* the poller tries again */ });
    }

    function load() {
        baseline = null;
        arranged = false;
        // The record loads on its own, so a proxy problem never hides it.
        var recordsDone = loadRecords();
        Promise.all([getSettings(), getStatus()]).then(function (results) {
            if (results[0]) fill(results[0]);
            // Wait for the record, so the address step is not judged before it is known.
            return recordsDone.then(function () { render(results[1]); });
        }).catch(function () {
            Shared.getEl('summaryNote').className = 'base-error';
            show('summaryNote', t.tr('ErrorLoadStatus'));
        });
    }

    function bind() {
        checklist = createSetupChecklist({
            steps: STEPS.map(function (s) { return { key: s.key, title: t.tr(s.titleKey), state: 'todo', content: Shared.getEl('body' + s.key) }; })
        });
        Shared.getEl('checklist').appendChild(checklist.element);
        Shared.getEl('certTermsDescription').innerHTML = htmlFormat(Shared, 'DescriptionAcceptTerms', [linkHtml(Shared, 'https://letsencrypt.org/repository/', 'LinkSubscriberAgreement')]);

        // Step 2: the record and Update now.
        Shared.getEl('recProvider').addEventListener('change', onProviderChange);
        Shared.getEl('btnRunNow').addEventListener('click', runNow);

        // Steps 3 to 6.
        Shared.getEl('certMode').addEventListener('change', showCertFields);
        Shared.getEl('btnDownloadRoot').addEventListener('click', downloadRoot);
        Shared.getEl('btnRouterRetry').addEventListener('click', retryRouter);
        Shared.getEl('btnTrust').addEventListener('click', trust);
        Shared.getEl('btnRestore').addEventListener('click', restore);
        Shared.getEl('btnReach').addEventListener('click', testReach);

        saveBar = createSaveBar({ fill: true, form: Shared.getEl('RemoteAccessConfigurationForm'), onSave: save });
        Shared.getEl('saveBar').replaceWith(saveBar.element);
        ['input', 'change'].forEach(function (type) {
            view.addEventListener(type, function () { saveBar.setDirty(isDirty()); });
        });
    }

    Shared = translatedPage(view, {
        pluginId: PLUGIN_ID,
        apiPrefix: 'RemoteAccess',
        tabsKey: 'remoteaccess',
        tabIndex: 1,
        bind: bind,
        isDirty: isDirty,
        load: function (shared, page) {
            load();
            page.createPoller(refresh, 10000).start(false);
        }
    }).shared;
}
