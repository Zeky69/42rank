import { ftFetch, Priority, TTL } from "@/lib/ft-api";

const PAGE_SIZE = 100;
const MAX_PAGES = 25; // garde-fou : 2500 étudiants max scannés pour les stats
const BUCKET = 2; // largeur d'un barreau d'histogramme, en niveaux

type Row = {
  level: number;
  user: { login: string; pool_year?: string | null };
};

function poolYearDateRange(poolYear: string): { from: string; to: string } {
  const y = parseInt(poolYear, 10);
  return { from: `${y}-06-01`, to: `${y + 1}-08-31` };
}

// Récupère toute la promo (toutes les pages) pour le campus + l'année donnés.
// Les pages partagent le cache du classement (TTL.ranking), donc la navigation
// page par page réchauffe déjà ce que ce composant relit.
async function fetchPromo(
  campusId: number | null,
  poolYear: string,
  cursusId: number,
  token: string,
): Promise<{ login: string; level: number }[]> {
  const { from, to } = poolYearDateRange(poolYear);
  const out: { login: string; level: number }[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const path =
      `/v2/cursus_users` +
      `?filter[cursus_id]=${cursusId}` +
      (campusId !== null ? `&filter[campus_id]=${campusId}` : "") +
      `&range[begin_at]=${from},${to}` +
      `&sort=-level` +
      `&page[size]=${PAGE_SIZE}&page[number]=${page}`;
    // Priorité basse : widget secondaire, ne doit pas retarder le classement principal.
    const batch = await ftFetch<Row[]>(path, token, {
      ttl: TTL.ranking,
      priority: Priority.low,
    });
    for (const r of batch) {
      if (r.user.pool_year === poolYear) {
        out.push({ login: r.user.login, level: r.level });
      }
    }
    if (batch.length < PAGE_SIZE) break;
  }
  return out;
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

type Props = {
  accessToken: string;
  login: string;
  campusId: number | null;
  poolYear: string;
  cursusId: number;
};

export default async function PromoStats({
  accessToken,
  login,
  campusId,
  poolYear,
  cursusId,
}: Props) {
  let promo: { login: string; level: number }[];
  try {
    promo = await fetchPromo(campusId, poolYear, cursusId, accessToken);
  } catch {
    return null; // non bloquant : si l'API échoue, on n'affiche rien
  }
  if (promo.length < 3) return null;

  const asc = promo.map((p) => p.level).sort((a, b) => a - b);
  const n = asc.length;
  const mean = asc.reduce((s, v) => s + v, 0) / n;
  const med = median(asc);
  const variance = asc.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);

  // Percentile de l'utilisateur : combien de gens sont au-dessus de lui dans
  // la promo → « top X% ». myLevel vient directement de la promo déjà chargée.
  const myLevel = promo.find((p) => p.login === login)?.level;
  const myPercentile =
    typeof myLevel === "number"
      ? Math.max(1, Math.ceil(((asc.filter((v) => v > myLevel).length + 1) / n) * 100))
      : null;

  // Histogramme : on regroupe par tranche de BUCKET niveaux.
  const maxLevel = asc[n - 1];
  const bucketCount = Math.max(1, Math.ceil((maxLevel + 0.001) / BUCKET));
  const buckets = new Array<number>(bucketCount).fill(0);
  for (const v of asc) {
    const idx = Math.min(bucketCount - 1, Math.floor(v / BUCKET));
    buckets[idx]++;
  }
  const bucketMax = Math.max(...buckets);

  return (
    <section className="promo-stats">
      <div className="promo-stats-row">
        <div className="stat">
          <div className="stat-value">{n}</div>
          <div className="stat-label">Promo entière</div>
        </div>
        <div className="stat">
          <div className="stat-value">{med.toFixed(2)}</div>
          <div className="stat-label">Niveau médian</div>
        </div>
        <div className="stat">
          <div className="stat-value">{mean.toFixed(2)}</div>
          <div className="stat-label">Niveau moyen</div>
        </div>
        <div className="stat">
          <div className="stat-value">±{stddev.toFixed(2)}</div>
          <div className="stat-label">Écart-type</div>
        </div>
        {myPercentile !== null && (
          <div className="stat stat-accent">
            <div className="stat-value">top {myPercentile}%</div>
            <div className="stat-label">Toi dans la promo</div>
          </div>
        )}
      </div>

      <div className="promo-hist">
        {buckets.map((count, i) => (
          <div
            key={i}
            className="promo-hist-col"
            title={`lvl ${i * BUCKET}–${(i + 1) * BUCKET} · ${count}`}
          >
            <div className="promo-hist-bar-wrap">
              <div
                className="promo-hist-bar"
                style={{ height: `${bucketMax ? (count / bucketMax) * 100 : 0}%` }}
              />
            </div>
            <span className="promo-hist-xlbl">{i * BUCKET}</span>
          </div>
        ))}
      </div>
      <p className="promo-hist-cap">Distribution des niveaux de la promo</p>
    </section>
  );
}
