// When: 2026-11-23 | By: claude-sonnet-4-6 | What: serve BirdNET-Go audio clips — from mounted filesystem (BIRDNET_CLIPS_DIR) or proxied from HTTP (BIRDNET_CLIPS_URL)
import { NextRequest, NextResponse } from "next/server";
import { createReadStream, statSync } from "fs";
import { join } from "path";
import { Readable } from "stream";

const BIRDNET_CLIPS_DIR = process.env.BIRDNET_CLIPS_DIR ?? "";
const BIRDNET_CLIPS_URL = process.env.BIRDNET_CLIPS_URL ?? "http://localhost:8091";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const filename = path[path.length - 1];
  const contentType = inferContentType(filename);
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=86400",
  };

  // Serve directly from mounted filesystem when available
  if (BIRDNET_CLIPS_DIR) {
    const filePath = join(BIRDNET_CLIPS_DIR, ...path);
    try {
      const stat = statSync(filePath);
      headers["Content-Length"] = String(stat.size);
      const stream = createReadStream(filePath);
      const webStream = Readable.toWeb(stream) as ReadableStream;
      return new NextResponse(webStream, { headers });
    } catch {
      return new NextResponse(null, { status: 404 });
    }
  }

  // Fall back to HTTP proxy
  try {
    const url = `${BIRDNET_CLIPS_URL}/${path.join("/")}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return new NextResponse(null, { status: res.status });
    const contentLength = res.headers.get("Content-Length");
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
