import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import CompareData from "./CompareData";
import CompareSkeleton from "./CompareSkeleton";
import ProgressionChartServer from "./ProgressionChartServer";
import ChartSkeleton from "./ChartSkeleton";

export const dynamic = "force-dynamic";

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: { login: string };
  searchParams: { campus?: string; pool?: string; page?: string };
}) {
  const session = await getSession();
  if (!session.accessToken) redirect("/");

  const { accessToken, login: myLogin, userId, cursusId } = session;
  const theirLogin = decodeURIComponent(params.login);

  const backParams = new URLSearchParams();
  if (searchParams.campus) backParams.set("campus", searchParams.campus);
  if (searchParams.pool) backParams.set("pool", searchParams.pool);
  if (searchParams.page) backParams.set("page", searchParams.page);
  const backHref = backParams.toString()
    ? `/ranking?${backParams.toString()}`
    : "/ranking";

  if (theirLogin === myLogin) {
    return (
      <main>
        <p>
          Tu ne peux pas te comparer avec toi-meme.{" "}
          <Link href={backHref}>Retour</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="wide compare-page">
      <div className="topbar">
        <Link href={backHref}>← Retour au classement</Link>
        <a href="/api/auth/logout">Se deconnecter</a>
      </div>

      <Suspense
        key={theirLogin}
        fallback={<CompareSkeleton theirLogin={theirLogin} />}
      >
        <CompareData
          accessToken={accessToken!}
          myUserId={userId!}
          cursusId={cursusId!}
          theirLogin={theirLogin}
        />
      </Suspense>

      <Suspense key={`chart-${theirLogin}`} fallback={<ChartSkeleton />}>
        <ProgressionChartServer
          accessToken={accessToken!}
          myUserId={userId!}
          myLogin={myLogin!}
          theirLogin={theirLogin}
        />
      </Suspense>
    </main>
  );
}
