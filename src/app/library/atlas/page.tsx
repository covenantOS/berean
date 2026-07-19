import Link from "next/link";
import type { Metadata } from "next";
import AtlasMap, { AtlasPoint } from "@/components/AtlasMap";
import { ATLAS_BBOX, landPaths, listPlaces, project, viewBoxFor } from "@/lib/atlas";

export const metadata: Metadata = {
  title: "The Atlas",
  description: "Every geolocated place in Scripture, plotted on the land it happened in.",
};

export default async function AtlasPage({
  searchParams,
}: {
  searchParams: Promise<{ place?: string }>;
}) {
  const { place } = await searchParams;
  const [paths, places] = await Promise.all([landPaths(ATLAS_BBOX), listPlaces()]);

  if (!places || paths.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="font-editorial mb-1 text-2xl font-bold">The Atlas</h1>
        <p className="text-sm text-muted">
          The atlas is not furnished in this build — it ships only when both the
          Natural Earth land base and the TIPNR place data are present and
          registered in the rights registry.
        </p>
      </div>
    );
  }

  const points: AtlasPoint[] = places.map((p) => {
    const [x, y] = project(p.lng, p.lat);
    return { id: p.id, name: p.name, x, y, refs: p.refs, major: p.major };
  });
  const majorCount = points.filter((p) => p.major).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav className="mb-6 text-sm text-muted">
        <Link href="/workspace?tab=library" className="text-sapphire no-underline hover:underline">
          The Library
        </Link>{" "}
        / The Atlas
      </nav>

      <h1 className="font-editorial mb-1 text-2xl font-bold">The Atlas</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted">
        {points.length.toLocaleString()} places named in Scripture carry coordinates;{" "}
        {majorCount} of them are referenced ten times or more and are labeled here.
        Every point opens its Factbook entry.
      </p>

      <AtlasMap
        viewBox={viewBoxFor(ATLAS_BBOX)}
        paths={paths}
        points={points}
        focusId={place}
      />
    </div>
  );
}
