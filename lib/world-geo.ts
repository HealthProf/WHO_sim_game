// World map geometry for the Release 4 map views (client-safe, no DB).
// Countries come from world-atlas's 110m TopoJSON, bundled with the app so
// the projector never depends on a CDN during class. Each WHO region is
// drawn as one merged shape (topojson merge), so internal country borders
// don't clutter a projector-sized map; countries outside WHO regional
// membership are drawn individually in neutral gray.
import { feature, merge } from "topojson-client";
import { geoEqualEarth, geoPath } from "d3-geo";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry, MultiPolygon } from "geojson";
import world from "world-atlas/countries-110m.json";
import { REGIONS, type RegionId } from "./regions";
import { EXCLUDED_FROM_MAP, regionForFeature } from "./who-region-geo";

const topo = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;

export interface RegionShape {
  regionId: RegionId;
  path: string;
  // Label anchor (centroid of the largest landmass) and bounding box, in
  // the projected coordinate space.
  labelAt: [number, number];
  bounds: [[number, number], [number, number]];
}

export interface WorldGeometry {
  width: number;
  height: number;
  regions: RegionShape[];
  unassigned: string[]; // gray paths
}

const cache = new Map<string, WorldGeometry>();

export function buildWorldGeometry(width = 960, height = 470): WorldGeometry {
  const key = `${width}x${height}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const geoms = topo.objects.countries.geometries.filter((g) => !EXCLUDED_FROM_MAP.has(String(g.id ?? "")));
  const projection = geoEqualEarth().fitExtent(
    [
      [6, 6],
      [width - 6, height - 6],
    ],
    feature(topo, { type: "GeometryCollection", geometries: geoms }) as never
  );
  const path = geoPath(projection);

  const regions: RegionShape[] = REGIONS.map((regionId) => {
    const members = geoms.filter((g) => regionForFeature(g.id as string | undefined, (g.properties as { name?: string } | undefined)?.name) === regionId);
    const merged = merge(topo, members as never) as MultiPolygon;
    const mergedFeature: Feature<Geometry> = { type: "Feature", properties: {}, geometry: merged };
    const polys = merged.coordinates.map((poly) => {
      const f: Feature<Geometry> = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: poly } };
      return { f, area: path.area(f) };
    });
    const totalArea = polys.reduce((sum, p) => sum + p.area, 0);
    // Label on the largest landmass so it doesn't land in the ocean.
    const largest = polys.reduce((best, p) => (p.area > best.area ? p : best), polys[0]);
    // Zoom bounds from substantial landmasses only: small pieces across the
    // date line (Chukotka, Fiji) would otherwise stretch EURO's and WPRO's
    // box across the whole map.
    const substantial = polys.filter((p) => p.area >= totalArea * 0.02);
    const bs = substantial.map((p) => path.bounds(p.f));
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...bs.map((b) => b[0][0])), Math.min(...bs.map((b) => b[0][1]))],
      [Math.max(...bs.map((b) => b[1][0])), Math.max(...bs.map((b) => b[1][1]))],
    ];
    return {
      regionId,
      path: path(mergedFeature) ?? "",
      labelAt: path.centroid(largest.f) as [number, number],
      bounds,
    };
  });

  const unassigned = geoms
    .filter((g) => !regionForFeature(g.id as string | undefined, (g.properties as { name?: string } | undefined)?.name))
    .map((g) => path(feature(topo, g) as Feature<Geometry>) ?? "")
    .filter(Boolean);

  const result = { width, height, regions, unassigned };
  cache.set(key, result);
  return result;
}
