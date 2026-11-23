// When: 2026-11-23 | By: claude-sonnet-4-6 | What: proxy xeno-canto API for reference bird songs
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const species = req.nextUrl.searchParams.get("species");
  if (!species) {
    return NextResponse.json({ error: "species param required" }, { status: 400 });
  }

  const query = encodeURIComponent(`${species} q>:C`); // quality >= C
  const url = `https://xeno-canto.org/api/2/recordings?query=${query}&page=1`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 }, // cache 1h — species songs don't change
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `xeno-canto returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    // Return only the first few recordings to keep payload small
    const recordings = (data.recordings ?? []).slice(0, 5).map((r: Record<string, string>) => ({
      id: r.id,
      en: r.en,
      file: r.file,
      lic: r.lic,
      type: r.type,
      country: r.cnt,
    }));

    return NextResponse.json({ recordings });
  } catch {
    return NextResponse.json(
      { error: "Could not reach xeno-canto" },
      { status: 502 }
    );
  }
}
