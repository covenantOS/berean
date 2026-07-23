# J. N. Darby, Synopsis of the Books of the Bible: raw source

Retrieved 2026-07-23 from STEM Publishing's digitization:
https://stempublishing.com/authors/darby/synopsis/ (per-book landing pages
plus one page per section, fetched once into `html/` and parsed from that
cache on reruns).

License: the Synopsis first appeared in French in Darby's journal *Etudes
sur La Parole*; the English edition ran to five volumes, 1857-1862
(London: G. Morrish). Darby died in 1882; the work is public domain.
STEM's pages carry no copyright notice and add no editorial apparatus of
their own; the digitization is a faithful transcription. Registered in
`src/lib/rights.ts` as `darby`.

Note on the CrossWire route: the CrossWire SWORD "Darby" module is
Darby's Bible *translation* (a zText module), not the Synopsis, so no
zCom source exists for this work; STEM's per-chapter HTML is the cleanest
openly hosted digitization.

`html/` holds the fetched pages (kept out of git, `.gitignore`;
reproducible from the site). Normalized by
`scripts/build-commentary-darby.mjs` into `data/commentary/darby/`.

Source condition, verified 2026-07-23:

- All 66 books: one landing page plus per-section pages linked from the
  landing page's sidebar in order (883 section pages parsed).
- Darby wrote prose chapter by chapter, never verse by verse; every
  section ships with an empty verses label (the intro-section convention
  of the other builds).
- Section titles run "Introduction", "Chapter N", "Chapters A to B",
  "Chapters A and B", verse-qualified ranges ("Chapters 9:35 to 12",
  "Chapters 11:19 to 30"; the two forms are told apart by the book's own
  verse counts),
  and whole-book "Summary" / "Conclusion" essays for the shortest books
  (Ruth, Esther, Ecclesiastes, Obadiah, Nahum, Haggai, Malachi, Philemon,
  2 John, 3 John, Jude, and 1 Kings' conclusion).
- Sections covering several chapters are duplicated into each covered
  chapter with the printed scope title prefixed (142 ranges into 470
  chapters).
- The work-level preface and the Old Testament, New Testament, Prophets,
  Minor Prophets, and Epistles introductions ship as intro sections in
  Genesis 1, Isaiah 1, Hosea 1, Matthew 1, and Romans 1.
- Text quality: clean UTF-8, zero U+FFFD.
