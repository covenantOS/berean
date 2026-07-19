import { NextRequest, NextResponse } from "next/server";
import { getBook } from "@/lib/canon";
import { getEntity } from "@/lib/entities";
import { landPaths, project, viewBoxFor } from "@/lib/atlas";
import { eventsForEntity, formatEventYears } from "@/lib/timeline";

/**
 * The Factbook: one TIPNR entity composed into a report. Identity is the
 * record's own name, type, tag, and aliases; Overview carries the brief,
 * short, and article prose the dataset ships; Location joins the atlas for
 * geocoded places, rendering the same locator the old entity page shows;
 * Family is the record's relationship lists; On the Timeline is the real
 * eventsForEntity join; Every Reference is the dataset's verse mentions,
 * grouped by book. Nothing beyond the shipped record is invented.
 */

const ID_PATTERN = /^[A-Za-z0-9]{5,6}$/;

export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get("id") ?? "").trim();
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "An entity id is required." }, { status: 400 });
  }
  const entity = await getEntity(id);
  if (!entity) {
    return NextResponse.json({ error: "No such entity." }, { status: 404 });
  }

  // Location: the locator map's pieces, computed here so the pane stays a
  // client component; the SVG it renders matches the old entity page's.
  let locator: { viewBox: string; paths: string[]; x: number; y: number } | null = null;
  if (entity.geo) {
    const span = 3;
    const bbox = {
      minLng: entity.geo.lng - span,
      maxLng: entity.geo.lng + span,
      minLat: entity.geo.lat - span,
      maxLat: entity.geo.lat + span,
    };
    const paths = await landPaths(bbox);
    if (paths.length > 0) {
      const [x, y] = project(entity.geo.lng, entity.geo.lat);
      locator = { viewBox: viewBoxFor(bbox, 0.15), paths, x, y };
    }
  }

  const timeline = (await eventsForEntity(id)).map((e) => ({
    id: e.id,
    label: e.label,
    years: formatEventYears(e),
  }));

  const byBook = new Map<string, { chapter: number; verse: number }[]>();
  for (const ref of entity.refs) {
    if (!byBook.has(ref.slug)) byBook.set(ref.slug, []);
    byBook.get(ref.slug)!.push({ chapter: ref.chapter, verse: ref.verse });
  }
  const refsByBook = [...byBook.entries()]
    .map(([slug, refs]) => {
      const book = getBook(slug);
      return book ? { slug: book.slug, bookName: book.name, refs } : null;
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);

  return NextResponse.json({
    id: entity.id,
    name: entity.name,
    kind: entity.kind,
    type: entity.type,
    tag: entity.tag,
    description: entity.description,
    brief: entity.brief,
    short: entity.short,
    article: entity.article,
    aliases: entity.aliases,
    tribe: entity.tribe,
    area: entity.area,
    geo: entity.geo,
    locator,
    relations: entity.relations,
    timeline,
    refsByBook,
    refCount: entity.refs.length,
  });
}
