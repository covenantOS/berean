# Thomas Aquinas, Catena Aurea (Newman translation) — raw source

Retrieved 2026-07-23 from the CrossWire Bible Society SWORD module repository:
https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/Catena.zip
(module `Catena` version 1.0.1, 2022-07-31; see `catena.conf`, vendored from
the zip). The module text derives from Tom Lemmens's OSIS conversion of
public-domain sources, checked against scans of the original publication
(`TextSource` in `catena.conf`: https://github.com/lemtom/catena/). The
English text is John Henry Newman's translation of Aquinas's patristic
catena on the four Gospels (4 vols., Oxford, 1841-1845; the module's About
dates it 1842).

License: `DistributionLicense=Public Domain` (see `catena.conf`). The Catena
Aurea (composed 1262-1267; the Matthew volume presented to Pope Urban IV in
1263) and Newman's 1842 translation are public domain. Registered in
`src/lib/rights.ts` as `catena`.

`Catena.zip` holds a zCom SWORD module: `modules/comments/zcom/catena/nt.czs/.czv/.czz`
(zlib-compressed, verse-indexed, KJV versification, OSIS markup, UTF-8),
plus an empty `nt.bzs` stub. The zip is kept out of git (`.gitignore`); it
is reproducible from the URL above. Normalized by
`scripts/build-commentary-catena.mjs` into `data/commentary/catena/`.

Source condition, verified 2026-07-23:

- Gospels only: every slot outside Matthew, Mark, Luke, and John is empty.
  821 entries cover 3,708 of the 3,779 Gospel verses; uncovered verses
  simply do not appear.
- Entries key by their lemma header ("Ver. N.", "Ver. N-M."), but the
  module anchors each entry at the first slot after the previous entry's
  span, so an entry following a span sits before the verse its lemma names
  (3 reseats: Matt 24:3, Mark 14:53, Luke 18:35). The build keys by the
  lemma header. Header quirks handled: OCR letter-for-digit substitutions
  ("l" for 1), one header reading "2." where the lemma quotes Matthew
  23:32, three part-letter openers ("1a."), one omitted number (John 8:1).
- A lemma often runs a partial quotation of the next entry's first verse as
  a connective; the earlier span trims back to the next entry's anchor (19
  trims). Section text is unchanged by trimming.
- Newman's editorial footnotes ride OSIS `<note>` elements mid-sentence;
  the build lifts all 266 out of the prose flow and appends them, text
  unchanged, as their section's trailing paragraphs.
- Patristic attributions (Chrysostom, Augustine, Jerome, the Glosses, and
  the rest) are the work's own text and ship intact.
- Nine records carry a literal `\par` conversion artifact; the build treats
  it as a paragraph break.
- Text quality: clean UTF-8, zero U+FFFD. A small number of source OCR
  artifacts remain in the text (for example "their is the kingdom" in the
  Matthew 5:1 lemma), as shipped by the module.
