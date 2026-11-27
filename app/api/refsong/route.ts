// When: 2026-11-27 | By: claude-sonnet-4-6 | What: proxy iNaturalist for bird reference recordings (no API key required)
import { NextRequest, NextResponse } from "next/server";

interface iNatSound {
  file_url: string;
  file_content_type: string;
  attribution: string;
  license_code: string;
}

interface iNatObs {
  sounds?: iNatSound[];
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json(null, { status: 400 });

  const url =
    `https://api.inaturalist.org/v1/observations` +
    `?taxon_name=${encodeURIComponent(q)}` +
    `&sounds=true&quality_grade=research&per_page=1&order_by=votes`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return NextResponse.json(null, { status: 502 });

    const data = await res.json();
    const sound: iNatSound | undefined = (data.results as iNatObs[])?.[0]
      ?.sounds?.[0];
    if (!sound?.file_url) return NextResponse.json(null, { status: 404 });

    return NextResponse.json({
      url: sound.file_url,
      contentType: sound.file_content_type,
      attribution: sound.attribution,
      license: sound.license_code,
    });
  } catch {
    return NextResponse.json(null, { status: 502 });
  }
}
