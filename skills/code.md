# Code

How to write, comment, and test code in this plugin. It covers C#, JavaScript, HTML, CSS, and YAML.

## Base First

[JPKribs.Jellyfin.Base](https://github.com/JPKribs/jellyfin-plugin-base) holds everything two plugins could share. Its docs site lists every component and helper. Read it before you write anything new.

### Use What Base Has

* Use the Base type or component when one fits. Never write a local version, a wrapper that renames it, or a CSS override of a `base-` class.
* When Base almost fits, change Base. Never patch around it locally.
* Delete a local copy as soon as Base offers the same thing. Do it in the commit that moves to that Base version.
* Never shadow a Base name. A local `FormatUtilities` or `errorText` beside Base's is ambiguous.
* Read Base from the package this plugin builds against. The C# source is in `~/.nuget/packages/jpkribs.jellyfin.base/<version>/src/`, and the JS typings are in `assets/jpkribs_shared.d.ts` beside it.
* Treat the local Base checkout as read only. Base has its own owner and its own release, so report a gap and wait for the version that closes it.
* A local helper that looks like Base but differs on purpose stays, with the reason in its summary. `ProviderHttp` follows a redirect on the same server, where Base's `RedirectRefusingHandler` refuses every one. `SecretFile` sets Windows access rules as it creates a file, which Base's `AtomicFile` does not.

| Need | Use from Base |
| :--- | :--- |
| Plugin class and config lock | `PluginBase<TPlugin, TConfiguration>` |
| Scheduled task | `PluginScheduledTask` |
| Provider HTTP calls | `JpkHttp` and `HttpResult`, through `DNSProviderBase.SendAsync` |
| Retry and backoff | `BackoffPolicy`, `RetryPolicy`, `CircuitBreaker` |
| Secrets | `SecretProtector`, `StableSecretProtection`, `AddPluginSecretProtector` |
| Comparing a presented secret | `SecretCompare.FixedTimeEquals` |
| Paths inside a folder | `PathContainment` |
| Activity log | `ActivityLogger`, `ActivitySummary`, `ActivityText` |
| JSON state file | `JsonFileStore<T>` |
| SQLite versioning | `DatabaseSchema` |
| Text from outside, for a log or the settings file | `FormatUtilities.SanitizeForLog` |
| The clock | `TimeProvider`, and `UtcTime` for stored times |
| Config page lifecycle | `createConfigPage` |
| Dialogs | `confirmDialog`, `promptDialog`, `openDialog` |
| A setup in steps that each have a state | `createSetupChecklist` |
| Counts by country | `createWorldMap` and `linkWorldMap`, with `COUNTRY_CODES` and `WORLD` for country names |
| Tables | `createDataTable`, with `width: 'auto'` for short columns, `widthKey` so widths stick, and `renderRelative` for times |
| A link to hand to a phone | `createQrCode` |
| A framed section with a header | `createCollapsibleSection`, with `collapsible: false` for one that is always open |
| Picking several values | `createChipSelect` |
| Secret fields | `bindSecretField` with `clearButton`, `readSecretField`, `SECRET_KEPT` |

### Move Code Into Base

Code belongs in Base when another plugin could use it unchanged. A helper with no Remote Access types in its signature is a candidate.

1. Report the gap to Base's owner with what the plugin needs and why.
2. Wait for the Base release that adds it. Never commit this plugin against an unreleased Base package.
3. Raise `JPKribs.Jellyfin.Base` in `Jellyfin.Plugin.RemoteAccess/Jellyfin.Plugin.RemoteAccess.csproj`, delete the local copy with its tests and styles, and add a `developer` changelog line naming the Base version.

## Comments

### The Rules

* Every class, method, function, and component gets a header comment.
* The header is the name, then a summary of one or two sentences, leaning to one.
* List inputs and outputs when there are any. One line each, as `name [type]: What or why`.
* Write no inline comments, with one exception. A branch whose reason is not obvious gets one short line above it.
* A branch comment says why, not what. Keep it under 15 words.
* Never comment what the code already says.
* Never leave commented out code, TODO, FIXME, or HACK. Open an issue instead.
* Never describe history. "Used to", "now", and "was changed to" belong in commit messages.
* Use no em dashes or semicolons in comments.

### C#

C# uses XML docs so the compiler and IntelliSense read them.

* Every type and every member that is not private gets `<summary>`, every `<param>`, and `<returns>` when it returns a value.
* Private members get a `<summary>` when the name does not say enough.
* Use `<inheritdoc/>` on an interface or override member.
* Write `true` and `false` as `<c>true</c>` and `<c>false</c>`.
* A constructor summary is "Initializes a new instance of the <see cref="Name"/> class."
* Put one type in each file, named after the type. A small enum used by one class may share its file.
* Match the namespace to the folder.

### JavaScript

```js
// countryRows
// One row per country for the table beside the map, counting only the layers that are on, most first.
//
// Inputs
// data [object]: The People reply.
// active [string[]]: The map layers that are on.
//
// Output
// [object[]]: Rows of { code, name, users, failures, blocked, total, last }.
export function countryRows(data, active) {
```

* Comment every top level function and every exported function.
* Open each file with a header naming the file and saying what it holds in one sentence. Use no `// ====` banners in new code.
* Each page imports Base by `./configurationpage?name=remoteaccess_jpkribs_shared.js` and the plugin's shared module by `./configurationpage?name=remoteaccess_tabs.js`.
* Put logic a test should reach in `remoteaccess_tabs.js` as an exported function, so the node tests can call it without a page.

### HTML

```html
<!-- Locations -->
<!-- Where visitors came from, as a world map and a table that share one selection. -->
<div class="sectionTitleContainer flex align-items-center">
```

* One comment line naming each section where it starts, and an optional second line saying what it is for.
* Use no inline `style` attributes and no `<style>` blocks.

### CSS

```css
/* ra-fingerprint */
/* The root certificate's fingerprint, in short lines a person compares against their device. */
/* Example: <span class="base-mono ra-fingerprint">AB CD EF</span> */
.ra-fingerprint { white-space: pre-line; }
```

* Three lines above each rule, the name, what it looks like, and one example.
* Prefix every class with `ra-` in kebab case. `base-` is reserved for Base.
* Use Base tokens such as `--base-border` and `--base-gap-wide`. Never write a hex value for something Base already colors.

### YAML

* A workflow opens with its `name`. Comment a step only when its reason is not obvious.

## C# Conventions

* Target `net10.0` with `Nullable` on, `TreatWarningsAsErrors` on, and `AnalysisMode` set to `AllEnabledByDefault`.
* Keep `jellyfin.ruleset` identical across plugins. Raise a rule change in every plugin at once.
* Suppress a rule only at the narrowest scope, with a reason.
* Use file scoped namespaces, `sealed` classes, and records for data.
* Name private fields `_camelCase`.
* End every async method name in `Async`, pass the `CancellationToken` through, and use `ConfigureAwait(false)` on every await.
* Guard public arguments with `ArgumentNullException.ThrowIfNull`.
* Log through `ILogger<T>` with static, named templates. Pass untrusted text through `FormatUtilities.SanitizeForLog`.
* Catch a specific exception, or filter with `when`. Rethrow `OperationCanceledException` when the token was cancelled.
* Read the clock once in a method and reuse the value.
* Register services in `PluginServiceRegistrator`.
* Keep the assembly name `Jellyfin.Plugin.RemoteAccess` and the secrets name in `Plugin.SecretsName`. Jellyfin names the settings file and the key ring after them.

## JavaScript Conventions

* Each config page is an ES module whose default export calls `createConfigPage` with `TABS` and `PLUGIN_ID` from `remoteaccess_tabs.js`.
* Build each Base component once in `bind`, and update it with `setValue`, `setRows`, or `setCounts` on each load.
* Use `const` and `let` in new code. Arrow functions are fine for callbacks.
* Escape every value placed in HTML with `escapeHtml`. Prefer building a node and setting `textContent`.
* Report results with `shared.setStatus`, and problems from a save with `problemText`.
* Start every poller with `page.createPoller`, so `viewhide` stops it.

## Security

* Store every credential with `SecretProtector`, built by `AddPluginSecretProtector`. `CredentialEncryption` encrypts record credentials on every save path. Never write a secret to the config, a file, or a log in plain text.
* Send a stored secret to the browser only as a kept marker. The DDNS endpoints use their own markers, which `readDdnsSecret` writes.
* Mask every credential in a provider failure with `CredentialRedactor` before it is logged or stored.
* Send provider requests through `ProviderHttp`, which follows a redirect only on the same server, so a header such as an API key never reaches another one.
* Write keys and certificates with `SecretFile`, and keep their folders private with `SecretFile.ProtectFolder`.
* Guard every route with `[Authorize(Policy = "RequiresElevation")]`.
* Never block your network or trusted networks. `BlockGuard.IsExempt` decides.
* Compare a secret a caller presents with `SecretCompare.FixedTimeEquals`, never `==`.
* Build SQL with parameters only.
* Never put a secret or a user's data in a URL.

## Tests

See [testing.md](testing.md) for each layer and how to write tests.

## Checklist

* [ ] Base's source and typings were searched, and nothing here duplicates Base.
* [ ] Every class, method, function, and component has a header.
* [ ] Inline comments appear only above branches, and say why.
* [ ] Every changed source file has tests that pass, per [testing.md](testing.md).
* [ ] The [security](#security) rules hold.
* [ ] `dotnet build` shows no warnings.
