using System.Collections.Generic;
using System.Linq;
using Jellyfin.Database.Implementations.Entities;
using Jellyfin.Plugin.RemoteAccess.Models;
using Jellyfin.Plugin.RemoteAccess.Utilities;
using JPKribs.Jellyfin.Base;
using MediaBrowser.Model.Activity;
using Microsoft.Extensions.Logging;
using NSubstitute;
using Xunit;

namespace Jellyfin.Plugin.RemoteAccess.Tests;

/// <summary>
/// Covers the configuration save audit: an added or removed record and a changed credential each get one
/// activity log entry, while an unchanged save stays silent. Credentials are compared in stored form, so
/// an echoed back stored value is not a change.
/// </summary>
public class ConfigurationAuditTests
{
    private readonly List<ActivityLog> _entries = new();
    private readonly ActivityLogger _activity;

    public ConfigurationAuditTests()
    {
        var manager = Substitute.For<IActivityManager>();
        manager.CreateAsync(Arg.Do<ActivityLog>(_entries.Add));
        _activity = new ActivityLogger(manager, Substitute.For<ILogger<ActivityLogger>>());
    }

    private static DNSRecord Record(string id, string host = "host.example.com", string login = "enc:l", string password = "enc:p")
        => new() { Id = id, Hostname = host, Login = login, Password = password };

    [Fact]
    public void UnchangedSave_LogsNothing()
    {
        var records = new List<DNSRecord> { Record("a") };

        ConfigurationAudit.LogRecordChanges(_activity, records, new List<DNSRecord> { Record("a") });

        Assert.Empty(_entries);
    }

    [Fact]
    public void EditedRecord_LogsChanged_WithTheAdmin()
    {
        var admin = System.Guid.NewGuid();
        ConfigurationAudit.LogRecordChanges(_activity, new List<DNSRecord> { Record("a") }, new List<DNSRecord> { Record("a", host: "new.example.com") }, admin);

        var entry = Assert.Single(_entries);
        Assert.Equal("RemoteAccess.RecordChanged", entry.Type);
        Assert.Equal(admin, entry.UserId);
    }

    [Fact]
    public void NewRecord_LogsAdded()
    {
        ConfigurationAudit.LogRecordChanges(_activity, new List<DNSRecord>(), new List<DNSRecord> { Record("a") });

        var entry = Assert.Single(_entries);
        Assert.Equal("RemoteAccess.RecordAdded", entry.Type);
        Assert.Equal("1 DNS Record Added", entry.Name);
        Assert.Equal("1 DNS record was added for host.example.com (1) with Cloudflare (1)", entry.ShortOverview);
    }

    [Fact]
    public void DroppedRecord_LogsRemoved()
    {
        ConfigurationAudit.LogRecordChanges(_activity, new List<DNSRecord> { Record("a") }, new List<DNSRecord>());

        var entry = Assert.Single(_entries);
        Assert.Equal("RemoteAccess.RecordRemoved", entry.Type);
    }

    [Fact]
    public void ChangedPassword_LogsCredentialsChanged_Once()
    {
        var before = new List<DNSRecord> { Record("a") };
        var after = new List<DNSRecord> { Record("a", password: "enc:replaced") };

        ConfigurationAudit.LogRecordChanges(_activity, before, after);

        var entry = Assert.Single(_entries);
        Assert.Equal("RemoteAccess.RecordCredentialsChanged", entry.Type);
    }

    [Fact]
    public void ChangedLogin_LogsCredentialsChanged()
    {
        ConfigurationAudit.LogRecordChanges(
            _activity,
            new List<DNSRecord> { Record("a") },
            new List<DNSRecord> { Record("a", login: "enc:replaced") });

        Assert.Equal("RemoteAccess.RecordCredentialsChanged", Assert.Single(_entries).Type);
    }

    [Fact]
    public void FirstSave_NullBefore_SumsEveryRecordAsAdded()
    {
        ConfigurationAudit.LogRecordChanges(_activity, null, new List<DNSRecord> { Record("a"), Record("b", host: "other.example.com") });

        var entry = Assert.Single(_entries);
        Assert.Equal("RemoteAccess.RecordAdded", entry.Type);
        Assert.Equal("2 DNS Records Added", entry.Name);
        Assert.Equal("2 DNS records were added for host.example.com (1), other.example.com (1) with Cloudflare (2)", entry.ShortOverview);
    }

    [Fact]
    public void ChangedAndRemoved_ReadAsSummaries_AndCredentialsStandAlone()
    {
        var admin = System.Guid.NewGuid();
        var before = new List<DNSRecord> { Record("a"), Record("b", host: "b.example.com"), Record("gone", host: "gone.example.com") };
        var after = new List<DNSRecord>
        {
            Record("a", host: "a2.example.com"),
            new() { Id = "b", Hostname = "b.example.com", Login = "enc:l", Password = "enc:new", Enabled = false }
        };

        ConfigurationAudit.LogRecordChanges(_activity, before, after, admin);

        var changed = Assert.Single(_entries, e => e.Type == "RemoteAccess.RecordChanged");
        Assert.Equal("2 DNS Records Changed", changed.Name);
        Assert.Equal("2 DNS records were changed for a2.example.com (1), b.example.com (1), now disabled (1), enabled (1)", changed.ShortOverview);
        Assert.Equal(admin, changed.UserId);

        var removed = Assert.Single(_entries, e => e.Type == "RemoteAccess.RecordRemoved");
        Assert.Equal("1 DNS Record Removed", removed.Name);
        Assert.Equal("1 DNS record was removed for gone.example.com (1) with Cloudflare (1)", removed.ShortOverview);

        var credentials = Assert.Single(_entries, e => e.Type == "RemoteAccess.RecordCredentialsChanged");
        Assert.Equal("Credentials Changed for b.example.com", credentials.Name);
        Assert.Equal("The login or password of the Cloudflare DNS record for b.example.com was changed", credentials.ShortOverview);
    }

    [Fact]
    public void MixedSave_LogsEachChangeSeparately()
    {
        var before = new List<DNSRecord> { Record("keep"), Record("drop"), Record("cred") };
        var after = new List<DNSRecord> { Record("keep"), Record("cred", password: "enc:new"), Record("fresh") };

        ConfigurationAudit.LogRecordChanges(_activity, before, after);

        Assert.Equal(3, _entries.Count);
        Assert.Single(_entries, e => e.Type == "RemoteAccess.RecordAdded");
        Assert.Single(_entries, e => e.Type == "RemoteAccess.RecordRemoved");
        Assert.Single(_entries, e => e.Type == "RemoteAccess.RecordCredentialsChanged");
    }

    [Fact]
    public void NullActivityLogger_DoesNotThrow()
    {
        ConfigurationAudit.LogRecordChanges(null, new List<DNSRecord> { Record("a") }, new List<DNSRecord>());
    }
}
