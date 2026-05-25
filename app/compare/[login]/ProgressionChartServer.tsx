import { ftFetch, TTL, xpToLevel } from "@/lib/ft-api";
import type { LevelPoint } from "@/lib/ft-api";
import ProgressionChart from "./ProgressionChart";

const CURSUS_ID = 21;

type ApiUser = { id: number };

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

type Props = {
  accessToken: string;
  myUserId: number;
  myLogin: string;
  theirLogin: string;
};

export default async function ProgressionChartServer({
  accessToken,
  myUserId,
  myLogin,
  theirLogin,
}: Props) {
  const them = await ftFetch<ApiUser>(
    `/v2/users/${encodeURIComponent(theirLogin)}`,
    accessToken,
    { ttl: TTL.ranking },
  );

  const [myProjects, theirProjects] = await Promise.all([
    fetchProjects(myUserId, accessToken),
    fetchProjects(them.id, accessToken),
  ]);

  return (
    <ProgressionChart
      myLogin={myLogin}
      theirLogin={theirLogin}
      myUserId={myUserId}
      theirUserId={them.id}
      initialMyPoints={toProgressionPoints(myProjects)}
      initialTheirPoints={toProgressionPoints(theirProjects)}
    />
  );
}
