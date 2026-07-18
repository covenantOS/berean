# Nave's Topical Bible — provenance

- Work: Orville J. Nave, *Nave's Topical Bible* (originally published early 1900s). Public domain.
- Source: CrossWire SWORD module `Nave` (version 3.0), rawzip package.
  URL: https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/Nave.zip
- The module's own `nave.conf` declares `DistributionLicense=Public Domain` and
  `TextSource=https://ccel.org/ccel/n/nave/bible.xml` (the CCEL digitization).
- Retrieved: 2026-07-18
- Files kept here: `nave.conf` (module metadata), `dict.zdx` / `dict.zdt`
  (SWORD zLD compressed lexdict data). The zip was unpacked and the two
  unloaded SWORD index files (`dict.dat`, `dict.idx`) omitted; `dict.zdx` +
  `dict.zdt` suffice to reconstruct every entry.
- Normalized by `scripts/build-topics.mjs` into `data/topics/naves.json`.
