import { ftFetch, TTL } from "@/lib/ft-api";

type Row = {
  level: number;
  user: { id: number; pool_year?: string | null };
};

type Props = {
  accessToken: string;
  userId: number;
  cursusId: number;
  poolYear: string;
};

function poolYearDateRange(poolYear: string): { from: string; to: string } {
  const y = parseInt(poolYear, 10);
  return { from: `${y}-06-01`, to: `${y + 1}-08-31` };
}

const PAGE_SIZE = 100;

// Rang mondial exact : on parcourt le classement (tous campus) trié par niveau,
// filtré sur la promo, et on compte combien de personnes sont classées avant
// toi jusqu'à te trouver. Mêmes pages que le classement global → cache partagé.
export default async function GlobalRank({
  accessToken,
  userId,
  cursusId,
  poolYear,
}: Props) {
  try {
    const { from, to } = poolYearDateRange(poolYear);
    let before = 0;
    let rank: number | null = null;

    for (let page = 1; page <= 20; page++) {
      const path =
        `/v2/cursus_users` +
        `?filter[cursus_id]=${cursusId}` +
        `&range[begin_at]=${from},${to}` +
        `&sort=-level` +
        `&page[size]=${PAGE_SIZE}&page[number]=${page}`;
      const batch = await ftFetch<Row[]>(path, accessToken, { ttl: TTL.ranking });

      for (const cu of batch) {
        if (cu.user.pool_year !== poolYear) continue;
        if (cu.user.id === userId) {
          rank = before + 1;
          break;
        }
        before++;
      }
      if (rank !== null || batch.length < PAGE_SIZE) break;
    }

    if (rank === null) return null;

    return (
      <div className="global-rank">
        <span className="global-rank-num">#{rank.toLocaleString("fr-FR")}</span>
        <span className="global-rank-lbl">Rang mondial · Piscine {poolYear}</span>
      </div>
    );
  } catch {
    // Widget annexe : rien en cas d'erreur (token expiré géré ailleurs).
    return null;
  }
}
