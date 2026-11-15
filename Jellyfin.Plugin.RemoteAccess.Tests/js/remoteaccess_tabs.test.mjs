// remoteaccess_tabs.test.mjs
// Tests the helpers every Remote Access page shares: the proxy's addresses, the DDNS record, the router text, the
// Dashboard's map and country table, and the Configuration checklist states.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    addressLines, otherAddresses, proxyHostnames, primaryRecord, routerStateText, problemText,
    countryCounts, countryRows, countryFilterOptions, activityQuery, stepState, MAP_LAYERS
} from './configurationpage?name=remoteaccess_tabs.js';
import { COUNTRY_CODES } from './configurationpage?name=remoteaccess_jpkribs_shared.js';

var PEOPLE = {
    PeopleByCountry: [{ CountryCode: 'US', Country: 'United States', Count: 4, LastUtc: '2026-11-15T10:00:00Z' }],
    FailedByCountry: [
        { CountryCode: 'DE', Country: 'Germany', Count: 6, LastUtc: '2026-11-15T09:00:00Z' },
        { CountryCode: 'US', Country: 'United States', Count: 1, LastUtc: '2026-11-15T11:00:00Z' }
    ],
    BlockedByCountry: [{ CountryCode: 'CN', Country: 'China', Count: 12, LastUtc: '2026-11-14T10:00:00Z' }]
};

test('addressLines cleans each line the way the server stores names', () => {
    assert.deepEqual(addressLines(' Media.Example.com. \n\n tv.example.com\r\n'), ['media.example.com', 'tv.example.com']);
});

test('otherAddresses leaves out the names the record covers', () => {
    assert.deepEqual(otherAddresses(['media.example.com', 'TV.example.com'], ['media.example.com']), ['tv.example.com']);
});

test('proxyHostnames puts the record names first and drops duplicates', () => {
    assert.deepEqual(proxyHostnames(['media.example.com'], ['tv.example.com', 'Media.example.com']), ['media.example.com', 'tv.example.com']);
});

test('primaryRecord keeps the first enabled record, else the first', () => {
    assert.equal(primaryRecord([{ Id: 'a', Enabled: false }, { Id: 'b' }]).Id, 'b');
    assert.equal(primaryRecord([{ Id: 'a', Enabled: false }]).Id, 'a');
    assert.equal(primaryRecord([]), null);
});

test('routerStateText warns when the device that answered is not the gateway', () => {
    var text = routerStateText({ Mapped: true, Ports: [80, 443], Device: '192.168.1.2', DeviceIsGateway: false });
    assert.match(text, /ports 80 and 443/);
    assert.match(text, /not this server's default gateway/);
    assert.equal(routerStateText(null), '');
});

test('problemText joins the problems a save lists, and falls back without them', async () => {
    var failed = { json: () => Promise.resolve({ Errors: ['Enter the hostname.', 'Enter the token.'] }) };
    assert.equal(await problemText(failed, 'Could not save.'), 'Enter the hostname. Enter the token.');
    assert.equal(await problemText(new Error('x'), 'Could not save.'), 'Could not save.');
});

test('countryCounts gives the world map each country by layer', () => {
    assert.deepEqual(countryCounts(PEOPLE), { US: { people: 4, failed: 1 }, DE: { failed: 6 }, CN: { blocked: 12 } });
    assert.deepEqual(countryCounts(null), {});
});

test('map layers are codes Base knows', () => {
    assert.ok(COUNTRY_CODES.includes('US'));
    assert.deepEqual(MAP_LAYERS.map((l) => l.key), ['people', 'failed', 'blocked']);
});

test('countryRows counts only the layers that are on, most first', () => {
    var all = countryRows(PEOPLE, ['people', 'failed', 'blocked']);
    assert.deepEqual(all.map((r) => [r.code, r.total]), [['CN', 12], ['DE', 6], ['US', 5]]);
    assert.equal(all[2].last, '2026-11-15T11:00:00Z');
    var people = countryRows(PEOPLE, ['people']);
    assert.deepEqual(people.map((r) => r.code), ['US']);
    assert.equal(people[0].failures, 0);
});

test('countryFilterOptions lists Local, then countries by name, and keeps the picked one', () => {
    var options = countryFilterOptions(PEOPLE, 'FR');
    assert.deepEqual(options.map((o) => o.value), ['local', 'CN', 'FR', 'DE', 'US']);
});

test('activityQuery sends the picked filters to the server', () => {
    assert.equal(activityQuery({}), 'People');
    assert.equal(activityQuery({ type: ['Failure'], place: ['local'] }), 'People?type=Failure&place=local');
});

test('stepState maps an assessment to a checklist state', () => {
    assert.equal(stepState({ state: 'green' }), 'done');
    assert.equal(stepState({ state: 'amber' }), 'attention');
    assert.equal(stepState({ state: 'red' }), 'attention');
    assert.equal(stepState({ state: 'gray', idle: true }), 'optional');
    assert.equal(stepState({ state: 'gray' }), 'todo');
    assert.equal(stepState(null), 'todo');
});
