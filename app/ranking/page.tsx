import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ftFetch, TTL, TokenExpiredError } from "@/lib/ft-api";
import { recordActivity } from "@/lib/stats";
import RankingData from "./RankingData";
import RankingSkeleton from "./RankingSkeleton";
import Filters from "./Filters";

export const dynamic = "force-dynamic";

type Campus = { id: number; name: string };

async function fetchAllCampuses(token: string): Promise<Campus[]> {
  const all: Campus[] = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await ftFetch<Campus[]>(
      `/v2/campus?page[size]=100&page[number]=${page}&sort=name`,
      token,
      { ttl: TTL.longLived },
    );
    all.push(...batch.map((c) => ({ id: c.id, name: c.name })));
    if (batch.length < 100) break;
  }
  return all;
}

function buildPoolYears(): string[] {
  const current = new Date().getFullYear();
  const years: string[] = [];
  for (let y = current; y >= 2017; y--) years.push(String(y));
  return years;
}

export default async function RankingPage({
  searchParams,
}: {
  searchParams: { campus?: string; pool?: string; page?: string };
}) {
  const session = await getSession();
  if (!session.accessToken) redirect("/");

  const { accessToken, login, userId, campusId, campusName, poolYear, cursusId } =
    session;
  if (userId) void recordActivity(userId);

  if (!campusId || !poolYear || !cursusId) {
    return (
      <main>
        <h1>Donnees manquantes</h1>
        <p>
          campus={String(campusId)} · pool_year={String(poolYear)} · cursus=
          {String(cursusId)}
        </p>
        <p>
          <a href="/api/auth/logout">Se deconnecter</a>
        </p>
      </main>
    );
  }

  const selectedCampusId = searchParams.campus
    ? parseInt(searchParams.campus, 10)
    : campusId;
  const selectedPoolYear = searchParams.pool ?? poolYear;
  const selectedPage = Math.max(
    1,
    searchParams.page ? parseInt(searchParams.page, 10) || 1 : 1,
  );

  let campuses: Campus[] = [];
  try {
    campuses = await fetchAllCampuses(accessToken!);
  } catch (e) {
    if (e instanceof TokenExpiredError) redirect("/api/auth/logout");
    throw e;
  }
  const poolYears = buildPoolYears();
  const selectedCampusName =
    campuses.find((c) => c.id === selectedCampusId)?.name ??
    (selectedCampusId === campusId
      ? (campusName ?? `Campus ${selectedCampusId}`)
      : `Campus ${selectedCampusId}`);

  const dataKey = `${selectedCampusId}-${selectedPoolYear}-${selectedPage}`;

  return (
    <main className="wide">
      <div className="topbar">
        <span>
          Connecte en tant que <strong>{login}</strong>
        </span>
        <a href="/api/auth/logout">Se deconnecter</a>
      </div>

      <header className="hero">
        <div>
          <h1>Classement</h1>
          <p className="sub">
            {selectedCampusName} · Piscine {selectedPoolYear}
          </p>
        </div>
      </header>

      <Filters
        campuses={campuses}
        poolYears={poolYears}
        currentCampusId={selectedCampusId}
        currentPoolYear={selectedPoolYear}
      />

      <Suspense key={dataKey} fallback={<RankingSkeleton />}>
        <RankingData
          accessToken={accessToken!}
          login={login!}
          campusId={selectedCampusId}
          poolYear={selectedPoolYear}
          cursusId={cursusId}
          page={selectedPage}
        />
      </Suspense>
    </main>
  );
}
