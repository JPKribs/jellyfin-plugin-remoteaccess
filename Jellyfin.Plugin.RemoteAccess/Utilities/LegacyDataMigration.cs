using System;
using System.Collections.Generic;
using System.IO;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.RemoteAccess.Utilities;

/// <summary>
/// Moves the files saved under the plugin's earlier name, <c>Jellyfin.Plugin.DynamicDns</c>, to the names this
/// build reads: the settings file, the status file and the proxy's data folder. It runs before any of them is
/// opened, from every place that opens them. A file already under the new name is left alone, and so is its old
/// copy. The credential key folder keeps its name, see <see cref="Plugin.SecretsName"/>.
/// </summary>
internal static class LegacyDataMigration
{
    /// <summary>The name files were saved under before.</summary>
    internal const string OldName = "Jellyfin.Plugin.DynamicDns";

    /// <summary>The name files are saved under.</summary>
    internal const string NewName = "Jellyfin.Plugin.RemoteAccess";

    private static readonly string[] _suffixes = { ".xml", ".Status.json", ".Proxy" };
    private static readonly HashSet<string> _done = new(StringComparer.Ordinal);
    private static readonly object _lock = new();

    /// <summary>
    /// Moves each old file or folder in the plugin configurations folder to its new name. Runs once per folder.
    /// </summary>
    /// <param name="configurationsPath">Jellyfin's plugin configurations folder.</param>
    /// <param name="logger">Logger for what was moved, or <c>null</c>.</param>
    public static void Run(string configurationsPath, ILogger? logger = null)
    {
        ArgumentException.ThrowIfNullOrEmpty(configurationsPath);
        lock (_lock)
        {
            if (!_done.Add(configurationsPath))
            {
                return;
            }

            foreach (var suffix in _suffixes)
            {
                Move(Path.Join(configurationsPath, OldName + suffix), Path.Join(configurationsPath, NewName + suffix), logger);
            }
        }
    }

    private static void Move(string from, string to, ILogger? logger)
    {
        if (File.Exists(to) || Directory.Exists(to))
        {
            return;
        }

        try
        {
            if (File.Exists(from))
            {
                File.Move(from, to);
            }
            else if (Directory.Exists(from))
            {
                Directory.Move(from, to);
            }
            else
            {
                return;
            }

            logger?.LogInformation("Moved {From} to {To}", from, to);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            logger?.LogError("Could not move {From} to {To}: {Message}. Move it by hand and restart Jellyfin.", from, to, ex.Message);
        }
    }
}
