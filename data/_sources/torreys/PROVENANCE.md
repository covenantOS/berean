# Torrey's New Topical Textbook — provenance

- Work: R. A. Torrey, *The New Topical Text Book* (1897). Public domain.
- Source: CrossWire SWORD module `Torrey` (version 1.3), rawzip package.
  URL: https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/Torrey.zip
- The module's own `torrey.conf` declares `DistributionLicense=Public Domain`;
  its About note records that the source reprint (Sword of the Lord Publishers)
  carries no copyright notice and the original edition is out of copyright.
  `TextSource=http://www.bf.org/` (Bible Foundation).
- Retrieved: 2026-07-18
- Files kept here: `torrey.conf` (module metadata), `torrey.idx` / `torrey.dat`
  (SWORD RawLD lexdict data; the idx records are 6-byte offset+size pairs into
  the dat stream, entries are ThML).
- Normalized by `scripts/build-topics.mjs` into `data/topics/torreys.json`.
