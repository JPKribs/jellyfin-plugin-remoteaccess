# Testing

How to test this plugin, from a single method to a page in a real Jellyfin. A change is done when the tests for every layer it touches pass.

## The Rule

Every source file has tests, and every test proves that given inputs produce the expected output. A bug fix starts with a test that fails without the fix.

## Layers

Test each behavior at the lowest layer that can prove it. Go up a layer only for what the lower one cannot reach.

| Layer | Proves | Runs | Time |
| :--- | :--- | :--- | :--- |
| Unit | One class gives the right output for each input | `dotnet test` | Seconds |
| Provider | A DNS provider sends the right request and reads each reply | `dotnet test` | Seconds |
| Controller | A route's checks, saves, and replies | `dotnet test` | Seconds |
| JavaScript | The page helpers in `remoteaccess_tabs.js` | `node --test` | Seconds |
| Page | A page draws, and its buttons send the right requests | The page harness, or Jellyfin | Minutes |
| Live | The proxy, certificates, and the router on a real network | A test server | As long as it takes |

| A change to | Needs |
| :--- | :--- |
| A utility, model, or policy | Unit |
| A provider | Provider, through `StubHttp` |
| A controller or the save path | Controller |
| A page helper | JavaScript |
| A page's markup or script | JavaScript for its logic, and a look at the page |
| The proxy host, certificates, the router, or Trust the Proxy | Unit, and a live check before release |

## C# Tests

Tests use xUnit, with `NSubstitute` for Jellyfin's own interfaces and hand written stubs for everything else. Each test file covers one subject, named `<Subject>Tests.cs`, in `Jellyfin.Plugin.RemoteAccess.Tests/`.

```bash
dotnet test
```

* Name each method `Subject_Scenario_Expectation`.
* Arrange, act, and assert, separated by blank lines.
* Assert one behavior per test. Several asserts are fine when they check one outcome.
* Use `[Theory]` with `[InlineData]` for one rule over several inputs.
* Test the edges. Null, empty, the largest value, a cancelled token, a provider that answers with an error, and a provider that never answers.
* Never sleep. Pass a clock or a delay in, and control it from the test.
* A test never reaches the network. Use `StubHttp` for a provider, and `OrchestratorHarness` for an update run.
* A new provider gets a `<Name>ProviderTests.cs` that covers a good reply, each failure the provider documents, and a redirect.

## JavaScript Tests

The page helpers run on node's own test runner. `register.mjs` loads `loader.mjs`, which serves the plugin's modules and Base's bundle by the names Jellyfin uses. Base's bundle comes from the restored NuGet package at the version the csproj names, so run `dotnet restore` first.

```bash
node --import ./Jellyfin.Plugin.RemoteAccess.Tests/js/register.mjs --test 'Jellyfin.Plugin.RemoteAccess.Tests/js/*.test.mjs'
```

```js
test('activityQuery sends the picked filters to the server', () => {
    assert.equal(activityQuery({ type: ['Failure'], place: ['local'] }), 'People?type=Failure&place=local');
});
```

* Name each test as a sentence about the behavior.
* Test logic, not layout. Move logic out of a page into an exported function in `remoteaccess_tabs.js` so a test can call it.
* Use generic names and documentation addresses, such as `media.example.com` and `203.0.113.10`.

## Looking at a Page

Every changed page is looked at before it is called done, at desktop width and at 375 px.

### In Jellyfin

Build with `./build.sh`, unzip the zip from `dist/` into `<config>/plugins/Remote Access_<version>/` on a Jellyfin 12.4 test server, and restart it. Reload the page after each install, since the dashboard caches scripts.

### In the Page Harness

When no test server is at hand, serve the page files outside Jellyfin. A small server in a scratch folder maps `configurationpage?name=<file>` to `Jellyfin.Plugin.RemoteAccess/Configuration/<file>`, and `remoteaccess_jpkribs_shared.*` to Base's `assets/` in the NuGet package. A shell page stubs `ApiClient`, `LibraryMenu`, and `Dashboard`, answers each `RemoteAccess/...` request from fixtures, imports the page controller, and dispatches `viewshow`.

* Keep the harness and its fixtures outside the repository.
* Use fixtures with generic names only.
* Record each request the page sends, and assert on them, such as the filter a table passed to `People`.
* The harness proves the page draws and sends the right requests. It does not prove the server's answers, so a change to a route still needs a controller test.

## Live Checks

The proxy, Let's Encrypt, the router, and Trust the Proxy depend on a real network. Before a release that changes them, check them on a test server with a test domain.

* Never use a real person's domain or address in a check you record, a screenshot, or a log you share.
* Note in the report which live checks ran and which did not.

## Checklist

* [ ] Every changed source file has tests.
* [ ] A bug fix has a test that fails without it.
* [ ] Edges are covered, including null, empty, cancelled, and a failing provider.
* [ ] `dotnet test` passes.
* [ ] The JavaScript tests pass.
* [ ] Every changed page was looked at, at desktop width and at 375 px.
