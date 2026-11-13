# Versioning

Releases use a four part version, `JJ.JJ.F.B`, that matches the supported Jellyfin version with the plugin's own feature and bug count:

```
12.4.4.7
└──┘ └┬┘
 │    └── 4 = Plugin feature release
 │        7 = Plugin bug/patch release within that feature
 │
 └─── 12.4 = Jellyfin version this build was tested/released for
```

Targets **Jellyfin 12.4.x** on `net10.0` with ABI `12.4.0.0`.
