using System;
using System.Collections.Generic;
using Jellyfin.Plugin.RemoteAccess.Services.People;
using JPKribs.Jellyfin.Base;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.RemoteAccess.Utilities;

/// <summary>
/// The summed activity entries the plugin writes: one entry per outcome, such as "3 DNS records updated",
/// instead of one per record, ban or connection, in the server's display language. Each outcome's source is what the
/// count is listed by.
/// </summary>
public static class ActivityEntries
{
    /// <summary>Gets the bans past the few a minute written one by one, listed by country.</summary>
    public static ActivityOutcome ClientsBanned { get; } = new(
        "RemoteAccess.AddressBanned",
        TranslationKeys.ActivityClientsBannedOne,
        TranslationKeys.ActivityClientsBannedMany,
        (t, language) => BaseTranslations.Format(TranslationKeys.ActivityClientsBannedOverview, language, ActivityText.CountedList(t.Sources)),
        LogLevel.Warning);

    /// <summary>Gets the DNS records a run pushed a new address to, listed by hostname and address.</summary>
    public static ActivityOutcome RecordsUpdated { get; } = new(
        "RemoteAccess.RecordUpdated",
        TranslationKeys.ActivityRecordsUpdatedOne,
        TranslationKeys.ActivityRecordsUpdatedMany,
        (t, language) => Overview(t, language, TranslationKeys.ActivityRecordsUpdatedOverview, TranslationKeys.ActivityRecordsUpdatedToOverview));

    /// <summary>Gets the DNS records that updated again after failing, listed by hostname and failed attempts.</summary>
    public static ActivityOutcome RecordsRecovered { get; } = new(
        "RemoteAccess.RecordRecovered",
        TranslationKeys.ActivityRecordsRecoveredOne,
        TranslationKeys.ActivityRecordsRecoveredMany,
        (t, language) => Overview(t, language, TranslationKeys.ActivityRecordsRecoveredOverview, TranslationKeys.ActivityRecordsRecoveredAfterOverview));

    /// <summary>Gets the DNS records whose update failed and left DNS on an old address, listed by hostname and reason.</summary>
    public static ActivityOutcome RecordsFailed { get; } = new(
        "RemoteAccess.RecordFailed",
        TranslationKeys.ActivityRecordsFailedOne,
        TranslationKeys.ActivityRecordsFailedMany,
        (t, language) => Overview(t, language, TranslationKeys.ActivityRecordsFailedOverview, TranslationKeys.ActivityRecordsFailedWhyOverview),
        LogLevel.Error);

    /// <summary>Gets the DNS records whose update failed while DNS already serves the current address.</summary>
    public static ActivityOutcome RecordsFailedServing { get; } = new(
        "RemoteAccess.RecordFailed",
        TranslationKeys.ActivityRecordsFailedOne,
        TranslationKeys.ActivityRecordsFailedMany,
        (t, language) => Overview(t, language, TranslationKeys.ActivityRecordsFailedServingOverview, TranslationKeys.ActivityRecordsFailedServingWhyOverview),
        LogLevel.Warning);

    /// <summary>Gets the DNS records a run paused after repeated failures, listed by hostname and why.</summary>
    public static ActivityOutcome RecordsPaused { get; } = new(
        "RemoteAccess.RecordBackoff",
        TranslationKeys.ActivityRecordsPausedOne,
        TranslationKeys.ActivityRecordsPausedMany,
        (t, language) => Overview(t, language, TranslationKeys.ActivityRecordsPausedOverview, TranslationKeys.ActivityRecordsPausedAfterOverview),
        LogLevel.Warning);

    /// <summary>Gets the DNS records a save added, listed by hostname and provider.</summary>
    public static ActivityOutcome RecordsAdded { get; } = new(
        "RemoteAccess.RecordAdded",
        TranslationKeys.ActivityRecordsAddedOne,
        TranslationKeys.ActivityRecordsAddedMany,
        (t, language) => Overview(t, language, TranslationKeys.ActivityRecordsAddedOverview, TranslationKeys.ActivityRecordsAddedWithOverview));

    /// <summary>Gets the DNS records a save changed, listed by hostname and whether each is on.</summary>
    public static ActivityOutcome RecordsChanged { get; } = new(
        "RemoteAccess.RecordChanged",
        TranslationKeys.ActivityRecordsChangedOne,
        TranslationKeys.ActivityRecordsChangedMany,
        (t, language) => Overview(t, language, TranslationKeys.ActivityRecordsChangedOverview, TranslationKeys.ActivityRecordsChangedToOverview));

    /// <summary>Gets the DNS records a save removed, listed by hostname and provider.</summary>
    public static ActivityOutcome RecordsRemoved { get; } = new(
        "RemoteAccess.RecordRemoved",
        TranslationKeys.ActivityRecordsRemovedOne,
        TranslationKeys.ActivityRecordsRemovedMany,
        (t, language) => Overview(t, language, TranslationKeys.ActivityRecordsRemovedOverview, TranslationKeys.ActivityRecordsRemovedWithOverview));

    /// <summary>Gets the Let's Encrypt TXT records a cleanup gave up removing, listed by name.</summary>
    public static ActivityOutcome TxtRecordsLeftOver { get; } = new(
        "RemoteAccess.AcmeTxtLeftOver",
        TranslationKeys.ActivityTxtRecordsLeftOverOne,
        TranslationKeys.ActivityTxtRecordsLeftOverMany,
        (t, language) => BaseTranslations.Format(TranslationKeys.ActivityTxtRecordsLeftOverOverview, language, ActivityText.CountedList(t.Sources)),
        LogLevel.Warning);

    /// <summary>
    /// The hourly entry for refused internet connections, in the server's display language, as "12 connections
    /// refused" over "Refused in the last hour by the country rules (9), bans (3)".
    /// </summary>
    /// <param name="totals">The hour's refusals.</param>
    /// <returns>The name and overview.</returns>
    public static (string Name, string Overview) Refused(RefusalTotals totals)
    {
        var language = ServerText.Language;
        var reasons = new Dictionary<string, int>(StringComparer.Ordinal)
        {
            [BaseTranslations.Get(TranslationKeys.ActivityRefusedByCountryRules, language)] = Clamp(totals.Country),
            [BaseTranslations.Get(TranslationKeys.ActivityRefusedByBans, language)] = Clamp(totals.Ban),
            [BaseTranslations.Get(TranslationKeys.ActivityRefusedByBlockList, language)] = Clamp(totals.Address),
            [BaseTranslations.Get(TranslationKeys.ActivityRefusedByLimits, language)] = Clamp(totals.Limit)
        };
        var total = Clamp(totals.Total);
        var name = BaseTranslations.Format(total == 1 ? TranslationKeys.ActivityConnectionsRefusedOne : TranslationKeys.ActivityConnectionsRefusedMany, language, total);
        var overview = BaseTranslations.Format(TranslationKeys.ActivityConnectionsRefusedOverview, language, ActivityText.CountedList(reasons));
        return (name, ActivityText.Sentence(overview)!);
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

    // The overview that lists the sources, with the reasons when any were given.
    private static string Overview(ActivityTally tally, string language, string plain, string withReasons)
        => tally.Reasons.Count == 0
            ? BaseTranslations.Format(plain, language, ActivityText.CountedList(tally.Sources))
            : BaseTranslations.Format(withReasons, language, ActivityText.CountedList(tally.Sources), ActivityText.CountedList(tally.Reasons));

    private static int Clamp(long value) => (int)Math.Clamp(value, 0, int.MaxValue);
}
