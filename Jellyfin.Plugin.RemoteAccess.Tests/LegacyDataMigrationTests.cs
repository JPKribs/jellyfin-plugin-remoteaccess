using System;
using System.IO;
using Jellyfin.Plugin.RemoteAccess.Proxy;
using Jellyfin.Plugin.RemoteAccess.Services;
using Jellyfin.Plugin.RemoteAccess.Utilities;
using MediaBrowser.Common.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Xunit;

namespace Jellyfin.Plugin.RemoteAccess.Tests;

/// <summary>
/// Covers moving files saved under the plugin's earlier name to the names it reads.
/// </summary>
public class LegacyDataMigrationTests
{
    private static string NewDir()
    {
        var dir = Path.Join(Path.GetTempPath(), "remoteaccess-migrate-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        return dir;
    }

    private static IApplicationPaths Paths(string dir)
    {
        var paths = Substitute.For<IApplicationPaths>();
        paths.PluginConfigurationsPath.Returns(dir);
        return paths;
    }

    [Fact]
    public void Run_MovesSettingsStatusAndProxyFolder()
    {
        var dir = NewDir();
        try
        {
            File.WriteAllText(Path.Join(dir, "Jellyfin.Plugin.DynamicDns.xml"), "settings");
            File.WriteAllText(Path.Join(dir, "Jellyfin.Plugin.DynamicDns.Status.json"), "status");
            Directory.CreateDirectory(Path.Join(dir, "Jellyfin.Plugin.DynamicDns.Proxy", "acme"));
            File.WriteAllText(Path.Join(dir, "Jellyfin.Plugin.DynamicDns.Proxy", "DISABLE"), string.Empty);
            Directory.CreateDirectory(Path.Join(dir, "Jellyfin.Plugin.DynamicDns.Keys"));

            LegacyDataMigration.Run(dir);

            Assert.Equal("settings", File.ReadAllText(Path.Join(dir, "Jellyfin.Plugin.RemoteAccess.xml")));
            Assert.Equal("status", File.ReadAllText(Path.Join(dir, "Jellyfin.Plugin.RemoteAccess.Status.json")));
            Assert.True(File.Exists(Path.Join(dir, "Jellyfin.Plugin.RemoteAccess.Proxy", "DISABLE")));
            Assert.True(Directory.Exists(Path.Join(dir, "Jellyfin.Plugin.RemoteAccess.Proxy", "acme")));
            Assert.False(File.Exists(Path.Join(dir, "Jellyfin.Plugin.DynamicDns.xml")));
            Assert.False(Directory.Exists(Path.Join(dir, "Jellyfin.Plugin.DynamicDns.Proxy")));

            // The key folder keeps its name, since the stored credentials are bound to it.
            Assert.True(Directory.Exists(Path.Join(dir, "Jellyfin.Plugin.DynamicDns.Keys")));
        }
        finally
        {
            Directory.Delete(dir, true);
        }
    }

    [Fact]
    public void Run_LeavesBothWhenNewNameExists()
    {
        var dir = NewDir();
        try
        {
            File.WriteAllText(Path.Join(dir, "Jellyfin.Plugin.DynamicDns.xml"), "old");
            File.WriteAllText(Path.Join(dir, "Jellyfin.Plugin.RemoteAccess.xml"), "new");

            LegacyDataMigration.Run(dir);

            Assert.Equal("new", File.ReadAllText(Path.Join(dir, "Jellyfin.Plugin.RemoteAccess.xml")));
            Assert.Equal("old", File.ReadAllText(Path.Join(dir, "Jellyfin.Plugin.DynamicDns.xml")));
        }
        finally
        {
            Directory.Delete(dir, true);
        }
    }

    [Fact]
    public void ProxyPathsAndStatusStore_MigrateBeforeUse()
    {
        var dir = NewDir();
        try
        {
            File.WriteAllText(Path.Join(dir, "Jellyfin.Plugin.DynamicDns.Status.json"), "{}");
            Directory.CreateDirectory(Path.Join(dir, "Jellyfin.Plugin.DynamicDns.Proxy"));

            var proxy = new ProxyPaths(Paths(dir));
            _ = new StatusStoreService(Paths(dir), NullLogger<StatusStoreService>.Instance);

            Assert.Equal(Path.Join(dir, "Jellyfin.Plugin.RemoteAccess.Proxy"), proxy.DataDirectory);
            Assert.True(Directory.Exists(proxy.DataDirectory));
            Assert.True(File.Exists(Path.Join(dir, "Jellyfin.Plugin.RemoteAccess.Status.json")));
        }
        finally
        {
            Directory.Delete(dir, true);
        }
    }
}
