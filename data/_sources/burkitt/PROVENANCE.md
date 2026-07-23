# William Burkitt, Expository Notes on the New Testament — raw source

Retrieved 2026-07-23 from the CrossWire Bible Society SWORD module repository:
https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/Burkitt.zip
(module `Burkitt` version 1.0, 2013-01-10; see `burkitt.conf`, vendored from
the zip). Expository Notes with Practical Observations on the New Testament
(Gospels published 1700, Acts to Revelation published 1703, the year of
Burkitt's death).

License: `DistributionLicense=Public Domain` (see `burkitt.conf`). Burkitt
(1650-1703) and his notes are public domain. Registered in
`src/lib/rights.ts` as `burkitt`.

`Burkitt.zip` holds a zCom SWORD module: `modules/comments/zcom/burkitt/nt.czs/.czv/.czz`
(zlib-compressed, verse-indexed, KJV versification, OSIS markup, UTF-8).
The zip is kept out of git (`.gitignore`); it is reproducible from the URL
above. Normalized by `scripts/build-commentary-burkitt.mjs` into
`data/commentary/burkitt/`.

Source condition, verified 2026-07-23:

- New Testament only: the zip carries no Old Testament files, so Old
  Testament books honestly have no volume.
- Book- and chapter-introduction slots hold only structural milestones
  (`<div osisID="Matt" type="book"/>`, `<chapter osisID="Matt.1"/>`), never
  text; the work ships no introduction sections.
- Burkitt comments verse by verse; verses he passes over have empty slots
  and simply do not appear (3,276 notes across the 7,957 NT verse slots).
- One multi-verse note (Hebrews 9:9-10, span declared in the record's
  annotateRef) is duplicated into both covered slots; the build merges it
  into one range section.
- Scripture references keep their visible text.
- Text quality: clean UTF-8, zero U+FFFD.
