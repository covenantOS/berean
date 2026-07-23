# C. H. Spurgeon, the sermon archive (New Park Street Pulpit and
# Metropolitan Tabernacle Pulpit): raw source

Retrieved 2026-07-23 from The Spurgeon Library (spurgeon.org), a ministry
of Midwestern Baptist Theological Seminary, through its public WPGraphQL
endpoint: https://spurgeoncenter.wpenginepowered.com/graphql
(query `sermons(first: 100, after: ...)`, 36 pages cached under
`graphql/`, kept out of git, `.gitignore`; reproducible from the
endpoint). Normalized by `scripts/build-sermons.mjs` into
`data/sermons/`.

License: the sermons were published week by week and in annual volumes,
1855-1917 (New Park Street Pulpit volumes 1-6, Metropolitan Tabernacle
Pulpit through volume 63); Spurgeon died in 1892. Every sermon is public
domain. The Library's transcription is faithful to the printed text and
adds no editorial apparatus of its own. Registered in `src/lib/rights.ts`
as `spurgeon-sermons`.

Source condition, verified 2026-07-23:

- 3,597 sermon records, each with title, full HTML text, the appointed
  text's display reference ("Romans 10:1-3"), the year, the collection
  volume, a facsimile PDF URL, and the site's scripture-chapter taxonomy
  ("romans-10"), whose book slugs match Berean's canon exactly.
- Canonical sermon numbers populate 469 records ("3060", "3141A",
  combined issues "39-40", "7, 8"; 85 of them backfilled from the printed
  publication block the record carries in its body); polluted values
  ("874Delivered", "1850-51A") are dropped and logged in the build's
  anomaly list. 159 records carry the printed publication block
  ("No. 3006 A Sermon Published On Thursday, ..."), which ships as the
  reader's header line.
- 77 records carry no chapter tag (they stay readable, absent from the
  Passage Guide); 21 span two chapters and index under each; verse
  numbers in tags on one-chapter books ("obadiah-17") normalize to the
  book's single chapter.
- 17 records are stubs with no body text (volume prefaces, meeting
  reports, one sermon whose text never entered the library's database);
  they ship with an empty paragraph list and the reader points to the
  facsimile PDF and the library page instead.
- Text quality: clean UTF-8, zero U+FFFD.
