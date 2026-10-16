import { getSession } from "@/lib/session";

// Le CDN de 42 refuse maintenant les photos de profil (/users/*) sans token
// API en Bearer : on les sert depuis notre serveur avec le token de la session.
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams.get("u");
  let target: URL;
  try {
    target = new URL(u ?? "");
  } catch {
    return new Response("Bad url", { status: 400 });
  }
  if (target.protocol !== "https:" || target.hostname !== "cdn.intra.42.fr" || !target.pathname.startsWith("/users/")) {
    return new Response("Forbidden", { status: 403 });
  }

  const session = await getSession();
  if (!session.accessToken) return new Response("Unauthorized", { status: 401 });

  const res = await fetch(target, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.startsWith("image/")) {
    return new Response(null, { status: res.ok ? 502 : res.status });
  }

  return new Response(res.body, {
    headers: {
      "Content-Type": type,
      // l'URL contient un hash propre à chaque version de la photo
      "Cache-Control": "private, max-age=604800, immutable",
    },
  });
}
