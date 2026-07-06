import { ftFetch, Priority, TTL } from "@/lib/ft-api";

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
const MAX_PAGES = 20;
// Pages envoyées en parallèle par lot : le rate-limiter espace de toute façon
// chaque requête de RATE_LIMIT_MS, mais attendre la réponse d'une page avant
// de lancer la suivante empile en plus la latence réseau à chaque itération.
// En lançant un lot d'un coup, les réponses se chevauchent au lieu de s'additionner.
const BATCH_SIZE = 4;

function pathForPage(cursusId: number, from: string, to: string, page: number): string {
  return (
    `/v2/cursus_users` +
    `?filter[cursus_id]=${cursusId}` +
    `&range[begin_at]=${from},${to}` +
    `&sort=-level` +
    `&page[size]=${PAGE_SIZE}&page[number]=${page}`
  );
}

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
    let reachedEnd = false;

    for (
      let start = 1;
      start <= MAX_PAGES && rank === null && !reachedEnd;
      start += BATCH_SIZE
    ) {
      const pageNumbers = Array.from(
        { length: Math.min(BATCH_SIZE, MAX_PAGES - start + 1) },
        (_, i) => start + i,
      );
      // Priorité basse : widget secondaire, ne doit pas retarder le classement principal.
      const batches = await Promise.all(
        pageNumbers.map((p) =>
          ftFetch<Row[]>(pathForPage(cursusId, from, to, p), accessToken, {
            ttl: TTL.ranking,
            priority: Priority.low,
          }),
        ),
      );

      for (const batch of batches) {
        for (const cu of batch) {
          if (cu.user.pool_year !== poolYear) continue;
          if (cu.user.id === userId) {
            rank = before + 1;
            break;
          }
          before++;
        }
        if (batch.length < PAGE_SIZE) reachedEnd = true;
        if (rank !== null || reachedEnd) break;
      }
    }

    // On a atteint la vraie fin du classement sans jamais te trouver : cas
    // d'erreur (pas dans ce cursus/promo) plutôt que de rang très bas.
    if (rank === null && reachedEnd) return null;

    return (
      <div className="global-rank">
        <span className="global-rank-num">
          {rank !== null ? `#${rank.toLocaleString("fr-FR")}` : `#${(MAX_PAGES * PAGE_SIZE).toLocaleString("fr-FR")}+`}
        </span>
        <span className="global-rank-lbl">Rang mondial · Piscine {poolYear}</span>
      </div>
    );
  } catch {
    // Widget annexe : rien en cas d'erreur (token expiré géré ailleurs).
    return null;
  }
}
