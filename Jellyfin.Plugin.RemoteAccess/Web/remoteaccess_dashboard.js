// remoteaccess_dashboard.js
// The Dashboard tab: the share card, where visitors came from, banned addresses and what each address did.

import { createConfigPage, confirmDialog, createWorldMap, linkWorldMap, createDataTable, createQrCode, createCollapsibleSection, renderRelative } from './configurationpage?name=remoteaccess_jpkribs_shared.js';
import { PLUGIN_ID, TABS, problemText, showText, MAP_LAYERS, countryCounts, countryRows, countryFilterOptions, activityQuery } from './configurationpage?name=remoteaccess_tabs.js';

// The badge color for each kind of activity, matching the map layer for the same kind.
var TYPE_COLORS = { User: 'blue', Failure: 'red', Blocked: 'purple', Seen: 'gray' };

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
        if (row.IsLocal) return 'Local';
        return row.Country || 'Unknown';
    }

    // shortHost
    // The address without its scheme, which every row would repeat.
    function shortHost(host) {
        return (host || '').replace(/^https?:\/\//, '');
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
        if (r.Banned) return rowButton('Unban', 'secondary', { unban: r.Ip }, '', 'Unban ' + r.Ip);
        if (r.Exempt) return rowButton('Block', 'destructive', null, 'Your network and trusted networks are never blocked.', 'Block ' + r.Ip);
        if (r.Listed) return rowButton('Unblock', 'secondary', { unblock: r.Ip }, '', 'Unblock ' + r.Ip);
        // Blocked only by a range, where unblocking one address would not help, so say where it is changed.
        if (r.Covered) return rowButton('Unblock', 'secondary', null, 'Blocked by a range under Advanced.', 'Unblock ' + r.Ip);
        if (r.CountryBlocked) {
            return rowButton('Unblock', 'secondary', { 'unblock-country': r.CountryCode, country: r.Country }, 'Allow connections from ' + r.Country, 'Unblock ' + r.Country + ' for ' + r.Ip);
        }
        return rowButton('Block', 'destructive', { block: r.Ip }, '', 'Block ' + r.Ip);
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
        if (data.Settings && data.Settings.Enabled === false) note = 'History is off, so nothing new is recorded. Turn on Record History under Advanced > History.';
        else if (data.Recording === false) note = 'History is recorded while remote access is on.';
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
            Shared.setStatus('activityStatus', 'Could not load Remote Access.', true, { timeout: 0 });
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
        confirmDialog('Unblock ' + name + '? Individual blocked addresses stay blocked.', { title: 'Unblock Country', confirmText: 'Unblock' }).then(function (ok) {
            if (ok) post('People/UnblockCountry?code=' + encodeURIComponent(code), 'Unblocked ' + name + '.', 'Could not unblock ' + name + '.');
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
            post('People/Unban?ip=' + encodeURIComponent(ip), 'Unbanned ' + ip + '.', 'Could not unban ' + ip + '.');
        } else if ((ip = b.getAttribute('data-block'))) {
            post('People/Block?ip=' + encodeURIComponent(ip), 'Blocked ' + ip + '.', 'Could not block ' + ip + '.');
        } else if ((ip = b.getAttribute('data-unblock'))) {
            post('People/Unblock?ip=' + encodeURIComponent(ip), 'Unblocked ' + ip + '.', 'Could not unblock ' + ip + '.');
        } else {
            unblockCountry(b.getAttribute('data-unblock-country'), b.getAttribute('data-country'));
        }
    }

    // buildShare
    // The share card, a fixed section with the address as a QR code and its kind as a badge.
    function buildShare() {
        var body = Shared.getEl('shareBody');
        share = createCollapsibleSection({ title: 'Share Your Server', collapsible: false, badge: { label: 'Public', color: 'green' }, content: body });
        body.classList.remove('hidden');
        Shared.getEl('shareHost').appendChild(share.element);
        qr = createQrCode({ label: 'QR code for your server\'s address', fileName: 'jellyfin-qr.png' });
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
            share.setBadge(s.HomeOnly ? { label: 'Home Only', color: 'orange' } : { label: 'Public', color: 'green' });
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
            layers: MAP_LAYERS.map(function (l) { return { key: l.key, label: l.label, color: l.color }; }),
            label: 'Where visitors came from',
            onLayersChange: showLayers
        });
        Shared.getEl('worldMap').appendChild(map.element);

        var counts = MAP_LAYERS.map(function (l) {
            return { key: l.column, label: l.label, icon: l.icon, align: 'end' };
        });
        countries = createDataTable({
            columns: [{ key: 'name', label: 'Country' }].concat(counts, [
                { key: 'last', label: 'Last', width: 'auto', value: function (r) { return new Date(r.last); }, render: renderRelative('last') }
            ]),
            rows: [],
            rowKey: 'code',
            selectable: true,
            widthKey: 'remoteaccess-countries',
            label: 'Countries',
            emptyText: 'Nothing from the internet yet.'
        });
        Shared.getEl('countryTable').appendChild(countries.element);
        linkWorldMap(map, countries, { field: 'code', rowKey: 'code' });

        banned = createDataTable({
            columns: [
                { key: 'Ip', label: 'IP', width: 'auto', render: function (b) { return mono(b.Ip); } },
                { key: 'Country', label: 'Country', value: function (b) { return b.Country || 'Unknown'; } },
                { key: 'Failures', label: 'Failures', align: 'end', icon: 'warning' },
                { key: 'BannedUtc', label: 'Banned', width: 'auto', value: function (b) { return new Date(b.BannedUtc); }, render: renderRelative('BannedUtc') },
                { key: 'UntilUtc', label: 'Ends', width: 'auto', value: function (b) { return b.UntilUtc ? new Date(b.UntilUtc) : null; }, render: renderRelative('UntilUtc', { emptyText: 'Until Lifted' }) },
                { key: 'action', label: 'Action', sortable: false, width: 'auto', render: function (b) { return rowButton('Unban', 'secondary', { unban: b.Ip }, '', 'Unban ' + b.Ip); } }
            ],
            rows: [],
            rowKey: 'Ip',
            widthKey: 'remoteaccess-banned',
            label: 'Banned addresses',
            emptyText: 'No banned addresses.'
        });
        Shared.getEl('banned').appendChild(banned.element);

        activity = createDataTable({
            // Eight columns fill the table at desktop width, so they share it evenly. A clipped value shows on hover,
            // and each column can be dragged wider.
            columns: [
                { key: 'Type', label: 'Type', render: function (r) { return badge(TYPE_COLORS[r.Type] || 'gray', r.Type); } },
                { key: 'User', label: 'User' },
                { key: 'Ip', label: 'IP', render: function (r) { return mono(r.Ip); } },
                { key: 'Device', label: 'Device' },
                { key: 'Host', label: 'Address', value: function (r) { return shortHost(r.Host); } },
                { key: 'place', label: 'Country', value: place },
                { key: 'area', label: 'Area', hidden: true, value: function (r) { return r.IsLocal ? '' : r.City || ''; } },
                { key: 'LastUtc', label: 'Last Seen', value: function (r) { return new Date(r.LastUtc); }, render: renderRelative('LastUtc') },
                { key: 'action', label: 'Action', sortable: false, render: action }
            ],
            fetch: fetchActivity,
            rowKey: function (r) { return r.Type + '|' + r.Ip + '|' + r.User + '|' + r.Host; },
            filters: [
                { name: 'type', label: 'Types', options: ['User', 'Failure', 'Blocked', 'Seen'].map(function (t) { return { value: t, label: t }; }) },
                { name: 'place', label: 'Countries', options: [{ value: 'local', label: 'Local' }] }
            ],
            pageSize: ACTIVITY_PAGE,
            maxHeight: '32rem',
            widthKey: 'remoteaccess-activity',
            label: 'Activity',
            emptyText: 'Nothing recorded yet.'
        });
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

    Shared = createConfigPage(view, {
        pluginId: PLUGIN_ID,
        apiPrefix: 'RemoteAccess',
        tabsKey: 'remoteaccess',
        tabIndex: 0,
        tabs: TABS,
        bind: bind,
        load: function (shared, page) {
            loadShare();
            if (!builtThisShow) activity.reload();
            builtThisShow = false;
            page.createPoller(function () { activity.reload(); }, 30000).start(false);
        }
    }).shared;
}
