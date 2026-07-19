import { Book, CANON, getBook, resolveBookName } from "./canon";

/**
 * The precise query language behind the concordance. A query with no
 * operators takes the old substring path in searchCanon and never reaches
 * this file; anything with quotes, parentheses, a wildcard, an uppercase
 * operator, or an in: scope parses here and throws QueryError on malformed
 * input, so a bad query gets a message instead of a wrong answer.
 *
 *   grace AND truth                  both words (a space alone also means AND)
 *   faith OR love                    either word
 *   NOT wrath                        verses without the word
 *   (law OR grace) AND truth         parentheses group
 *   "grace and truth"                consecutive words
 *   bapt*  *bapt  b*t                wildcards, two letters beside the *
 *   grace NEAR truth                 within four words of each other
 *   grace WITHIN 7 WORDS OF truth    a word window of any size
 *   faith WITHIN 3 VERSES OF love    at most three verses apart, canon order
 *   in:romans  in:gen-exod           scope to a book or a book range
 *   in:ps.23  in:ps.1-50             scope to a chapter or chapter range
 *   in:john.3.16-21                  scope to a verse range
 *   in:romans,gal,eph                scopes combine with commas
 *
 * Words match whole words, case-insensitive; operators stay uppercase so
 * lowercase "and" and "or" remain ordinary words. BEFORE/AFTER do not ship:
 * the evaluator runs one streaming pass over the canon, and WITHIN VERSES
 * answers the window questions without order-sensitive state.
 */

export class QueryError extends Error {}

/* ------------------------------- detection ------------------------------ */

