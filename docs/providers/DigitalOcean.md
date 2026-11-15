# DigitalOcean

In step 2, **Address**, of the **Configuration** tab, set **Provider** to **DigitalOcean**, then fill in:

- **Record Name**: the record name, such as home.example.com.
- **API Token**: a DigitalOcean API token with read and write scope. Create one under API, then Tokens, then Generate New Token.
- **Apex Domain**: the apex domain, such as example.com.
- **Server Override**: leave blank to use DigitalOcean's own server.

_Ported from ddclient's `nic_digitalocean_update`._
