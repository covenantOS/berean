# Logos Feature Matrix

Authoritative capability inventory of Logos Bible Software, current subscription version (October 2024 relaunch and later, app version 37+), with Logos 10 (October 2022) differences noted. Built as the work-tracking checklist for the Berean clone: every line is one capability to reproduce.

Tags:

- `[SW]` pure software: UI and logic only, no special content required
- `[DATA]` needs a dataset: Faithlife-built tagging, alignment, or reference data that must be recreated or sourced
- `[LICENSED]` gated by publisher licenses: requires licensed Bible texts, books, or media
- Combinations mean both apply. Tier notes (Premium, Pro, Max) mark subscription gating.

Sources: logos.com/features and logos.com/compare, the support.logos.com help center (full section crawl, July 2026), the Logos Platform Comparison matrix (support article 9785956686349), the Logos user wiki via web.archive.org (Tools, Guides, Passage Guide pages), Faithlife launch coverage for Logos 9 and 10, and user reviews and forums for gaps official pages omit.

## Version notes

- October 2024 relaunch: perpetual feature sets replaced by subscription tiers (Premium, Pro, Max; the free Basic app remains). AI and cloud features are subscription only. Logos 10 and older owners keep purchased feature sets and receive free app updates.
- Added after Logos 10 (2024 to 2026): Smart Search, Search Synopsis, Search Result Summaries, Summarize sidebar, Study Assistant, Sermon Assistant, Bible Study Builder, Insights panel, reference-aware New Tab panel, Factbook refresh (passage entries, lenses, AI summaries), Sermon and Bible Study Markers, Get Started layout wizard, AI credits meter.
- Added in Logos 10 (2022): UI redesign, Multiview, Corresponding Notes and Highlights visual filter, Print Library catalog and print book search, Auto Translate, search tabs for Documents, Factbook, and Maps, Dashboard replacing the old Home page.
- Logos 9 (2020) for reference: Sermon Builder, Sermon Manager, Preaching Mode, Counseling Guide, Factbook Tags, Bible Books Explorer, Reader's Edition interlinear, Charts tool, dark mode, Wordsearch migration.

## 1. Texts and Interlinears

