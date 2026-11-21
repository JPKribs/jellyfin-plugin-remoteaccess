using System;
using System.Security.Claims;
using Jellyfin.Plugin.RemoteAccess.Api;
using Xunit;

namespace Jellyfin.Plugin.RemoteAccess.Tests;

/// <summary>
/// Who an activity entry for an administrator's change names: the signed-in user, or "An administrator" when
/// the request carries no user, as one made with an API key.
/// </summary>
public sealed class ActivityUserTests
{
    [Fact]
    public void NameOf_SignedInUser_IsTheirName()
    {
        var id = Guid.NewGuid();
        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.Name, "viewer"),
            new Claim("Jellyfin-UserId", id.ToString("N"))
        }));

        Assert.Equal("viewer", ActivityUser.NameOf(user));
        Assert.Equal(id, ActivityUser.Of(user));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    public void NameOf_NoName_IsAnAdministrator(string? name)
    {
        var user = name is null
            ? new ClaimsPrincipal(new ClaimsIdentity())
            : new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.Name, name) }));

        Assert.Equal("An administrator", ActivityUser.NameOf(user));
        Assert.Equal("An administrator", ActivityUser.NameOf(null));
    }
}
