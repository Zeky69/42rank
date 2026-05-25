import { ftFetch, TTL, getXpCache, computeLevelPoints } from "@/lib/ft-api";
import ProgressionChart from "./ProgressionChart";

const CURSUS_ID = 21;

type ApiUser = { id: number };

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
  // Résolution de theirUserId via le cache ftFetch (cache hit si CompareData a déjà fetchée)
  const them = await ftFetch<ApiUser>(
    `/v2/users/${encodeURIComponent(theirLogin)}`,
    accessToken,
    { ttl: TTL.ranking },
  );
  const theirUserId = them.id;

  const myEvents = getXpCache(myUserId, CURSUS_ID);
  const theirEvents = getXpCache(theirUserId, CURSUS_ID);

  return (
    <ProgressionChart
      myLogin={myLogin}
      theirLogin={theirLogin}
      myUserId={myUserId}
      theirUserId={theirUserId}
      initialMyPoints={myEvents ? computeLevelPoints(myEvents) : null}
      initialTheirPoints={theirEvents ? computeLevelPoints(theirEvents) : null}
    />
  );
}
