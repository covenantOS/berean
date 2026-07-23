# MACULA Hebrew Linguistic Datasets (Septuagint alignment source)

Retrieved 2026-07-23 from the Clear-Bible/macula-hebrew repository:
https://raw.githubusercontent.com/Clear-Bible/macula-hebrew/main/sources/Clear/annotations/annotations.xml
(repository: https://github.com/Clear-Bible/macula-hebrew)

License: CC BY 4.0. `LICENSE.md` in this directory is the repository's own
license file, kept in git as the license evidence (the web-usfm `copr.htm`
precedent). It states: "MACULA Hebrew Linguistic Datasets © 2022-2024 by
Biblica, Inc is licensed under CC BY 4.0", and names among the datasets the
"Greek equivalents drawn from the Septuagint" and the "Strong's numbers for
both Hebrew and Greek equivalents" — the two fields Berean builds on.
Attribution string required by the license: "MACULA Hebrew Linguistic
Datasets, available at https://github.com/Clear-Bible/macula-hebrew/".
Registered in `src/lib/rights.ts` (id `macula-hebrew`).

Only the aggregate ships: `data/lxx-strongs/hebrew-greek.json` maps each
Hebrew Strong's id to the Greek Strong's ids the LXX uses for it, with
counts, built by `scripts/build-lxx-strongs.mjs`. The raw annotations file
(80 MB) is kept out of git (see `.gitignore`). To rebuild:

    curl -O https://raw.githubusercontent.com/Clear-Bible/macula-hebrew/main/sources/Clear/annotations/annotations.xml
    node scripts/build-lxx-strongs.mjs

Numbering: both sides of the alignment use standard Strong's numbering
(Hebrew `StrongNumberX`, Greek `GreekStrong`), so the Hebrew-to-Greek
aggregation is direct; no cross-system mapping is built. One caveat handled
by the build: MACULA tags Hebrew prefixes and pronominal suffixes with
private numbers that collide with real Strong's entries (the conjunction
waw is "2050b", which is also Strong's H2050). The build excludes those
values by an empirical rule (lemma skeleton never present; at least 90% of
tokens single-consonant) and prints and records the excluded list in
`data/lxx-strongs/_meta.json`.

## Other sources investigated and rejected for a Strong's-tagged LXX

- CCAT/CATSS morphological LXX and Hebrew-Greek parallel alignment
  (ccat.sas.upenn.edu/gopher/text/religion/biblical/lxxmorph/): the
  `0-user-declaration.txt` user agreement requires no commercial use
  without written consent and a signed per-recipient registration.
- CrossWire SWORD `LXX` module (CCAT/Rahlfs with morphology):
  `DistributionLicense=Copyrighted; Free non-commercial distribution`.
- Apostolic Bible Polyglot (`ABP`, `ABPGrk` SWORD modules; a Strong's-coded
  Greek-English interlinear LXX): `DistributionLicense=Copyrighted;
  Permission to distribute granted to CrossWire` — free to download, not
  redistributable.
- eliranwong/LXX-Rahlfs-1935: CC BY-NC-SA 4.0 per its README, and itself
  derived from the restricted CCAT data. eliranwong/LXX-Swete-1930: GPL-3.0.
- openscriptures/GreekResources (CC BY 4.0): corrected LXX lemma lists per
  verse, but no Hebrew alignment and no verse-level Strong's tagging, so it
  cannot answer Hebrew-to-Greek equivalents on its own.
- eBible.org: no Strong's-tagged LXX edition (plain texts only; the Greek
  Brenton text already ships as `lxx-greek-brenton`).
- SalitaNgDiyos/LXX-Strongs-and-RMA-Codes: the CCAT `lxxmorph-rc` data with
  no license file.
