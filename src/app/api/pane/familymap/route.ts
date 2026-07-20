import { NextRequest, NextResponse } from "next/server";
import { searchEntities } from "@/lib/entities";
import { buildFamilyMap, FAMILY_MAP_MAX_DEPTH } from "@/lib/familymap";

/**
 * The family map's feed. Two modes: `q` searches the TIPNR people for a
 * root to start from (the Tools pane's picker); `root` walks one person's
 * kin into the generational graph, `up` and `down` bounding the walk at
 * FAMILY_MAP_MAX_DEPTH generations each way. An unfurnished dataset or an
 * unknown id answers the way the Factbook route does.
 */

const ID_PATTERN = /^[A-Za-z0-9]{5,6}$/;

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const q = (params.get("q") ?? "").trim();
  if (q !== "") {
    const hits = (await searchEntities(q, 8)).filter((e) => e.kind === "person");
    return NextResponse.json({
      results: hits.map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        tag: e.tag,
        brief: e.brief,
      })),
    });
  }

  const root = (params.get("root") ?? "").trim();
  if (!ID_PATTERN.test(root)) {
    return NextResponse.json({ error: "A root entity id is required." }, { status: 400 });
  }
  const depth = (key: string): number => {
    const n = Number(params.get(key));
    if (!Number.isFinite(n)) return 2;
    return Math.min(Math.max(0, Math.floor(n)), FAMILY_MAP_MAX_DEPTH);
  };
  const map = await buildFamilyMap(root, depth("up"), depth("down"));
  if (!map) {
    return NextResponse.json({ error: "No such entity." }, { status: 404 });
  }
  return NextResponse.json(map);
}
