using System;
using System.Collections.Generic;
using Jellyfin.Plugin.RemoteAccess.Utilities;
using JPKribs.Jellyfin.Base;

namespace Jellyfin.Plugin.RemoteAccess.Providers;

/// <summary>
/// Which record fields a provider uses and the key of the label to show for each, so the dashboard renders only the
/// inputs a provider needs. A null label hides that field. This lives on the provider so the UI is driven
/// from one place per provider rather than a separate table.
/// </summary>
public sealed class ProviderFields
{
    /// <summary>Gets the key of the hostname field's label, or null to hide it.</summary>
    public string? Hostname { get; init; }

    /// <summary>Gets the key of the login field's label, or null to hide it.</summary>
    public string? Login { get; init; }

    /// <summary>Gets the key of the password field's label, or null to hide it.</summary>
    public string? Password { get; init; }

    /// <summary>Gets the key of the zone field's label, or null to hide it.</summary>
    public string? Zone { get; init; }

    /// <summary>Gets a value indicating whether the optional server override field is shown.</summary>
    public bool Server { get; init; }

    /// <summary>Gets a value indicating whether the optional TTL field is shown.</summary>
    public bool Ttl { get; init; }

    /// <summary>
    /// Gets a value indicating whether the IPv6 (AAAA) toggle is shown. Mirrors
    /// <see cref="IDNSProvider.SupportsIPv6"/> so the dashboard hides the toggle for single-address
    /// protocols that cannot push an AAAA record.
    /// </summary>
    public bool IPv6 { get; init; } = true;

    /// <summary>Gets the advanced flags this provider supports, such as wildcard, static, mx, backupmx.</summary>
    public IReadOnlyList<string> Advanced { get; init; } = Array.Empty<string>();

    /// <summary>
    /// Gets a copy with each label read from its key in a language, as the dashboard shows it.
    /// </summary>
    /// <param name="language">The page's language, or <c>null</c> for the server's.</param>
    /// <returns>The fields with their labels.</returns>
    public ProviderFields Translated(string? language = null) => new()
    {
        Hostname = Label(Hostname, language),
        Login = Label(Login, language),
        Password = Label(Password, language),
        Zone = Label(Zone, language),
        Server = Server,
        Ttl = Ttl,
        IPv6 = IPv6,
        Advanced = Advanced
    };

    private static string? Label(string? key, string? language) => key is null ? null : BaseTranslations.Get(key, language ?? ServerText.Language);
}
