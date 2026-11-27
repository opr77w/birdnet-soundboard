// When: 2026-11-27 | By: claude-sonnet-4-6 | What: BirdNET vs BirdWeather cross-check UI
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface CrosscheckData {
  generatedAt: string;
  periodDays: number;
  local: {
    species: number;
    detections: number;
    list: {
      scientific_name: string;
      common_name: string;
      count: number;
      max_confidence: number;
      avg_confidence: number;
      nearbyCount: number;
    }[];
  };
  nearby: {
    stations: string[];
    stationCount: number;
    species: number;
    detections: number;
  };
  suspects: {
    scientificName: string;
    commonName: string;
    count: number;
    maxConfidence: number;
    avgConfidence: number;
  }[];
  missing: {
    scientificName: string;
    commonName: string;
    nearbyCount: number;
    nearbyStations: number;
  }[];
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function ConfBadge({ v }: { v: number }) {
  const cls = v >= 0.8 ? "text-emerald-400" : v >= 0.6 ? "text-yellow-400" : "text-orange-400";
  return <span className={cls}>{pct(v)}</span>;
}

export default function CrosscheckPage() {
  const [data, setData] = useState<CrosscheckData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"suspects" | "missing" | "all">("suspects");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crosscheck");
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `HTTP ${res.status}`);
        return;
      }
      setData(await res.json());
    } catch {
      setError("Could not reach /api/crosscheck");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <main className="min-h-screen bg-slate-900 text-white px-4 py-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/" className="text-slate-400 hover:text-slate-200 text-sm">← Soundboard</Link>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-2">🔍 Cross-check</h1>
          <p className="text-slate-400 mt-1">BirdNET-Go vs nearby BirdWeather stations (last 7 days)</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
        >
          <RefreshIcon />
          refresh
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
          <span className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>Querying BirdNET-Go and BirdWeather…</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-2xl border border-red-800 bg-red-950/40 p-6 text-center">
          <div className="text-red-400 font-semibold mb-1">Cross-check failed</div>
          <div className="text-red-300/70 text-sm">{error}</div>
        </div>
      )}

      {/* Content */}
      {!loading && !error && data && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard label="This station" value={`${data.local.species} spp`} sub={`${data.local.detections} det.`} />
            <StatCard label="Nearby stations" value={String(data.nearby.stationCount)} sub={`${data.nearby.species} spp`} />
            <StatCard label="Suspects" value={String(data.suspects.length)} sub="detected here only" accent="amber" />
            <StatCard label="Missing" value={String(data.missing.length)} sub={`from area top-20`} accent="blue" />
          </div>

          {/* Nearby station list */}
          {data.nearby.stations.length > 0 && (
            <div className="mb-6 text-slate-400 text-sm">
              Nearby: {data.nearby.stations.join(", ")}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            {(["suspects", "missing", "all"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === t
                    ? "bg-slate-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                {t === "suspects" ? `🟡 Suspects (${data.suspects.length})` :
                 t === "missing"  ? `🔵 Missing (${data.missing.length})` :
                                    `📋 All species (${data.local.list.length})`}
              </button>
            ))}
          </div>

          {/* Suspects tab */}
          {tab === "suspects" && (
            <div>
              <p className="text-slate-400 text-sm mb-3">
                Detected here but not logged by any nearby BirdWeather station in the last 7 days. Worth listening to the clips.
              </p>
              {data.suspects.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <div className="text-4xl mb-3">✅</div>
                  <p>No suspects — all detections corroborated nearby.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-400 border-b border-slate-700">
                        <th className="pb-2 pr-4 font-medium">Species</th>
                        <th className="pb-2 pr-4 font-medium text-right">Det.</th>
                        <th className="pb-2 pr-4 font-medium text-right">Max conf</th>
                        <th className="pb-2 font-medium text-right">Avg conf</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {data.suspects.map((r) => (
                        <tr key={r.scientificName} className="hover:bg-slate-800/40">
                          <td className="py-2 pr-4">
                            <div className="font-medium text-white">{r.commonName}</div>
                            <div className="text-slate-400 italic text-xs">{r.scientificName}</div>
                          </td>
                          <td className="py-2 pr-4 text-right text-white">{r.count}</td>
                          <td className="py-2 pr-4 text-right"><ConfBadge v={r.maxConfidence} /></td>
                          <td className="py-2 text-right"><ConfBadge v={r.avgConfidence} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Missing tab */}
          {tab === "missing" && (
            <div>
              <p className="text-slate-400 text-sm mb-3">
                In the area's top-{data.nearby.stationCount > 0 ? 20 : "N"} species by nearby detections, but not detected here.
              </p>
              {data.missing.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <div className="text-4xl mb-3">✅</div>
                  <p>Nothing missing — this station detected all area top-20 species.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-400 border-b border-slate-700">
                        <th className="pb-2 pr-4 font-medium">Species</th>
                        <th className="pb-2 pr-4 font-medium text-right">Nearby det.</th>
                        <th className="pb-2 font-medium text-right">Stations</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {data.missing.map((r) => (
                        <tr key={r.scientificName} className="hover:bg-slate-800/40">
                          <td className="py-2 pr-4">
                            <div className="font-medium text-white">{r.commonName}</div>
                            <div className="text-slate-400 italic text-xs">{r.scientificName}</div>
                          </td>
                          <td className="py-2 pr-4 text-right text-white">{r.nearbyCount}</td>
                          <td className="py-2 text-right text-slate-300">{r.nearbyStations}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* All species tab */}
          {tab === "all" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="pb-2 pr-4 font-medium">Species</th>
                    <th className="pb-2 pr-4 font-medium text-right">Here</th>
                    <th className="pb-2 pr-4 font-medium text-right">Nearby</th>
                    <th className="pb-2 font-medium text-right">Max conf</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {data.local.list.map((r) => (
                    <tr key={r.scientific_name} className={`hover:bg-slate-800/40 ${r.nearbyCount === 0 ? "text-amber-400/80" : ""}`}>
                      <td className="py-2 pr-4">
                        <div className={`font-medium ${r.nearbyCount === 0 ? "text-amber-300" : "text-white"}`}>{r.common_name}</div>
                        <div className="text-slate-400 italic text-xs">{r.scientific_name}</div>
                      </td>
                      <td className="py-2 pr-4 text-right">{r.count}</td>
                      <td className="py-2 pr-4 text-right text-slate-400">{r.nearbyCount || "—"}</td>
                      <td className="py-2 text-right"><ConfBadge v={r.max_confidence} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-8 text-center text-slate-600 text-xs">
            Generated {new Date(data.generatedAt).toLocaleTimeString()} ·{" "}
            Nearby data from{" "}
            <a href="https://app.birdweather.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-400">
              BirdWeather
            </a>
          </div>
        </>
      )}
    </main>
  );
}

function StatCard({
  label, value, sub, accent,
}: {
  label: string; value: string; sub: string; accent?: "amber" | "blue";
}) {
  const val = accent === "amber" ? "text-amber-400" : accent === "blue" ? "text-blue-400" : "text-white";
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
      <div className="text-slate-400 text-xs mb-1">{label}</div>
      <div className={`text-xl font-bold ${val}`}>{value}</div>
      <div className="text-slate-500 text-xs">{sub}</div>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
      <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.75.75 0 0 1 1.359-.635A6.5 6.5 0 1 1 8 1.5a6.5 6.5 0 0 1 4.293 1.639l.957-.957a.75.75 0 0 1 1.282.542v3.093a.75.75 0 0 1-.75.75H10.69a.75.75 0 0 1-.542-1.282l.957-.957A5.002 5.002 0 0 0 8 3Z" clipRule="evenodd" />
    </svg>
  );
}
