using Jellyfin.Plugin.RemoteAccess.Api;
using Xunit;

namespace Jellyfin.Plugin.RemoteAccess.Tests;

/// <summary>
/// The Dashboard's share card: the public address, which the page draws as a QR code.
/// </summary>
public class ShareTests
{
    [Fact]
    public void Share_AnAddress_GivesTheAddress()
    {
        var info = ShareController.Create("https://media.example.com");
        Assert.Equal("https://media.example.com", info.Url);
        Assert.False(info.HomeOnly);
    }

    [Fact]
    public void Share_NoAddress_IsEmpty()
    {
        var info = ShareController.Create(string.Empty);
        Assert.Empty(info.Url);
    }
}
