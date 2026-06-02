import { ftFetch, ftFetchTotal, TTL } from "@/lib/ft-api";

type ApiUser = {
  cursus_users?: { cursus_id: number; level: number }[];
};

type Props = {
  accessToken: string;
  userId: number;
  cursusId: number;
  poolYear: string;
  // Niveau connu via la session (évite une requête). Optionnel : fallback /v2/users.
  level?: number;
};

function poolYearDateRange(poolYear: string): { from: string; to: string } {
  const y = parseInt(poolYear, 10);
  return { from: `${y}-06-01`, to: `${y + 1}-08-31` };
}

export default async function GlobalRank({
  accessToken,
  userId,
  cursusId,
  poolYear,
  level,
}: Props) {
  let myLevel = level ?? 0;

  try {
    // Fallback si le niveau n'est pas en session (ancienne session) : 1 requête
    // mise en cache et partagée avec la page de comparaison.
    if (!myLevel) {
      const me = await ftFetch<ApiUser>(`/v2/users/${userId}`, accessToken, {
        ttl: TTL.ranking,
      });
      myLevel = me.cursus_users?.find((c) => c.cursus_id === cursusId)?.level ?? 0;
    }
    if (myLevel <= 0) return null;

    // X-Total des cursus_users de niveau >= au mien sur la promo = mon rang mondial.
    const { from, to } = poolYearDateRange(poolYear);
    const path =
      `/v2/cursus_users` +
      `?filter[cursus_id]=${cursusId}` +
      `&range[begin_at]=${from},${to}` +
      `&range[level]=${myLevel},100` +
      `&page[size]=1`;
    const rank = await ftFetchTotal(path, accessToken, { ttl: TTL.ranking });
    if (rank <= 0) return null;

    return (
      <div className="global-rank">
        <span className="global-rank-num">#{rank.toLocaleString("fr-FR")}</span>
        <span className="global-rank-lbl">Rang mondial · Piscine {poolYear}</span>
      </div>
    );
  } catch {
    // Widget annexe : on n'affiche rien en cas d'erreur (token expiré géré ailleurs).
    return null;
  }
}
