import { NextResponse } from "next/server";

export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.UID as string,
    redirect_uri: process.env.REDIRECT_URI as string,
    response_type: "code",
    scope: "public",
  });
  return NextResponse.redirect(
    `https://api.intra.42.fr/oauth/authorize?${params.toString()}`,
  );
}
