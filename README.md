# MongoCacheView
See what is in your MongoDB WT Cache and how it's being used.

usage: mongosh <connection options>  mongocacheview.js

For Atlas connections, the display adds four rate columns:

- `RdMB/s` and `WrMB/s` show the rate of bytes read into and written from the WiredTiger cache, converted to MiB/s.
- `RdIOPS` estimates read IOPS as pages read into cache per second (one IOP per page read).
- `WrIOPS` estimates write IOPS as MiB/s written from cache multiplied by 4, using a 256 KiB I/O assumption. WiredTiger can combine page writes, so this is not based on the number of pages written.

These are per-collection and per-index cache activity estimates, not direct measurements of physical disk I/O. Read page sizes and compression can vary. IOPS columns are displayed only when the connection host is identified as an Atlas `mongodb.net` host.
