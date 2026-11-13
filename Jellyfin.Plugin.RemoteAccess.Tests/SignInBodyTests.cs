using System;
using System.Linq;
using System.Net;
using System.Text;
using Jellyfin.Plugin.RemoteAccess.People;
using Jellyfin.Plugin.RemoteAccess.Proxy;
using Xunit;

namespace Jellyfin.Plugin.RemoteAccess.Tests;

public class SignInBodyTests
{
    private static string Username(string json) => SignInBody.Username(Encoding.UTF8.GetBytes(json));

    [Theory]
    [InlineData("{\"Username\":\"admin\",\"Pw\":\"hunter2\"}", "admin")]
    [InlineData("{\"Pw\":\"hunter2\",\"username\":\"  Root \"}", "Root")]
    [InlineData("{\"Pw\":{\"Username\":\"nested\"},\"USERNAME\":\"top\"}", "top")]
    [InlineData("{\"Username\":\"a\\r\\nb\\u0000c\"}", "abc")]
    [InlineData("{\"Username\":\"Zoë\"}", "Zoë")]
    [InlineData("{\"Secret\":\"abc\"}", "")]
    [InlineData("{\"Username\":5}", "")]
    [InlineData("{\"Username\":null}", "")]
    [InlineData("[\"Username\",\"admin\"]", "")]
    [InlineData("{\"Username\":\"adm", "")]
    [InlineData("Username=admin&Pw=x", "")]
    [InlineData("", "")]
    public void Username_IsReadFromTheSignInBody(string json, string expected) => Assert.Equal(expected, Username(json));

    [Fact]
    public void Username_NeverCarriesThePassword()
        => Assert.DoesNotContain("hunter2", Username("{\"Username\":\"admin\",\"Pw\":\"hunter2\",\"Password\":\"hunter2\"}"), StringComparison.Ordinal);

    [Fact]
    public void Username_IsCutToALength()
        => Assert.Equal(SignInBody.MaxUsernameLength, Username("{\"Username\":\"" + new string('a', 5000) + "\"}").Length);

    [Fact]
    public void Recorder_KeepsTheNameTried_AndPairsByIt()
    {
        var recorder = new AccessRecorder();
        var ip = IPAddress.Parse("203.0.113.5");

        // One address tries a real user and a made-up one moments apart. Jellyfin reports only the real one,
        // which must claim the proxy's failure for that name and leave the made-up one to be recorded.
        recorder.RecordSignInFailure(ip, "https://media.example.com", "admin");
        recorder.RecordSignInFailure(ip, "https://media.example.com", "Alice");
        recorder.Claim("203.0.113.5", "alice");

        var unclaimed = Assert.Single(recorder.TakeUnclaimed(TimeSpan.Zero));
        Assert.Equal("admin", unclaimed.Username);
    }

    [Fact]
    public void Recorder_PairsOnAddressAlone_WhenASideHasNoName()
    {
        var recorder = new AccessRecorder();
        recorder.RecordSignInFailure(IPAddress.Parse("203.0.113.5"), "https://media.example.com");
        recorder.Claim("203.0.113.5", "alice");
        Assert.Empty(recorder.TakeUnclaimed(TimeSpan.Zero));
    }
}
