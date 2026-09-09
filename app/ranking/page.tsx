import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { recordActivity } from "@/lib/stats";
import RankingData from "./RankingData";
import RankingSkeleton from "./RankingSkeleton";
import FiltersSkeleton from "./FiltersSkeleton";
import FiltersAsync from "./FiltersAsync";
import GlobalRank from "./GlobalRank";
import PromoStats from "./PromoStats";
import HeroSubtitle from "./HeroSubtitle";

export const dynamic = "force-dynamic";

function buildPoolYears(): string[] {
  const current = new Date().getFullYear();
  const years: string[] = [];
  for (let y = current; y >= 2017; y--) years.push(String(y));
  return years;
}

export default async function RankingPage({
  searchParams,
}: {
  searchParams: {
    campus?: string;
    pool?: string;
    month?: string;
    cursus?: string;
    page?: string;
  };
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

  const poolYears = buildPoolYears();
  // Le menu "periode de piscine" n'est propose par Filters que pour un cursus
  // de piscine ; inutile de connaitre le nom du cursus ici pour ca, ce qui
  // evite de bloquer tout le rendu sur la liste complete des cursus.
  const selectedPoolMonth = searchParams.month ?? "all";

  const dataKey = `${isGlobal ? "all" : selectedCampusId}-${selectedCursusId}-${selectedPoolYear}-${selectedPoolMonth}-${selectedPage}`;

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
          <Suspense
            fallback={
              <p className="sub">
                Cursus {selectedCursusId} ·{" "}
                {isGlobal ? "Tous les campus" : `Campus ${selectedCampusId}`} · Piscine{" "}
                {selectedPoolYear}
              </p>
            }
          >
            <HeroSubtitle
              accessToken={accessToken!}
              isGlobal={isGlobal}
              selectedCampusId={selectedCampusId}
              selectedCursusId={selectedCursusId}
              selectedPoolYear={selectedPoolYear}
              selectedPoolMonth={selectedPoolMonth}
              myCampusId={campusId}
              myCampusName={campusName}
            />
          </Suspense>
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
            poolMonth={selectedPoolMonth}
          />
        </Suspense>
      </header>

      <Suspense
        key={`filters-${isGlobal ? "all" : selectedCampusId}`}
        fallback={<FiltersSkeleton showPoolMonth={selectedPoolMonth !== "all"} />}
      >
        <FiltersAsync
          accessToken={accessToken!}
          poolYears={poolYears}
          currentCampus={isGlobal ? "all" : String(selectedCampusId)}
          currentCursus={String(selectedCursusId)}
          currentPoolYear={selectedPoolYear}
          currentPoolMonth={selectedPoolMonth}
          myCampusId={campusId}
          selectedCampusId={selectedCampusId}
        />
      </Suspense>

      <Suspense
        key={`promo-${isGlobal ? "all" : selectedCampusId}-${selectedCursusId}-${selectedPoolYear}-${selectedPoolMonth}`}
        fallback={null}
      >
        <PromoStats
          accessToken={accessToken!}
          login={login!}
          campusId={selectedCampusId}
          poolYear={selectedPoolYear}
          poolMonth={selectedPoolMonth}
          cursusId={selectedCursusId}
        />
      </Suspense>

      <Suspense key={dataKey} fallback={<RankingSkeleton />}>
        <RankingData
          accessToken={accessToken!}
          login={login!}
          campusId={selectedCampusId}
          poolYear={selectedPoolYear}
          poolMonth={selectedPoolMonth}
          cursusId={selectedCursusId}
          page={selectedPage}
        />
      </Suspense>
    </main>
  );
}
