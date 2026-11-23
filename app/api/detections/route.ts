// When: 2026-11-23 | By: claude-sonnet-4-6 | What: proxy BirdNET-Go recent detections to avoid CORS
import { NextRequest, NextResponse } from "next/server";

const BIRDNET_BASE_URL =
  process.env.BIRDNET_BASE_URL ?? "http://localhost:8080";

export async function GET(req: NextRequest) {
  const limit = req.nextUrl.searchParams.get("limit") ?? "10";

  const url = `${BIRDNET_BASE_URL}/api/v2/detections/recent?limit=${limit}`;

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    const username = process.env.BIRDNET_USERNAME;
    const password = process.env.BIRDNET_PASSWORD;
    if (username && password) {
      headers["Authorization"] =
        "Basic " +
        Buffer.from(`${username}:${password}`).toString("base64");
    }

    const res = await fetch(url, { headers, next: { revalidate: 0 } });
    if (!res.ok) {
      return NextResponse.json(
        { error: `BirdNET-Go returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach BirdNET-Go at ${BIRDNET_BASE_URL}` },
      { status: 502 }
    );
  }
}
