import { getSession } from "@/lib/session";
import { ftFetch, TTL, xpToLevel, TokenExpiredError } from "@/lib/ft-api";
import type { LevelPoint } from "@/lib/ft-api";
import { loadCursusXP, saveCursusXP } from "@/lib/cursus-xp-disk-cache";

const CURSUS_ID = 21;

type ProjectRow = {
  "validated?": boolean | null;
  marked_at: string | null;
  final_mark: number | null;
  xp?: number;
  experience_points?: number;
  cursus_ids: number[];
  project: { id: number };
};

async function fetchProjects(userId: number, token: string): Promise<ProjectRow[]> {
  const all: ProjectRow[] = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await ftFetch<ProjectRow[]>(
      `/v2/users/${userId}/projects_users?page[size]=100&page[number]=${page}`,
      token,
      { ttl: TTL.projects },
    );
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

async function getCursusXpMap(token: string): Promise<Map<number, number>> {
  const disk = loadCursusXP(CURSUS_ID);
  if (disk) return disk;

  const map = new Map<number, number>();
  try {
    for (let page = 1; page <= 5; page++) {
      const batch = await ftFetch<
        Array<{
          id: number;
          difficulty?: number;
          project_sessions?: Array<{ maximum_xp?: number; is_primary?: boolean }>;
        }>
      >(
        `/v2/cursus/${CURSUS_ID}/projects?page[size]=100&page[number]=${page}`,
        token,
        { ttl: TTL.longLived },
      );
      for (const proj of batch) {
        const session =
          proj.project_sessions?.find((s) => s.is_primary) ??
          proj.project_sessions?.[0];
        const xp = session?.maximum_xp ?? proj.difficulty ?? null;
        if (xp != null && xp > 0) map.set(proj.id, xp);
      }
      if (batch.length < 100) break;
    }
  } catch {
    // silent — fall back to per-project xp fields
  }
  if (map.size > 0) saveCursusXP(CURSUS_ID, map);
  return map;
}

function toProgressionPoints(
  projects: ProjectRow[],
  xpMap: Map<number, number>,
): LevelPoint[] {
  const validated = projects
    .filter(
      (p) =>
        p["validated?"] === true &&
        p.marked_at !== null &&
        p.cursus_ids.includes(CURSUS_ID),
    )
    .sort(
      (a, b) =>
        new Date(a.marked_at!).getTime() - new Date(b.marked_at!).getTime(),
    );

  let cumXp = 0;
  const points: LevelPoint[] = [];
  for (const p of validated) {
    const baseXP = xpMap.get(p.project.id) ?? 0;
    let xp = 0;
    if (baseXP > 0 && p.final_mark != null) {
      xp = Math.round((baseXP * Math.min(p.final_mark, 125)) / 100);
    } else {
      xp = p.xp ?? p.experience_points ?? 0;
    }
    if (xp > 0) {
      cumXp += xp;
      points.push({
        date: p.marked_at!,
        level: parseFloat(xpToLevel(cumXp).toFixed(4)),
      });
    }
  }
  return points;
}

export async function GET(
  _req: Request,
  { params }: { params: { userId: string } },
) {
  const session = await getSession();
  if (!session.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = parseInt(params.userId, 10);
  if (isNaN(userId)) return new Response("Bad Request", { status: 400 });

  const token = session.accessToken;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        send({ type: "total", pages: 1 });
        const [projects, xpMap] = await Promise.all([
          fetchProjects(userId, token),
          getCursusXpMap(token),
        ]);
        const points = toProgressionPoints(projects, xpMap);
        send({ type: "progress", done: 1, total: 1 });
        send({ type: "data", points });
      } catch (e) {
        if (e instanceof TokenExpiredError) {
          send({ type: "error", message: "token_expired" });
        } else {
          send({
            type: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
