// When: 2026-11-27 | By: claude-sonnet-4-6 | What: proxy xeno-canto v3 for bird reference recordings
import { NextRequest, NextResponse } from "next/server";

interface XCRecording {
  file: string;
  "file-name": string;
  en: string;
  rec: string;
  lic: string;
}

interface XCResponse {
  recordings: XCRecording[];
  numRecordings: string;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json(null, { status: 400 });

  const apiKey = process.env.XENOCANTO_API_KEY;
  if (!apiKey) return NextResponse.json(null, { status: 503 });

  const url =
    `https://xeno-canto.org/api/3/recordings` +
    `?query=${encodeURIComponent(`sp:"${q}"`)}` +
    `&key=${apiKey}`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return NextResponse.json(null, { status: 502 });

    const data: XCResponse = await res.json();
    const rec = data.recordings?.[0];
    if (!rec?.file) return NextResponse.json(null, { status: 404 });

    return NextResponse.json({
      url: rec.file,
      attribution: `${rec.rec} / xeno-canto`,
      license: rec.lic,
    });
  } catch {
    return NextResponse.json(null, { status: 502 });
  }
}
