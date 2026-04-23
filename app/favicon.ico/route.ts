import { NextResponse } from "next/server";

export function GET() {
  // Avoid noisy 404s from browsers that still request /favicon.ico.
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "public, max-age=86400",
    },
  });
}

