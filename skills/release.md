# Release

How to cut a release of this plugin, from the version number to the manifest every server reads.

## Versions

A version is `JJ.JJ.F.B`.

| Part | Means | Raise it when |
| :--- | :--- | :--- |
| `JJ.JJ` | The Jellyfin version the release targets, such as `12.4` | The plugin moves to a new Jellyfin version |
| `F` | The feature release | The release adds or changes behavior a user will notice |
| `B` | The bug release within that feature | The release only fixes bugs or tidies |

Raising a part sets every part after it to `0`. `12.4.4.10` becomes `12.4.5.0` for a feature and `12.4.4.11` for a fix.

## Branch

A feature release is cut on `unstable`, then **Sync Branches** with `promote` moves `master` to it. A bug release is cut on `master`, and the sync carries it to `unstable`. See [branches.md](branches.md).

## Before the Release

1. **Base.** When the release needs a Base change, wait until Base is released and NuGet serves the version, then raise `JPKribs.Jellyfin.Base` in `Jellyfin.Plugin.RemoteAccess/Jellyfin.Plugin.RemoteAccess.csproj` and delete any local copy Base replaces. Never release against a local package.
2. **Artifacts.** When a dependency is added or removed, change `artifacts` in `build.yaml` to match, since the zip carries only those files.
3. **Build.**

    ```bash
    dotnet build -c Release
    ```

4. **Tests.**

    ```bash
    dotnet test
    ```

    ```bash
    node --import ./Jellyfin.Plugin.RemoteAccess.Tests/js/register.mjs --test 'Jellyfin.Plugin.RemoteAccess.Tests/js/*.test.mjs'
    ```

    Every check must run on the commit that is released. Run them again after any later change.

5. **Pages.** Look at every changed page per [testing.md](testing.md#looking-at-a-page), and run the live checks for any change to the proxy, certificates, the router, or Trust the Proxy.
6. **Docs.** Every page describes this release. Retake any screenshot whose subject changed.

    ```bash
    mkdocs build --strict
    ```

7. **Names.** Search the change for real domains, addresses, and names, and replace each with an `example.com` name or a documentation address.
8. **Review.** Run [review.md](review.md) over everything since the last release.

## Set the Release

Edit `build.yaml`.

1. Set `version` to the new version.
2. Replace the whole `changelog` with this release's entries. Each release lists only its own changes. See [documentation.md](documentation.md#release-notes) for how to write them.
3. Name the Base version in `developer` when it changed, such as "Uses JPKribs.Jellyfin.Base 2026.11.17", with what it replaced locally.
4. Keep `description` and `overview` true for this release.

Commit on `master` with the change it ships, then bring in anything CI pushed and push.

```bash
git pull --rebase
```

```bash
git push
```

## Publish

1. **Draft.** A push to `master` that changes more than `build.yaml` and the docs starts **Create/Update Release Draft**. It builds the zip and writes a draft release named `v<version>` with the changelog as its notes. When `v<version>` is already published, it raises the bug part, commits "Auto-increment version to ...", and drafts that version. A push that only changes `build.yaml` starts nothing, so run the workflow from the Actions tab.
2. **Check.** Open the draft. The notes must match `build.yaml`, and the zip and its `.md5` must be attached.

    ```bash
    gh release view v<version>
    ```

3. **Release.** Publish the draft. The **Publish Plugin** workflow takes the attached zip's checksum, adds the version to `manifest.json`, and commits "Update manifest for release v<version>".

    ```bash
    gh release edit v<version> --draft=false
    ```

4. **Pull.**

    ```bash
    git pull --rebase
    ```

5. **Verify.** On a test server, add the repository URL, install the release from the catalog, restart, and open each tab.

## When a Release Is Wrong

* Never edit or reuse a published version. Fix it in a new bug release.
* When a release breaks servers, publish the fix as the next bug release at once.
* When the manifest entry itself is wrong, run **Publish Plugin** by hand with the release tag after fixing the cause.

## Checklist

* [ ] The version follows `JJ.JJ.F.B`, and later parts are `0`.
* [ ] Base is released and referenced, with local copies deleted.
* [ ] `artifacts` lists every DLL the plugin needs, and no other.
* [ ] `dotnet build`, `dotnet test`, and the JS tests pass on the released commit.
* [ ] Every changed page was looked at.
* [ ] Docs and screenshots describe this release, and `mkdocs build --strict` passes.
* [ ] The changelog lists only this release.
* [ ] The draft matches `build.yaml` before it is published.
* [ ] The manifest commit is pulled.
