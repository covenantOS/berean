import Link from "next/link";
import { landPaths, project, viewBoxFor } from "@/lib/atlas";

/**
 * The small static locator on place entity pages: the same Natural Earth base
 * and projection as the atlas, framed a few degrees around the place, linking
 * to the full atlas focused on it.
 */
export default async function LocatorMap({
  id,
  name,
  lat,
  lng,
}: {
  id: string;
  name: string;
  lat: number;
  lng: number;
}) {
  const span = 3;
  const bbox = {
    minLng: lng - span,
    maxLng: lng + span,
    minLat: lat - span,
    maxLat: lat + span,
  };
  const paths = await landPaths(bbox);
  if (paths.length === 0) return null;
  const [x, y] = project(lng, lat);

  return (
    <div className="w-full max-w-xs">
      <Link href={`/library/atlas?place=${id}`} title={`${name} in the Atlas`}>
        <svg
          viewBox={viewBoxFor(bbox, 0.15)}
          role="img"
          aria-label={`Locator map for ${name}`}
          className="w-full rounded-[4px] border border-rule bg-white hover:border-sapphire"
        >
          <g fill="var(--surface)" stroke="var(--rule)" strokeWidth={0.12}>
            {paths.map((d, i) => (
              <path key={i} d={d} fillRule="evenodd" />
            ))}
          </g>
          <circle
            cx={x}
            cy={y}
            r={0.55}
            fill="var(--stained-ruby)"
            stroke="white"
            strokeWidth={0.12}
          />
          <text
            x={x + 0.9}
            y={y + 0.5}
            fontSize={1.6}
            fontFamily="var(--font-editorial, Georgia, serif)"
            fill="var(--ink, #221d15)"
            stroke="white"
            strokeWidth={0.4}
            paintOrder="stroke"
          >
            {name}
          </text>
        </svg>
      </Link>
      <p className="mt-1 text-[0.68rem] text-muted">
        <Link href={`/library/atlas?place=${id}`} className="text-sapphire no-underline hover:underline">
          Open in the Atlas
        </Link>{" "}
        · modern coastline (Natural Earth, public domain)
      </p>
    </div>
  );
}
