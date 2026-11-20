// loader.mjs
// A node loader hook that lets the Remote Access page modules load outside Jellyfin. The pages import each other and
// Base's bundle by a specifier only Jellyfin resolves, so this maps each one to its file. Base's bundle comes from the
// NuGet package at the version the plugin's csproj names, so a test runs the same Base the plugin ships.

import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';

var configDir = '';
var baseEntry = '';

// initialize
// Finds the Web folder and Base's bundle.
//
// Inputs
// data [object]: root is the repository folder.
export async function initialize(data) {
    configDir = join(data.root, 'Jellyfin.Plugin.RemoteAccess', 'Web');
    var csproj = readFileSync(join(data.root, 'Jellyfin.Plugin.RemoteAccess', 'Jellyfin.Plugin.RemoteAccess.csproj'), 'utf8');
    var version = /Include="JPKribs\.Jellyfin\.Base" Version="([^"]+)"/.exec(csproj)[1];
    var packages = process.env.NUGET_PACKAGES || join(homedir(), '.nuget', 'packages');
    var bundle = join(packages, 'jpkribs.jellyfin.base', version.toLowerCase(), 'assets', 'jpkribs_shared.js');
    if (!existsSync(bundle)) throw new Error('Base ' + version + ' is not restored. Run dotnet restore first. Expected ' + bundle + '.');
    baseEntry = pathToFileURL(bundle).href;
}

// resolve
// Maps './configurationpage?name=<file>' to the plugin's own file, or to Base's bundle for the shared one.
//
// Inputs
// specifier [string]: What the importing module asked for.
// context [object]: The importer and the import conditions.
// nextResolve [function]: The default resolver.
//
// Output
// [Promise]: The resolved URL.
export async function resolve(specifier, context, nextResolve) {
    var match = /^\.\/configurationpage\?name=(.+)$/.exec(specifier);
    if (!match) return nextResolve(specifier, context);
    if (match[1] === 'remoteaccess_jpkribs_shared.js') return { url: baseEntry, shortCircuit: true };
    return { url: pathToFileURL(join(configDir, match[1])).href, shortCircuit: true };
}

// load
// Loads the plugin and Base scripts as ES modules, since neither folder has a package file that says so.
//
// Inputs
// url [string]: The module to load.
// context [object]: The load context.
// nextLoad [function]: The default loader.
//
// Output
// [Promise]: The loaded module source.
export async function load(url, context, nextLoad) {
    if (url.endsWith('.js') && (url.startsWith(pathToFileURL(configDir).href) || url === baseEntry)) {
        return nextLoad(url, { ...context, format: 'module' });
    }
    return nextLoad(url, context);
}
