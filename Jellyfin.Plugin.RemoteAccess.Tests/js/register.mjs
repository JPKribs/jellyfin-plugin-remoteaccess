// register.mjs
// Registers loader.mjs, so the tests import the page modules by the names Jellyfin serves them under.
// Run the tests with: node --import ./Jellyfin.Plugin.RemoteAccess.Tests/js/register.mjs --test 'Jellyfin.Plugin.RemoteAccess.Tests/js/*.test.mjs'

import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

var here = dirname(fileURLToPath(import.meta.url));
register(pathToFileURL(join(here, 'loader.mjs')).href, { parentURL: import.meta.url, data: { root: join(here, '..', '..') } });
