import { NextRequest, NextResponse } from "next/server";
import { searchEntities } from "@/lib/entities";
import {
  countRefs,
  formatTopicRef,
  getTopic,
  getTopicByTitle,
  isTopicWork,
  TOPIC_WORKS,
  type TopicNode,
} from "@/lib/topics";

/**
 * The Topic Guide: one entry of Nave's or Torrey's composed into a report.
 * Key Passages is the entry's own section tree with its verse lists; Related
 * Topics resolves the entry's "See X" cross-references back to real topics
 * in the same work, plus the same-titled entry in the other work when one
 * exists; People and Places joins the entry's title against the TIPNR
 * entity index on an exact name or alias match, the only join the shipped
 * data honestly supports. The topical works carry no definition prose, so
 * no overview section is fabricated.
 */

/** References listed per section node; the remainder is counted. */
const REFS_PER_NODE = 24;

interface GuideNode {
  label: string;
  refs: {
    label: string;
    slug: string;
    chapter: number;
    verse: number | null;
    verseEnd?: number;
  }[];
  moreRefs: number;
  children: GuideNode[];
}

function serializeNode(node: TopicNode): GuideNode {
  return {
    label: node.label,
    refs: node.refs.slice(0, REFS_PER_NODE).map((r) => ({
      label: formatTopicRef(r),
      slug: r.slug,
      chapter: r.chapter,
      verse: r.verse,
      ...(r.verseEnd ? { verseEnd: r.verseEnd } : {}),
    })),
    moreRefs: Math.max(0, node.refs.length - REFS_PER_NODE),
    children: node.children.map(serializeNode),
  };
}

/** Every "See X" title in the tree, in first-cited order, deduplicated. */
function collectSeeTitles(nodes: TopicNode[], into: string[] = []): string[] {
  for (const node of nodes) {
    if (node.see && !into.includes(node.see)) into.push(node.see);
    collectSeeTitles(node.children, into);
  }
  return into;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const workParam = params.get("work") ?? "";
  const id = (params.get("id") ?? "").trim().toLowerCase();
  if (!isTopicWork(workParam) || !/^[a-z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: "A topical work and topic id are required." }, { status: 400 });
  }
  const topic = await getTopic(workParam, id);
  if (!topic) {
    return NextResponse.json({ error: "No such topic." }, { status: 404 });
  }
  const work = TOPIC_WORKS.find((w) => w.id === workParam)!;

  // (a) Key Passages: the entry's section tree with its verse lists.
  const sections = topic.children.map(serializeNode);

  // (b) Related Topics: "See X" cross-references resolved against the same
  // work; titles that resolve to nothing stay as plain text.
  const seeTitles = collectSeeTitles(topic.children);
  const resolved = await Promise.all(
    seeTitles.map(async (title) => ({ title, topic: await getTopicByTitle(workParam, title) }))
  );
  const related = resolved
    .filter((r) => r.topic && r.topic.id !== topic.id)
    .map((r) => ({ work: workParam, id: r.topic!.id, title: r.topic!.title }));
  const relatedUnresolved = resolved.filter((r) => !r.topic).map((r) => r.title);

  // (c) The same-titled entry in the other work, when it exists.
  const otherWorkId = workParam === "naves" ? "torreys" : "naves";
  const other = await getTopicByTitle(otherWorkId, topic.title);
  const otherWork = other ? { work: otherWorkId, id: other.id, title: other.title } : null;

  // (d) People and Places: exact name or alias matches in the entity index.
  // A looser match would invent joins the data does not record.
  const needle = topic.title.trim().toLowerCase();
  const entities = (await searchEntities(topic.title, 12))
    .filter((e) =>
      [e.name, ...e.aliases].some((n) => n.trim().toLowerCase() === needle)
    )
    .slice(0, 6)
    .map((e) => ({ id: e.id, name: e.name, kind: e.kind, type: e.type, brief: e.brief }));

  return NextResponse.json({
    work: workParam,
    workLabel: work.label,
    id: topic.id,
    title: topic.title,
    refs: countRefs(topic),
    sections,
    related,
    relatedUnresolved,
    otherWork,
    entities,
  });
}
