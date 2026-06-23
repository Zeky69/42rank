import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { publicBaseUrl } from "@/lib/base-url";
import { recordActivity } from "@/lib/stats";

type TokenResponse = { access_token?: string; error?: string };
type Cursus = { id: number; slug: string };
type CursusUser = { cursus_id: number; cursus: Cursus; level: number };
type Campus = { id: number; name: string };
type Me = {
  id: number;
  login: string;
  image?: { link?: string };
  campus?: Campus[];
  pool_year?: string;
  cursus_users?: CursusUser[];
};

export async function GET(req: NextRequest) {
  const base = publicBaseUrl();
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(`${base}/`);

  const tokenRes = await fetch("https://api.intra.42.fr/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.UID as string,
      client_secret: process.env.SECRET as string,
      code,
      redirect_uri: process.env.REDIRECT_URI as string,
    }),
  });

  const token = (await tokenRes.json()) as TokenResponse;
  if (!token.access_token) {
    return new NextResponse(
      `OAuth token exchange failed: ${token.error ?? "unknown"}`,
      { status: 500 },
    );
  }

  const meRes = await fetch("https://api.intra.42.fr/v2/me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!meRes.ok) {
    return new NextResponse(`/v2/me failed: ${meRes.status}`, { status: 500 });
  }
  const me = (await meRes.json()) as Me;

  const main42cursus =
    me.cursus_users?.find((c) => c.cursus.slug === "42cursus") ??
    me.cursus_users?.[0];

  const session = await getSession();
  session.accessToken = token.access_token;
  session.login = me.login;
  session.userId = me.id;
  session.campusId = me.campus?.[0]?.id;
  session.campusName = me.campus?.[0]?.name;
  session.poolYear = me.pool_year;
  session.cursusId = main42cursus?.cursus_id ?? 21;
  session.image = me.image?.link;
  await session.save();
  void recordActivity(me.id, me.campus?.[0]?.name);

  return NextResponse.redirect(`${base}/ranking`);
}
