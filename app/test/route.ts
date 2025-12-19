import electron from "electron";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const password = "3YiABv0hXEjwD1Pof36HJUpW4HW7dQAG";

export async function POST(req: NextRequest) {
  const iteration =
    parseInt(req.cookies.get("iteration")?.value ?? "0", 10) || 0;

  const session = await getIronSession<Record<string, any>>(await cookies(), {
    password,
    cookieName: "iron",
  });
  session.username = "Alison";
  session.iteration = iteration + 1;
  await session.save();
  const res = NextResponse.json({
    message: "Hello from Next.js! in response to " + (await req.text()),
    requestCookies: (await cookies()).getAll(),
    electron: electron.app.getVersion(),
    session, // never do this, it's just for demo to show what server knows
  });

  res.cookies.set("iteration", (iteration + 1).toString(), {
    path: "/",
    maxAge: 60 * 60, // 1 hour
  });

  res.cookies.set("sidebar:state", Date.now().toString(), {
    path: "/",
    maxAge: 60 * 60, // 1 hour
  });

  return res;
}
