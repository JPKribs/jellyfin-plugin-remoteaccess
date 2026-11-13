using System;
using System.Collections.Generic;
using JPKribs.Jellyfin.Base;

namespace Jellyfin.Plugin.RemoteAccess.Utilities;

/// <summary>
/// Counts one run's events, such as a DNS update run or a configuration save, and writes one summary entry
/// per outcome when the run ends, worded as the shared library's <see cref="ActivitySummary"/> words them.
/// Unlike that summary it writes at once and can name the administrator who made the change.
/// </summary>
public sealed class ActivityBatch
{
    private readonly List<ActivityOutcome> _order = new();
    private readonly Dictionary<ActivityOutcome, Tally> _tallies = new();

    /// <summary>Gets a value indicating whether nothing was counted.</summary>
    public bool IsEmpty => _order.Count == 0;

    /// <summary>Counts one event toward its outcome's summary.</summary>
    /// <param name="outcome">The outcome.</param>
    /// <param name="source">What it is listed by, such as a hostname.</param>
    /// <param name="reason">Why, when the overview lists reasons.</param>
    public void Add(ActivityOutcome outcome, string source, string? reason = null)
    {
        ArgumentNullException.ThrowIfNull(outcome);
        ArgumentNullException.ThrowIfNull(source);
        if (!_tallies.TryGetValue(outcome, out var tally))
        {
            tally = new Tally();
            _tallies[outcome] = tally;
            _order.Add(outcome);
        }

        tally.Total++;
        tally.Sources[source] = tally.Sources.GetValueOrDefault(source) + 1;
        if (!string.IsNullOrEmpty(reason))
        {
            tally.Reasons[reason] = tally.Reasons.GetValueOrDefault(reason) + 1;
        }
    }

    /// <summary>Writes one entry per outcome counted, in the order first counted, and starts over.</summary>
    /// <param name="activity">The activity log writer, or null to only start over.</param>
    /// <param name="userId">The administrator behind the run, empty when none.</param>
    public void Write(ActivityLogger? activity, Guid userId = default)
    {
        foreach (var outcome in _order)
        {
            var tally = _tallies[outcome];
            var counted = new ActivityTally(tally.Total, tally.Sources, tally.Reasons);
            activity?.Log(
                ActivityText.SummaryName(tally.Total, outcome.Outcome, outcome.Noun),
                outcome.Type,
                ActivityText.Sentence(outcome.Overview(counted)),
                outcome.Severity,
                userId);
        }

        _order.Clear();
        _tallies.Clear();
    }

    private sealed class Tally
    {
        public int Total { get; set; }

        public Dictionary<string, int> Sources { get; } = new(StringComparer.Ordinal);

        public Dictionary<string, int> Reasons { get; } = new(StringComparer.Ordinal);
    }
}
