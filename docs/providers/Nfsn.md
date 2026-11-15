# NearlyFreeSpeech.NET

In step 2, **Address**, of the **Configuration** tab, set **Provider** to **NearlyFreeSpeech.NET**, then fill in:

- **Hostname**: the host.
- **Member Login**: your NFSN member login.
- **API Key**: your NFSN API key. Request one on the NFSN site under Profile, then API.
- **DNS Zone**: the DNS zone, such as example.com.
- **TTL**: optional, in seconds. `1` uses the provider's default.
- **Server Override**: leave blank to use NearlyFreeSpeech.NET's own server.

Only the A record is managed, matching ddclient, so the **Update IPv6** toggle is hidden for it.

_Ported from ddclient's `nic_nfsn_update`._
