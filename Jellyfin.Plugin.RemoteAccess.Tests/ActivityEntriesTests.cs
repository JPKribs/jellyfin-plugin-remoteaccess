using System;
using System.Collections.Generic;
using Jellyfin.Database.Implementations.Entities;
using Jellyfin.Plugin.RemoteAccess.Services.People;
using Jellyfin.Plugin.RemoteAccess.Utilities;
using JPKribs.Jellyfin.Base;
using MediaBrowser.Model.Activity;
using Microsoft.Extensions.Logging;
using NSubstitute;
using Xunit;

namespace Jellyfin.Plugin.RemoteAccess.Tests;

/// <summary>
/// The wording of every summed activity entry: a generic name with no count over one sentence that lists
/// where each came from, with a count past 1, in US English when no server language is set.
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

        Assert.Equal("DNS records updated", entry.Name);
        Assert.Equal("RemoteAccess.RecordUpdated", entry.Type);
        Assert.Equal(LogLevel.Information, entry.LogSeverity);
        Assert.Equal("Updated for a.example.com, b.example.com to 203.0.113.5 (2)", entry.ShortOverview);
    }

    [Fact]
    public void RecordsRecovered_ListsHostsAndFailedAttempts()
    {
        var entry = Write(ActivityEntries.RecordsRecovered, ("a.example.com", "3 failed attempts"));

        Assert.Equal("DNS record recovered", entry.Name);
        Assert.Equal("RemoteAccess.RecordRecovered", entry.Type);
        Assert.Equal("Updated again for a.example.com after 3 failed attempts", entry.ShortOverview);
    }

    [Fact]
    public void RecordsFailed_IsAnError_WithTheReasons()
    {
        var entry = Write(ActivityEntries.RecordsFailed, ("a.example.com", "badauth"), ("b.example.com", "badauth"), ("c.example.com", "Timed out"));

        Assert.Equal("DNS records failed", entry.Name);
        Assert.Equal("RemoteAccess.RecordFailed", entry.Type);
        Assert.Equal(LogLevel.Error, entry.LogSeverity);
        Assert.Equal("Not updated for a.example.com, b.example.com, c.example.com: badauth (2), Timed out", entry.ShortOverview);
    }

    [Fact]
    public void RecordsFailedServing_IsAWarning()
    {
        var entry = Write(ActivityEntries.RecordsFailedServing, ("a.example.com", "AAAA rejected"));

        Assert.Equal("DNS record failed", entry.Name);
        Assert.Equal(LogLevel.Warning, entry.LogSeverity);
        Assert.Equal("Not updated for a.example.com: AAAA rejected, though DNS already serves the current address so nothing is cut off yet", entry.ShortOverview);
    }

    [Fact]
    public void RecordsPaused_ListsHostsAndWhy()
    {
        var entry = Write(ActivityEntries.RecordsPaused, ("a.example.com", "5 consecutive failures until 2026-11-14 10:00:00Z"));

        Assert.Equal("DNS record paused", entry.Name);
        Assert.Equal("RemoteAccess.RecordBackoff", entry.Type);
        Assert.Equal(LogLevel.Warning, entry.LogSeverity);
        Assert.Equal("Updates were paused for a.example.com after 5 consecutive failures until 2026-11-14 10:00:00Z, or until the public IP changes", entry.ShortOverview);
    }

    [Fact]
    public void TxtRecordsLeftOver_ListsTheNames()
    {
        var entry = Write(ActivityEntries.TxtRecordsLeftOver, ("_acme-challenge.a.example.com", null), ("_acme-challenge.b.example.com", null));

        Assert.Equal("TXT records left over", entry.Name);
        Assert.Equal("RemoteAccess.AcmeTxtLeftOver", entry.Type);
        Assert.Equal(LogLevel.Warning, entry.LogSeverity);
        Assert.Equal("Still published at the DNS provider for _acme-challenge.a.example.com, _acme-challenge.b.example.com, they do no harm but can be deleted there", entry.ShortOverview);
    }

    [Fact]
    public void ClientsBanned_ListsTheCountries()
    {
        var entry = Write(ActivityEntries.ClientsBanned, ("China", null), ("China", null), ("an unknown country", null));

        Assert.Equal("Clients banned", entry.Name);
        Assert.Equal("RemoteAccess.AddressBanned", entry.Type);
        Assert.Equal("Banned 3 clients after failed sign-ins from China (2), an unknown country", entry.ShortOverview);
    }

    [Fact]
    public void ClientsBanned_One_SaysOneClient()
    {
        var entry = Write(ActivityEntries.ClientsBanned, ("China", null));

        Assert.Equal("Client banned", entry.Name);
        Assert.Equal("Banned 1 client after failed sign-ins from China", entry.ShortOverview);
    }

    [Fact]
    public void RecordsAdded_NamesTheAdministrator()
    {
        var entry = Write(ActivityEntries.RecordsAdded("viewer"), ("a.example.com", "Cloudflare"));

        Assert.Equal("DNS record added", entry.Name);
        Assert.Equal("RemoteAccess.RecordAdded", entry.Type);
        Assert.Equal("viewer added a.example.com with Cloudflare", entry.ShortOverview);
    }

    [Fact]
    public void ListCounts_LeavesOutACountOfOne()
    {
        var counts = new Dictionary<string, int>(StringComparer.Ordinal) { ["b.example.com"] = 1, ["a.example.com"] = 3, ["c.example.com"] = 0 };

        Assert.Equal("a.example.com (3), b.example.com", ActivityEntries.ListCounts(counts));
    }

    [Fact]
    public void Refused_ListsTheRules_LargestFirst()
    {
        var (name, overview) = ActivityEntries.Refused(new RefusalTotals(Address: 1, Ban: 3, Country: 9));

        Assert.Equal("Connections refused", name);
        Assert.Equal("Refused 13 internet connections in the last hour by the country rules (9), bans (3), the block list", overview);
    }

    [Fact]
    public void Refused_One()
    {
        var (name, overview) = ActivityEntries.Refused(new RefusalTotals(0, 0, 0) { Limit = 1 });

        Assert.Equal("Connection refused", name);
        Assert.Equal("Refused 1 internet connection in the last hour by the connection limits", overview);
    }

    [Fact]
    public void Batch_WritesInTheOrderFirstCounted_AndStartsOver()
    {
        var batch = new ActivityBatch();
        batch.Add(ActivityEntries.RecordsFailed, "b.example.com", "badauth");
        batch.Add(ActivityEntries.RecordsUpdated, "a.example.com");
        batch.Write(_activity);
        batch.Write(_activity);

        Assert.Equal(new[] { "DNS record failed", "DNS record updated" }, _entries.ConvertAll(e => e.Name));
        Assert.Equal("Updated for a.example.com", _entries[1].ShortOverview);
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
