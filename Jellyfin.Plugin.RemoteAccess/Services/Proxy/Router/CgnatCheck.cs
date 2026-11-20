using System.Net;
using System.Net.Sockets;
using Jellyfin.Plugin.RemoteAccess.Utilities;
using JPKribs.Jellyfin.Base;

namespace Jellyfin.Plugin.RemoteAccess.Services.Proxy.Router;

/// <summary>
/// Tells whether the router sits behind a provider's shared address, carrier-grade NAT, where no port the router
/// forwards can be reached from the internet.
/// </summary>
public static class CgnatCheck
{
    /// <summary>
    /// Compares the router's own internet address with the one the internet sees.
    /// </summary>
    /// <param name="routerAddress">The router's internet address as the router reports it, empty while unknown.</param>
    /// <param name="publicIPv4">This server's public IPv4 address as seen from the internet, empty while unknown.</param>
    /// <returns>Whether the server is behind a shared address, and why in plain words; empty when it is not.</returns>
    public static (bool BehindCgnat, string Reason) Evaluate(string routerAddress, string publicIPv4)
    {
        if (!IPAddress.TryParse(routerAddress, out var router) || router.AddressFamily != AddressFamily.InterNetwork || router.Equals(IPAddress.Any))
        {
            return (false, string.Empty);
        }

        var b = router.GetAddressBytes();

        // 100.64.0.0/10 is set aside for providers to share among customers (RFC 6598).
        if (b[0] == 100 && (b[1] & 0xC0) == 64)
        {
            return (true, ServerText.Format(TranslationKeys.ErrorRouterShared, router));
        }

        if (b[0] == 10 || (b[0] == 172 && b[1] >= 16 && b[1] <= 31) || (b[0] == 192 && b[1] == 168))
        {
            return (true, ServerText.Format(TranslationKeys.ErrorRouterPrivate, router));
        }

        if (IPAddress.TryParse(publicIPv4, out var seen) && seen.AddressFamily == AddressFamily.InterNetwork && !seen.Equals(router))
        {
            return (true, ServerText.Format(TranslationKeys.ErrorRouterMismatch, router, seen));
        }

        return (false, string.Empty);
    }
}
