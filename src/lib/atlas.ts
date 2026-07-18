import { promises as fs } from "fs";
import path from "path";
import { getRights } from "./rights";

/**
 * The Atlas machinery: a self-contained SVG rendering of the biblical world.
 * The land base is Natural Earth 1:110m land (public domain, vendored under
 * data/_sources/naturalearth); TIPNR places with coordinates are plotted on
 * top. Projection is a plain equirectangular (longitude compressed by the
 * cosine of the mid-latitude) computed in TypeScript — no tile server, no
 * mapping library.
 */

export interface AtlasPlace {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  refs: number;
  major: boolean;
}

export interface AtlasBBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

/** The atlas frames the whole biblical world: Iberia to Persia, Cush to the
 *  Black Sea — every geolocated TIPNR place falls inside. */
export const ATLAS_BBOX: AtlasBBox = { minLng: -9, minLat: -2, maxLng: 79, maxLat: 48 };

/** A place is "major" when Scripture references it ten times or more; that
 *  keeps the default label layer legible (~136 labels). */
export const MAJOR_REFS = 10;

const UNITS_PER_DEG = 10;
const MID_LAT = 30;
const LNG_SCALE = UNITS_PER_DEG * Math.cos((MID_LAT * Math.PI) / 180);

export function project(lng: number, lat: number): [number, number] {
  return [lng * LNG_SCALE, -lat * UNITS_PER_DEG];
}

/** viewBox covering a lon/lat bounding box, with a small margin. */
export function viewBoxFor(bbox: AtlasBBox, marginDeg = 0.6): string {
  const [x0, y1] = project(bbox.minLng - marginDeg, bbox.minLat - marginDeg);
  const [x1, y0] = project(bbox.maxLng + marginDeg, bbox.maxLat + marginDeg);
  return `${x0.toFixed(1)} ${y0.toFixed(1)} ${(x1 - x0).toFixed(1)} ${(y1 - y0).toFixed(1)}`;
}

function atlasAvailable(): boolean {
  return getRights("naturalearth")?.status === "shipped";
}

interface NeGeometry {
  type: string;
  coordinates: number[][][] | number[][][][];
  bbox?: number[];
}

interface NeFeature {
  geometry: NeGeometry;
  bbox?: number[];
}

let landPromise: Promise<NeFeature[] | null> | null = null;

async function loadLand(): Promise<NeFeature[] | null> {
  if (!atlasAvailable()) return null;
  if (!landPromise) {
    landPromise = fs
      .readFile(
        path.join(process.cwd(), "data", "_sources", "naturalearth", "ne_110m_land.geojson"),
        "utf8"
      )
      .then((raw) => (JSON.parse(raw) as { features: NeFeature[] }).features)
      .catch(() => null);
  }
  return landPromise;
}

function ringToPath(ring: number[][]): string {
  return (
    "M" +
    ring
      .map(([lng, lat]) => {
        const [x, y] = project(lng, lat);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join("L") +
    "Z"
  );
}

function featureToPath(geometry: NeGeometry): string {
  const polys =
    geometry.type === "Polygon"
      ? [geometry.coordinates as number[][][]]
      : (geometry.coordinates as number[][][][]);
  return polys
    .map((poly) => poly.map((ring) => ringToPath(ring)).join(""))
    .join("");
}

function featureBBox(feature: NeFeature): number[] {
  const bbox = feature.bbox ?? feature.geometry.bbox;
  if (bbox) return bbox;
  let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
  const walk = (coords: unknown): void => {
    if (Array.isArray(coords) && typeof coords[0] === "number") {
      const [lng, lat] = coords as number[];
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    } else if (Array.isArray(coords)) coords.forEach(walk);
  };
  walk(feature.geometry.coordinates);
  return [minLng, minLat, maxLng, maxLat];
}

/**
 * SVG path data for every land polygon intersecting the given bounding box
 * (empty string when the Natural Earth base is not furnished). Paths are in
 * the shared projected coordinate space, so any viewBox from viewBoxFor
 * crops them correctly.
 */
export async function landPaths(bbox: AtlasBBox): Promise<string[]> {
  const features = await loadLand();
  if (!features) return [];
  return features
    .filter((f) => {
      const [minLng, minLat, maxLng, maxLat] = featureBBox(f);
      return (
        maxLng >= bbox.minLng && minLng <= bbox.maxLng && maxLat >= bbox.minLat && minLat <= bbox.maxLat
      );
    })
    .map((f) => featureToPath(f.geometry));
}

let placesPromise: Promise<AtlasPlace[] | null> | null = null;

/** Every TIPNR place carrying coordinates, from the detail shards. */
export async function listPlaces(): Promise<AtlasPlace[] | null> {
  if (getRights("tipnr")?.status !== "shipped") return null;
  if (!placesPromise) {
    placesPromise = (async () => {
      try {
        const dir = path.join(process.cwd(), "data", "entities", "detail");
        const files = await fs.readdir(dir);
        const places: AtlasPlace[] = [];
        for (const file of files) {
          if (!file.endsWith(".json")) continue;
          const shard = JSON.parse(await fs.readFile(path.join(dir, file), "utf8")) as Record<
            string,
            {
              id: string;
              name: string;
              kind: string;
              type: string;
              geo: { lat: number; lng: number } | null;
              refs: unknown[];
            }
          >;
          for (const e of Object.values(shard)) {
            if (e.kind !== "place" || !e.geo) continue;
            places.push({
              id: e.id,
              name: e.name,
              type: e.type,
              lat: e.geo.lat,
              lng: e.geo.lng,
              refs: e.refs.length,
              major: e.refs.length >= MAJOR_REFS,
            });
          }
        }
        places.sort((a, b) => b.refs - a.refs || a.name.localeCompare(b.name));
        return places;
      } catch {
        return null;
      }
    })();
  }
  return placesPromise;
}
