// remoteaccess_dashboard.js
// The Dashboard tab: the share card, where visitors came from, banned addresses and what each address did.

import { confirmDialog, createWorldMap, linkWorldMap, createDataTable, createQrCode, createCollapsibleSection, renderRelative } from './configurationpage?name=remoteaccess_jpkribs_shared.js';
import { PLUGIN_ID, t, translatedPage, tableText, htmlFormat, linkHtml, problemText, showText, MAP_LAYERS, countryCounts, countryRows, countryFilterOptions, activityQuery } from './configurationpage?name=remoteaccess_tabs.js';

// The kinds of activity, each with its name and its badge color, which matches the map layer for the same kind.
var TYPES = [
    { value: 'User', nameKey: 'HeaderUser', color: 'blue' },
    { value: 'Failure', nameKey: 'ActivityFailure', color: 'red' },
    { value: 'Blocked', nameKey: 'HeaderBlocked', color: 'purple' },
    { value: 'Seen', nameKey: 'ActivitySeen', color: 'gray' }
];

export default function (view) {
    'use strict';

    var Shared = null;
    var data = null;
    // While a block, unblock or unban request runs, the row buttons are off so a second click sends nothing.
    var busy = false;
    var map = null;
    var countries = null;
    var banned = null;
    var activity = null;
    var qr = null;
    var share = null;
    // The Activity filters of the last request, so the country filter keeps the country picked.
    var lastFilters = {};
    var placeOptions = '';
    // The Activity rows of the last request, which the table shows a page at a time.
    var activityRows = [];
    var ACTIVITY_PAGE = 50;
    // The Activity table loads itself when it is built, so the first show does not ask again.
    var builtThisShow = false;

    // place
    // The Activity row's country, or Local for your network.
    function place(row) {
        if (row.IsLocal) return t.tr('OptionLocal');
        return row.Country || t.tr('Unknown');
    }

    // shortHost
    // The address without its scheme, which every row would repeat.
    function shortHost(host) {
        return (host || '').replace(/^https?:\/\//, '');
    }

    // typeBadge
    // The badge of a kind of activity, gray with the kind itself for one this page does not know.
    function typeBadge(type) {
        var known = TYPES.filter(function (x) { return x.value === type; })[0];
        return badge(known ? known.color : 'gray', known ? t.tr(known.nameKey) : type);
    }

    // badge
    // A colored label for a table cell.
    function badge(color, text) {
        var el = document.createElement('span');
        el.className = 'base-badge ' + color;
        el.textContent = text;
        return el;
    }

    // mono
    // A cell in the mono font, for addresses.
    function mono(text) {
        var el = document.createElement('span');
        el.className = 'base-mono';
        el.textContent = text || '';
        return el;
    }

    // rowButton
    // A small button for a table row. The accessible name says which address or country it acts on, since every
    // row has one.
    //
    // Inputs
    // label [string]: The button's text.
    // variant [string]: secondary or destructive.
    // attrs [object]: Data attributes that name the action, or null for a button that is always off.
    // title [string]: Why the button is off, or empty.
    // name [string]: The accessible name.
    //
    // Output
    // [HTMLElement]: The button.
    function rowButton(label, variant, attrs, title, name) {
        var b = document.createElement('button');
        b.setAttribute('is', 'emby-button');
        b.type = 'button';
        b.className = 'raised base-button small ' + variant;
        Object.keys(attrs || {}).forEach(function (k) { b.setAttribute('data-' + k, attrs[k]); });
        if (title) b.title = title;
        if (name) b.setAttribute('aria-label', name);
        b.disabled = !attrs || busy;
        var span = document.createElement('span');
        span.textContent = label;
        b.appendChild(span);
        return b;
    }

    // action
    // The one button each Activity row has. A banned address can be unbanned, your network is never blocked so
    // its button is off, a blocked address unblocks itself, an address its country's rule refuses unblocks the
    // country, and anything else can be blocked.
    function action(r) {
        if (r.Banned) return unbanButton(r.Ip);
        if (r.Exempt) return rowButton(t.tr('ButtonBlock'), 'destructive', null, t.tr('TextNeverBlocked'), t.format('ButtonBlockAddress', r.Ip));
        if (r.Listed) return rowButton(t.tr('ButtonUnblock'), 'secondary', { unblock: r.Ip }, '', t.format('ButtonUnblockAddress', r.Ip));
        // Blocked only by a range, where unblocking one address would not help, so say where it is changed.
        if (r.Covered) return rowButton(t.tr('ButtonUnblock'), 'secondary', null, t.tr('TextBlockedByRange'), t.format('ButtonUnblockAddress', r.Ip));
        if (r.CountryBlocked) {
            return rowButton(t.tr('ButtonUnblock'), 'secondary', { 'unblock-country': r.CountryCode, country: r.Country }, t.format('TextAllowCountry', r.Country), t.format('ButtonUnblockCountryFor', r.Country, r.Ip));
        }
        return rowButton(t.tr('ButtonBlock'), 'destructive', { block: r.Ip }, '', t.format('ButtonBlockAddress', r.Ip));
    }

    // unbanButton
    // The Unban button of a banned address, in the Banned and Activity tables.
    function unbanButton(ip) {
        return rowButton(t.tr('ButtonUnban'), 'secondary', { unban: ip }, '', t.format('ButtonUnbanAddress', ip));
    }

    // showsArea
    // Cities are looked up only when Location is set to City, and then the Activity table shows them.
    function showsArea() {
        return !!(data && data.Settings && data.Settings.Location === 'City');
    }

    // renderMap
    // Shades the map and fills the country table beside it for the layers that are on.
    function renderMap() {
        map.setCounts(countryCounts(data));
        countries.setRows(countryRows(data, map.getActive()));
    }

    // showLayers
    // Shows a count column only while its layer is on.
    function showLayers(active) {
        MAP_LAYERS.forEach(function (layer) { countries.setColumnHidden(layer.column, active.indexOf(layer.key) < 0); });
        if (data) countries.setRows(countryRows(data, active));
    }

    // apply
    // Draws everything the People reply holds apart from the Activity rows, which its table draws.
    function apply(d) {
        data = d || {};
        renderMap();
        banned.setRows(data.Banned || []);
        activity.setColumnHidden('area', !showsArea());
        var options = countryFilterOptions(data, ((lastFilters.place || [])[0]) || '');
        var key = JSON.stringify(options);
        if (key !== placeOptions) {
            placeOptions = key;
            activity.setFilterOptions('place', options);
        }
        var note = '';
        if (data.Settings && data.Settings.Enabled === false) note = t.tr('HistoryOffNote');
        else if (data.Recording === false) note = t.tr('HistoryRecordedWhileOn');
        showText(Shared, 'peopleOff', note);
    }

    // pageOf
    // One page of the Activity rows, as the table asks for it while it scrolls.
    function pageOf(query) {
        var size = (query && query.pageSize) || ACTIVITY_PAGE;
        var start = (Math.max(1, (query && query.page) || 1) - 1) * size;
        return { Items: activityRows.slice(start, start + size), TotalCount: activityRows.length };
    }

    // fetchActivity
    // Loads the People reply for the Activity table's filters and draws the rest of the page from it. Later pages
    // come from the rows already loaded, since the server sends them all at once.
    function fetchActivity(query) {
        // Base counts pages from 1.
        if (query && query.page > 1) return Promise.resolve(pageOf(query));
        lastFilters = (query && query.filters) || {};
        return Shared.apiRequest(activityQuery(lastFilters), 'GET').then(function (d) {
            apply(d);
            activityRows = (d && d.Activity) || [];
            return pageOf(query);
        }).catch(function () {
            Shared.setStatus('activityStatus', t.tr('ErrorLoadDashboard'), true, { timeout: 0 });
            activityRows = [];
            return pageOf(query);
        });
    }

    // setBusy
    // Turns every row button off while a change is sent, and back on after.
    function setBusy(on) {
        busy = on;
        Array.prototype.slice.call(view.querySelectorAll('[data-unban], [data-block], [data-unblock], [data-unblock-country]')).forEach(function (b) {
            b.disabled = on;
        });
    }

    // post
    // Sends one change, reports it under the Activity heading and reloads.
    function post(path, done, failed) {
        if (busy) return;
        setBusy(true);
        Shared.apiRequest(path, 'POST').then(function () {
            Shared.setStatus('activityStatus', done, false);
        }).catch(function (err) {
            return problemText(err, failed).then(function (message) {
                Shared.setStatus('activityStatus', message, true);
            });
        }).then(function () {
            setBusy(false);
            activity.reload();
        });
    }

    // unblockCountry
    // A country rule covers many people, so this one asks first.
    function unblockCountry(code, name) {
        var options = { title: t.tr('HeaderUnblockCountry'), confirmText: t.tr('ButtonUnblock'), cancelText: t.tr('ButtonCancel') };
        confirmDialog(t.format('ConfirmUnblockCountry', name), options).then(function (ok) {
            if (ok) post('People/UnblockCountry?code=' + encodeURIComponent(code), t.format('MessageUnblocked', name), t.format('ErrorUnblock', name));
        });
    }

    // onRowAction
    // Runs the button a row holds, for the Banned and Activity tables.
    function onRowAction(e) {
        if (busy) return;
        var b = e.target.closest('button[data-unban], button[data-block], button[data-unblock], button[data-unblock-country]');
        if (!b || b.disabled) return;
        e.stopPropagation();
        var ip;
        if ((ip = b.getAttribute('data-unban'))) {
            post('People/Unban?ip=' + encodeURIComponent(ip), t.format('MessageUnbanned', ip), t.format('ErrorUnban', ip));
        } else if ((ip = b.getAttribute('data-block'))) {
            post('People/Block?ip=' + encodeURIComponent(ip), t.format('MessageBlocked', ip), t.format('ErrorBlock', ip));
        } else if ((ip = b.getAttribute('data-unblock'))) {
            post('People/Unblock?ip=' + encodeURIComponent(ip), t.format('MessageUnblocked', ip), t.format('ErrorUnblock', ip));
        } else {
            unblockCountry(b.getAttribute('data-unblock-country'), b.getAttribute('data-country'));
        }
    }

    // buildShare
    // The share card, a fixed section with the address as a QR code and its kind as a badge.
    function buildShare() {
        var body = Shared.getEl('shareBody');
        share = createCollapsibleSection({ title: t.tr('HeaderShareServer'), collapsible: false, badge: { label: t.tr('BadgePublic'), color: 'green' }, content: body });
        body.classList.remove('hidden');
        Shared.getEl('shareHost').appendChild(share.element);
        Shared.getEl('shareHomeOnly').innerHTML = htmlFormat(Shared, 'ShareHomeOnly', [linkHtml(Shared, '#/configurationpage?name=remoteaccess_configuration', 'TabConfiguration')]);
        qr = createQrCode({
            label: t.tr('LabelQrCode'),
            fileName: 'jellyfin-qr.png',
            copyImageText: t.tr('ButtonCopyImage'),
            downloadText: t.tr('Download'),
            copiedText: t.tr('MessageCopied'),
            copyFailedText: t.tr('ErrorCopy'),
            tooLongText: t.tr('ErrorQrTooLong')
        });
        Shared.getEl('shareQr').appendChild(qr.element);
    }

    // loadShare
    // The address people use from the internet. The card stays hidden until Remote Access has a public name.
    function loadShare() {
        return Shared.apiRequest('Share', 'GET').then(function (s) {
            var url = (s && s.Url) || '';
            Shared.setVisible('shareHost', !!url);
            if (!url) return;
            qr.setValue(url);
            share.setBadge(s.HomeOnly ? { label: t.tr('BadgeHomeOnly'), color: 'orange' } : { label: t.tr('BadgePublic'), color: 'green' });
            Shared.setVisible('shareNote', !s.HomeOnly);
            Shared.setVisible('shareHomeOnly', !!s.HomeOnly);
            Shared.setVisible('btnShare', typeof navigator.share === 'function');
        }).catch(function () {
            Shared.setVisible('shareHost', false);
        });
    }

    // buildTables
    // The world map and its country table, the Banned table and the Activity table.
    function buildTables() {
        map = createWorldMap({
            layers: MAP_LAYERS.map(function (l) { return { key: l.key, label: t.tr(l.labelKey), color: l.color }; }),
            label: t.tr('LabelWorldMap'),
            onLayersChange: showLayers
        });
        Shared.getEl('worldMap').appendChild(map.element);

        var counts = MAP_LAYERS.map(function (l) {
            return { key: l.column, label: t.tr(l.labelKey), icon: l.icon, align: 'end' };
        });
        countries = createDataTable(Object.assign(tableText(), {
            columns: [{ key: 'name', label: t.tr('HeaderCountry') }].concat(counts, [
                { key: 'last', label: t.tr('HeaderLast'), width: 'auto', value: function (r) { return new Date(r.last); }, render: renderRelative('last') }
            ]),
            rows: [],
            rowKey: 'code',
            selectable: true,
            widthKey: 'remoteaccess-countries',
            label: t.tr('HeaderCountries'),
            emptyText: t.tr('EmptyCountries')
        }));
        Shared.getEl('countryTable').appendChild(countries.element);
        linkWorldMap(map, countries, { field: 'code', rowKey: 'code' });

        banned = createDataTable(Object.assign(tableText(), {
            columns: [
                { key: 'Ip', label: t.tr('HeaderIp'), width: 'auto', render: function (b) { return mono(b.Ip); } },
                { key: 'Country', label: t.tr('HeaderCountry'), value: function (b) { return b.Country || t.tr('Unknown'); } },
                { key: 'Failures', label: t.tr('HeaderFailures'), align: 'end', icon: 'warning' },
                { key: 'BannedUtc', label: t.tr('HeaderBanned'), width: 'auto', value: function (b) { return new Date(b.BannedUtc); }, render: renderRelative('BannedUtc') },
                { key: 'UntilUtc', label: t.tr('HeaderEnds'), width: 'auto', value: function (b) { return b.UntilUtc ? new Date(b.UntilUtc) : null; }, render: renderRelative('UntilUtc', { emptyText: t.tr('TextUntilLifted') }) },
                { key: 'action', label: t.tr('HeaderAction'), sortable: false, width: 'auto', render: function (b) { return unbanButton(b.Ip); } }
            ],
            rows: [],
            rowKey: 'Ip',
            widthKey: 'remoteaccess-banned',
            label: t.tr('LabelBannedTable'),
            emptyText: t.tr('EmptyBanned')
        }));
        Shared.getEl('banned').appendChild(banned.element);

        activity = createDataTable(Object.assign(tableText(), {
            // Eight columns fill the table at desktop width, so they share it evenly. A clipped value shows on hover,
            // and each column can be dragged wider.
            columns: [
                { key: 'Type', label: t.tr('LabelType'), render: function (r) { return typeBadge(r.Type); } },
                { key: 'User', label: t.tr('HeaderUser') },
                { key: 'Ip', label: t.tr('HeaderIp'), render: function (r) { return mono(r.Ip); } },
                { key: 'Device', label: t.tr('LabelDevice') },
                { key: 'Host', label: t.tr('HeaderAddress'), value: function (r) { return shortHost(r.Host); } },
                { key: 'place', label: t.tr('HeaderCountry'), value: place },
                { key: 'area', label: t.tr('HeaderArea'), hidden: true, value: function (r) { return r.IsLocal ? '' : r.City || ''; } },
                { key: 'LastUtc', label: t.tr('HeaderLastSeen'), value: function (r) { return new Date(r.LastUtc); }, render: renderRelative('LastUtc') },
                { key: 'action', label: t.tr('HeaderAction'), sortable: false, render: action }
            ],
            fetch: fetchActivity,
            rowKey: function (r) { return r.Type + '|' + r.Ip + '|' + r.User + '|' + r.Host; },
            filters: [
                { name: 'type', label: t.tr('HeaderTypes'), options: TYPES.map(function (x) { return { value: x.value, label: t.tr(x.nameKey) }; }) },
                { name: 'place', label: t.tr('HeaderCountries'), options: [{ value: 'local', label: t.tr('OptionLocal') }] }
            ],
            pageSize: ACTIVITY_PAGE,
            maxHeight: '32rem',
            widthKey: 'remoteaccess-activity',
            label: t.tr('HeaderActivity'),
            emptyText: t.tr('EmptyActivity')
        }));
        Shared.getEl('activity').appendChild(activity.element);

        Shared.getEl('banned').addEventListener('click', onRowAction, true);
        Shared.getEl('activity').addEventListener('click', onRowAction, true);
    }

    // bind
    // Builds the page's components once.
    function bind() {
        buildShare();
        buildTables();
        builtThisShow = true;
        Shared.getEl('btnShare').addEventListener('click', function () {
            navigator.share({ title: 'Jellyfin', url: qr.getValue() }).catch(function () { /* closed without sharing */ });
        });
    }

    Shared = translatedPage(view, {
        pluginId: PLUGIN_ID,
        apiPrefix: 'RemoteAccess',
        tabsKey: 'remoteaccess',
        tabIndex: 0,
        bind: bind,
        load: function (shared, page) {
            loadShare();
            if (!builtThisShow) activity.reload();
            builtThisShow = false;
            page.createPoller(function () { activity.reload(); }, 30000).start(false);
        }
    }).shared;
}
