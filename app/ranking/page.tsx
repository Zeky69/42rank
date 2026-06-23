import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ftFetch, TTL, TokenExpiredError } from "@/lib/ft-api";
import { recordActivity } from "@/lib/stats";
import RankingData from "./RankingData";
import RankingSkeleton from "./RankingSkeleton";
import Filters from "./Filters";
import GlobalRank from "./GlobalRank";
import PromoStats from "./PromoStats";

export const dynamic = "force-dynamic";

type Campus = { id: number; name: string; country?: string };
type Cursus = { id: number; name: string };

async function fetchAllCampuses(token: string): Promise<Campus[]> {
  const all: Campus[] = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await ftFetch<Campus[]>(
      `/v2/campus?page[size]=100&page[number]=${page}&sort=name`,
      token,
      { ttl: TTL.longLived },
    );
    all.push(
      ...batch.map((c) => ({ id: c.id, name: c.name, country: c.country })),
    );
    if (batch.length < 100) break;
  }
  return all;
}

async function fetchAllCursus(token: string): Promise<Cursus[]> {
  const all: Cursus[] = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await ftFetch<Cursus[]>(
      `/v2/cursus?page[size]=100&page[number]=${page}&sort=name`,
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
  searchParams: { campus?: string; pool?: string; cursus?: string; page?: string };
}) {
  const session = await getSession();
  if (!session.accessToken) redirect("/");

  const { accessToken, login, userId, campusId, campusName, poolYear, cursusId } =
    session;
  if (userId) void recordActivity(userId, campusName);

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

  const isGlobal = searchParams.campus === "all";
  const selectedCampusId = isGlobal
    ? null
    : searchParams.campus
      ? parseInt(searchParams.campus, 10)
      : campusId;
  const selectedPoolYear = searchParams.pool ?? poolYear;
  const selectedCursusId = searchParams.cursus
    ? parseInt(searchParams.cursus, 10) || cursusId
    : cursusId;
  const selectedPage = Math.max(
    1,
    searchParams.page ? parseInt(searchParams.page, 10) || 1 : 1,
  );

  let campuses: Campus[] = [];
  let cursuses: Cursus[] = [];
  try {
    [campuses, cursuses] = await Promise.all([
      fetchAllCampuses(accessToken!),
      fetchAllCursus(accessToken!),
    ]);
  } catch (e) {
    if (e instanceof TokenExpiredError) redirect("/api/auth/logout");
    throw e;
  }
  const poolYears = buildPoolYears();
  const selectedCursusName =
    cursuses.find((c) => c.id === selectedCursusId)?.name ??
    `Cursus ${selectedCursusId}`;
  const selectedCampusName = isGlobal
    ? "Tous les campus"
    : (campuses.find((c) => c.id === selectedCampusId)?.name ??
      (selectedCampusId === campusId
        ? (campusName ?? `Campus ${selectedCampusId}`)
        : `Campus ${selectedCampusId}`));

  const dataKey = `${isGlobal ? "all" : selectedCampusId}-${selectedCursusId}-${selectedPoolYear}-${selectedPage}`;

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
          <h1>{isGlobal ? "Classement global" : "Classement"}</h1>
          <p className="sub">
            {selectedCursusName} · {selectedCampusName} · Piscine{" "}
            {selectedPoolYear}
          </p>
        </div>
        <Suspense
          fallback={
            <div className="global-rank loading">
              <span className="global-rank-num">#…</span>
              <span className="global-rank-lbl">Rang mondial</span>
            </div>
          }
        >
          <GlobalRank
            accessToken={accessToken!}
            userId={userId!}
            cursusId={selectedCursusId}
            poolYear={selectedPoolYear}
          />
        </Suspense>
      </header>

      <Filters
        campuses={campuses}
        cursuses={cursuses}
        poolYears={poolYears}
        currentCampus={isGlobal ? "all" : String(selectedCampusId)}
        currentCursus={String(selectedCursusId)}
        currentPoolYear={selectedPoolYear}
        myCampusId={campusId}
      />

      <Suspense
        key={`promo-${isGlobal ? "all" : selectedCampusId}-${selectedCursusId}-${selectedPoolYear}`}
        fallback={null}
      >
        <PromoStats
          accessToken={accessToken!}
          login={login!}
          campusId={selectedCampusId}
          poolYear={selectedPoolYear}
          cursusId={selectedCursusId}
        />
      </Suspense>

      <Suspense key={dataKey} fallback={<RankingSkeleton />}>
        <RankingData
          accessToken={accessToken!}
          login={login!}
          campusId={selectedCampusId}
          poolYear={selectedPoolYear}
          cursusId={selectedCursusId}
          page={selectedPage}
        />
      </Suspense>
    </main>
  );
}
