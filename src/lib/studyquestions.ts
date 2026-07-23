import type { BookGenre } from "./bookmeta";

/**
 * Questions to Ask: hand-built inductive question sets keyed by the genre
 * of the book a chapter sits in, the honest v1 of the question bank. Each
 * set walks the inductive order (look, weigh, answer for it) in the plain
 * speech of the study, and each ends where study ends: with the reader
 * answering the text. The sets key on the book's genre
 * (src/lib/bookmeta.ts), not on the pericope; a per-passage curation is a
 * research project of its own, and this file does not pretend to be one.
 * History and Acts share the narrative set, and the Gospels carry their
 * parable question inside the gospel set, because a gospel chapter may or
 * may not hold one.
 */

export interface QuestionSet {
  /** The keying genre as the section hint wears it. */
  label: string;
  questions: string[];
}

const NARRATIVE: string[] = [
  "Who acts in this chapter, and who is acted on?",
  "What has changed by the last verse?",
  "Where does the narrator slow down, and what does that scene want me to see?",
  "Who obeys and who rebels here, and what does each one reap?",
  "Where is God in this chapter, named or hidden?",
  "What does this chapter commend for imitation, and what does it warn me to flee?",
];

const LAW: string[] = [
  "What does this command guard in the life of God's people?",
  "What does this law confess about the God who gave it?",
  "Where does this instruction expose the sin it restrains?",
  "How would keeping this word have shaped Israel's worship, table, and courts?",
  "How does Christ fulfill this word, and what does obedience look like now?",
];

const WISDOM: string[] = [
  "What does the wise man do here, and what does the fool do?",
  "What does this saying promise, and what does it refuse to promise?",
  "Where have I watched this pattern hold, and where have I watched it ignored?",
  "What does this chapter teach about the fear of the LORD?",
  "Which verse names my own pattern, and what would repentance look like this week?",
];

const POETRY: string[] = [
  "What is the psalmist feeling, and which words carry that weight?",
  "Who is spoken to in each movement: God, the soul, the congregation, or the enemy?",
  "Where does the psalm turn, and what turns it?",
  "Which images repeat, and what do they confess about God?",
  "What would it cost to pray this psalm honestly today?",
];

const PROPHECY: string[] = [
  "What sin does the prophet name, and who is called to answer for it?",
  "What does the prophet promise God will do, in judgment and in mercy?",
  "Who heard this word first, and what did it ask of them?",
  "Where does this word reach past its first hearers to the Messiah or the last day?",
  "What would repentance look like if I took this warning seriously?",
];

const GOSPEL: string[] = [
  "What does Jesus do here, and what does it show about who He is?",
  "Who comes to Jesus in this chapter, and what does each one receive?",
  "If Jesus tells a parable here, who heard it first, and what does it force them to decide?",
  "What does Jesus claim about Himself, in word or in deed?",
  "Who opposes Him here, and what do they love that He threatens?",
  "What would it mean to follow Him through the scene this chapter describes?",
];

const EPISTLE: string[] = [
  "What does the writer command, and what reason does he give?",
  "What has God already done for the reader, stated as fact before any command?",
  "What problem in the church is this paragraph answering?",
  "Which doctrinal claim carries the most weight here, and what rests on it?",
  "What would obedience to this chapter look like in my congregation this month?",
];

const APOCALYPSE: string[] = [
  "What does this vision show about the throne: who rules, and who does not?",
  "Which images echo the Old Testament, and where are they drawn from?",
  "What is the church called to endure here, and what is she promised?",
  "What does the unveiling of Jesus Christ show in this chapter?",
  "How does this chapter steady a suffering church instead of feeding a timeline chart?",
];

const SETS: Record<BookGenre, QuestionSet> = {
  law: { label: "the law", questions: LAW },
  history: { label: "narrative", questions: NARRATIVE },
  wisdom: { label: "wisdom", questions: WISDOM },
  poetry: { label: "poetry", questions: POETRY },
  prophecy: { label: "prophecy", questions: PROPHECY },
  gospel: { label: "the Gospels", questions: GOSPEL },
  acts: { label: "narrative", questions: NARRATIVE },
  epistle: { label: "the epistles", questions: EPISTLE },
  apocalypse: { label: "apocalypse", questions: APOCALYPSE },
};

/** The set a book answers to; every genre in the taxonomy carries one. */
export function questionSetFor(genre: BookGenre): QuestionSet {
  return SETS[genre];
}
