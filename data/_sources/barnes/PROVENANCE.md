# Albert Barnes, Notes on the New Testament — raw source

Retrieved 2026-07-18 from the CrossWire Bible Society SWORD module repository:
https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/Barnes.zip
(module `Barnes` version 1.1; see `barnes.conf`, vendored from the zip).

License: `DistributionLicense=Public Domain` (see `barnes.conf`). The
commentary (Albert Barnes, d. 1870) is public domain. Registered in
`src/lib/rights.ts` as `barnes`.

Note: CCEL also hosts Barnes (https://ccel.org/ccel/barnes), but its ThML
exports of the Notes volumes ship title pages and indexes only, without the
commentary body, so the CrossWire module is the vendored source. The module
covers the New Testament only (Barnes's OT volumes on Job, Psalms, Isaiah,
and Daniel are not in this module and are not shipped).

`Barnes.zip` holds a zCom SWORD module: `modules/comments/zcom/barnes/nt.czs/.czv/.czz`
(zlib-compressed, verse-indexed, KJV versification, ThML-ish markup, UTF-8).
The zip is kept out of git (`.gitignore`); it is reproducible from the URL
above. Normalized by `scripts/build-commentary-barnes.mjs` into
`data/commentary/barnes/`.
