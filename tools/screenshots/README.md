# Screenshot Kit

Takes every image in `docs/screenshots/`. It serves the plugin's real pages with jellyfin-web's real styles and a stand-in server, and drives headless Chromium at 2x. Only Activity Log needs a server, and `activity.py` starts a throwaway one in Docker.

| File | Does |
| :--- | :--- |
| `server.py` | Serves the plugin pages, Base from the NuGet cache, and jellyfin-web, the way Jellyfin's `configurationpage` route does. It answers `RemoteAccess/Translations` and `RemoteAccess/Providers` the way the plugin does |
| `index.html` | Loads jellyfin-web's stylesheets in load order, draws the dashboard header, and mounts one tab |
| `upgrade.js` | Adds the classes and markup Jellyfin's `emby-*` elements add on upgrade, so the real CSS applies |
| `stub.js` | A stand-in `ApiClient`, `Dashboard`, and `LibraryMenu` with the generic sample data |
| `shoot.mjs` | Opens each subject, sets it up, and writes its PNG to `docs/screenshots/` |
| `activity.py` | Starts Jellyfin in Docker with the plugin from `dist/`, has the plugin write a few entries, and takes Activity Log from Jellyfin's own page |

## Requirements

* Python 3 and Node.js.
* The plugin built once with `dotnet build`. The server reads the strings the build writes to `obj/`, and Base from the NuGet cache at the version the csproj names.
* jellyfin-web from the Jellyfin image the plugin targets. Set `JELLYFIN_WEB` to its folder. The default is the macOS app's.
* playwright-core. Set `PLAYWRIGHT_CORE` to its `index.mjs` unless Node resolves `playwright-core` on its own.
* Chromium. The default is Playwright's `chromium-1148` in `~/Library/Caches/ms-playwright`. Set `CHROMIUM` to use another binary.
* For Activity Log only, Docker and a plugin ZIP in `dist/` from `./build.sh`.

Copy jellyfin-web out of the image without running it.

```bash
id=$(docker create jellyfin/jellyfin:12.4.20261026-211555)
docker cp "$id":/jellyfin/jellyfin-web /path/to/jellyfin-web
docker rm "$id"
```

## Running

From this folder, start the server and take every shot.

```bash
JELLYFIN_WEB=/path/to/jellyfin-web python3 -I server.py &
PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core/index.mjs node shoot.mjs
```

Activity Log is left out of that run. Take it with its own script, which removes the container when done.

```bash
PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core/index.mjs python3 -I activity.py
```

Name files to retake only those.

```bash
node shoot.mjs "Router Step" CGNAT
```

`server.py 8867` and `PORT=8867` run both on another port. Activity Log uses port 8869, or `PORT` for `activity.py`.

The tabs also open in a browser, such as `http://127.0.0.1:8866/index.html?page=configuration`. `page` is `dashboard`, `configuration` or `advanced`. `state` picks a variant of the sample status in `stub.js`: `cgnat` for a shared address, `reach` for a passed outside test, and `dyndns` for a DynDNS v2 record.

Look at every PNG the kit writes before committing it. Last update and the outside test show the time of the run. A new subject is one more entry in the `shots` list of `shoot.mjs`, and new sample data goes in `stub.js`.
