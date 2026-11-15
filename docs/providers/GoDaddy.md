# GoDaddy

In step 2, **Address**, of the **Configuration** tab, set **Provider** to **GoDaddy**, then fill in:

- **Record Name**: the host. The domain is removed to form the record name.
- **API Key**: your GoDaddy API key.
- **API Secret**: your GoDaddy API secret. Create a Production key at developer.godaddy.com/keys.
- **Domain**: the domain, such as example.com.
- **TTL**: optional, in seconds. `1`, the default, sends GoDaddy's 600 second minimum. Higher values are sent as entered.
- **Server Override**: leave blank to use GoDaddy's own server.

_Ported from ddclient's `nic_godaddy_update`._
