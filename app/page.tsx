// When: 2026-11-27 | By: claude-sonnet-4-6 | What: BirdNET-Go soundboard — latest detections with playback
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";

interface Detection {
  id: number;
  date: string;
  time: string;
  timestamp?: string;
  commonName: string;
  scientificName: string;
  speciesCode: string;
  confidence: number;
  clipName?: string;
  verified?: string;
  isNewSpecies?: boolean;
}


const REFRESH_INTERVAL = 30_000;

// Route audio through the Next.js clips proxy so it works from any client network
function clipUrl(detection: Detection): string | null {
  if (!detection.clipName) return null;
  const [year, month] = detection.date.split("-");
  return `/api/clips/${year}/${month}/${detection.clipName}`;
}

function confidencePct(c: number): string {
  return `${Math.round(c * 100)}%`;
}

function confidenceColor(c: number): string {
  if (c >= 0.8) return "text-emerald-400";
  if (c >= 0.6) return "text-yellow-400";
  return "text-orange-400";
}

// When: 2026-11-23 | By: claude-sonnet-4-6 | What: minimal audio player with play/stop toggle
function AudioButton({
  url,
  label,
  variant = "primary",
}: {
  url: string;
  label: string;
  variant?: "primary" | "secondary";
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const toggle = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.onended = () => setPlaying(false);
      audioRef.current.onerror = () => {
        setPlaying(false);
        setLoading(false);
        setError(true);
      };
    }

    if (playing) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
    } else {
      setLoading(true);
      audioRef.current
        .play()
        .then(() => {
          setPlaying(true);
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
          setError(true);
        });
    }
  }, [url, playing]);

  // Stop when unmounted
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const base =
    variant === "primary"
      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
      : "bg-slate-700 hover:bg-slate-600 text-slate-200";

  return (
    <button
      onClick={toggle}
      disabled={error}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${base} disabled:opacity-40 disabled:cursor-not-allowed`}
      title={error ? "Audio unavailable" : label}
    >
      {loading ? (
        <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : playing ? (
        <StopIcon />
      ) : (
        <PlayIcon />
      )}
      <span>{error ? "unavailable" : playing ? "stop" : label}</span>
    </button>
  );
}

// When: 2026-11-27 | By: claude-sonnet-4-6 | What: lazy-load reference recording from iNaturalist on first click
function RefAudioButton({ scientificName }: { scientificName: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const resolvedUrl = useRef<string | null>(null);

  const toggle = useCallback(async () => {
    if (notFound) return;

    if (playing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
      return;
    }

    setLoading(true);
    try {
      if (!resolvedUrl.current) {
        const res = await fetch(
          `/api/refsong?q=${encodeURIComponent(scientificName)}`
        );
        if (!res.ok) { setNotFound(true); return; }
        const data = await res.json();
        if (!data?.url) { setNotFound(true); return; }
        resolvedUrl.current = data.url;
      }

      if (!audioRef.current) {
        audioRef.current = new Audio(resolvedUrl.current!);
        audioRef.current.onended = () => setPlaying(false);
        audioRef.current.onerror = () => { setPlaying(false); setNotFound(true); };
      }

      await audioRef.current.play();
      setPlaying(true);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [playing, notFound, scientificName]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  return (
    <button
      onClick={toggle}
      disabled={notFound}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      title={notFound ? "No recording found" : "Play reference recording (iNaturalist)"}
    >
      {loading ? (
        <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : playing ? (
        <StopIcon />
      ) : (
        <span>🎵</span>
      )}
      <span>{notFound ? "unavailable" : playing ? "stop" : "reference"}</span>
    </button>
  );
}

// When: 2026-11-23 | By: claude-sonnet-4-6 | What: single bird detection card with play controls
function BirdCard({
  detection,
  featured,
}: {
  detection: Detection;
  featured?: boolean;
}) {
  const detClip = clipUrl(detection);

  const time = detection.timestamp
    ? new Date(detection.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : detection.time;

  return (
    <div
      className={`rounded-2xl border border-slate-700 bg-slate-800/60 backdrop-blur p-4 flex flex-col gap-3 ${
        featured ? "col-span-full ring-2 ring-emerald-500/40 p-6" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl">🐦</span>
            <span
              className={`font-bold ${featured ? "text-2xl" : "text-base"} text-white leading-tight`}
            >
              {detection.commonName}
            </span>
            {detection.isNewSpecies && (
              <span className="text-xs bg-emerald-700 text-emerald-100 px-2 py-0.5 rounded-full font-medium">
                NEW
              </span>
            )}
            {detection.verified === "correct" && (
              <span className="text-xs bg-blue-700 text-blue-100 px-2 py-0.5 rounded-full font-medium">
                ✓ verified
              </span>
            )}
          </div>
          <div className="text-slate-400 text-sm italic">
            {detection.scientificName}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`font-bold ${confidenceColor(detection.confidence)}`}>
            {confidencePct(detection.confidence)}
          </div>
          <div className="text-slate-500 text-xs">confidence</div>
        </div>
      </div>

      <div className="text-slate-400 text-sm">
        {detection.date} at {time}
      </div>

      <div className="flex flex-wrap gap-2">
        {detClip && (
          <AudioButton url={detClip} label="play detection" variant="primary" />
        )}
        <RefAudioButton scientificName={detection.scientificName} />
      </div>
    </div>
  );
}