const KEYWORD_RE = /\b(AND|OR|NOT|NEAR|WITHIN)\b/;
const SYNTAX_CHAR_RE = /["“”()*]/;
const SCOPE_RE = /(^|\s)in:/i;

/** Does the query carry any precise syntax, or is it a plain substring? */
export function hasPreciseSyntax(q: string): boolean {
  return KEYWORD_RE.test(q) || SYNTAX_CHAR_RE.test(q) || SCOPE_RE.test(q);
}

/* -------------------------------- the AST ------------------------------- */

export interface WordNode {
  kind: "word";
  re: RegExp;
  source: string;
}

export interface PhraseNode {
  kind: "phrase";
  parts: RegExp[];
  source: string;
}

/** Nodes that answer with word positions inside a verse. */
export type MatchNode = WordNode | PhraseNode;

export interface WithinVersesNode {
  kind: "withinVerses";
  left: Node;
  right: Node;
  maxVerses: number;
}

export type Node =
  | MatchNode
  | { kind: "and" | "or"; children: Node[] }
  | { kind: "not"; child: Node }
  | { kind: "near"; left: MatchNode; right: MatchNode; maxWords: number }
  | WithinVersesNode;

/** NEAR is a fixed small word window. */
export const NEAR_WORDS = 4;

export interface ScopeSegment {
  /** Canon indices, inclusive. */
  fromBook: number;
  toBook: number;
  /** Chapter bounds, set only on single-book segments. */
  fromCh?: number;
  toCh?: number;
  /** Verse bounds, set only on single-chapter segments. */
  fromV?: number;
  toV?: number;
}

export interface QueryPlan {
  root: Node;
  scopes: ScopeSegment[];
  /** Cross-verse windows, precomputed by the runner verse by verse. */
  within: WithinVersesNode[];
}

/* ------------------------------ scope parsing ---------------------------- */

function resolveBook(name: string): Book | undefined {
  return resolveBookName(name) ?? getBook(name.trim().toLowerCase());
}

function bookIndexOf(book: Book): number {
  return CANON.indexOf(book);
}

interface ScopeRef {
  book: Book;
  ch?: number;
  v?: number;
}

/** book[.chapter[.verse]] with the pieces validated against the canon. */
function parseScopeRef(s: string): ScopeRef {
  const pieces = s.split(".");
  const book = resolveBook(pieces[0]);
  if (!book) {
    throw new QueryError(`No book answers to "${pieces[0]}" in an in: range.`);
  }
  if (pieces.length === 1) return { book };
  if (pieces.length > 3) {
    throw new QueryError(`"${s}" has too many parts; try book, book.chapter, or book.chapter.verse.`);
  }
  if (!/^\d+$/.test(pieces[1]) || Number(pieces[1]) < 1 || Number(pieces[1]) > book.chapters) {
    throw new QueryError(`"${s}" names a chapter ${book.name} does not have.`);
  }
  const ch = Number(pieces[1]);
  if (pieces.length === 2) return { book, ch };
  if (!/^\d+$/.test(pieces[2]) || Number(pieces[2]) < 1) {
    throw new QueryError(`"${s}" names a verse that is not a number.`);
  }
  return { book, ch, v: Number(pieces[2]) };
}

function wholeRefSegment(h: ScopeRef): ScopeSegment {
  const i = bookIndexOf(h.book);
  if (h.ch === undefined) return { fromBook: i, toBook: i };
  if (h.v === undefined) return { fromBook: i, toBook: i, fromCh: h.ch, toCh: h.ch };
  return { fromBook: i, toBook: i, fromCh: h.ch, toCh: h.ch, fromV: h.v, toV: h.v };
}

function parseScopeSegment(part: string): ScopeSegment {
  const p = part.trim().toLowerCase();
  if (!p) throw new QueryError("An in: range has an empty piece.");
  const whole = resolveBook(p);
  if (whole) {
    const i = bookIndexOf(whole);
    return { fromBook: i, toBook: i };
  }
  const dash = p.indexOf("-");
  const head = dash >= 0 ? p.slice(0, dash) : p;
  const tail = dash >= 0 ? p.slice(dash + 1) : null;
  const h = parseScopeRef(head);
  if (tail === null) return wholeRefSegment(h);

  const tailBook = resolveBook(tail);
  if (tailBook) {
    if (h.ch !== undefined) {
      throw new QueryError(`The range "${p}" mixes a chapter with a book range.`);
    }
    const a = bookIndexOf(h.book);
    const b = bookIndexOf(tailBook);
    if (a > b) throw new QueryError(`The range "${p}" runs against canon order.`);
    return { fromBook: a, toBook: b };
  }
  if (!/^\d+$/.test(tail)) {
    throw new QueryError(`"${tail}" in the range "${p}" is not a book, chapter, or verse.`);
  }
  const n = Number(tail);
  if (h.v !== undefined) {
    if (n < h.v) throw new QueryError(`The range "${p}" runs backwards.`);
    return { fromBook: bookIndexOf(h.book), toBook: bookIndexOf(h.book), fromCh: h.ch, toCh: h.ch, fromV: h.v, toV: n };
  }
  if (h.ch !== undefined) {
    if (n > h.book.chapters) {
      throw new QueryError(`The range "${p}" names a chapter ${h.book.name} does not have.`);
    }
    if (n < h.ch) throw new QueryError(`The range "${p}" runs backwards.`);
    return { fromBook: bookIndexOf(h.book), toBook: bookIndexOf(h.book), fromCh: h.ch, toCh: n };
  }
  throw new QueryError(`The range "${p}" needs a book on the right side, e.g. in:gen-exod.`);
}

function parseScopeSpec(spec: string): ScopeSegment[] {
  return spec.split(",").map(parseScopeSegment);
}

/** Read the spec after in:; quoted pieces and comma lists compose. */
function readScopeSpec(q: string, start: number): { spec: string; next: number } {
  let spec = "";
  let i = start;
  while (i < q.length) {
    if (q[i] === '"' || q[i] === "“") {
      const close = q[i] === "“" ? "”" : '"';
      const end = q.indexOf(close, i + 1);
      if (end < 0) throw new QueryError("A quote opens but never closes.");
      spec += q.slice(i + 1, end);
      i = end + 1;
    } else {
      const m = /^[^,\s()"]*/.exec(q.slice(i))!;
      spec += m[0];
      i += m[0].length;
    }
    if (q[i] === ",") {
      spec += ",";
      i++;
      continue;
    }
    break;
  }
  return { spec, next: i };
}

/** Is a verse inside a scope segment? bookIdx is the canon index. */
export function scopeMatch(s: ScopeSegment, bookIdx: number, ch: number, v: number): boolean {
  if (bookIdx < s.fromBook || bookIdx > s.toBook) return false;
  if (s.fromCh === undefined) return true;
  if (bookIdx !== s.fromBook || ch < s.fromCh || ch > s.toCh!) return false;
  if (s.fromV !== undefined && (v < s.fromV || v > s.toV!)) return false;
  return true;
}

/**
 * Pull in: scopes out of a query string, leaving the rest. Used by the
 * morph search, whose query words never carry the precise grammar's other
 * operators.
 */
export function extractScopes(q: string): { rest: string; scopes: ScopeSegment[] } {
  const scopes: ScopeSegment[] = [];
  let rest = "";
  let i = 0;
  while (i < q.length) {
    const atStart = i === 0 || /\s/.test(q[i - 1]);
    if (atStart && q.slice(i, i + 3).toLowerCase() === "in:") {
      const { spec, next } = readScopeSpec(q, i + 3);
      i = next;
      if (!spec) {
        throw new QueryError("in: needs a book or range, e.g. in:romans or in:gen-exod.");
      }
      scopes.push(...parseScopeSpec(spec));
    } else {
      rest += q[i];
      i++;
    }
  }
  return { rest: rest.replace(/\s+/g, " ").trim(), scopes };
}

/* -------------------------------- tokenizer ----------------------------- */

type Token =
  | { t: "word"; text: string }
  | { t: "phrase"; text: string }
  | { t: "num"; n: number }
  | { t: "lparen" }
  | { t: "rparen" }
  | { t: "and" }
  | { t: "or" }
  | { t: "not" }
  | { t: "near" }
  | { t: "within" }
  | { t: "words" }
  | { t: "verses" }
  | { t: "of" };

const KEYWORDS: Record<string, Token["t"]> = {
  AND: "and",
  OR: "or",
  NOT: "not",
  NEAR: "near",
  WITHIN: "within",
  WORDS: "words",
  VERSES: "verses",
  OF: "of",
};

function tokenize(q: string): { tokens: Token[]; scopes: ScopeSegment[] } {
  const tokens: Token[] = [];
  const scopes: ScopeSegment[] = [];
  let i = 0;
  while (i < q.length) {
    const c = q[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "(") {
      tokens.push({ t: "lparen" });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ t: "rparen" });
      i++;
      continue;
    }
    if (c === '"' || c === "“") {
      const close = c === "“" ? "”" : '"';
      const end = q.indexOf(close, i + 1);
      if (end < 0) throw new QueryError("A quote opens but never closes.");
      tokens.push({ t: "phrase", text: q.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    if ((c === "i" || c === "I") && q.slice(i, i + 3).toLowerCase() === "in:") {
      const { spec, next } = readScopeSpec(q, i + 3);
      i = next;
      if (!spec) {
        throw new QueryError("in: needs a book or range, e.g. in:romans or in:gen-exod.");
      }
      scopes.push(...parseScopeSpec(spec));
      continue;
    }
    if (/[A-Za-z0-9'’*-]/.test(c)) {
      const m = /^[A-Za-z0-9'’*-]+/.exec(q.slice(i))!;
      const raw = m[0];
      i += raw.length;
      const keyword = KEYWORDS[raw];
      if (keyword) {
        tokens.push({ t: keyword } as Token);
      } else if (/^\d+$/.test(raw)) {
        tokens.push({ t: "num", n: Number(raw) });
      } else {
        tokens.push({ t: "word", text: raw });
      }
      continue;
    }
    throw new QueryError(`The character "${c}" is not part of the query syntax.`);
  }
  return { tokens, scopes };
}

/* --------------------------------- parser ------------------------------- */

function tokenLabel(t: Token): string {
  switch (t.t) {
    case "word":
      return `"${t.text}"`;
    case "phrase":
      return `the phrase "${t.text}"`;
    case "num":
      return `the number ${t.n}`;
    case "lparen":
      return "an opening parenthesis";
    case "rparen":
      return "a closing parenthesis";
    default:
      return `the operator ${t.t.toUpperCase()}`;
  }
}

function wordRegex(text: string): RegExp {
  const pat = text
    .split("*")
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[a-z0-9'’-]*");
  return new RegExp(`^${pat}$`);
}

function wordNode(raw: string): WordNode {
  const text = raw.toLowerCase().replace(/^[^a-z0-9*]+|[^a-z0-9*]+$/g, "");
  if (!text.replace(/\*/g, "")) {
    throw new QueryError(`"${raw}" has no letters to match.`);
  }
  if (text.includes("*") && text.replace(/\*/g, "").length < 2) {
    throw new QueryError(`The wildcard "${raw}" needs at least two letters beside the *.`);
  }
  return { kind: "word", re: wordRegex(text), source: text };
}

function phraseNode(raw: string): MatchNode {
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length === 0) throw new QueryError("An empty phrase matches nothing.");
  if (words.length === 1) return wordNode(words[0]);
  const parts = words.map((w) => wordNode(w).re);
  return { kind: "phrase", parts, source: raw };
}

function isMatchNode(n: Node): n is MatchNode {
  return n.kind === "word" || n.kind === "phrase";
}

function hasWithin(n: Node): boolean {
  switch (n.kind) {
    case "withinVerses":
      return true;
    case "and":
    case "or":
      return n.children.some(hasWithin);
    case "not":
      return hasWithin(n.child);
    default:
      return false;
  }
}

class Parser {
  private pos = 0;
  private tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token | undefined {
    return this.tokens[this.pos++];
  }

  run(): Node {
    const root = this.parseOr();
    const rest = this.peek();
    if (rest) {
      throw new QueryError(`Unexpected ${tokenLabel(rest)} where the query should end.`);
    }
    return root;
  }

  private parseOr(): Node {
    const children = [this.parseAnd()];
    while (this.peek()?.t === "or") {
      this.next();
      children.push(this.parseAnd());
    }
    return children.length === 1 ? children[0] : { kind: "or", children };
  }

  private parseAnd(): Node {
    const children = [this.parseProx()];
    while (true) {
      const t = this.peek();
      if (t?.t === "and") {
        this.next();
        children.push(this.parseProx());
      } else if (t && this.startsUnary(t)) {
        // Implicit AND: two words side by side.
        children.push(this.parseProx());
      } else {
        break;
      }
    }
    return children.length === 1 ? children[0] : { kind: "and", children };
  }

  private startsUnary(t: Token): boolean {
    // OF, WORDS, and VERSES count: beside WITHIN they are consumed as part of
    // the operator, anywhere else they are ordinary words.
    return (
      t.t === "word" ||
      t.t === "phrase" ||
      t.t === "num" ||
      t.t === "lparen" ||
      t.t === "not" ||
      t.t === "of" ||
      t.t === "words" ||
      t.t === "verses"
    );
  }

  private parseProx(): Node {
    let left = this.parseUnary();
    while (true) {
      const t = this.peek();
      if (t?.t === "near") {
        this.next();
        const right = this.parseUnary();
        left = this.wordWindow(left, right, NEAR_WORDS, "NEAR");
      } else if (t?.t === "within") {
        this.next();
        const n = this.next();
        if (n?.t !== "num") {
          throw new QueryError("WITHIN needs a count, e.g. faith WITHIN 3 VERSES OF love.");
        }
        let unit: "words" | "verses" = "verses";
        const u = this.peek();
        if (u?.t === "words" || u?.t === "verses") {
          unit = u.t;
          this.next();
        }
        if (this.next()?.t !== "of") {
          throw new QueryError("WITHIN needs OF after its count, e.g. faith WITHIN 3 VERSES OF love.");
        }
        const right = this.parseUnary();
        if (unit === "words") {
          left = this.wordWindow(left, right, n.n, "WITHIN WORDS OF");
        } else {
          if (hasWithin(left) || hasWithin(right)) {
            throw new QueryError("WITHIN VERSES does not nest inside another WITHIN VERSES.");
          }
          left = { kind: "withinVerses", left, right, maxVerses: n.n };
        }
      } else {
        break;
      }
    }
    return left;
  }

  private wordWindow(left: Node, right: Node, maxWords: number, op: string): Node {
    if (!isMatchNode(left) || !isMatchNode(right)) {
      throw new QueryError(`${op} takes a single word or phrase on each side.`);
    }
    return { kind: "near", left, right, maxWords };
  }

  private parseUnary(): Node {
    if (this.peek()?.t === "not") {
      this.next();
      return { kind: "not", child: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Node {
    const t = this.next();
    if (!t) throw new QueryError("The query ends where a word was expected.");
    if (t.t === "lparen") {
      const inner = this.parseOr();
      if (this.next()?.t !== "rparen") {
        throw new QueryError("A parenthesis opens but never closes.");
      }
      return inner;
    }
    if (t.t === "word") return wordNode(t.text);
    if (t.t === "num") return wordNode(String(t.n));
    if (t.t === "phrase") return phraseNode(t.text);
    // OF, WORDS, and VERSES mean something only beside WITHIN; anywhere else
    // they are ordinary words.
    if (t.t === "of" || t.t === "words" || t.t === "verses") return wordNode(t.t);
    throw new QueryError(`Unexpected ${tokenLabel(t)} where a word was expected.`);
  }
}

/** Parse a precise query. Throws QueryError on malformed input. */
export function parseQuery(q: string): QueryPlan {
  const { tokens, scopes } = tokenize(q);
  if (tokens.length === 0) {
    throw new QueryError(
      scopes.length > 0 ? "The in: scope needs words to search for." : "The query is empty."
    );
  }
  const root = new Parser(tokens).run();
  const within: WithinVersesNode[] = [];
  const walk = (n: Node) => {
    if (n.kind === "withinVerses") within.push(n);
    else if (n.kind === "and" || n.kind === "or") n.children.forEach(walk);
    else if (n.kind === "not") walk(n.child);
  };
  walk(root);
  return { root, scopes, within };
}

/* -------------------------------- evaluator ----------------------------- */

/** A verse as matchable words: lowercase, punctuation stripped. */
export function verseWords(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+(?:['’-][a-z0-9]+)*/g) ?? [];
}

function matchPositions(node: MatchNode, words: string[]): number[] {
  const out: number[] = [];
  if (node.kind === "word") {
    words.forEach((w, i) => {
      if (node.re.test(w)) out.push(i);
    });
    return out;
  }
  const n = node.parts.length;
  for (let i = 0; i + n <= words.length; i++) {
    let ok = true;
    for (let j = 0; j < n; j++) {
      if (!node.parts[j].test(words[i + j])) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(i);
  }
  return out;
}

/**
 * Does a verse satisfy the node? Cross-verse windows cannot answer from one
 * verse alone, so the runner precomputes them and passes `within`.
 */
export function evalVerse(node: Node, words: string[], within?: (n: WithinVersesNode) => boolean): boolean {
  switch (node.kind) {
    case "word":
    case "phrase":
      return matchPositions(node, words).length > 0;
    case "and":
      return node.children.every((c) => evalVerse(c, words, within));
    case "or":
      return node.children.some((c) => evalVerse(c, words, within));
    case "not":
      return !evalVerse(node.child, words, within);
    case "near": {
      const left = matchPositions(node.left, words);
      if (left.length === 0) return false;
      const right = matchPositions(node.right, words);
      if (right.length === 0) return false;
      return left.some((i) => right.some((j) => Math.abs(i - j) <= node.maxWords));
    }
    case "withinVerses":
      return within ? within(node) : false;
  }
}

/**
 * Per-verse truth for a WITHIN VERSES node, given where each side held.
 * A verse hits when one side holds there and the other holds within
 * maxVerses of it, so both sides of the pairing surface as hits.
 */
export function windowFlags(left: boolean[], right: boolean[], maxVerses: number): boolean[] {
  const li: number[] = [];
  const ri: number[] = [];
  left.forEach((f, i) => {
    if (f) li.push(i);
  });
  right.forEach((f, i) => {
    if (f) ri.push(i);
  });
  const covers = (arr: number[], i: number): boolean => {
    // Binary search for the first entry at or after i - maxVerses.
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] < i - maxVerses) lo = mid + 1;
      else hi = mid;
    }
    return lo < arr.length && arr[lo] <= i + maxVerses;
  };
  return left.map((f, i) => (f && covers(ri, i)) || (right[i] && covers(li, i)));
}
