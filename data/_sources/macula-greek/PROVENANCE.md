# MACULA Greek Linguistic Datasets (syntax trees source)

Retrieved 2026-07-23 from the Clear-Bible/macula-greek repository:
https://github.com/Clear-Bible/macula-greek (the `Nestle1904/lowfat/*.xml`
files, by a shallow sparse git clone of the default branch).

License: CC BY 4.0. `LICENSE.md` in this directory is the repository's own
license file, kept in git as the license evidence (the web-usfm `copr.htm`
precedent). It states: "MACULA Greek Linguistic Datasets © 2022-2024 by
Biblica, Inc is licensed under CC BY 4.0", and names among the licensed
datasets the "Greek Syntax Trees in both Node and Lowfat format" and the
morphology attributes. Attribution string required by the license: "MACULA
Greek Linguistic Datasets, available at
https://github.com/Clear-Bible/macula-greek/". Registered in
`src/lib/rights.ts` (id `macula-greek`). The underlying Nestle 1904 text is
a 1904 publication in the public domain.

Two layers ship. `data/constructions/<Book>.json` records, per chapter and
verse, every clause carrying at least one constituent with a clause-level
function role, each part labeled from the treebank manual's documented set
(ADV, IO, O, O2, P, S, V, VC) plus the `aux` role the trees use for
appositions and other attachments outside the clause core (the manual does
not document `aux`; the label is empirical and noted in the build).
`data/frames/<Book>.json` records, per chapter and verse, the Clear
semantic frames (each annotated verb's arguments: A0 agent, A1 patient,
A2 recipient, AA2 experiencer; the role labels are empirical, the manuals
do not document them) and the participant referents (`@referent`,
resolving pronouns and other mentions to their antecedent words). Built by
`scripts/build-constructions.mjs` and `scripts/build-frames.mjs`; the raw
XML (about 100 MB) is kept out of git (see `.gitignore`). Versification
follows the shipped TAGNT (NA-style numbering, the N1904's own). To
rebuild:

    git clone --depth 1 --filter=blob:none --sparse https://github.com/Clear-Bible/macula-greek.git
    git sparse-checkout set Nestle1904/lowfat
    node scripts/build-constructions.mjs
    node scripts/build-frames.mjs

## Layers investigated and NOT taken from this repository

- Word sense data from the United Bible Societies MARBLE project (the
  `@domain` and `@ln` attributes on every `<w>`, and everything under
  `sources/MARBLE/`). The LICENSE.md's third-party list says of these
  attributes only "Used with permission": no license grant to downstream
  users is stated anywhere, and the MARBLE project publishes no license
  text of its own. The CC BY 4.0 grant covers Clear Bible's own datasets;
  it cannot sublicense UBS content. These attributes are excluded from the
  build. Louw-Nida semantic domains ship instead from the UBS Dictionary of
  the Greek New Testament, which UBS itself publishes under CC BY-SA 4.0
  (see `data/_sources/ubs-dictionaries/PROVENANCE.md`). Five constituents
  whose role attribute carries the source's own `err_...` annotation-error
  markers are skipped and counted in `data/constructions/_meta.json`.
- Semantic frames and participant referents (`sources/Clear/annotations`,
  carried on the lowfat words as `@frame` and `@referent`): Clear Bible's
  own data, CC BY 4.0, shipped 2026-07-23 as `data/frames/` behind the
  Exegetical Guide's Who Does What section and the original-language
  search's `role:` filter (`scripts/build-frames.mjs`). The `@subjref`
  attribute (verb to its expressed subject) stays reserved: it overlaps
  the frames' A0 layer, which already names the agent with its role.
- Clear's own word-sense numbers (`sources/Clear/wordsense`): bare sense
  numbers without definitions or labels, nothing honest to present.
- Synonyms (`sources/Clear/synonyms`): a proximity table without a stated
  derivation; reserved.
- SBLGNT text variants (`SBLGNT/`): the shipped TAGNT already amalgamates
  SBLGNT with the other editions and carries per-word edition flags.
