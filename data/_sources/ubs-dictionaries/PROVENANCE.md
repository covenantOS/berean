# UBS open-license dictionaries (semantic domains source)

Retrieved 2026-07-23 from the ubsicap/ubs-open-license repository:
https://github.com/ubsicap/ubs-open-license
- `dictionaries/greek/JSON/UBSGreekNTDic-v1.1-en.JSON` (UBS Dictionary of the
  Greek New Testament, v1.1, English)
- `dictionaries/hebrew/JSON/UBSHebrewDic-v0.9.2-en.JSON` (UBS Dictionary of
  Biblical Hebrew, v0.9.2, English)

License: CC BY-SA 4.0. `LICENSE.md` in this directory is the repository's
own license file for the dictionaries (the full Attribution-ShareAlike 4.0
International legal text), kept in git as the license evidence (the web-usfm
`copr.htm` precedent). The repository README states: "This work is licensed
under a Creative Commons Attribution-ShareAlike 4.0 International License",
and names the rights holders: "UBS Dictionary of New Testament Greek,
© United Bible Societies, 2023. Adapted from Semantic Dictionary of Biblical
Greek: © United Bible Societies 2018-2023, which is adapted from
Greek-English Lexicon of the New Testament: Based on Semantic Domains, Eds.
J P Louw, Eugene Albert Nida © United Bible Societies 1988, 1989" and "UBS
Dictionary of Biblical Hebrew © United Bible Societies, 2023. Adapted from
Semantic Dictionary of Biblical Hebrew © 2000-2023 United Bible Societies."
Registered in `src/lib/rights.ts` (id `ubs-dictionaries`).

What ships: `data/domains/greek.json` and `data/domains/hebrew.json`, each
mapping a base Strong's id to the lemma's attested senses with their domain
assignments, short definitions, glosses, and attestation counts, built by
`scripts/build-domains.mjs`. The Greek senses carry the Louw-Nida entry
codes and domain names from the lexicon this dictionary adapts; the Hebrew
senses carry the SDBH domain hierarchy, a different taxonomy, named as SDBH
wherever it is presented. The derived aggregates are themselves licensed
CC BY-SA 4.0 as ShareAlike adaptations of the dictionaries, with the same
attribution. The raw dictionary JSON (about 39 MB) is kept out of git (see
`.gitignore`). To rebuild:

    curl -O https://raw.githubusercontent.com/ubsicap/ubs-open-license/main/dictionaries/greek/JSON/UBSGreekNTDic-v1.1-en.JSON
    curl -O https://raw.githubusercontent.com/ubsicap/ubs-open-license/main/dictionaries/hebrew/JSON/UBSHebrewDic-v0.9.2-en.JSON
    node scripts/build-domains.mjs

On the Louw-Nida naming question: the domain names and entry numbers ship
because this dictionary is the rights holder's own licensed edition of the
Louw-Nida taxonomy under CC BY-SA 4.0. The numbers, names, and definitions
all carry the license; attribution is given in the rights registry, the
_meta.json files, and every surface that presents them.

Strong's id mapping: the dictionaries' StrongCodes carry a letter prefix
marking language (G, H, and A for the Aramaic vocabulary) over the Strong's
number; Strong's interleaves the Aramaic words in the Hebrew sequence, so
both H and A codes reduce to the same H-space (A0002 is Strong's H2).
Collisions (one number, several dictionary entries) resolve against the
shipped Strong's lexicons by lemma consonant skeleton, and the resolution
counts are recorded in `data/domains/_meta.json`.

## Why these dictionaries and not the MACULA `@ln`/`@domain` attributes

The same semantic-domain assignments appear in the Clear-Bible/macula-greek
lowfat trees as the `@ln` and `@domain` attributes, sourced from the UBS
MARBLE project. There the only stated term is "Used with permission": no
downstream license grant exists, and MARBLE publishes no license text.
Rights-first means the data ships from the edition that carries a verified
license, and that is this one.
