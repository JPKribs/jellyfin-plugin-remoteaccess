using System;
using System.Collections.Generic;
using Jellyfin.Plugin.RemoteAccess.People;
using JPKribs.Jellyfin.Base;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.RemoteAccess.Utilities;

/// <summary>
/// The summed activity entries the plugin writes: one entry per outcome, such as "3 DNS Records Updated",
/// instead of one per record, ban or connection. Each outcome's source is what the count is listed by.
/// </summary>
public static class ActivityEntries
{
    private const string DnsRecord = "DNS record";

    /// <summary>Gets the bans past the few a minute written one by one, listed by country.</summary>
    public static ActivityOutcome ClientsBanned { get; } = new(
        "RemoteAccess.AddressBanned",
        "Banned",
        t => $"{Lead(t, "client")} banned after failed sign-ins, too many to list one by one, from {ActivityText.CountedList(t.Sources)}",
        LogLevel.Warning,
        "Client");

    /// <summary>Gets the DNS records a run pushed a new address to, listed by hostname and address.</summary>
    public static ActivityOutcome RecordsUpdated { get; } = new(
        "RemoteAccess.RecordUpdated",
        "Updated",
        t => $"{Lead(t, DnsRecord)} updated for {ActivityText.CountedList(t.Sources)}{Then(" to ", t.Reasons)}",
        Noun: "DNS Record");

    /// <summary>Gets the DNS records that updated again after failing, listed by hostname and failed attempts.</summary>
    public static ActivityOutcome RecordsRecovered { get; } = new(
        "RemoteAccess.RecordRecovered",
        "Recovered",
        t => $"{Lead(t, DnsRecord)} updated again for {ActivityText.CountedList(t.Sources)}{Then(" after ", t.Reasons)}",
        Noun: "DNS Record");

    /// <summary>Gets the DNS records whose update failed and left DNS on an old address, listed by hostname and reason.</summary>
    public static ActivityOutcome RecordsFailed { get; } = new(
        "RemoteAccess.RecordFailed",
        "Failed",
        t => $"{Lead(t, DnsRecord)} not updated for {ActivityText.CountedList(t.Sources)}{Then(": ", t.Reasons)}",
        LogLevel.Error,
        "DNS Record");

    /// <summary>Gets the DNS records whose update failed while DNS already serves the current address.</summary>
    public static ActivityOutcome RecordsFailedServing { get; } = new(
        "RemoteAccess.RecordFailed",
        "Failed",
        t => $"{Lead(t, DnsRecord)} not updated for {ActivityText.CountedList(t.Sources)}{Then(": ", t.Reasons)}, though DNS already serves the current address so nothing is cut off yet",
        LogLevel.Warning,
        "DNS Record");

    /// <summary>Gets the DNS records a run paused after repeated failures, listed by hostname and why.</summary>
    public static ActivityOutcome RecordsPaused { get; } = new(
        "RemoteAccess.RecordBackoff",
        "Paused",
        t => $"Updates were paused for {ActivityText.CountedList(t.Sources)}{Then(" after ", t.Reasons)}, or until the public IP changes",
        LogLevel.Warning,
        "DNS Record");

    /// <summary>Gets the DNS records a save added, listed by hostname and provider.</summary>
    public static ActivityOutcome RecordsAdded { get; } = new(
        "RemoteAccess.RecordAdded",
        "Added",
        t => $"{Lead(t, DnsRecord)} added for {ActivityText.CountedList(t.Sources)}{Then(" with ", t.Reasons)}",
        Noun: "DNS Record");

    /// <summary>Gets the DNS records a save changed, listed by hostname and whether each is now on.</summary>
    public static ActivityOutcome RecordsChanged { get; } = new(
        "RemoteAccess.RecordChanged",
        "Changed",
        t => $"{Lead(t, DnsRecord)} changed for {ActivityText.CountedList(t.Sources)}{Then(", now ", t.Reasons)}",
        Noun: "DNS Record");

    /// <summary>Gets the DNS records a save removed, listed by hostname and provider.</summary>
    public static ActivityOutcome RecordsRemoved { get; } = new(
        "RemoteAccess.RecordRemoved",
        "Removed",
        t => $"{Lead(t, DnsRecord)} removed for {ActivityText.CountedList(t.Sources)}{Then(" with ", t.Reasons)}",
        Noun: "DNS Record");

    /// <summary>Gets the Let's Encrypt TXT records a cleanup gave up removing, listed by name.</summary>
    public static ActivityOutcome TxtRecordsLeftOver { get; } = new(
        "RemoteAccess.AcmeTxtLeftOver",
        "Left Over",
        t => $"{Lead(t, "Let's Encrypt TXT record")} still published at the DNS provider for {ActivityText.CountedList(t.Sources)}, they do no harm but can be deleted there",
        LogLevel.Warning,
        "TXT Record");

    /// <summary>
    /// The hourly entry for refused internet connections, as "12 Connections Refused" over "12 internet
    /// connections were refused in the last hour by the country rules (9), bans (3)".
    /// </summary>
    /// <param name="totals">The hour's refusals.</param>
    /// <returns>The name and overview.</returns>
    public static (string Name, string Overview) Refused(RefusalTotals totals)
    {
        var reasons = new Dictionary<string, int>(StringComparer.Ordinal)
        {
            ["the country rules"] = Clamp(totals.Country),
            ["bans"] = Clamp(totals.Ban),
            ["the block list"] = Clamp(totals.Address),
            ["the connection limits"] = Clamp(totals.Limit)
        };
        var total = Clamp(totals.Total);
        var overview = $"{ActivityText.Count(total, "internet connection")} {ActivityText.WasOrWere(total)} refused in the last hour by "
            + ActivityText.CountedList(reasons) + ", the Remote Access page lists the addresses";
        return (ActivityText.SummaryName(total, "Refused", "Connection"), ActivityText.Sentence(overview)!);
    }

    /// <summary>
    /// Outside text, such as an error or a provider reply, as one plain sentence: trimmed, capitalized and
    /// with no closing full stop, cut to what the activity log keeps.
    /// </summary>
    /// <param name="text">The text.</param>
    /// <returns>The sentence, empty for blank text.</returns>
    public static string Plain(string? text) => ActivityLogger.Trim(ActivityText.Sentence(text?.Trim()) ?? string.Empty);

    /// <summary>Outside text as a phrase inside a sentence: trimmed, with no closing full stop.</summary>
    /// <param name="text">The text.</param>
    /// <returns>The phrase.</returns>
    public static string Phrase(string? text) => (text ?? string.Empty).Trim().TrimEnd('.');

    // "3 DNS records were", "1 client was".
    private static string Lead(ActivityTally tally, string noun)
        => $"{ActivityText.Count(tally.Total, noun)} {ActivityText.WasOrWere(tally.Total)}";

    // The reasons after a joining word, or nothing when none were given.
    private static string Then(string joiner, IReadOnlyDictionary<string, int> reasons)
        => reasons.Count == 0 ? string.Empty : joiner + ActivityText.CountedList(reasons);

    private static int Clamp(long value) => (int)Math.Clamp(value, 0, int.MaxValue);
}
