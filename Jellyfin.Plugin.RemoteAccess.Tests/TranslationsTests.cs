using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using Jellyfin.Plugin.RemoteAccess.Utilities;
using JPKribs.Jellyfin.Base;
using Xunit;

namespace Jellyfin.Plugin.RemoteAccess.Tests;

/// <summary>
/// Covers the strings the pages and the server show: every key a page uses is built in, Jellyfin's own strings come
/// in Jellyfin's languages, and the server's text falls back to US English.
/// </summary>
public class TranslationsTests
{
    // A key in markup, tr('Key'), format('Key', a key picked in tr(a ? 'A' : 'B'), htmlFormat(shared, 'Key',
    // linkHtml(shared, href, 'Key'), or a nameKey, labelKey or titleKey in a table of keys.
    private static readonly Regex[] _uses =
    {
        new(@"data-str(?:-title|-label|-placeholder)?=""([A-Za-z0-9_.]+)"""),
        new(@"\b(?:tr|format)\('([A-Za-z0-9_.]+)'"),
        new(@"\btr\([^()']*\?\s*'([A-Za-z0-9_]+)'\s*:\s*'([A-Za-z0-9_]+)'"),
        new(@"htmlFormat\(\w+, '([A-Za-z0-9_]+)'"),
        new(@"linkHtml\(\w+, [^,]+, '([A-Za-z0-9_]+)'"),
        new(@"\b(?:name|label|title)Key: '([A-Za-z0-9_]+)'")
    };

    [Fact]
    public void EveryKeyThePagesUseIsBuiltIn()
    {
        var english = BaseTranslations.For("en-us");
        var used = new HashSet<string>();
        foreach (var file in Directory.EnumerateFiles(WebFolder()))
        {
            var text = File.ReadAllText(file);
            foreach (var match in _uses.SelectMany(r => r.Matches(text)))
            {
                used.UnionWith(match.Groups.Values.Skip(1).Where(g => g.Success).Select(g => g.Value));
            }
        }

        Assert.True(used.Count > 300, "Only " + used.Count + " keys were found in the pages.");
        Assert.All(used, k => Assert.True(english.ContainsKey(k), k + " is neither in Localization/en-us.json nor a JellyfinString in the csproj"));
    }

    [Fact]
    public void JellyfinStringsComeInJellyfinsLanguages()
    {
        Assert.Equal("Dashboard", BaseTranslations.Get(TranslationKeys.TabDashboard, "en-us"));
        Assert.NotEqual("Cancel", BaseTranslations.Get(TranslationKeys.ButtonCancel, "de"));
        Assert.Equal(BaseTranslations.Get(TranslationKeys.HeaderTrustProxy, "en-us"), BaseTranslations.Get(TranslationKeys.HeaderTrustProxy, "de"));
    }

    [Fact]
    public void ServerTextIsUsEnglishWithoutTheServerConfiguration()
    {
        Assert.Equal("Port 8096 is already in use by another program.", ServerText.Format(TranslationKeys.ErrorPortInUse, 8096));
        Assert.Equal("80 and 443", ServerText.List(new object[] { 80, 443 }));
        Assert.Equal("80, 443 and 8920", ServerText.List(new object[] { 80, 443, 8920 }));
    }

    // The plugin's Web folder, found from the test's output folder.
    private static string WebFolder()
    {
        var dir = new DirectoryInfo(System.AppContext.BaseDirectory);
        while (dir is not null && !Directory.Exists(Path.Join(dir.FullName, "Jellyfin.Plugin.RemoteAccess", "Web")))
        {
            dir = dir.Parent;
        }

        Assert.NotNull(dir);
        return Path.Join(dir!.FullName, "Jellyfin.Plugin.RemoteAccess", "Web");
    }
}
