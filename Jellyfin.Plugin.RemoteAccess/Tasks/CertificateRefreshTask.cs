using System;
using System.Collections.Generic;
using System.Globalization;
using System.Threading;
using System.Threading.Tasks;
using Jellyfin.Plugin.RemoteAccess.Services.Proxy;
using Jellyfin.Plugin.RemoteAccess.Services.Proxy.Settings;
using Jellyfin.Plugin.RemoteAccess.Utilities;
using JPKribs.Jellyfin.Base;
using MediaBrowser.Model.Tasks;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.RemoteAccess.Tasks;

/// <summary>
/// Keeps the proxy's certificate current: requests a Let's Encrypt one when it is missing, no longer covers the
/// addresses, or is within 30 days of expiry, reloads certificate files, replaces a self-signed one before it
/// expires, and warns in the activity log when a certificate is about to run out or cannot be loaded. The proxy
/// also notices file changes on its own; this is the scheduled safety net. Forcing a new certificate is the
/// Advanced tab's button, not a task.
/// </summary>
public sealed class CertificateRefreshTask : PluginScheduledTask
{
    private static readonly TimeSpan _warnBefore = TimeSpan.FromDays(14);

    private readonly ProxyManager _proxy;
    private readonly ActivityLogger _activity;
    private readonly ILogger<CertificateRefreshTask> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="CertificateRefreshTask"/> class.
    /// </summary>
    /// <param name="proxy">The proxy manager.</param>
    /// <param name="activity">The activity log writer.</param>
    /// <param name="logger">The logger.</param>
    public CertificateRefreshTask(ProxyManager proxy, ActivityLogger activity, ILogger<CertificateRefreshTask> logger)
    {
        _proxy = proxy;
        _activity = activity;
        _logger = logger;
    }

    /// <inheritdoc />
    public override string Name => ServerText.Get(TranslationKeys.TaskRefreshCertificate);

    /// <inheritdoc />
    public override string Key => "RemoteAccessCertificateRefresh";

    /// <inheritdoc />
    public override string Description => ServerText.Get(TranslationKeys.TaskRefreshCertificateDescription);

    /// <inheritdoc />
    public override async Task ExecuteAsync(IProgress<double> progress, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(progress);
        progress.Report(0);

        var enabled = Plugin.Instance?.ReadConfiguration(c => c.Proxy?.Enabled == true) ?? false;
        if (!enabled)
        {
            progress.Report(100);
            return;
        }

        var status = await _proxy.RefreshCertificateAsync(cancellationToken).ConfigureAwait(false);
        if (status.Mode == CertificateMode.None)
        {
            progress.Report(100);
            return;
        }

        // Let's Encrypt failures are logged where they happen, with the reason and the next try.
        if (!status.Loaded && status.Mode != CertificateMode.Automatic)
        {
            _logger.LogError("Remote access certificate could not be loaded: {Error}", status.Error);
            _activity.Log(ServerText.Get(TranslationKeys.ActivityCertificateFailedToLoad), "RemoteAccess.CertificateFailed", ActivityEntries.Plain(status.Error), LogLevel.Error);
        }
        else if (status.Loaded && status.NotAfterUtc is { } expires && expires - DateTime.UtcNow < _warnBefore)
        {
            _logger.LogWarning("The certificate for {Names} expires {Expires:yyyy-MM-dd}, renew it so remote access keeps working", string.Join(", ", status.Names), expires);
            _activity.Log(
                ServerText.Get(TranslationKeys.ActivityCertificateExpiring),
                "RemoteAccess.CertificateExpiring",
                ServerText.Format(TranslationKeys.ActivityCertificateExpiringOverview, string.Join(", ", status.Names), expires.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)),
                LogLevel.Warning);
        }

        progress.Report(100);
    }

    /// <inheritdoc />
    public override IEnumerable<TaskTriggerInfo> GetDefaultTriggers()
    {
        // Seeds the default schedule only. Administrators change it under Scheduled Tasks.
        yield return Daily(TimeSpan.FromHours(3));
    }
}
