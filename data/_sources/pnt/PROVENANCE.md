# B. W. Johnson, The People's New Testament — raw source

Retrieved 2026-07-23 from the CrossWire Bible Society SWORD module repository:
https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/PNT.zip
(module `PNT` version 1.1, SwordVersionDate 2001-11-28; see `pnt.conf`,
vendored from the zip). The People's New Testament with Explanatory Notes,
two volumes (St. Louis: Christian Publishing Company, 1889-1891).

License: `DistributionLicense=Public Domain` (see `pnt.conf`). Johnson
(1833-1894) died well over a century ago; the 1889-1891 edition is public
domain. Registered in `src/lib/rights.ts` as `pnt`.

`PNT.zip` holds a zCom SWORD module: `modules/comments/zcom/pnt/nt.bzs/.bzv/.bzz`
(zlib-compressed, verse-indexed, KJV versification, ThML markup). The zip is
kept out of git (`.gitignore`); it is reproducible from the URL above.
Normalized by `scripts/build-commentary-pnt.mjs` into
`data/commentary/pnt/`.

Source condition, verified 2026-07-23:

- New Testament only: the zip carries no Old Testament files. Philemon has
  no content in the module, so no Philemon volume ships.
- Johnson's per-chapter heading and "SUMMARY OF <BOOK> N:" outline ride the
  chapter's first-verse slot; the build shelves them as intro sections (258
  chapters). The summary's own book and chapter name govern placement: the
  module swaps Matthew 8's and Matthew 9's summaries into each other's
  first-verse slots (both intros shelved at their named chapters). Matthew
  8:1's note is absent from the module. Summary naming quirks handled:
  "SUMMARY OF JOH 19", "SUMMARY OF HEBREW 4", "SUMMARY OF II CORINTHIAN
  12", "SUMMARY OF CHAPTER 5" (Hebrews 5 and 6), and numberless
  "SUMMARY OF II/III JOHN".
- Sixteen books carry a spurious record in their chapter-1 introduction
  slot: an exact duplicate of a verse note from the previous book (Mark 1
  holds Matthew 27:66's note, Acts 1 holds John 20:31's, and so on). All 16
  verified as exact duplicates and dropped.
- Ten records run past their own verse: the note for verse v continues
  with an embedded "c:v+1" marker and the next verse's note, the whole
  record duplicated into the covered slots (Luke 10:25, John 13:14, Acts
  25:9, and seven records in Revelation; the Revelation 13:18 record runs
  through the chapter seam into 14:1 and 14:2, chapter summary included).
  The build splits each record at its markers, shelves each piece at the
  verse the marker names (10 splits), and drops the duplicated slots (12).
  Luke 10:24's own note is absent from the module; its slot holds only the
  10:25 continuation.
- Verses without a note simply do not appear.
- Text quality: clean single-line ThML, zero U+FFFD.
