// When: 2026-11-23 | By: claude-sonnet-4-6 | What: proxy BirdNET-Go audio clips through Next.js so the browser never needs a direct clips-server URL
import { NextRequest, NextResponse } from "next/server";

const BIRDNET_CLIPS_URL =
  process.env.BIRDNET_CLIPS_URL ?? "http://localhost:8091";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const url = `${BIRDNET_CLIPS_URL}/${path.join("/")}`;

  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    const contentType =
      res.headers.get("Content-Type") ?? inferContentType(path[path.length - 1]);
    const contentLength = res.headers.get("Content-Length");

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400", // clips are immutable
    };
    if (contentLength) headers["Content-Length"] = contentLength;

    return new NextResponse(res.body, { headers });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}

function inferContentType(filename: string): string {
  if (filename?.endsWith(".flac")) return "audio/flac";
  if (filename?.endsWith(".mp3")) return "audio/mpeg";
  if (filename?.endsWith(".ogg")) return "audio/ogg";
  return "audio/wav";
}
