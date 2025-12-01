import { NextResponse as Response } from "next/server";

export async function POST(req: Request) {
  return Response.json({
    message: "Hello from Next.js! in response to " + (await req.text()),
  });
}
