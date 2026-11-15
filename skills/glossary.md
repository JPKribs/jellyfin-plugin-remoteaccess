# Glossary

The agreed name for every concept in this plugin. The UI, the docs, messages, and code use these words and no others.

* Use the **Term** in the UI, the docs, and messages.
* The **In Code** column names the type or member that holds it, when the code name differs.
* Never use a word from the **Not** column for the concept.
* Add a term here before it appears anywhere else. Rename it here first when it changes, then everywhere in the same commit.

## The Plugin

| Term | Meaning | In Code | Not |
| :--- | :--- | :--- | :--- |
| Remote Access | The plugin, and the feature of reaching Jellyfin from outside the home network | `Plugin` | DDNS plugin, Dynamic DNS plugin |
| Dashboard | The first tab, with the share card, Locations, Banned, and Activity | `remoteaccess_dashboard` | Overview, Home |
| Configuration | The second tab, the setup checklist | `remoteaccess_configuration` | Setup, Settings |
| Advanced | The third tab, the finer settings | `remoteaccess_advanced` | Expert, More |
| Step | One item of the Configuration checklist, numbered 1 to 6 | `STEPS` | Stage, task |

## Dynamic DNS

| Term | Meaning | In Code | Not |
| :--- | :--- | :--- | :--- |
| DDNS record | The one record that keeps a name pointed at this server's public IP | `DNSRecord` | Domain, entry, host |
| Provider | The DNS service that holds the record, such as Cloudflare | `IDNSProvider`, `DNSProviderBase` | Service, registrar |
| Hostname | The name the record updates, and the name people use to reach Jellyfin | `Hostname` | Domain, FQDN |
| Zone | The domain a provider keeps the record in | `Zone` | Root domain |
| Public IP | The address the internet sees for this server | `DetectedIP` | External IP, WAN IP |
| Detection URLs | The services asked for the public IP | `IPv4DetectionUrl`, `IPv6DetectionUrl` | IP lookup |
| Update | Sending the public IP to the provider | `DnsUpdateService` | Sync, push |
| Update Now | The button that runs an update right away | `RunNow` | Run, Refresh |
| Force Update | Sending the IP again after a while, even when DNS matches | `ForceUpdateHours` | Refresh interval |
| Back Off | Pausing a record after failures in a row | `RecordBackoff` | Throttle, cooldown |
| Paused | A record that is off, or backing off | `Enabled` | Disabled, suspended |
| Update DDNS | The scheduled task that updates the record | `DNSUpdateTask` | DDNS task |

## The Proxy

| Term | Meaning | In Code | Not |
| :--- | :--- | :--- | :--- |
| Proxy | The HTTPS reverse proxy Remote Access runs in front of Jellyfin | `ProxyManager`, `ProxyHost` | Reverse proxy, gateway |
| Address | A name the proxy answers on | `Hostnames` | Domain, host |
| Other Addresses | Names the proxy answers on besides the record's | `otherAddresses` | Extra hosts, aliases |
| Certificate | What lets browsers connect securely | `CertificateStore` | Cert, SSL |
| Source | Where the certificate comes from, Let's Encrypt, PEM files, a PKCS#12 file, Self-signed, or None | `CertificateMode` | Mode, type |
| Let's Encrypt | The free certificate authority the plugin asks for a certificate | `CertificateMode.Automatic`, `AcmeCertificateService` | ACME, automatic |
| Root Certificate | The self-signed authority a device installs to trust this server | `LocalAuthority`, `RootCertificate` | CA cert |
| Router | The home router, and the step that forwards ports 80 and 443 | `RouterPortMapper` | Gateway, modem |
| Automatic Port Forwarding | Asking the router to forward the ports through UPnP or NAT-PMP | `AutoPortForwarding` | UPnP |
| Shared Address | A public IP the provider shares between customers, so nothing outside can reach in | `CgnatCheck`, `BehindCgnat` | CGNAT, in the UI |
| Trust the Proxy | Setting Jellyfin up to see each visitor's real address through the proxy, with one restart | `NetworkTakeover`, `TakeOver` | Takeover, in the UI |
| Undo | Putting Jellyfin's network settings back as they were before Trust the Proxy | `Restore` | Revert, rollback |
| Only Through the Proxy | Jellyfin listens on this server only, so every visitor uses the proxy | `JellyfinLoopbackOnly` | Loopback only, lockdown |
| Test from Outside | Asking check-host.net to reach the address from other countries | `ReachabilityChecker` | Reachability test, ping |
| Verify External Access | The scheduled task that runs the outside test | `ExternalAccessTask` | |
| Refresh Certificate | The scheduled task that renews the certificate | `CertificateRefreshTask` | |

## Protection

| Term | Meaning | In Code | Not |
| :--- | :--- | :--- | :--- |
| Ban | A temporary refusal of an address after failed sign-ins | `BanList`, `Ban` | Lockout, jail |
| Unban | Lifting a ban | `Unban` | Release, pardon |
| Block | Adding an address or range to the block list | `Block` | Ban, deny |
| Blocked Addresses | Addresses and ranges always refused | `BlockedAddresses` | Block list, deny list, in the UI |
| Country Rule | Which countries may connect, Server country only, Block these countries, Allow only these countries, or Off | `CountryRuleMode`, `CountryRules` | Geo-blocking, geofence |
| Trusted Networks | Addresses treated like your own network | `TrustedNetworks` | Whitelist, allow list |
| Your Network | Addresses on the same local network as this server | `IsLocal`, `Exempt` | LAN, home network, in the UI |
| Failed Sign-in | A sign-in Jellyfin refused | `SignInFailedConsumer` | Failed login, auth failure |

## History

| Term | Meaning | In Code | Not |
| :--- | :--- | :--- | :--- |
| History | The record of who connected and what happened | `PeopleStore`, `PeopleSettings` | Logs, audit trail |
| Activity | One row of history, typed User, Failure, Blocked, or Seen | `ActivityRow`, `ActivityType` | Event, entry |
| Locations | The world map and its country table on the Dashboard | Base `createWorldMap` | Map, geography |
| Location Database | The DB-IP database that turns an address into a country | `GeoIpService` | GeoIP, IP database, in the UI |
| Refresh Locations | The scheduled task that downloads the location database | `LocationDatabaseTask` | |
| Share Card | The Dashboard's QR code of the public address | `ShareController` | Invite, QR card |
| Home Only | An address that only works on the home network | `HomeOnly` | Local, private, in the UI |
| Activity Log | Jellyfin's dashboard activity log | `ActivityLogger` | Event log |
