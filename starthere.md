# Start Here

Read this file before you change anything in this repository. It applies to people and to AI assistants alike.

## The Guides

Each guide in [skills](skills/) covers one kind of work. Read the guide that matches the task before you start it.

| Guide | Read it before you |
| :--- | :--- |
| [skills/glossary.md](skills/glossary.md) | Name anything, in the UI, the docs, or code. |
| [skills/style.md](skills/style.md) | Build or change anything a user sees, including labels, messages, and layout. |
| [skills/code.md](skills/code.md) | Write or change code or comments in any language. |
| [skills/testing.md](skills/testing.md) | Write or run tests, or look at a page outside Jellyfin. |
| [skills/profiling.md](skills/profiling.md) | Find or fix slow C#, or change code on a hot path. Profile only for a reported symptom, a hot path change, or a number that grew. |
| [skills/documentation.md](skills/documentation.md) | Write or change the README, the docs site, screenshots, or release notes. |
| [skills/review.md](skills/review.md) | Call any change done. |
| [skills/release.md](skills/release.md) | Cut a release. |
| [skills/branches.md](skills/branches.md) | Pick a branch, sync the two, and promote unstable. |
| [skills/translations.md](skills/translations.md) | Add or change a string a person reads. |

A task that touches several areas needs every matching guide. A new setting, for example, needs the glossary, style, code, testing, documentation, and review guides.

## Ground Rules

* **Base comes first.** Anything reusable lives in [JPKribs.Jellyfin.Base](https://github.com/JPKribs/jellyfin-plugin-base). Search it before you build anything, use what it has, and never copy or override it locally. The world map, the setup checklist, the data tables, and the QR code on these pages are all Base's.
* **Describe the current release only.** Docs, labels, and comments say what the plugin does today. Release notes are the only place for what changed.
* **Keep it short.** Every label, message, and comment is as brief as it can be while staying clear.
* **One word per concept.** Use the term in the glossary, everywhere.
* **Prove it with a test.** A change is not done until a test shows that its inputs give the right output.
* **Generic names only.** Examples, tests, docs, and screenshots use `example.com` names and documentation addresses such as `203.0.113.10`, never a real server, domain, or person.

## Verify Before Done

Work is done when it has been checked, not when it has been written.

* Run every check the change needs, and read its output. A check that did not run has not passed, and neither has one that ran before the last change.
* Look at every changed page, in Jellyfin or in the page harness from [skills/testing.md](skills/testing.md#looking-at-a-page).
* Read the whole diff before reporting, using [skills/review.md](skills/review.md).
* Check every new string against the style checklist and the glossary.
* Check every claim in a doc against the code or the running plugin.
* Report what was checked, what was not, and why. Never call work done while a check fails.

## Stop and Ask

Stop and ask before any of these, even when the task seems to call for it.

* **Jellyfin's network settings.** A change to Trust the Proxy, Undo, Only Through the Proxy, or anything else that writes Jellyfin's own network configuration or restarts it. A mistake here locks people out of their server.
* **Security.** A change to authentication, credential storage, the key ring, the redirect rules for provider requests, bans, the block list, country rules, trusted networks, or which addresses count as local.
* **Certificates.** A change to how certificates are requested, stored, renewed, or trusted, or to the self-signed root.
* **Stored data.** Anything that changes, moves, or deletes the settings file, the key ring, certificates, or the history database, or how an older install's data is read.
* **Providers.** Removing a DNS provider, or changing what a provider sends.
* **Base.** Any change to Base, since every plugin takes it.
* **Settings.** Renaming, removing, or changing the default of a setting users already have.
* **Releases.** Raising the version, publishing, or pushing to `master`.
* **The rules.** Any case where following a guide would make the result worse.

Explain what you would change, why, and what it risks. Wait for an answer before you act.

## The Repository

| Path | What it holds |
| :--- | :--- |
| `Jellyfin.Plugin.RemoteAccess/` | The plugin source. |
| `Jellyfin.Plugin.RemoteAccess/Web/` | The dashboard pages, as HTML, JS, and CSS. |
| `Jellyfin.Plugin.RemoteAccess/Configuration/` | The plugin configuration. |
| `Jellyfin.Plugin.RemoteAccess/Localization/` | The plugin's own strings, in `en-us.json`. |
| `Jellyfin.Plugin.RemoteAccess/Providers/` | The DNS providers, one class each under `Implementations/`. |
| `Jellyfin.Plugin.RemoteAccess/Services/Proxy/` | The HTTPS proxy, certificates, the router, and Trust the Proxy. |
| `Jellyfin.Plugin.RemoteAccess/Services/People/` | History, bans, the block list, country rules, and locations. |
| `Jellyfin.Plugin.RemoteAccess.Tests/` | The C# tests, and the page module tests in `js/`. |
| `docs/` | The documentation site, built with MkDocs. |
| `build.yaml` | The version, the artifacts, and the release notes. |
| `skills/` | The guides. |
| `../Shared/jellyfin-plugin-base/` | A local checkout of Base, when present. Read it, and never change it from work on this plugin. |