- [ ] [SW] Bible reader panel: verse and pericope navigation with reference box, pericope suggestions, and locator bar; depends on the Bible datatype verse index.
- [ ] [DATA][LICENSED] Reverse interlinear view: modern translation with aligned original language lines (lemma, morphology, gloss, transliteration, Louw-Nida, Strong's); depends on per-translation alignment datasets for ESV, NIV, KJV, NASB, LSB, CSB, NRSV and more.
- [ ] [DATA] Inline interlinear: the same alignment rendered inside the text flow instead of a ribbon.
- [ ] [DATA] Interlinear pane: bottom panel with full parsing for the word under the cursor.
- [ ] [LICENSED][DATA] Original language texts: BHW Hebrew, Lexham Hebrew Bible, NA28/UBS5/SBLGNT Greek, Septuagint editions, Targums, Peshitta, Vulgate, Dead Sea Scrolls, all morphologically tagged.
- [ ] [DATA] Reader's Edition interlinear (Logos 9): glosses shown only for vocabulary below a chosen frequency band.
- [ ] [LICENSED][DATA] Manuscript images and transcriptions: papyri through minuscules with passage navigation, surfaced through the manuscript explorers.
- [ ] [SW] Parallel resources: one keystroke swaps a panel between equivalent resources (Bibles, commentary volumes, lexicons); depends on series metadata.
- [ ] [SW] Multiview (Logos 10): several books side by side in one panel with shared or independent scrolling.
- [ ] [SW] Bible Text Only mode: hides chapter numbers, verse numbers, footnotes, and headings; plus one-verse-per-line and red letter toggles.
- [ ] [SW] Text Comparison tool: diffs any set of Bible versions against a base text, marking added and omitted words; depends on the verse index.
- [ ] [DATA] Corresponding Words visual filter: hovering a word highlights its aligned counterparts in other open texts.
- [ ] [DATA] Emphasize Active Lemmas visual filter: every occurrence of the hovered lemma lights up across the panel.
- [ ] [SW] Emphasize Active References visual filter: hovering a reference link highlights the matching text in open Bibles.
- [ ] [SW] Corresponding Notes and Highlights visual filter (Logos 10): annotations made in one resource surface in parallel resources.
- [ ] [SW] Community Notes visual filter: notes shared by chosen Faithlife groups render inline.
- [ ] [DATA] Factbook Tags and Community Tags visual filters: inline markers where dataset tags or community tags attach to the text.
- [ ] [DATA][LICENSED] Discourse and Propositional Outlines visual filters: indentation and discourse markers from the Lexham Discourse and High Definition datasets.
- [x] [SW] Context menu: right-click splits into dataset entities on the left (person, place, thing, event, lemma, morph) and actions on the right (guides, searches, Factbook, pronounce).
- [x] [SW] Selection menu: hover toolbar on any selection for copy, highlight, note, search, share, and translate.
- [x] [DATA] Keylinking: double-click a word to open the prioritized lexicon at its lemma or Strong's number.

## 2. Search (morph, clause, semantic)

- [ ] [SW] All Search: one query across books, Bibles, personal documents, tools, and the store; depends on unified local and cloud indexes.
- [ ] [SW] Bible Search: words, phrases, and operators inside chosen versions and verse ranges, with multi-version result views.
- [ ] [SW] Books Search: full-text library search with field scoping (heading text, footnotes, surface text).
- [ ] [SW] Precise Search syntax: boolean, proximity (NEAR, WITHIN n, BEFORE, AFTER), wildcards, grouping, and field operators.
- [ ] [DATA] Morph Search: lemma plus morphology queries over tagged texts with term picker, root and lexeme forms, and agreement constraints; depends on morphological tagging.
- [ ] [DATA][SW] Morph Query documents: visual builder that composes morph searches without syntax and saves them as documents.
- [ ] [DATA] Clause Search: role-based queries (subject, verb, object, agent, patient) that find who does what to whom; depends on clause participant tagging.
- [ ] [DATA][LICENSED] Greek Syntax Search: tree-pattern queries over Cascadia Syntax Graphs and Opentext.org analyses.
- [ ] [DATA][LICENSED] Hebrew Syntax Search: phrase-marker queries over Lexham Hebrew Bible and Andersen-Forbes analyses.
- [ ] [SW] Smart Search: natural-language hybrid of lexical match, semantic embeddings, AI ranking, and snippet selection; Bible scope in all tiers, books scope Premium and up; searches unowned and print-cataloged books; cloud AI.
- [ ] [SW] Smart Bible Search: question in, verified verses out, with AI candidates confirmed against the actual licensed text; all tiers.
- [ ] [DATA] Speaker and Addressee extensions: {Speaker <Person Jesus>} and {Addressee <Person Peter>} over the reported speech dataset.
- [ ] [DATA] Datatype and label search: <Person Peter>, {Label ...}, {Section ...}, {Milestone ...} reach every dataset.
- [ ] [SW] Search Templates: fill-in forms for common morph, clause, and dataset queries.
- [ ] [SW] Inline Search: find box scoped to the open book with match navigation.
- [ ] [SW] Docs Search (Logos 10): search tab over your own notes, sermons, clippings, and documents.
- [ ] [SW] Specialized search tabs: Factbook Search, Maps Search, Media Search, Bookstore Search.
- [ ] [SW] Result views: Verses, Aligned, Grid, and Analysis arrangements for Bible and morph results.
- [x] [SW] Charts tool: bar, column, pie, donut, line, and area frequency graphs of results by book or chapter; also launched from word study translation rings.
- [x] [SW] Result handoffs: save results as a Passage List, Word List, Visual Filter, or Favorite; re-run anything from History. (Passage List, Word List, Favorite, and History ship; the Visual Filter handoff is deferred: the highlight store is one tint per verse with no named, toggleable result sets.)
- [ ] [SW] Milestones: indexed navigation points inside books so searches and guides land on the right article.

## 3. Guides and Workflows

- [x] [SW] Passage Guide: master pericope report over library and datasets.
- [ ] [DATA] Commentaries section: hits sortable by priority, series, author, denomination, type, and era (patristic through contemporary).
- [x] [DATA][LICENSED] Cross References section: pooled cross-reference data from licensed Bibles and dedicated resources.
- [ ] [DATA] Parallel Passages section: quotation and allusion parallels from harmony resources and the OT-in-NT dataset.
- [ ] [DATA] Topics section: Logos Controlled Vocabulary tags for the passage as list, cloud, or tags.
- [ ] [DATA] Interesting Words section: statistically significant vocabulary of the passage from reverse interlinear data.
- [ ] [SW] Compare Versions section: translation similarity against a chosen base version.
- [x] [DATA] Biblical People, Places, Things, and Events sections: entity cards from the Biblical Knowledgebase with Factbook links.
- [ ] [DATA] Cultural Concepts and Literary Typing sections: background concepts and genre labels from their datasets.
- [ ] [LICENSED] Media, Atlas, and Music sections: maps, images, and hymn resources tied to the passage.
- [ ] [LICENSED] Journals, Sermons, Illustrations, and Collections sections: hits from journal series, sermon archives, illustration resources, and user collections.
- [ ] [DATA] Systematic Theologies, Biblical Theologies, and Confessional Documents sections: passages cited inside those tagged corpora.
- [x] [SW] Exegetical Guide: original language report with Word by Word, Grammar, Textual Variants, Apparatuses, Lemma in Passage, and Important Words sections.
- [ ] [DATA][LICENSED] Textual Variants and Apparatuses sections: manuscript evidence from the variants dataset and licensed apparatuses.
- [x] [SW] Bible Word Study guide: the word-level report; section detail under Word Study.
- [x] [DATA] Topic Guide: controlled vocabulary topic entry with definition, key passages, dictionary hits, and related topics.
- [ ] [DATA] Sermon Starter Guide: passage or theme in; themes, key passages, illustrations, outlines, sermons, and media out; depends on Preaching Themes and sermon tagging.
- [ ] [DATA] Theology Guide (Logos 10): systematic theology topics browsed through the Lexham Survey of Theology ontology.
- [ ] [DATA][LICENSED] Counseling Guide (Logos 9): counseling topics mapped to passages and counseling resources.
- [ ] [SW] Custom guides and Guide Editor: compose named guides from any sections, with per-section collections and settings; custom guides appear in the context menu.
- [ ] [SW] Workflows engine: step-by-step guided studies with prompts, embedded tools, note capture into auto-titled notebooks, progress rings, and resume from the Dashboard.
- [ ] [DATA] Prebuilt workflow library: Devotional, Lectio Divina, Praying Scripture, Adoration, Basic and Inductive Bible Study, Biblical Person/Place/Theme/Topic Study, Passage Exegesis, Word Study, Expository Sermon Preparation.
- [ ] [SW] Workflow Editor: build and share custom workflows from the same section parts.
- [x] [SW] Insights panel (2025, all plans): cards inside the Bible panel surfacing study Bibles, commentaries, and references for the current passage without opening a guide. (A collapsible rail ships at the chapter's head in the workspace reader, toggled from the pane header, over the Passage Guide composition: commentaries, cross-references, people and places, topics, and notable words, each card handing off to the full guide. A study Bible dataset and AI summaries do not ship, so those card kinds do not appear.)

## 4. Factbook and Datasets

- [x] [DATA] Factbook tool: 20,000+ entry pages aggregating datasets, media, and library hits, with lenses (biblical, theological, library) and one-click AI summaries for subscribers. (The Factbook ships as a pinned workspace tab over the 4,247 TIPNR entries, aggregating identity prose, family relationships, the atlas locator, the timeline join, and every verse reference; the entry count is TIPNR's, and lenses, media, library hits, and AI summaries do not ship.)
- [x] [DATA] Factbook entry types: biblical people, places, things, events, books of the Bible, topics, theological topics, church history themes, counseling themes, lemmas, manuscripts, ancient authors and works. (Biblical people, places, and things ship; the remaining entry types do not.)
- [x] [DATA] Factbook sections: Key Article, Passages, Events, Reported Speech, Commentaries, Dictionaries, Media, Factbook Tags, Questions to Ask, Dig Deeper, See Also, Referred to As. (Key Article as the dataset's own prose, Passages as Every Reference, Events as On the Timeline, See Also as the Family lists, and Referred to As as the alias line ship; the remaining sections have no shipped dataset behind them.)
- [x] [DATA] Factbook Tags: dataset anchors embedded in books that jump from any mention to the entry; searchable and visible as a visual filter. (TIPNR anchors ride the reader apparatus and the verse context menu and open the Factbook entry; the omnibox searches them. A visual filter over the text does not ship.)
- [ ] [DATA] Bible Browser: faceted browsing of the whole Bible by people, places, things, events, genres, and speakers (online).
- [x] [DATA] Biblical People, Places, and Things datasets: referent tagging across the canon, including family trees and relationship diagrams. (TIPNR referent tagging across the canon and the family relationship lists ship, surfaced in the Factbook; tree and diagram visualizations do not.)
- [x] [DATA] Biblical Events database: dated, linked event records powering Factbook, Timeline, Atlas, and the Event Navigator. (Dated event records linked to TIPNR entities power the Timeline and the Factbook's On the Timeline section; Atlas and Event Navigator joins do not ship.)
- [ ] [DATA] Reported Speech, Speakers, and Addressees datasets: who speaks to whom, verse by verse, including Deuterocanon.
- [ ] [DATA] Speaking to God dataset: every prayer address and its response.
- [ ] [DATA] Miracles, Parables, and Prophecies datasets: tagged instances with agent, means, and fulfillment links.
- [ ] [DATA] OT Quotes and Allusions in the NT dataset: powers Parallel Passages and the NT Use of the OT interactive.
- [ ] [DATA] Figurative Language dataset plus Bullinger's Figures of Speech tagging.
- [ ] [DATA] Literary Typing and Longacre Genre Analysis: pericope-level genre labels, visualized in Bible Books Explorer.
- [ ] [DATA] Cultural Concepts dataset: ancient-world concepts tagged to passages and media.
- [ ] [DATA] Preaching Themes dataset: homiletic theme tagging powering Sermon Starter, sermon metadata, and themed media.
- [ ] [DATA][LICENSED] Discourse datasets: Lexham Discourse Greek NT, High Definition NT, and Hebrew Bible equivalents with propositional outlines.
- [ ] [DATA] Greek and Hebrew Grammatical Constructions datasets: named constructions searchable and shown in Exegetical Guide.
- [ ] [DATA] Syntactic Force, Sentence Types, and Speech Acts datasets: clause-level pragmatics tagging.
- [ ] [DATA] Louw-Nida semantic domains and Bible Sense Lexicon taxonomy: concept-first lexical organization.
- [ ] [DATA] Logos Controlled Vocabulary: canonical topic names aligning dictionaries, guides, and Factbook.
- [ ] [DATA] Lexham Systematic Theology Ontology: about 830,000 systematic theology cross-references categorized by tradition and locus.
- [ ] [DATA][LICENSED] Confessional Documents tagging: creeds and confessions indexed by passage and topic.
- [ ] [DATA] Church History Themes dataset: eras, people, events, and documents of church history for Factbook and Timeline.
- [ ] [DATA] Questions and Answers dataset: curated question bank feeding Factbook's Questions to Ask and Study Assistant entry points.
- [ ] [DATA] Popular Quotes dataset: notable quotations with attribution, powering quote detection and the sermon Quotations block.
- [ ] [DATA] Canon and book metadata: authorship, genre, composition dates, and statistics powering Bible Books Explorer.
- [ ] [DATA][LICENSED] Textual variants and manuscript data: variant units with witness alignment feeding guides and explorers.
- [ ] [DATA] Reference data utilities: Israelite Sacrifices, Prophets Priests Regents and Judges, Weights and Measures, Narrative Character Maps, Names of God.
- [ ] [DATA][LICENSED] Catholic datasets: Deuterocanon addressees, Catholic Topical Index, Catholic Daily Readings (shared with Verbum).

## 5. Notes, Highlights, Clippings

- [ ] [SW] Notes tool: rich text notes with images and a faceted sidebar (notebook, type, resource, Bible book, tag, anchor, date).
- [ ] [SW] Notebooks: named containers that organize notes and serve as the sharing and filtering unit.
- [x] [SW] Anchors: attach a note by Bible reference (follows you across every version) or by selection in any book. (Bible-reference anchors ship: marginalia keys on book, chapter, and verse, so a note renders in every translation and the selection toolbar anchors its note to the selection's verse. Selection anchors inside arbitrary books await non-Bible readers.)
- [x] [SW] Note indicator icons: per-style markers in the text showing where notes exist, configurable per notebook. (One discreet marker ships: the verse number turns amber and opens the note on click. Per-style, per-notebook configuration awaits notebooks.)
- [ ] [DATA] Labels: structured name-value tags on notes that become searchable fields.
- [ ] [SW] Highlighting engine: palette and style editor controlling font, colors, borders, effects, inserted text and images; highlights are notes and fully searchable.
- [ ] [SW] Clippings documents: ordered excerpt collections from any resources with citation text preserved.
- [ ] [SW] Community Notes: group-shared notes rendered in your text via visual filter.
- [ ] [SW] Notebook sharing and collaboration: share a notebook to a Faithlife group with read or edit rights.
- [ ] [SW] Notes import: Wordsearch and BibleWorks importers for migrating users.
- [ ] [SW] Print and export for notes and clippings.
- [ ] [SW] Journaling: date-based notebooks and filters used as a journal.
- [ ] [SW] Reference-range filtering: the Notes panel filters everything to the passage in front of you.
- [ ] [SW] Docs indexing: notes and highlights flow into Docs Search and All Search.

## 6. Layouts and Linking

- [ ] [SW] Saved layouts: named workspace snapshots with update-on-save and cloud sync.
- [ ] [DATA] Quickstart layouts: prebuilt workspace templates for common tasks.
- [ ] [SW] Get Started wizard (2025, Premium and up): pick a task and Logos generates the layout.
- [ ] [SW] Dashboard (Logos 10): cards for verse of the day, reading progress, plans, workflows, and promos.
- [ ] [SW] Docking workspace: tabs, tiles, panels, floating windows, and multi-monitor support.
- [ ] [SW] Link sets: lettered link groups (A through E plus Follow) that scroll panels together.
- [ ] [SW] Navigation stack: per-panel back and forward plus global History with re-runnable searches.
- [ ] [SW] Command box: type references, commands, or tool names to open anything.
- [ ] [SW] New Tab panel (2025): opening a tab offers everything or reference-aware suggestions keyed to the active passage.
- [ ] [SW] Toolbar and shortcuts: customizable toolbar, draggable shortcut targets, full keyboard map.
- [ ] [SW] Favorites tool: bookmark tree with folders plus nine keyboard bookmarks.
- [ ] [SW] Reading view and full screen: distraction-free reading with columns and page view.
- [ ] [SW] Per-resource display controls: columns, text size, font, and the visual filter menu per panel.
- [ ] [SW] Program Settings: global fonts, scaling, citation style, transliteration, internet use, update behavior.
- [ ] [SW] Theme switching and dark mode; interface language switching across six-plus languages.
- [ ] [SW] Hebrew and Greek input methods; Bible book abbreviations recognized across many languages.
- [ ] [SW] Deep links: logosres: and ref.ly URLs into exact library locations for docs and web sharing.

## 7. Sermon Builder and Manager

- [ ] [SW] Sermon document: block-based manuscript editor (headings, normal, illustration, quote, question blocks); Pro and up, Silver feature set and up under Logos 10.
- [ ] [SW] Passage blocks: type a reference and hit Alt+Enter to insert the text from your Top Bible with an auto-built slide; per-block display options (block paragraphs, one verse per slide, fully formatted).
- [ ] [SW] Automatic slides: every heading, quote, and passage block produces an editable slide with style and background controls.
- [ ] [SW] Auto handout and discussion questions: companion documents generated from the same manuscript.
- [ ] [SW] Sermon outline sidebar: live outline tree of the document for navigation.
- [ ] [SW] Export and publish: DOCX, PDF, slide export, and one-way slide publish to Proclaim.
- [ ] [DATA] Quotations block: quotations with automatic citation, backed by the Popular Quotes dataset and quote detection across the library.
- [ ] [SW] Notebook tab: drag notes from any notebook straight into the sermon.
- [ ] [SW] Sermon Assistant pane: the four AI generators docked beside the manuscript (Pro and up; see AI group).
- [ ] [SW] Sermon Manager: list and calendar views of all sermons, filterable by date, passage, series, tag, and venue; series planning and archives.
- [ ] [SW] Sermon metadata: passage, topic, series, date, and venue fields that drive the 2025 Sermon and Bible Study Markers inside your Bibles.
- [ ] [SW] Sermon Import: bulk DOCX import with automatic metadata and passage detection.
- [ ] [SW][LICENSED] Logos Sermons platform: publish sermons to a church profile with audio or video, paid automatic transcription and closed captions, and a public archive (Pro and Max include access).
- [ ] [SW] Preach handoff: one click sends the sermon into Preaching Mode.

## 8. Preaching Mode

- [ ] [SW] Browser-based presentation view launched from any sermon document; runs on desktop, tablets, and phones.
- [ ] [SW] Adjustable timer with one- and two-minute flash warnings and an overtime pulse.
- [ ] [SW] Paging or scrolling navigation with keyboard, touch, and clicker support.
- [ ] [SW] Live display controls: font family, five sizes, line spacing, margins, and text column mode, persisted per device.
- [ ] [SW] On-screen slide indicator showing which slide is currently displayed.
- [ ] [SW] Proclaim remote control: advance the congregation's slides from Preaching Mode; internet needed only to start.

## 9. Library and Store

- [ ] [SW] Library panel: faceted filtering by type, subject, author, series, language, era, rating, tag, and download state.
- [ ] [SW] Cloud library: resources stream on demand with selective download for offline use.
- [ ] [SW] Prioritization: ordered preference lists per resource type, including advanced per-datatype rules.
- [ ] [SW] Collections: rule-based dynamic sets that scope searches, guides, and tools.
- [ ] [SW] Custom series: merge or rename series so parallel switching works your way.
- [ ] [SW] Hide books: remove titles from the local installation while licenses persist.
- [ ] [SW] Tags and ratings: personal metadata on every resource, usable in collection rules.
- [ ] [SW] Library export: dump the catalog to a spreadsheet.
- [ ] [SW] Print Library catalog (Logos 10): register physical books by ISBN so Smart Search can cite them by page number.
- [ ] [LICENSED] Store with dynamic pricing: bundle prices subtract what you already own.
- [ ] [LICENSED] 2025 denominational libraries: Anglican, Baptist, Charismatic, Lutheran, Messianic Jewish, Orthodox, Reformed, Seventh-day Adventist, Wesleyan, plus Verbum for Catholic users.
- [ ] [LICENSED] Pre-Pub and Community Pricing: crowdfunding pipelines that move new books into production.
- [ ] [LICENSED] Mobile Ed courses: video courseware with transcripts and self tests, driven by the Courses tool.
- [ ] [LICENSED] Audiobooks and read-aloud editions in the catalog.
- [ ] [SW] Store conveniences: wishlists, payment plans, monthly free book, subscriber storewide discount.
- [ ] [SW] Personal Books: compile DOCX into tagged library resources with automatic Bible reference linking; PDFs convert through Word or Google Docs.
- [ ] [SW] Bookstore Search: buy from inside the app with preview snippets of unowned books.

## 10. Atlas, Timeline, Media

- [ ] [DATA] Atlas tool (online): professional cartography with layered sites, event routes, and journeys searchable by place.
- [ ] [LICENSED] Maps resources: biblical places maps and image libraries embedded in books.
- [ ] [DATA] Timeline tool: filterable scroll of biblical and church history events by era, empire, type, and subject; every event opens Factbook.
- [ ] [SW] Media tool: search and browse every media collection by tag and type, customize slides, and export.
- [ ] [SW] Visual Copy: turn any selection or verse into a styled slide or share image.
- [ ] [SW] User media uploads into your media library (Premium and up).
- [ ] [SW] Media Search and the Media Collections guide section: media surfaced per passage.
- [ ] [DATA] Bible Books Explorer interactive (Logos 9): the canon by author, genre, size, and composition date; desktop only.
- [ ] [DATA] Psalms Explorer and Proverbs Explorer interactives: genre-colored, sortable maps of the wisdom books.
- [ ] [DATA] Parallel Gospel Reader interactive: harmony alignment of the Gospels.
- [ ] [DATA][LICENSED] New Testament Manuscripts Explorer: sortable manuscript catalog with images and transcriptions.
- [ ] [DATA] Biblical Event Navigator and NT Use of the OT interactives.
- [ ] [DATA] Miracles of the Bible, Names of God, and Narrative Character Maps interactives.
- [ ] [DATA][LICENSED] Before and After: Biblical Sites interactive: then-and-now photo sliders.
- [ ] [SW] Utility interactives: Hebrew Cantillations, Greek and Hebrew Alphabet Tutors, Counting the Ten Commandments, Weights and Measures Converter, Numeric Converter, Text Converter, Who Killed Goliath.
- [ ] [DATA] Bible Outline Browser: stacked comparison of how your books outline the current passage.

## 11. Canvas and Whiteboard

- [ ] [SW] Canvas tool: infinite whiteboard for visual study; insert passages, text, shapes, connectors, and images.
- [ ] [SW] Canvas documents: multiple saved canvases synced like other documents.
- [ ] [SW] Canvas export and share as images for teaching.
- [ ] [SW] Draw On Screen (mobile): freehand pen and highlighter markup over any resource screen; save to photos or attach to a note.

## 12. Reading Plans

- [ ] [SW] Bible reading plan generator: any range and pace with automatic session division, catch-up, and adjustment.
- [ ] [SW] Book reading plans: schedule any library book by sessions, pages, or milestones.
- [ ] [SW] Plan tracking: mark done, progress bars, Dashboard cards, mobile reminders; syncs across devices.
- [ ] [SW] Group plans: share reading plans to Faithlife groups.
- [ ] [DATA][LICENSED] Lectionary and daily readings content (Catholic Daily Readings and similar) as ready-made plans.

## 13. Prayer Lists

- [ ] [SW] Prayer list documents: requests with tags, categories, and custom fields.
- [ ] [SW] Prayer scheduling: per-request frequency settings with last-prayed tracking.
- [ ] [SW] Answered prayer tracking: mark requests answered and keep the history.
- [ ] [SW] Sharing: prayer lists share to Faithlife groups like other documents.
- [ ] [SW] Cross-device sync and mobile access.

## 14. Memorization

- [ ] [DATA] Word List documents: vocabulary lists with lemma, gloss, and occurrence counts pulled from any passage or search.
- [ ] [SW] Flashcard drilling: word lists sync to companion flashcard mobile apps.
- [ ] [SW] Word Find Puzzle generator: printable puzzles built from any word list.
- [ ] [SW] Gap note: Logos has no native verse memorization trainer; the legacy Faithlife Bible Memory app is defunct. Berean can outflank them here.

## 15. Word Study

- [x] [SW] Bible Word Study guide: one lemma or English word in, a full lexical report out, with English and original language modes.
- [x] [DATA] Translation section: ring graph of how a lemma is rendered across your reverse interlinears, with Charts handoff.
- [ ] [DATA] Septuagint Translation section: Hebrew lemma to Greek equivalents in the LXX.
- [ ] [DATA] Lemma, Root, and Senses sections: dictionary entries, root relationships, and the sense taxonomy with example occurrences.
- [x] [DATA] Morphology section: form distribution of the lemma across the corpus.
- [ ] [LICENSED] Grammars section: discussion of the construction in your grammar resources.
- [ ] [DATA] Textual Searches section: prebuilt searches for the word across corpora and datasets.
- [ ] [SW] Concordance tool: build a concordance of any book with language, heading, and field facets.
- [ ] [DATA] Bible Sense Lexicon tool: browse concepts and synonym sets, then jump from sense to occurrences.
- [ ] [DATA] Semantic domains: Louw-Nida domain browsing and searching.
- [ ] [DATA] Information tool: hover or click for definition, translation across versions, morphology, and textual classification of the word under the cursor.
- [ ] [DATA] Pronunciation tool: audio for Greek (three schemes), Hebrew, Aramaic, and English Bible words.
- [ ] [DATA] Morphology Charts tool: full paradigm tables for any lemma.
- [ ] [DATA] Lemma in Passage section: every commentary and lexicon discussion of a lemma inside a given passage.

## 16. Export and Printing

- [ ] [SW] Print and Export panel: print any selection or range, or export to PDF, clipboard, or third-party apps.
- [ ] [SW] Copy Bible Verses tool: styled verse insertion into Word, PowerPoint, and email with a custom style editor.
- [ ] [SW] Automatic citations: copied text carries source citations in the style set in Program Settings.
- [ ] [SW] Bibliography documents: assemble and export bibliographies in APA, MLA, Chicago, Turabian, and more.
- [ ] [SW] Sentence Diagram tool: grammatical diagramming canvas for passages, printable and exportable.
- [ ] [SW] Handout and sermon export to DOCX, PDF, and slide decks.
- [ ] [SW] Notes, clippings, and prayer list printing.
- [ ] [SW] Canvas and Visual Copy image export.
- [ ] [SW] Library catalog export to spreadsheet.
- [ ] [SW] Power Lookup copy: expand and copy every referenced text on the page in one action.
- [ ] [SW] Copy location as link: ref.ly and logosres URLs for citing exact spots.
- [ ] [SW] Printing for guides and search results.

## 17. Mobile

- [ ] [SW] iOS and Android apps with the full owned library and store access.
- [ ] [SW] Offline reading: download any owned resource; sync verification on device.
- [ ] [SW] Tabbed browsing and split screen with linked panels on tablets and phones.
- [ ] [SW] Read Aloud: system or enhanced neural voices, plus audiobook resources with follow-along.
- [ ] [SW] Verse image sharing: Visual Copy style cards straight to social apps.
- [ ] [SW] Reference Scanner: camera OCR turns a printed verse list into a passage list.
- [ ] [SW] Draw On Screen markup (see Canvas group).
- [ ] [SW] Mobile notes and highlights with the same notebooks and styles.
- [ ] [SW] Mobile search: Smart Search, Bible, and Books search on the same cloud stack.
- [ ] [SW] Mobile guides and Factbook: Passage Guide, word study, and Factbook in mobile form.
- [ ] [SW] Insights panel on mobile with translation and selection info cards.
- [ ] [SW] Preaching Mode and Sermon Builder on tablets, including Proclaim publishing.
- [ ] [SW] Reading plans, prayer lists, and Courses on mobile with notifications and reminders.
- [ ] [SW] Text Selection Cards: tap a word for lemma, gloss, and translation cards.
- [ ] [SW] Workspace reset and display settings per device.

## 18. Sync and Cloud

- [ ] [SW] Document sync: every user document type (notes, sermons, plans, clippings, canvases, diagrams, word lists, bibliographies, visual filters, syntax and morph queries) syncs through Faithlife servers.
- [ ] [SW] Layout sync: application layouts follow you across desktop, web, and mobile.
- [ ] [SW] Reading progress sync: continue-reading cards resume on any device.
- [ ] [SW] License sync: purchases provision to every install immediately.
- [ ] [SW] Logos Cloud: resources stream without local download; full offline features still need the local index.
- [ ] [SW] Web app: near-full desktop parity in the browser.
- [ ] [SW] Faithlife groups: document sharing, community notes, group reading plans, and shared notebooks.
- [ ] [SW] Indexer: local full-text and dataset indexing pipeline with manual update checks.
- [ ] [SW] Free app updates for legacy license owners; features gate by owned feature set or subscription.
- [ ] [SW] Kiosk mode and account switching for shared computers.
- [ ] [SW] Media streaming and download layer for courseware video and audio.
- [ ] [SW] Cross-brand sync: one account powers Logos, Verbum, and Faithlife Ebooks.

## 19. AI Assistant

- [ ] [SW] Smart Search: hybrid lexical plus semantic search with AI ranking and snippets; cloud AI, credit-metered (details in Search group).
- [ ] [SW] Search Synopsis (Premium and up): AI overview of top results with footnoted citations into your library.
- [ ] [SW] Search Result Summaries: per-result one-click AI summary of the full article behind a snippet.
- [ ] [SW] Summarize sidebar (Premium and up): AI summaries of an article, chapter, or whole book at selectable outline levels.
- [ ] [SW] Study Assistant (Premium and up): conversational Q&A grounded in your library with citations, follow-ups, collection scoping, and shareable conversation links.
- [ ] [SW] Sermon Assistant (Pro and up): four generators in Sermon Builder (Outlines, Illustrations, Applications, Questions) with tone, audience, and situation controls.
- [ ] [SW] Bible Study Builder (Premium and up): topic or passage in, small-group study with discussion questions gathered from your library out.
- [ ] [SW] Auto Translate (Max, or legacy Gold): whole books or selections into 100-plus languages with a sidebar that follows scrolling.
- [ ] [SW] Factbook AI summaries: one-click summaries of commentary and dictionary entries inside Factbook.
- [ ] [SW] AI credits: monthly metered allowance scaled by tier, with toolbar gauge and upgrade path.

## 20. Admin and Account

- [ ] [SW] Subscription tiers: free Basic app plus Premium, Pro, and Max bundles billed monthly, annually, or two-year.
- [ ] [SW] Subscriber benefits: 5% storewide, extra monthly free book, Mobile Ed course access, Logos Sermons access (Pro and up), 5% annual reward coupon (Pro and up).
- [ ] [SW] Legacy honoring: perpetual Logos 10 and older feature sets keep working with free app updates.
- [ ] [SW] License management: claim codes, gift licenses, bulk and group licenses, church admin portal with Digital Asset Manager.
- [ ] [SW] Academic program: discounted pricing for students and faculty.
- [ ] [SW] Account services: profile, email, password, subscription management, and order history on logos.com.
- [ ] [SW] Multi-brand identity: one Faithlife account across Logos, Verbum, Proclaim, Ebooks, and groups.
- [ ] [SW] UI localization: English, Spanish, German, Korean, Brazilian Portuguese, and Chinese (simplified and traditional).
- [ ] [SW] Installation and indexing management, performance tuning, and download scheduling.
- [ ] [SW] Diagnostics: logging, problem reporting, typo reporting, and remote assistance.
- [ ] [SW] Faithlife groups administration: roles, privacy, subgroups, and content licensing for churches.
- [ ] [SW] Proclaim integration: presentation handoff from Sermon Builder and Preaching Mode.
- [ ] [SW] Feedback pipeline: in-app suggestions and forums feeding the roadmap.
- [ ] [SW] Platform coverage: Windows, macOS, iOS, Android, and the web app from one account.
