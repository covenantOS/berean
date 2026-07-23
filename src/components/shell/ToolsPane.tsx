"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CANTILLATIONS,
  GREEK_LETTERS,
  GREEK_NUMERAL_ONLY,
  HEBREW_FINALS,
  HEBREW_LETTERS,
  KERAIA,
  greekLettersValue,
  greekNumeral,
  greekToTranslit,
  hebrewLettersValue,
  hebrewNumeral,
  hebrewToTranslit,
  translitToGreek,
  type LetterInfo,
} from "@/lib/alphabets";
import {
  BIBLICAL_UNITS,
  MEASURE_KIND_LABELS,
  convertMeasure,
  formatMeasure,
  measureUnit,
  unitsOfKind,
  type MeasureKind,
} from "@/lib/measures";
import { NT_NAMES, OT_NAMES, type NameOfGod } from "@/lib/namesOfGod";
import { REIGN_TABLES } from "@/lib/reigns";
import { APPOINTED_OBSERVANCES, LEVITICAL_OFFERINGS, type Sacrifice } from "@/lib/sacrifices";
import { playSound } from "@/lib/sound";
import { useWorkspaceDispatch } from "./WorkspaceContext";

type ToolSection =
  | "measures"
  | "alphabets"
  | "numerals"
  | "transliteration"
  | "cantillations"
  | "names"
  | "reigns"
  | "sacrifices"
  | "family"
  | "commandments"
  | "goliath";

const SECTIONS: { id: ToolSection; label: string }[] = [
  { id: "measures", label: "Measures" },
  { id: "alphabets", label: "Alphabets" },
  { id: "numerals", label: "Numerals" },
  { id: "transliteration", label: "Transliteration" },
  { id: "cantillations", label: "Cantillations" },
  { id: "names", label: "Names of God" },
  { id: "reigns", label: "Reigns" },
  { id: "sacrifices", label: "Sacrifices" },
  { id: "family", label: "Family maps" },
  { id: "commandments", label: "Commandments" },
  { id: "goliath", label: "Goliath" },
];

/**
 * The Tools pane: the workspace's small utilities under one roof, each a
 * section of a single tab. Measures converts the biblical units to modern
 * equivalents and back; Alphabets tables the Greek and Hebrew letters with
 * a flash-style self-test; Numerals spells a number in letters and sums
 * letters back; Transliteration walks Greek and Hebrew script to
 * transliteration (and Greek back); Cantillations tables the accents the
 * pointed text carries; Names of God tables the received names and titles
 * with meaning and first occurrence; Reigns tables the kings, judges,
 * prophets, and high priests in order; Sacrifices tables the five
 * Levitical offerings and the two appointed observances; Family maps
 * opens the generational explorer over the TIPNR kinship data; Commandments
 * lays the three numberings side by side; Goliath sends the reader to the
 * comparison tool for the two texts.
 */
export default function ToolsPane({ paneId }: { paneId: string }) {
  const [section, setSection] = useState<ToolSection>("measures");

  return (
    <div className="mx-auto max-w-prose space-y-4">
      <header className="border-b border-rule pb-2">
        <p className="small-caps text-xs font-semibold text-amber">Tools</p>
        <p className="mt-1">
          <span className="seg flex-wrap" role="group" aria-label="Tool">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={section === s.id}
                onClick={() => {
                  setSection(s.id);
                  playSound("navigate");
                }}
              >
                {s.label}
              </button>
            ))}
          </span>
        </p>
      </header>
      <div key={section} className="fx-fade">
        {section === "measures" && <MeasuresTool paneId={paneId} />}
        {section === "alphabets" && <AlphabetsTool />}
        {section === "numerals" && <NumeralsTool />}
        {section === "transliteration" && <TransliterationTool />}
        {section === "cantillations" && <CantillationsTool />}
        {section === "names" && <NamesTool paneId={paneId} />}
        {section === "reigns" && <ReignsTool paneId={paneId} />}
        {section === "sacrifices" && <SacrificesTool paneId={paneId} />}
        {section === "family" && <FamilyMapsTool paneId={paneId} />}
        {section === "commandments" && <CommandmentsTool paneId={paneId} />}
        {section === "goliath" && <GoliathTool paneId={paneId} />}
      </div>
    </div>
  );
}

/* ---------- shared bits ---------- */

