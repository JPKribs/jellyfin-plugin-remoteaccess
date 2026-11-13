using System;
using System.Text;
using System.Text.Json;

namespace Jellyfin.Plugin.RemoteAccess.Proxy;

/// <summary>
/// Reads the username out of a sign-in request, for the history of failed sign-ins. Jellyfin only reports a
/// failure for a username that exists, so a guess at one that does not, such as <c>admin</c>, is only ever
/// seen here. Nothing else in the body is kept, the password least of all.
/// </summary>
public static class SignInBody
{
    /// <summary>The longest username kept. A longer one is cut, since it is free text from the internet.</summary>
    public const int MaxUsernameLength = 64;

    /// <summary>
    /// Finds the username in the JSON a client sends to sign in by name.
    /// </summary>
    /// <param name="json">The request body.</param>
    /// <returns>The username, trimmed and without control characters, or empty when there is none.</returns>
    public static string Username(ReadOnlySpan<byte> json)
    {
        try
        {
            var reader = new Utf8JsonReader(json, new JsonReaderOptions { AllowTrailingCommas = true, CommentHandling = JsonCommentHandling.Skip, MaxDepth = 8 });
            if (!reader.Read() || reader.TokenType != JsonTokenType.StartObject)
            {
                return string.Empty;
            }

            while (reader.Read() && reader.TokenType == JsonTokenType.PropertyName)
            {
                // Jellyfin reads property names without regard to case.
                var isUsername = string.Equals(reader.GetString(), "Username", StringComparison.OrdinalIgnoreCase);
                if (!reader.Read())
                {
                    break;
                }

                if (isUsername)
                {
                    return reader.TokenType == JsonTokenType.String ? Clean(reader.GetString()) : string.Empty;
                }

                reader.Skip();
            }
        }
        catch (Exception ex) when (ex is JsonException or InvalidOperationException or DecoderFallbackException)
        {
            // Not JSON, or cut short: there is no username to keep.
        }

        return string.Empty;
    }

    /// <summary>
    /// Makes a username safe to keep and show: no control characters, trimmed, and no longer than
    /// <see cref="MaxUsernameLength"/>.
    /// </summary>
    /// <param name="value">The raw username.</param>
    /// <returns>The cleaned username, or empty.</returns>
    public static string Clean(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var builder = new StringBuilder(Math.Min(value.Length, MaxUsernameLength));
        foreach (var c in value.AsSpan().Trim())
        {
            if (builder.Length >= MaxUsernameLength)
            {
                break;
            }

            if (!char.IsControl(c) && !char.IsSurrogate(c))
            {
                builder.Append(c);
            }
        }

        return builder.ToString().Trim();
    }
}
