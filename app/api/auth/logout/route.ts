import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { publicBaseUrl } from "@/lib/base-url";

export async function GET() {
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(`${publicBaseUrl()}/`);
}
