# Translations

How this plugin shows its text in the viewer's language. Base builds the strings in and checks them on every build. The full reference is Base's [Translations](https://jpkribs.github.io/jellyfin-plugin-base/Translations/) guide.

## Where the Strings Live

| Strings | Where |
| :--- | :--- |
| Jellyfin's own | `<JellyfinString Include="Key" />` items in `Jellyfin.Plugin.RemoteAccess/Jellyfin.Plugin.RemoteAccess.csproj` |
| This plugin's own | `Jellyfin.Plugin.RemoteAccess/Localization/en-us.json`, one file per language |
| The endpoint pages load them from | `GET /RemoteAccess/Translations` in `DynamicDNSController`, which answers with `BaseTranslations.Serve` |

## Rules

* Every word a person reads comes from a key. No hard coded English in a page, a script, or a message the server shows.
* Use a Jellyfin string whenever Jellyfin has the words. Search the web client's `src/strings/en-us.json` and the server's `Localization/Core/en-US.json` before adding a key.
* Add a local key only when Jellyfin has no string for it. Put it in `en-us.json` with its US English.
* One string, one key. The build fails on a key said twice or English said twice.
* Keep placeholders as `{0}`, `{1}`. Never build a sentence from pieces, since word order differs by language.
* A key is PascalCase and says what the text is, such as `HeaderQueue`, `LabelApiKey`, `ButtonRetry`, `ToastSaved`, `ErrorServerUnreachable`.
* Log lines and exception text for admins in the log stay in English and need no key.
* Text the server writes for everyone is in the server's display language, through `ServerText` in `Utilities/`. That covers the activity log, the scheduled tasks, and the states the pages show.
* A controller's own reply follows the page's language. Use `ServerText.Reply(Request, key, ...)`, or `ServerText.LanguageOf(Request)` to pass the language on, as the provider hints and field labels and `ProxySettingsValidator.Validate` take it. Base's `apiRequest` sends the page's language, and `BaseTranslations.RequestLanguage` reads it.
* A provider's `Hint` and its `Fields` labels are keys. The Providers endpoint turns them into text.
* A summed activity entry is an `ActivityOutcome` built from keys, a `...One` and a `...Many` name with `{0}` for the count and an overview built in the language it is given, per Base's [Activity Log](https://jpkribs.github.io/jellyfin-plugin-base/components/csharp/activity-log/) page. `ActivityBatch` and the `ActivitySummary` write them in the server's display language.
* The replies a DNS provider sends stay as the provider wrote them.

## Add a String

1. Search Jellyfin's strings for the words.
2. Found: add `<JellyfinString Include="Key" />` to the csproj.
3. Not found: add `"Key": "English"` to `Localization/en-us.json`.
4. Use it.
    * Markup: `data-str="Key"`, `data-str-title`, `data-str-label`, or `data-str-placeholder`, with the English as the element's own text.
    * Script: `t.tr('Key')` or `t.format('Key', value)`, with `t` from `remoteaccess_tabs.js`. Each page is wired with `translatedPage`, which runs `loadTranslations('RemoteAccess/Translations')` and translates the markup before `bind` runs.
    * A sentence with a link or bold text: `htmlFormat(shared, 'Key', [html])`, with `linkHtml` for a link.
    * A list of names: `listText(items)` on a page, `ServerText.List(items)` in C#.
    * A Base component's own words, such as the Save Bar's: Base translates them. Pass an option only for text that says something different from Base's default.
    * C#: `ServerText.Get(TranslationKeys.Key)` or `ServerText.Format(TranslationKeys.Key, value)`, which read `BaseTranslations` in the server's display language.
5. Build. Fix every `JPKT` error and warning.
6. Run `dotnet test`. `TranslationsTests` checks every key the pages use is built in.

## Add a Language

Add `Localization/<code>.json`, such as `de.json` or `pt-br.json`, with only keys `en-us.json` has. A missing key falls back to the language's base and then to US English. Jellyfin's strings come in every language Jellyfin has, with no file.

## Checklist

* [ ] No English in a page, script, or server message outside `Localization/en-us.json`.
* [ ] Jellyfin's string used wherever it has the words.
* [ ] The build has no `JPKT` error or warning.
* [ ] The pages show the strings, checked once in another language such as `de`.
