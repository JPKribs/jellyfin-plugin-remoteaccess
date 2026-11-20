using System.Collections.Generic;
using System.Linq;
using Jellyfin.Plugin.RemoteAccess.Services.Proxy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.RemoteAccess.Api;

/// <summary>
/// The server's public address, for the Dashboard's share card, which draws it as a QR code to scan into the Jellyfin apps.
/// </summary>
[ApiController]
[Authorize(Policy = "RequiresElevation")]
[Route("RemoteAccess/Share")]
[Produces("application/json")]
public class ShareController : ControllerBase
{
    /// <summary>
    /// Returns the address people use: the first public name, or else a name only the home network knows, marked as
    /// such. Empty while Remote Access is off or has no exact name.
    /// </summary>
    /// <returns>The address.</returns>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public ActionResult<ShareInfo> Get()
    {
        var hostnames = Plugin.Instance?.ReadConfiguration(c => c.Proxy.Enabled ? c.Proxy.Hostnames.ToList() : new List<string>())
            ?? new List<string>();
        var publicName = hostnames.FirstOrDefault(h => !h.StartsWith('*') && HostnameMatcher.IsPublicName(h));
        var name = publicName ?? hostnames.FirstOrDefault(h => !h.StartsWith('*'));
        var info = Create(name is null ? string.Empty : "https://" + name);
        info.HomeOnly = name is not null && publicName is null;
        return Ok(info);
    }

    /// <summary>
    /// Builds the share card's contents for an address.
    /// </summary>
    /// <param name="url">The public address, empty when there is none.</param>
    /// <returns>The address, empty for no address.</returns>
    internal static ShareInfo Create(string url) => new() { Url = url ?? string.Empty };
}

/// <summary>
/// What the Dashboard's share card shows.
/// </summary>
public sealed class ShareInfo
{
    /// <summary>Gets or sets the address people use from the internet, empty when there is none.</summary>
    public string Url { get; set; } = string.Empty;

    /// <summary>Gets or sets a value indicating whether the address only works on the home network, such as nas.lan.</summary>
    public bool HomeOnly { get; set; }
}
