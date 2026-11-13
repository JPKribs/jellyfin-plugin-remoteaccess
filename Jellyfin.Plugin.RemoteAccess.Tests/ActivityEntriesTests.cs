using System;
using System.Collections.Generic;
using Jellyfin.Database.Implementations.Entities;
using Jellyfin.Plugin.RemoteAccess.People;
using Jellyfin.Plugin.RemoteAccess.Utilities;
using JPKribs.Jellyfin.Base;
using MediaBrowser.Model.Activity;
using Microsoft.Extensions.Logging;
using NSubstitute;
using Xunit;

namespace Jellyfin.Plugin.RemoteAccess.Tests;

/// <summary>
/// The wording of every summed activity entry: a "<c>count nouns outcome</c>" name over one sentence that
/// lists where each came from, with counts.
/// </summary>
public sealed class ActivityEntriesTests
{
    private readonly List<ActivityLog> _entries = new();
    private readonly ActivityLogger _activity;

    public ActivityEntriesTests()
    {
        var manager = Substitute.For<IActivityManager>();
        manager.CreateAsync(Arg.Do<ActivityLog>(_entries.Add));
        _activity = new ActivityLogger(manager, Substitute.For<ILogger<ActivityLogger>>());
    }

    [Fact]
    public void RecordsUpdated_ListsHostsAndAddresses()
    {
        var entry = Write(ActivityEntries.RecordsUpdated, ("a.example.com", "203.0.113.5"), ("b.example.com", "203.0.113.5"));

        Assert.Equal("2 DNS Records Updated", entry.Name);
        Assert.Equal("RemoteAccess.RecordUpdated", entry.Type);
        Assert.Equal(LogLevel.Information, entry.LogSeverity);
        Assert.Equal("2 DNS records were updated for a.example.com (1), b.example.com (1) to 203.0.113.5 (2)", entry.ShortOverview);
    }

    [Fact]
    public void RecordsRecovered_ListsHostsAndFailedAttempts()
    {
        var entry = Write(ActivityEntries.RecordsRecovered, ("a.example.com", "3 failed attempts"));

        Assert.Equal("1 DNS Record Recovered", entry.Name);
        Assert.Equal("RemoteAccess.RecordRecovered", entry.Type);
        Assert.Equal("1 DNS record was updated again for a.example.com (1) after 3 failed attempts (1)", entry.ShortOverview);
    }

    [Fact]
    public void RecordsFailed_IsAnError_WithTheReasons()
    {
        var entry = Write(ActivityEntries.RecordsFailed, ("a.example.com", "badauth"), ("b.example.com", "badauth"), ("c.example.com", "Timed out"));

        Assert.Equal("3 DNS Records Failed", entry.Name);
        Assert.Equal("RemoteAccess.RecordFailed", entry.Type);
        Assert.Equal(LogLevel.Error, entry.LogSeverity);
        Assert.Equal("3 DNS records were not updated for a.example.com (1), b.example.com (1), c.example.com (1): badauth (2), Timed out (1)", entry.ShortOverview);
    }

    [Fact]
    public void RecordsFailedServing_IsAWarning()
    {
        var entry = Write(ActivityEntries.RecordsFailedServing, ("a.example.com", "AAAA rejected"));

        Assert.Equal("1 DNS Record Failed", entry.Name);
        Assert.Equal(LogLevel.Warning, entry.LogSeverity);
        Assert.Equal("1 DNS record was not updated for a.example.com (1): AAAA rejected (1), though DNS already serves the current address so nothing is cut off yet", entry.ShortOverview);
    }

    [Fact]
    public void RecordsPaused_ListsHostsAndWhy()
    {
        var entry = Write(ActivityEntries.RecordsPaused, ("a.example.com", "5 consecutive failures until 2026-11-14 10:00:00Z"));

        Assert.Equal("1 DNS Record Paused", entry.Name);
        Assert.Equal("RemoteAccess.RecordBackoff", entry.Type);
        Assert.Equal(LogLevel.Warning, entry.LogSeverity);
        Assert.Equal("Updates were paused for a.example.com (1) after 5 consecutive failures until 2026-11-14 10:00:00Z (1), or until the public IP changes", entry.ShortOverview);
    }

    [Fact]
    public void TxtRecordsLeftOver_ListsTheNames()
    {
        var entry = Write(ActivityEntries.TxtRecordsLeftOver, ("_acme-challenge.a.example.com", null), ("_acme-challenge.b.example.com", null));

        Assert.Equal("2 TXT Records Left Over", entry.Name);
        Assert.Equal("RemoteAccess.AcmeTxtLeftOver", entry.Type);
        Assert.Equal(LogLevel.Warning, entry.LogSeverity);
        Assert.Equal("2 Let's Encrypt TXT records were still published at the DNS provider for _acme-challenge.a.example.com (1), _acme-challenge.b.example.com (1), they do no harm but can be deleted there", entry.ShortOverview);
    }

    [Fact]
    public void ClientsBanned_ListsTheCountries()
    {
        var entry = Write(ActivityEntries.ClientsBanned, ("China", null), ("China", null), ("an unknown country", null));

        Assert.Equal("3 Clients Banned", entry.Name);
        Assert.Equal("RemoteAccess.AddressBanned", entry.Type);
        Assert.Equal("3 clients were banned after failed sign-ins, too many to list one by one, from China (2), an unknown country (1)", entry.ShortOverview);
    }

    [Fact]
    public void Refused_ListsTheRules_LargestFirst()
    {
        var (name, overview) = ActivityEntries.Refused(new RefusalTotals(Address: 1, Ban: 3, Country: 9));

        Assert.Equal("13 Connections Refused", name);
        Assert.Equal("13 internet connections were refused in the last hour by the country rules (9), bans (3), the block list (1), the Remote Access page lists the addresses", overview);
    }

    [Fact]
    public void Refused_One()
    {
        var (name, overview) = ActivityEntries.Refused(new RefusalTotals(0, 0, 0) { Limit = 1 });

        Assert.Equal("1 Connection Refused", name);
        Assert.Equal("1 internet connection was refused in the last hour by the connection limits (1), the Remote Access page lists the addresses", overview);
    }

    [Fact]
    public void Batch_WritesInTheOrderFirstCounted_AndStartsOver()
    {
        var batch = new ActivityBatch();
        batch.Add(ActivityEntries.RecordsFailed, "b.example.com", "badauth");
        batch.Add(ActivityEntries.RecordsUpdated, "a.example.com");
        batch.Write(_activity);
        batch.Write(_activity);

        Assert.Equal(new[] { "1 DNS Record Failed", "1 DNS Record Updated" }, _entries.ConvertAll(e => e.Name));
        Assert.Equal("1 DNS record was updated for a.example.com (1)", _entries[1].ShortOverview);
        Assert.True(batch.IsEmpty);
    }

    [Fact]
    public void Plain_MakesOneSentence()
    {
        Assert.Equal("The port is taken", ActivityEntries.Plain("  the port is taken.  "));
        Assert.Equal(string.Empty, ActivityEntries.Plain(null));
    }

    private ActivityLog Write(ActivityOutcome outcome, params (string Source, string? Reason)[] events)
    {
        var batch = new ActivityBatch();
        foreach (var (source, reason) in events)
        {
            batch.Add(outcome, source, reason);
        }

        batch.Write(_activity);
        return Assert.Single(_entries);
    }
}
