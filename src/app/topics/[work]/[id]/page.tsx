import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVerses } from "@/lib/bible";
import {
  TOPIC_WORKS,
  countRefs,
  formatTopicRef,
  getTopic,
  getTopicByTitle,
  isTopicWork,
  topicRefHref,
  type TopicNode,
  type TopicRef,
  type TopicWork,
} from "@/lib/topics";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ work: string; id: string }>;
}): Promise<Metadata> {
  const { work, id } = await params;
  if (!isTopicWork(work)) return {};
  const topic = await getTopic(work, id);
  return topic ? { title: topic.title.replace(/\b\w/g, (c) => c.toUpperCase()) } : {};
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ work: string; id: string }>;
}) {
  const { work, id } = await params;
  if (!isTopicWork(work)) notFound();
  const topic = await getTopic(work, id);
  if (!topic) notFound();
  const workMeta = TOPIC_WORKS.find((w) => w.id === work)!;
  const refs = countRefs(topic);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="small-caps mb-2 text-xs text-muted">
        <Link href="/topics" className="text-sapphire no-underline hover:underline">
          Topical index
        </Link>{" "}
        · {workMeta.label}
      </p>
      <h1 className="font-editorial mb-1 text-2xl font-bold capitalize">{topic.title}</h1>
      <p className="mb-8 text-sm text-muted">
        {refs.toLocaleString()} {refs === 1 ? "reference" : "references"}, with the KJV text.
      </p>

      <div className="space-y-6">
        {topic.children.map((node, i) => (
          <Node key={i} work={work} node={node} depth={0} />
        ))}
      </div>

      <footer className="mt-10 border-t border-rule pt-4 text-xs text-muted">
        {workMeta.label}, a public-domain work, digitized by CCEL and distributed through the
        CrossWire SWORD project. Provenance and rights in{" "}
        <Link href="/sources" className="text-sapphire no-underline hover:underline">
          Sources &amp; rights
        </Link>
        . Verse text is the King James Version (public domain).
      </footer>
    </div>
  );
}

async function Node({ work, node, depth }: { work: TopicWork; node: TopicNode; depth: number }) {
  const seeTopic = node.see ? await getTopicByTitle(work, node.see) : null;
  return (
    <section className={depth > 0 ? "ml-4 border-l border-rule pl-4" : ""}>
      {node.label &&
        (seeTopic ? (
          <p className="text-sm">
            See{" "}
            <Link
              href={`/topics/${work}/${seeTopic.id}`}
              className="text-sapphire no-underline hover:underline capitalize"
            >
              {seeTopic.title}
            </Link>
          </p>
        ) : (
          <h2
            className={
              depth === 0
                ? "small-caps mb-2 text-sm text-muted"
                : "mt-3 mb-1 text-sm font-medium"
            }
          >
            {node.label}
          </h2>
        ))}
      {node.refs.length > 0 && (
        <ol className="space-y-3">
          {node.refs.map((ref, i) => (
            <RefLine key={i} refObj={ref} />
          ))}
        </ol>
      )}
      {node.children.length > 0 && (
        <div className="mt-3 space-y-4">
          {node.children.map((child, i) => (
            <Node key={i} work={work} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </section>
  );
}

async function RefLine({ refObj }: { refObj: TopicRef }) {
  const verses =
    refObj.verse !== null
      ? await getVerses(refObj.slug, refObj.chapter, refObj.verse, refObj.verseEnd ?? refObj.verse)
      : null;
  return (
    <li>
      <Link
        href={topicRefHref(refObj)}
        className="small-caps text-sm font-medium text-sapphire no-underline hover:underline"
      >
        {formatTopicRef(refObj)}
      </Link>
      {verses && verses.length > 0 && (
        <p className="font-reader mt-0.5 leading-relaxed">
          {verses.map((v) => v.text).join(" ")}
        </p>
      )}
    </li>
  );
}
