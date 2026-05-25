import { getSession } from "@/lib/session";
import { ftFetch, TTL, xpToLevel, TokenExpiredError } from "@/lib/ft-api";
import type { LevelPoint } from "@/lib/ft-api";

const CURSUS_ID = 21;

type ProjectRow = {
  "validated?": boolean | null;
  marked_at: string | null;
  xp?: number;
  experience_points?: number;
  cursus_ids: number[];
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

function toProgressionPoints(projects: ProjectRow[]): LevelPoint[] {
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
    const xp = p.xp ?? p.experience_points ?? 0;
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
        const projects = await fetchProjects(userId, token);
        const points = toProgressionPoints(projects);
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