const NOTE = "text-[0.68rem] leading-relaxed text-muted";
const INPUT =
  "border border-rule bg-paper px-2 py-1 text-xs text-ink placeholder:text-muted focus:border-sapphire focus:outline-none";
const HEAD3 = "small-caps text-[0.62rem] font-semibold text-muted";

/* ---------- measures ---------- */

function MeasuresTool({ paneId }: { paneId: string }) {
  const { dispatch } = useWorkspaceDispatch();
  const [kind, setKind] = useState<MeasureKind>("length");
  const [value, setValue] = useState("1");
  const [fromId, setFromId] = useState("cubit");
  const [toId, setToId] = useState("meter");

  const units = unitsOfKind(kind);
  const from = measureUnit(fromId) ?? units[0];
  const to = measureUnit(toId) ?? units[units.length - 1];
  const n = Number(value);
  const result =
    value.trim() !== "" && Number.isFinite(n) && from.kind === kind && to.kind === kind
      ? convertMeasure(n, from, to)
      : null;

  /** A new kind resets the pair to the kind's first biblical and modern unit. */
  const pickKind = (k: MeasureKind) => {
    setKind(k);
    const list = unitsOfKind(k);
    const modern = list.find((u) => !BIBLICAL_UNITS.includes(u));
    setFromId(list[0].id);
    setToId((modern ?? list[list.length - 1]).id);
  };

  return (
    <section className="space-y-3">
      <div>
        <span className="seg flex-wrap" role="group" aria-label="Measure kind">
          {(Object.keys(MEASURE_KIND_LABELS) as MeasureKind[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => {
                pickKind(k);
                playSound("navigate");
              }}
            >
              {MEASURE_KIND_LABELS[k]}
            </button>
          ))}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          value={value}
          aria-label="Amount to convert"
          onChange={(e) => setValue(e.target.value)}
          className={`${INPUT} w-24`}
        />
        <select
          aria-label="From unit"
          value={from.id}
          onChange={(e) => setFromId(e.target.value)}
          className={INPUT}
        >
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <span className="text-[0.68rem] text-muted">to</span>
        <select
          aria-label="To unit"
          value={to.id}
          onChange={(e) => setToId(e.target.value)}
          className={INPUT}
        >
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        {result !== null && (
          <span className="text-[0.85rem] font-semibold text-ink">
            {formatMeasure(result)} {to.name.toLowerCase()}
            {result === 1 || to.name.startsWith("US") ? "" : "s"}
          </span>
        )}
      </div>

      <table className="w-full border-y border-rule text-[0.78rem]">
        <thead>
          <tr className="text-left">
            <th className={`${HEAD3} py-1 pr-2`}>Unit</th>
            <th className={`${HEAD3} py-1 pr-2`}>Metric</th>
            <th className={`${HEAD3} py-1 pr-2`}>Imperial</th>
            <th className={`${HEAD3} py-1`}>Appears</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {BIBLICAL_UNITS.filter((u) => u.kind === kind).map((u) => (
            <tr key={u.id}>
              <td className="py-1 pr-2 font-semibold text-ink">{u.name}</td>
              <td className="py-1 pr-2 text-muted">
                {formatMeasure(convertMeasure(1, u, measureUnit(metricFor(kind))!))}{" "}
                {measureUnit(metricFor(kind))!.name.toLowerCase()}s
              </td>
              <td className="py-1 pr-2 text-muted">
                {formatMeasure(convertMeasure(1, u, measureUnit(imperialFor(kind))!))}{" "}
                {measureUnit(imperialFor(kind))!.name.toLowerCase().replace(/^us /, "")}s
              </td>
              <td className="py-1">
                {u.ref && (
                  <button
                    type="button"
                    title={`Open ${u.ref.label}`}
                    onClick={() =>
                      dispatch({ type: "openRef", book: u.ref!.book, chapter: u.ref!.chapter, paneId })
                    }
                    className="small-caps text-[0.68rem] font-semibold text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                  >
                    {u.ref.label}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={NOTE}>
        Ancient measures were never standardized; these are the approximate equivalents the
        standard reference works give, and other tables differ.
      </p>
    </section>
  );
}

/** The metric column's unit for each kind. */
function metricFor(kind: MeasureKind): string {
  return kind === "length" ? "centimeter" : kind === "weight" ? "gram" : "liter-" + kind;
}

/** The imperial column's unit for each kind. */
function imperialFor(kind: MeasureKind): string {
  return kind === "length" ? "inch" : kind === "weight" ? "ounce" : kind === "dry" ? "bushel" : "gallon";
}

/* ---------- alphabets ---------- */

function AlphabetTable({
  letters,
  extra,
}: {
  letters: LetterInfo[];
  extra?: LetterInfo[];
}) {
  return (
    <table className="w-full border-y border-rule text-[0.78rem]">
      <thead>
        <tr className="text-left">
          <th className={`${HEAD3} py-1 pr-2`}>Letter</th>
          <th className={`${HEAD3} py-1 pr-2`}>Name</th>
          <th className={`${HEAD3} py-1 pr-2`}>Translit.</th>
          <th className={`${HEAD3} py-1 pr-2`}>Sounds like</th>
          <th className={`${HEAD3} py-1`}>Value</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-rule">
        {[...letters, ...(extra ?? [])].map((l) => (
          <tr key={l.name}>
            <td className="py-1 pr-2 font-editorial text-base">{l.glyph}</td>
            <td className="py-1 pr-2 font-semibold text-ink">{l.name}</td>
            <td className="py-1 pr-2 italic text-muted">{l.translit}</td>
            <td className="py-1 pr-2 text-muted">{l.sound}</td>
            <td className="py-1 text-muted">{l.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AlphabetsTool() {
  const [lang, setLang] = useState<"hebrew" | "greek">("hebrew");
  const letters = lang === "hebrew" ? HEBREW_LETTERS : GREEK_LETTERS;
  const [card, setCard] = useState<LetterInfo | null>(null);
  const [revealed, setRevealed] = useState(false);

  /** The self-test deals a random letter from the table on display. */
  const deal = (pool: LetterInfo[]) => {
    setCard(pool[Math.floor(Math.random() * pool.length)]);
    setRevealed(false);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="seg" role="group" aria-label="Alphabet">
          {(["hebrew", "greek"] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              onClick={() => {
                setLang(l);
                setCard(null);
                playSound("navigate");
              }}
              className="capitalize"
            >
              {l}
            </button>
          ))}
        </span>
        <button
          type="button"
          onClick={() => {
            deal(letters);
            playSound("open");
          }}
          className="fx-press ml-1 border border-rule bg-paper px-2 py-0.5 text-[0.68rem] text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          {card ? "Next letter" : "Quiz me"}
        </button>
      </div>

      {card && (
        <div key={card.name} className="fx-rise border border-rule bg-paper px-3 py-2">
          <p className="font-editorial text-2xl">{card.glyph}</p>
          {revealed ? (
            <p className="mt-1 text-[0.78rem] text-ink">
              <span className="font-semibold">{card.name}</span>
              <span className="italic text-muted"> {card.translit}</span>
              <span className="text-muted"> · {card.sound} · value {card.value}</span>
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="mt-1 text-[0.72rem] text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              Reveal
            </button>
          )}
        </div>
      )}

      <AlphabetTable letters={letters} extra={lang === "greek" ? GREEK_NUMERAL_ONLY : undefined} />
      <p className={NOTE}>
        {lang === "hebrew" ? (
          <>
            Five letters take a final form at a word&rsquo;s end (
            {Object.keys(HEBREW_FINALS).join(" ")}), the value unchanged. Shin and sin share one
            letter, the dot deciding.
          </>
        ) : (
          <>
            Digamma, qoppa, and sampi survive only as numerals, for six, ninety, and nine hundred.
          </>
        )}
      </p>
    </section>
  );
}

/* ---------- numerals ---------- */

function NumeralsTool() {
  const [num, setNum] = useState("");
  const [letters, setLetters] = useState("");

  const n = Number(num);
  const valid = Number.isInteger(n) && n >= 1 && n <= 999;
  const trimmed = letters.trim();
  const script = /[֑-ת]/.test(trimmed) ? "hebrew" : /[Ͱ-Ͽἀ-῾]/.test(trimmed) ? "greek" : null;
  const value =
    trimmed === ""
      ? null
      : script === "hebrew"
        ? hebrewLettersValue(trimmed)
        : script === "greek"
          ? greekLettersValue(trimmed)
          : null;

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <p className={HEAD3}>Number to letters</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            value={num}
            min={1}
            max={999}
            aria-label="Number, 1 to 999"
            placeholder="1–999"
            onChange={(e) => setNum(e.target.value)}
            className={`${INPUT} w-24`}
          />
          {valid && (
            <span className="font-editorial text-base text-ink">
              {hebrewNumeral(n)} · {greekNumeral(n)}
            </span>
          )}
          {num.trim() !== "" && !valid && (
            <span className={NOTE}>Whole numbers 1 through 999.</span>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <p className={HEAD3}>Letters to number</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={letters}
            aria-label="Hebrew or Greek letters"
            placeholder={`ωπη${KERAIA} or תתפח`}
            onChange={(e) => setLetters(e.target.value)}
            className={`${INPUT} min-w-40 flex-1 font-editorial`}
          />
          {value !== null && (
            <span className="text-[0.85rem] font-semibold text-ink">
              {value.toLocaleString()} <span className="text-[0.68rem] font-normal text-muted">({script})</span>
            </span>
          )}
          {trimmed !== "" && script === null && (
            <span className={NOTE}>Hebrew or Greek letters.</span>
          )}
        </div>
      </div>

      <p className={NOTE}>
        The letters standing for numbers, the way the manuscripts write them; the sums are
        arithmetic, nothing more.
      </p>
    </section>
  );
}

/* ---------- transliteration ---------- */

type TranslitDirection = "hebrew-to" | "greek-to" | "greek-from";

function TransliterationTool() {
  const [direction, setDirection] = useState<TranslitDirection>("hebrew-to");
  const [input, setInput] = useState("");

  const output = useMemo(() => {
    if (input === "") return "";
    if (direction === "hebrew-to") return hebrewToTranslit(input);
    if (direction === "greek-to") return greekToTranslit(input);
    return translitToGreek(input);
  }, [input, direction]);

  const options: { id: TranslitDirection; label: string }[] = [
    { id: "hebrew-to", label: "Hebrew → translit" },
    { id: "greek-to", label: "Greek → translit" },
    { id: "greek-from", label: "Translit → Greek" },
  ];

  return (
    <section className="space-y-3">
      <div>
        <span className="seg flex-wrap" role="group" aria-label="Conversion direction">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={direction === o.id}
              onClick={() => {
                setDirection(o.id);
                playSound("navigate");
              }}
            >
              {o.label}
            </button>
          ))}
        </span>
      </div>
      <textarea
        value={input}
        rows={3}
        aria-label="Text to convert"
        placeholder={
          direction === "hebrew-to"
            ? "בְּרֵאשִׁית בָּרָא"
            : direction === "greek-to"
              ? "Ἐν ἀρχῇ ἦν ὁ λόγος"
              : "en archē ēn ho logos"
        }
        onChange={(e) => setInput(e.target.value)}
        className={`${INPUT} w-full resize-y font-editorial text-sm`}
      />
      {output !== "" && (
        <p className="border border-rule bg-paper px-3 py-2 text-[0.9rem] text-ink">{output}</p>
      )}
      <p className={NOTE}>
        {direction === "hebrew-to"
          ? "Consonants carry over; the vowel points and accents stay behind. Hebrew runs this one way, its pointed spellings reading more than one way back."
          : direction === "greek-to"
            ? "Accents and breathings drop away; upsilon reads as y."
            : "The long vowels ē and ō land on eta and omega, plain e and o on epsilon and omicron; sigma closes as ς at a word's end."}
      </p>
    </section>
  );
}

/* ---------- cantillations ---------- */

function CantillationsTool() {
  return (
    <section className="space-y-3">
      <table className="w-full border-y border-rule text-[0.78rem]">
        <thead>
          <tr className="text-left">
            <th className={`${HEAD3} py-1 pr-2`}>Mark</th>
            <th className={`${HEAD3} py-1 pr-2`}>Name</th>
            <th className={`${HEAD3} py-1`}>Role</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {CANTILLATIONS.map((c) => (
            <tr key={c.name}>
              <td className="py-1 pr-2 font-editorial text-base">{c.mark}</td>
              <td className="py-1 pr-2 font-semibold text-ink">{c.name}</td>
              <td className="py-1 text-muted">{c.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={NOTE}>
        The accents of the pointed Hebrew text, the same marks the original-language apparatus
        carries: the disjunctives mark the verse&rsquo;s pauses, the conjunctives bind a word to
        the next.
      </p>
    </section>
  );
}

/* ---------- names of God ---------- */

function NameTable({
  paneId,
  names,
}: {
  paneId: string;
  names: NameOfGod[];
}) {
  const { dispatch } = useWorkspaceDispatch();
  return (
    <table className="w-full border-y border-rule text-[0.78rem]">
      <thead>
        <tr className="text-left">
          <th className={`${HEAD3} py-1 pr-2`}>Name</th>
          <th className={`${HEAD3} py-1 pr-2`}>Meaning</th>
          <th className={`${HEAD3} py-1 pr-2`}>First named</th>
          <th className={`${HEAD3} py-1`}>Note</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-rule">
        {names.map((n) => (
          <tr key={n.name}>
            <td className="py-1 pr-2 font-semibold text-ink">{n.name}</td>
            <td className="py-1 pr-2 text-muted">{n.meaning}</td>
            <td className="py-1 pr-2">
              <button
                type="button"
                title={`Open ${n.ref.label}`}
                onClick={() =>
                  dispatch({ type: "openRef", book: n.ref.book, chapter: n.ref.chapter, paneId })
                }
                className="small-caps text-[0.68rem] font-semibold text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                {n.ref.label}
              </button>
            </td>
            <td className="py-1 text-muted">{n.note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function NamesTool({ paneId }: { paneId: string }) {
  return (
    <section className="space-y-3">
      <NameTable paneId={paneId} names={OT_NAMES} />
      <NameTable paneId={paneId} names={NT_NAMES} />
      <p className={NOTE}>
        The received names and titles with their meanings; renderings of the compound names differ
        among the reference works (Yahweh-Yireh as &ldquo;will provide&rdquo; or &ldquo;will see to
        it&rdquo;), and the table gives the received sense.
      </p>
    </section>
  );
}

/* ---------- prophets, priests, regents, and judges ---------- */

function ReignsTool({ paneId }: { paneId: string }) {
  const { dispatch } = useWorkspaceDispatch();
  const [tableId, setTableId] = useState("united");
  const table = REIGN_TABLES.find((t) => t.id === tableId) ?? REIGN_TABLES[0];
  return (
    <section className="space-y-3">
      <div>
        <span className="seg flex-wrap" role="group" aria-label="Reign table">
          {REIGN_TABLES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={table.id === t.id}
              onClick={() => {
                setTableId(t.id);
                playSound("navigate");
              }}
            >
              {t.label}
            </button>
          ))}
        </span>
      </div>

      <table className="w-full border-y border-rule text-[0.78rem]">
        <thead>
          <tr className="text-left">
            <th className={`${HEAD3} py-1 pr-2`}>Name</th>
            <th className={`${HEAD3} py-1 pr-2`}>Years</th>
            <th className={`${HEAD3} py-1 pr-2`}>Note</th>
            <th className={`${HEAD3} py-1`}>Key reference</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {table.rows.map((r) => (
            <tr key={r.name}>
              <td className="py-1 pr-2 font-semibold text-ink">{r.name}</td>
              <td className="whitespace-nowrap py-1 pr-2 text-muted">{r.years}</td>
              <td className="py-1 pr-2 text-muted">{r.note}</td>
              <td className="py-1">
                {r.ref && (
                  <button
                    type="button"
                    title={`Open ${r.ref.label}`}
                    onClick={() =>
                      dispatch({ type: "openRef", book: r.ref!.book, chapter: r.ref!.chapter, paneId })
                    }
                    className="small-caps text-[0.68rem] font-semibold text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                  >
                    {r.ref.label}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={NOTE}>{table.note}</p>
    </section>
  );
}

/* ---------- the offerings of the law ---------- */

function SacrificeTable({
  paneId,
  rows,
}: {
  paneId: string;
  rows: Sacrifice[];
}) {
  const { dispatch } = useWorkspaceDispatch();
  return (
    <table className="w-full border-y border-rule text-[0.78rem]">
      <thead>
        <tr className="text-left">
          <th className={`${HEAD3} py-1 pr-2`}>Offering</th>
          <th className={`${HEAD3} py-1 pr-2`}>What was offered</th>
          <th className={`${HEAD3} py-1 pr-2`}>Who brought it</th>
          <th className={`${HEAD3} py-1 pr-2`}>Purpose</th>
          <th className={`${HEAD3} py-1`}>Key text</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-rule">
        {rows.map((s) => (
          <tr key={s.name}>
            <td className="py-1 pr-2 align-top">
              <span className="font-semibold text-ink">{s.name}</span>
              <br />
              <span className="text-[0.68rem] italic text-muted">{s.hebrew}</span>
            </td>
            <td className="py-1 pr-2 align-top text-muted">{s.offered}</td>
            <td className="py-1 pr-2 align-top text-muted">{s.broughtBy}</td>
            <td className="py-1 pr-2 align-top text-muted">{s.purpose}</td>
            <td className="py-1 align-top">
              <button
                type="button"
                title={`Open ${s.ref.label}`}
                onClick={() =>
                  dispatch({ type: "openRef", book: s.ref.book, chapter: s.ref.chapter, paneId })
                }
                className="small-caps whitespace-nowrap text-[0.68rem] font-semibold text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                {s.ref.label}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SacrificesTool({ paneId }: { paneId: string }) {
  return (
    <section className="space-y-3">
      <SacrificeTable paneId={paneId} rows={LEVITICAL_OFFERINGS} />
      <SacrificeTable paneId={paneId} rows={APPOINTED_OBSERVANCES} />
      <p className={NOTE}>
        The five offerings stand in the law&rsquo;s own order, Leviticus 1 through 7; the day of
        atonement (Leviticus 16) and the Passover (Exodus 12) are appointed days that turn on an
        offering, kept beside the five rather than among them.
      </p>
    </section>
  );
}

/* ---------- family maps ---------- */

/** Notable roots for the explorer, resolved against the TIPNR index. */
const FAMILY_MAP_STARTS: { id: string; label: string }[] = [
  { id: "H0121G", label: "Adam" },
  { id: "H5146", label: "Noah" },
  { id: "H0085", label: "Abraham" },
  { id: "H3478", label: "Israel (Jacob)" },
  { id: "H4872", label: "Moses" },
  { id: "H1732", label: "David" },
];

interface FamilySearchHit {
  id: string;
  name: string;
  type: string;
  tag: string;
  brief: string;
}

function FamilyMapsTool({ paneId }: { paneId: string }) {
  const { dispatch } = useWorkspaceDispatch();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<FamilySearchHit[]>([]);

  /** The picker searches the TIPNR people, debounced a beat. */
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/pane/familymap?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error(String(res.status));
          setHits(((await res.json()) as { results: FamilySearchHit[] }).results);
        })
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const openMap = (id: string, name: string) => {
    dispatch({ type: "openFamilyMap", entityId: id, title: name, paneId });
  };

  return (
    <section className="space-y-3">
      <p className="text-[0.78rem] leading-relaxed text-ink">
        The family map walks the TIPNR kinship data from any figure: parents upward, partners
        beside, children downward, every node opening its Factbook report. Pick a starting point
        or find any person.
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {FAMILY_MAP_STARTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => openMap(s.id, s.label)}
            className="fx-press border border-rule bg-paper px-2 py-0.5 text-[0.68rem] text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            {s.label}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={q}
        aria-label="Find a person to map"
        placeholder="Find any person, e.g. Bathsheba"
        onChange={(e) => setQ(e.target.value)}
        className={`${INPUT} w-full`}
      />
      {hits.length > 0 && (
        <ul className="fx-stagger divide-y divide-rule border-y border-rule">
          {hits.map((h, i) => (
            <li key={h.id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
              <button
                type="button"
                onClick={() => openMap(h.id, h.name)}
                title={h.brief || h.tag}
                className="flex w-full items-baseline gap-2 py-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
              >
                <span className="text-[0.78rem] font-semibold text-sapphire hover:underline">
                  {h.name}
                </span>
                <span className="truncate text-[0.68rem] text-muted">
                  {h.type}
                  {h.tag ? ` · ${h.tag}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className={NOTE}>
        Where the records intermarry, the map shows a person once and marks later appearances
        with a dashed cell; the Factbook carries every relationship in full.
      </p>
    </section>
  );
}

/* ---------- counting the commandments ---------- */

/**
 * The three numberings of the Ten Commandments, Exodus 20: the Jewish
 * count, which takes "I am the LORD" as the first word; the Catholic and
 * Lutheran count after Augustine, which folds the idols into the first and
 * splits the coveting; the Protestant count after Calvin, which gives the
 * idols their own word and keeps the coveting one. Verses follow the
 * Hebrew and English chapter.
 */
const COMMANDMENT_ROWS: { n: number; jewish: string; augustine: string; reformed: string }[] = [
  { n: 1, jewish: "I am the LORD your God (20:2)", augustine: "No other gods, no idols (20:3–6)", reformed: "No other gods (20:3)" },
  { n: 2, jewish: "No other gods, no idols (20:3–6)", augustine: "The Name not in vain (20:7)", reformed: "No idols (20:4–6)" },
  { n: 3, jewish: "The Name not in vain (20:7)", augustine: "Keep the Sabbath (20:8–11)", reformed: "The Name not in vain (20:7)" },
  { n: 4, jewish: "Keep the Sabbath (20:8–11)", augustine: "Honor father and mother (20:12)", reformed: "Keep the Sabbath (20:8–11)" },
  { n: 5, jewish: "Honor father and mother (20:12)", augustine: "No murder (20:13)", reformed: "Honor father and mother (20:12)" },
  { n: 6, jewish: "No murder (20:13)", augustine: "No adultery (20:14)", reformed: "No murder (20:13)" },
  { n: 7, jewish: "No adultery (20:14)", augustine: "No stealing (20:15)", reformed: "No adultery (20:14)" },
  { n: 8, jewish: "No stealing (20:15)", augustine: "No false witness (20:16)", reformed: "No stealing (20:15)" },
  { n: 9, jewish: "No false witness (20:16)", augustine: "Do not covet a wife (20:17)", reformed: "No false witness (20:16)" },
  { n: 10, jewish: "Do not covet (20:17)", augustine: "Do not covet goods (20:17)", reformed: "Do not covet (20:17)" },
];

function CommandmentsTool({ paneId }: { paneId: string }) {
  const { dispatch } = useWorkspaceDispatch();
  return (
    <section className="space-y-3">
      <table className="w-full border-y border-rule text-[0.78rem]">
        <thead>
          <tr className="text-left">
            <th className={`${HEAD3} py-1 pr-2`}>#</th>
            <th className={`${HEAD3} py-1 pr-2`}>Jewish</th>
            <th className={`${HEAD3} py-1 pr-2`}>Catholic / Lutheran</th>
            <th className={`${HEAD3} py-1`}>Protestant</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {COMMANDMENT_ROWS.map((r) => (
            <tr key={r.n}>
              <td className="py-1 pr-2 font-semibold text-ink">{r.n}</td>
              <td className="py-1 pr-2 text-muted">{r.jewish}</td>
              <td className="py-1 pr-2 text-muted">{r.augustine}</td>
              <td className="py-1 text-muted">{r.reformed}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={NOTE}>
        The words are one; the counting differs by tradition, all three reading{" "}
        <button
          type="button"
          title="Open Exodus 20"
          onClick={() => dispatch({ type: "openRef", book: "exodus", chapter: 20, paneId })}
          className="small-caps font-semibold text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          Exodus 20:1–17
        </button>
        . Deuteronomy 5 counts the same three ways.
      </p>
    </section>
  );
}

/* ---------- who killed goliath ---------- */

function GoliathTool({ paneId }: { paneId: string }) {
  const { dispatch } = useWorkspaceDispatch();
  return (
    <section className="space-y-3">
      <p className="text-[0.78rem] leading-relaxed text-ink">
        2 Samuel 21:19 says Elhanan of Bethlehem struck down Goliath the Gittite; 1 Chronicles
        20:5 says Elhanan struck down Lahmi the brother of Goliath. Both passages open in the
        comparison tool.
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            dispatch({ type: "openTextCompare", book: "2-samuel", chapter: 21, paneId });
          }}
          className="fx-press border border-rule bg-paper px-2 py-0.5 text-[0.72rem] text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          2 Samuel 21 in Text Compare
        </button>
        <button
          type="button"
          onClick={() => {
            dispatch({ type: "openTextCompare", book: "1-chronicles", chapter: 20, paneId });
          }}
          className="fx-press border border-rule bg-paper px-2 py-0.5 text-[0.72rem] text-ink hover:border-sapphire focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
        >
          1 Chronicles 20 in Text Compare
        </button>
      </div>
    </section>
  );
}
