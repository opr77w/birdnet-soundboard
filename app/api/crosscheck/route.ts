// When: 2026-11-27 | By: claude-sonnet-4-6 | What: live BirdNET-Go vs BirdWeather cross-check API route
import { NextResponse } from "next/server";

const LOCAL = process.env.BIRDNET_BASE_URL ?? "http://localhost:8080";
const GQL = "https://app.birdweather.com/graphql";
const DAYS = 7;
const BOX_LAT = 0.16;
const BOX_LON = 0.25;
const TOP_N = 20;
const IGNORE_STATIONS = new Set(["31891"]);

interface LocalSpecies {
  scientific_name: string;
  common_name: string;
  count: number;
  max_confidence: number;
  avg_confidence: number;
}

interface NearbyEntry {
  common: string;
  count: number;
  stations: number;
}

interface Station {
  id: string;
  name: string;
  latestDetectionAt: string | null;
}

async function gql<T>(query: string): Promise<T> {
  const res = await fetch(GQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`BirdWeather GraphQL ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

function norm(name: string): string {
  return (name ?? "").toLowerCase().replace(/[^a-z]/g, "");
}

export async function GET() {
  const token = process.env.BIRDWEATHER_TOKEN;
  const lat = parseFloat(process.env.BIRDNET_LAT ?? "0");
  const lon = parseFloat(process.env.BIRDNET_LON ?? "0");

  if (!token) return NextResponse.json({ error: "BIRDWEATHER_TOKEN not set" }, { status: 503 });
  if (!lat || !lon) return NextResponse.json({ error: "BIRDNET_LAT/LON not set" }, { status: 503 });

  try {
    // Own station ID
    let ownId: string | null = null;
    try {
      const r = await fetch(`https://app.birdweather.com/api/v1/stations/${token}`);
      if (r.ok) ownId = String((await r.json()).id);
    } catch { /* skip */ }

    // Local species summary for the last 7 days
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - DAYS);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const qs = new URLSearchParams({ start_date: fmt(start), end_date: fmt(today) });
    const localRes = await fetch(`${LOCAL}/api/v2/analytics/species/summary?${qs}`);
    if (!localRes.ok) throw new Error(`BirdNET-Go API ${localRes.status}`);
    const localArr: LocalSpecies[] = await localRes.json();
    const local: Record<string, LocalSpecies> = {};
    for (const r of localArr) local[r.scientific_name] = r;

    // Nearby active stations
    const ne = `{lat:${lat + BOX_LAT},lon:${lon + BOX_LON}}`;
    const sw = `{lat:${lat - BOX_LAT},lon:${lon - BOX_LON}}`;
    const stData = await gql<{ stations: { nodes: Station[] } }>(
      `{ stations(ne:${ne}, sw:${sw}, first:50){ nodes { id name latestDetectionAt } } }`
    );
    const cutoff = new Date(Date.now() - DAYS * 86400_000).toISOString().slice(0, 10);
    const active = stData.stations.nodes.filter(
      (s) =>
        s.id !== ownId &&
        !IGNORE_STATIONS.has(s.id) &&
        (s.latestDetectionAt ?? "") >= cutoff
    );

    // Top species from each nearby station
    const near: Record<string, NearbyEntry> = {};
    await Promise.all(
      active.map(async (s) => {
        const q = `{ station(id:"${s.id}"){ topSpecies(period:{count:${DAYS}, unit:"day"}, limit:200){ count species { commonName scientificName } } } }`;
        try {
          const d = await gql<{ station: { topSpecies: { count: number; species: { commonName: string; scientificName: string } }[] } }>(q);
          for (const r of d.station.topSpecies ?? []) {
            const sp = r.species;
            const e = near[sp.scientificName] ?? (near[sp.scientificName] = { common: sp.commonName, count: 0, stations: 0 });
            e.count += r.count;
            e.stations += 1;
          }
        } catch { /* skip failed station */ }
      })
    );

    const nearByCommon: Record<string, NearbyEntry> = {};
    for (const v of Object.values(near)) nearByCommon[norm(v.common)] = v;
    const nearFor = (sciName: string, commonName: string) =>
      near[sciName] ?? nearByCommon[norm(commonName)];

    // Suspects: local but not in any nearby station
    const suspects = localArr
      .filter((r) => !nearFor(r.scientific_name, r.common_name))
      .sort((a, b) => b.count - a.count);

    // Missing: in area top-N, not detected locally
    const localCommon = new Set(localArr.map((r) => norm(r.common_name)));
    const topNear = Object.entries(near)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, TOP_N);
    const missing = topNear.filter(
      ([sciName, v]) => !(sciName in local) && !localCommon.has(norm(v.common))
    );

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      periodDays: DAYS,
      local: {
        species: localArr.length,
        detections: localArr.reduce((s, r) => s + r.count, 0),
        list: localArr.sort((a, b) => b.count - a.count).map((r) => ({
          ...r,
          nearbyCount: nearFor(r.scientific_name, r.common_name)?.count ?? 0,
        })),
      },
      nearby: {
        stations: active.map((s) => s.name),
        stationCount: active.length,
        species: Object.keys(near).length,
        detections: Object.values(near).reduce((s, v) => s + v.count, 0),
      },
      suspects: suspects.map((r) => ({
        scientificName: r.scientific_name,
        commonName: r.common_name,
        count: r.count,
        maxConfidence: r.max_confidence,
        avgConfidence: r.avg_confidence,
      })),
      missing: missing.map(([sciName, v]) => ({
        scientificName: sciName,
        commonName: v.common,
        nearbyCount: v.count,
        nearbyStations: v.stations,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