// When: 2026-11-23 | By: claude-sonnet-4-6 | What: main page — polls BirdNET-Go and renders soundboard
export default function Home() {
  const [detections, setDetections] = useState<Detection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchDetections = useCallback(async () => {
    try {
      const res = await fetch("/api/detections?limit=10");
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      const raw: Detection[] = await res.json();
      // Keep one detection per species per calendar day (most recent first from API)
      const seen = new Set<string>();
      const data = raw.filter((d) => {
        const key = `${d.date}\0${d.scientificName}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setDetections(data);
      setError(null);
      setLastUpdate(new Date());
    } catch {
      setError("Could not reach the BirdNET-Go API proxy.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDetections();
    const interval = setInterval(fetchDetections, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchDetections]);

  const latest = detections[0] ?? null;
  const rest = detections.slice(1);

  return (
    <main className="min-h-screen bg-slate-900 text-white px-4 py-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            🦅 BirdNET Soundboard
          </h1>
          <p className="text-slate-400 mt-1">
            Latest detections from your BirdNET-Go instance
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-2">
            <Link
              href="/crosscheck"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
            >
              🔍 cross-check
            </Link>
            <button
              onClick={fetchDetections}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
            >
              <RefreshIcon />
              refresh
            </button>
          </div>
          {lastUpdate && (
            <span className="text-slate-500 text-xs">
              updated {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
          <span className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>Connecting to BirdNET-Go…</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-2xl border border-red-800 bg-red-950/40 p-6 text-center">
          <div className="text-red-400 font-semibold mb-1">
            Could not load detections
          </div>
          <div className="text-red-300/70 text-sm mb-3">{error}</div>
          <p className="text-slate-400 text-sm">
            Make sure BirdNET-Go is running and{" "}
            <code className="bg-slate-800 px-1 rounded">BIRDNET_BASE_URL</code>{" "}
            is set correctly in <code className="bg-slate-800 px-1 rounded">.env.local</code>.
          </p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && detections.length === 0 && (
        <div className="text-center py-20 text-slate-500">
          <div className="text-5xl mb-4">🔇</div>
          <p>No detections yet — check back soon.</p>
        </div>
      )}

      {/* Detections grid */}
      {!loading && !error && detections.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {latest && <BirdCard detection={latest} featured />}
          {rest.map((d) => (
            <BirdCard key={d.id} detection={d} />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 text-center text-slate-600 text-xs">
        Auto-refreshes every 30 s · Reference songs from{" "}
        <a
          href="https://xeno-canto.org"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-400"
        >
          xeno-canto
        </a>
      </div>
    </main>
  );
}

function PlayIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="w-3 h-3"
    >
      <path d="M3 2.69a.75.75 0 0 1 1.088-.67l9 4.5a.75.75 0 0 1 0 1.34l-9 4.5A.75.75 0 0 1 3 11.75V2.69Z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="w-3 h-3"
    >
      <rect x="2" y="2" width="12" height="12" rx="1" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="w-3 h-3"
    >
      <path
        fillRule="evenodd"
        d="M8 3a5 5 0 1 0 4.546 2.914.75.75 0 0 1 1.359-.635A6.5 6.5 0 1 1 8 1.5a6.5 6.5 0 0 1 4.293 1.639l.957-.957a.75.75 0 0 1 1.282.542v3.093a.75.75 0 0 1-.75.75H10.69a.75.75 0 0 1-.542-1.282l.957-.957A5.002 5.002 0 0 0 8 3Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
