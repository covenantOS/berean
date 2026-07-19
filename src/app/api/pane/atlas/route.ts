import { NextResponse } from "next/server";
import { ATLAS_BBOX, landPaths, listPlaces, project, viewBoxFor } from "@/lib/atlas";

/**
 * The Atlas pane's data: the Natural Earth land base and every geolocated
 * TIPNR place, projected into the shared SVG coordinate space, so the pane
 * stays a client component. The map it renders matches the retired
 * /library/atlas page's.
 */
export async function GET() {
  const [paths, places] = await Promise.all([landPaths(ATLAS_BBOX), listPlaces()]);
  if (!places || paths.length === 0) {
    return NextResponse.json({ error: "The atlas is not furnished." }, { status: 404 });
  }
  const points = places.map((p) => {
    const [x, y] = project(p.lng, p.lat);
    return { id: p.id, name: p.name, x, y, refs: p.refs, major: p.major };
  });
  return NextResponse.json({ viewBox: viewBoxFor(ATLAS_BBOX), paths, points });
}
