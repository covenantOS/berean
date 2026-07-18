> Copied from covenantOS/churchposting-app-backup revision 460c77bb82901f39244acd6028547f51e73b4aed (docs/COVENANT_DESIGN_LANGUAGE.md).

# Covenant Product Family Design Language

_Working standard as of July 17, 2026. This governs Covenant OS and provides the shared family foundation for future products such as Berean. It is an implementation guide, not merely a mood board._

## The idea

The product family should feel like a historic church renewed for excellent modern work: enduring, ordered, bright, legible, and quietly distinctive. The metaphor is architectural, but the interface is not a historical costume.

Use the inheritance of the church - leaded glass, stone structure, wood grain, printed Bibles, hymnals, service bulletins, marginalia, rules, small caps, and careful typography - to create hierarchy and identity. Do not imitate parchment props, fake leather, ornamental clutter, or a dark medieval game interface.

The governing design question is:

> Does this make serious work calmer, clearer, and more beautiful without slowing it down?

## Shared family and sibling distinction

Church Posting is the company. Covenant OS and Berean are sibling products in the same family.

- **Covenant OS** is the bright working house of the congregation. It emphasizes readiness, people, responsibility, and connected ministry work.
- **Berean** is the study and reading environment. It may be quieter and more text-centered, with reading modes tuned for long sessions, but it must still feel modern and related to Covenant OS.
- Neither product should pretend to be a room inside the other. They share identity and contracts while remaining independently useful and deployable.

Share semantic tokens, typography principles, interaction rules, and the restrained stained-glass mark. Do not make the two applications pixel-identical.

## Existing Covenant OS source of truth

Claude or another implementer should inspect these files before inventing a parallel system:

- `src/app/globals.css` - current semantic colors, typography aliases, Covenant mark, dither primitives, and Services workspace language.
- `src/app/layout.tsx` - Inter for interface work and Libre Baskerville for editorial display.
- `src/components/layout/CovenantBrand.tsx` - current leaded-window mark and the `Covenant OS by Church Posting` relationship.
- `src/components/layout/ProductContextBar.tsx` - product-level contextual navigation.
- `src/app/(dashboard)/worship/page.tsx` - current bright ledger interpretation of worship preparation.
- `src/components/dashboard/DashboardToolbar.tsx` - restrained stained-glass/dither signal surface.

These are an active foundation, not a finished universal component library. Reuse the principles; extract stable packages only after both products prove the same need.

## Color

Current family tokens:

| Meaning | Token | Current value | Use |
| --- | --- | --- | --- |
| Structural ink | `--signal-ink` | `#19272F` | navigation, primary actions, rules, major headings |
| Working paper | `--signal-paper` | `#F4F7F6` | page background and quiet secondary surfaces |
| Ruby glass | `--stained-ruby` | `#A42548` | selected state, care/attention accents |
| Sapphire glass | `--stained-sapphire` | `#176B91` | links, focus, information, reading/navigation accents |
| Amber glass | `--stained-amber` | `#CF8E18` | readiness, liturgical or editorial highlights |
| Emerald glass | `--stained-emerald` | `#24705A` | prepared/healthy state and completion |
| Violet glass | `--stained-violet` | `#634A8E` | rare secondary stained-glass accent |

Rules:

1. Work surfaces are white or a very light cool paper. The app shell must not be tan, brown, or low-contrast.
2. Stained-glass colors are signals, rules, panes, and small fields of light. They are not competing full-card backgrounds.
3. Structural ink supplies most contrast. Color does not carry meaning alone.
4. Berean may offer a warm reading paper and a candlelight evening mode inside the text reader. Navigation, controls, forms, and data apparatus must remain clearly legible.
5. Every palette and state must meet WCAG AA contrast, including evening mode.

## Typography

- Interface and apparatus: a restrained sans serif with excellent small-size rendering. Covenant OS currently uses Inter.
- Editorial headings and important titles: a serious book serif. Covenant OS currently uses Libre Baskerville.
- Scripture and sustained reading: choose and license a text face specifically for long reading, poetry, small caps, language coverage, and complete punctuation. Do not assume the display serif is automatically the reader face.
- Greek, Hebrew, transliteration, and critical signs require tested typefaces and correct bidirectional behavior. Never fall back silently to broken glyphs.

Use small caps, rules, folio-like metadata, and editorial spacing sparingly. Avoid oversized marketing typography inside routine work.

## Shape and depth

- Prefer square or lightly eased corners (`2px` to `6px`) for ledgers, work tables, dialogs, and structural panels.
- Reserve larger radii for rare soft containers, not every element.
- Use borders and alignment before shadows. Shadows should describe elevation only.
- A page should read as one composed workspace, not a field of unrelated floating cards.
- Dense professional tools may use tables, split panes, margins, drawers, and inspectors when the job benefits.

## Stained glass and dither

The leaded-window mark and dither are family signatures.

- Use one meaningful architectural or dither field on a major page, not one on every card.
- Dither suggests printed texture and ordered light. It must not reduce text contrast.
- Lead lines should create structure. Stained color should appear behind or beside content, not interfere with it.
- Never use generic aurora gradients, floating glass blobs, or an AI-purple glow as the product identity.

## Motion

Motion is quiet and physical: a drawer opens, a page changes, a row moves into order, a saved state settles.

- No bouncing controls, confetti, streaks, pulsing urgency, or ornamental animation loops.
- Respect reduced-motion preferences.
- Use motion to preserve spatial understanding and confirm real state change.

## Information architecture

- Products launch from a calm common home and then use contextual navigation.
- Navigation follows complete jobs, not every database table.
- Readiness, ownership, next action, and truth are visible.
- Advanced power opens progressively without hiding the real underlying model.
- Empty states teach the ministry job and create a real object; they do not sell the user another feature.

Berean's Chapel, Desk, Library, Pulpit, and Almanac may remain as evocative wayfinding and product storytelling. The operational model underneath should be shared projects, passages, sources, documents, calendars, and workflows rather than six duplicate stores.

## Language and tone

Write as a calm, capable ministry clerk.

- Prefer exact nouns and verbs: order of worship, Scripture reading, prepare, assign, reconcile, publish, approve.
- Avoid sales-CRM language, vague AI language, faux-liturgical ornament, and pious filler.
- Do not claim that software measures faithfulness or sanctification.
- Do not make a church's disputed doctrine sound like a platform verdict.

## Accessibility and responsive behavior

- Keyboard operation, visible focus, semantic headings, labeled controls, and screen-reader state are release requirements.
- Touch targets should be at least 44px where touch use is expected.
- Mobile is a composed workflow, not the desktop squeezed narrower.
- Scripture poetry, tables, interlinear text, musical material, and original languages each need explicit narrow-screen designs.
- Print is a first-class output for orders of worship, readings, teaching material, and study exports.

## Do not do this

- Do not make the app predominantly tan or brown.
- Do not apply rounded cards and large shadows everywhere.
- Do not use stained glass as a noisy wallpaper.
- Do not let the room metaphor create duplicated navigation or data.
- Do not copy a competitor's visual design or copyrighted content.
- Do not equate traditional churches with an inaccessible antique interface.

## Future shared packages

Do not block either application on a monorepo. When both products have proven the same contracts, extract versioned packages:

- `@church-posting/design-tokens` - semantic color, typography, spacing, motion, and mark geometry.
- `@church-posting/ministry-contracts` - IDs, event envelopes, service/sermon/reading schemas, and compatibility tests.
- `@church-posting/agent-contracts` - capability manifests, proposal/approval receipts, audit schema, and MCP types.

The packages must be versioned and backwards-compatible. Neither product imports the other product's application code.
