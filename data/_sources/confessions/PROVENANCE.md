# Confessional documents — provenance

The corpus behind `data/confessions/`: the landmark creeds and the two
workhorse standards of the Reformed/Baptist tradition, each with its
received scripture proof-text apparatus where one exists. All five documents
are public domain. Built by `scripts/build-confessions.mjs`; registry
entries in `src/lib/rights.ts` (ids `apostles-creed`, `nicene-creed`,
`chalcedon-definition`, `westminster-shorter-catechism`, `lbc-1689`).

## Westminster Shorter Catechism (`wsc.html`, 263 KB)

- Work: the Shorter Catechism of the Westminster Assembly (1647), with the
  proof texts printed by order of the House of Commons (1648). Public domain.
- Source: Reformed Standards digitization,
  https://reformedstandards.com/westminster/wsc.html (the plain WSC text,
  not the PCA proof-text variant the site also offers).
- Retrieved: 2026-07-23.
- The build parses all 107 questions with their lettered proof notes;
  question 8 carries an empty proof list in this edition and ships that way.

## 1689 London Baptist Confession (`bcf.txt`, 407 KB)

- Work: the confession composed 1677 and adopted by the general assembly of
  Particular Baptist ministers and messengers, London, 1689, with the
  scripture proofs its authors "took care to affix ... for the confirmation
  of each article." Public domain.
- Source: Christian Classics Ethereal Library (CCEL), "The 1677/89 London
  Baptist Confession of Faith," plain text,
  https://www.ccel.org/ccel/a/anonymous/bcf/cache/bcf.txt
- Retrieved: 2026-07-23.
- Read from this file: the epistle to the reader, the thirty-two chapters
  with their numbered proofs, the appendix, and the subscription statement.
- Excluded from this file, because they are modern copyrighted work, not the
  confession: the "1677/89 BCF Assistant" editorial apparatus (M. T. Smith,
  1994-1999), its quoted chapter outlines (Waldron, Evangelical Press 1989),
  doctrinal distinctives (Nichols), historical context (Renihan), and
  Spurgeon/Martin/Hetherington commendations. The subscriber name list is
  also omitted here for a different reason: the plain-text digitization
  mangles its two-column ditto-mark layout beyond honest reconstruction.
- CCEL editorial additions are kept but marked: bracketed "[Note: ...]"
  comments (9) ride as notes on their proofs, never as document text, and
  "See the original." (1) is kept as a note. Two proofs the print sets in
  the margin ("Hos. 1.7", "Gen. 2.16,17") are glued into the prose by the
  plain-text conversion; the build restores the prose and keeps the
  references as proofs, marked as restored.
- Two proofs the source prints name verses the canon does not contain:
  Acts 12:29,30 (chapter 27, proof 451) and Luke 13:36 (chapter 32, proof
  492). Both are documented errors in the original printing; CCEL's own
  notes flag them. The display strings stay as printed; the verses drop out
  of the parsed index and are recorded in `_meta.json`.

## The ecumenical creeds (`schaff-creeds2.txt`, 2.5 MB)

- Source: Philip Schaff, *The Creeds of Christendom*, vol. II (1877),
  CCEL plain text, https://www.ccel.org/ccel/schaff/creeds2/cache/creeds2.txt
- Retrieved: 2026-07-23. Schaff died 1893; the work is public domain.
- The Apostles' Creed: Schaff's received form ("I. THE APOSTLES' CREED. (a)
  RECEIVED FORM.", vendored lines 3084-3096), his parenthetical and
  bracketed annotations removed (he marks "(begotten)", "[Hades,
  spirit-world]", "[flesh]" as his own glosses).
- The Nicene Creed: the 381 (Nicæno-Constantinopolitan) text. Schaff prints
  it verbatim in the Ancoratus formula of Epiphanius (vendored lines
  2164-2301) and states it agrees with the 381 form word for word except
  three retained 325 clauses ("that is, of the substance of the Father",
  "God of God", and the concluding anathema), which are removed here. The
  325 form and its anathema ride as back matter from the same tables. The
  Western "and the Son" (filioque) is a later addition to the Latin text and
  is not part of the 381 creed; it does not appear.
- The Definition of Chalcedon: Schaff's English text (vendored lines
  4044-4061), his bracketed alternatives ("[rational]", "[coessential]") and
  footnote marks removed.
- The creeds carry no received proof-text apparatus, so their sections ship
  with empty proof lists by design; the proof-text index covers the
  catechism and the confession, whose apparatus is received.
