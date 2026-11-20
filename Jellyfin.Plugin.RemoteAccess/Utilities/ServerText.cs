using System.Collections.Generic;
using System.Linq;
using JPKribs.Jellyfin.Base;
using MediaBrowser.Controller.Configuration;
using Microsoft.AspNetCore.Http;

namespace Jellyfin.Plugin.RemoteAccess.Utilities;

/// <summary>
/// The plugin's strings in the server's display language, for text the server writes for whoever reads it, such as
/// activity log entries, the scheduled tasks and the states the pages show. A controller's own reply follows the
/// page's language through <see cref="Reply"/>.
/// </summary>
internal static class ServerText
{
    private static IServerConfigurationManager? _config;

    /// <summary>Gets the server's display language, or US English before the plugin sets the configuration.</summary>
    internal static string Language => _config is null ? BaseTranslations.FallbackLanguage : BaseTranslations.ServerLanguage(_config);

    /// <summary>Sets the configuration the server's display language is read from.</summary>
    /// <param name="config">Jellyfin's server configuration, or <c>null</c> for US English.</param>
    internal static void Use(IServerConfigurationManager? config) => _config = config;

    /// <summary>Reads one string.</summary>
    /// <param name="key">The key, from <see cref="TranslationKeys"/>.</param>
    /// <returns>The string in the server's language.</returns>
    internal static string Get(string key) => BaseTranslations.Get(key, Language);

    /// <summary>Reads one string and fills its placeholders.</summary>
    /// <param name="key">The key, from <see cref="TranslationKeys"/>.</param>
    /// <param name="args">The values for <c>{0}</c>, <c>{1}</c> and on.</param>
    /// <returns>The string in the server's language.</returns>
    internal static string Format(string key, params object?[] args) => BaseTranslations.Format(key, Language, args);

    /// <summary>Gets the language a page asked for, from its request, for a controller's reply.</summary>
    /// <param name="request">The page's request, or <c>null</c> for the server's language.</param>
    /// <returns>The language, such as de or pt-br.</returns>
    internal static string LanguageOf(HttpRequest? request) => request is null ? Language : BaseTranslations.RequestLanguage(request);

    /// <summary>Reads one string in the language a page asked for and fills its placeholders, for a controller's reply.</summary>
    /// <param name="request">The page's request, or <c>null</c> for the server's language.</param>
    /// <param name="key">The key, from <see cref="TranslationKeys"/>.</param>
    /// <param name="args">The values for <c>{0}</c>, <c>{1}</c> and on.</param>
    /// <returns>The string in the page's language.</returns>
    internal static string Reply(HttpRequest? request, string key, params object?[] args)
        => BaseTranslations.Format(key, LanguageOf(request), args);

    /// <summary>Joins names into a list in the server's language, such as "80 and 443".</summary>
    /// <param name="items">The names.</param>
    /// <returns>The list, empty for none.</returns>
    internal static string List(IEnumerable<object> items)
    {
        var list = items.Select(i => System.Convert.ToString(i, System.Globalization.CultureInfo.InvariantCulture) ?? string.Empty).ToList();
        return list.Count switch
        {
            0 => string.Empty,
            1 => list[0],
            _ => Format(TranslationKeys.TextPair, string.Join(", ", list.Take(list.Count - 1)), list[^1])
        };
    }
}
