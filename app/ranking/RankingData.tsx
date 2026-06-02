import Link from "next/link";
import { redirect } from "next/navigation";
import { ftFetch, TTL, TokenExpiredError } from "@/lib/ft-api";
import ClickableAvatar from "./ClickableAvatar";
import ProfileLink from "../ProfileLink";

const PAGE_SIZE = 100;

type CursusUserRow = {
  id: number;
  level: number;
  grade: string | null;
  blackholed_at: string | null;
  begin_at: string;
  user: {
    id: number;
    login: string;
    displayname: string;
    usual_full_name?: string;
    pool_year?: string | null;
    image?: {
      link?: string;
      versions?: { large?: string; medium?: string; small?: string };
    };
    location: string | null;
    correction_point: number;
    wallet: number;
    "staff?"?: boolean;
  };
};

function poolYearDateRange(poolYear: string): { from: string; to: string } {
  const y = parseInt(poolYear, 10);
  return { from: `${y}-06-01`, to: `${y + 1}-08-31` };
}

async function fetchRankingPage(
  campusId: number | null,
  poolYear: string,
  cursusId: number,
  pageNum: number,
  token: string,
): Promise<CursusUserRow[]> {
  const { from, to } = poolYearDateRange(poolYear);
  const path =
    `/v2/cursus_users` +
    `?filter[cursus_id]=${cursusId}` +
    (campusId !== null ? `&filter[campus_id]=${campusId}` : "") +
    `&range[begin_at]=${from},${to}` +
    `&sort=-level` +
    `&page[size]=${PAGE_SIZE}&page[number]=${pageNum}`;
  const batch = await ftFetch<CursusUserRow[]>(path, token, {
    ttl: TTL.ranking,
  });
  return batch.filter((cu) => cu.user.pool_year === poolYear);
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function blackholeInfo(
  cu: CursusUserRow,
): { label: string; cls: string } | null {
  const days = daysUntil(cu.blackholed_at);
  if (days === null) return null;
  if (days <= 0) return { label: "absorbe", cls: "danger" };
  return { label: "actif", cls: "good" };
}
function pickAvatar(cu: CursusUserRow) {
  return cu.user.image?.versions?.medium ?? cu.user.image?.link ?? null;
}
function pickAvatarLarge(cu: CursusUserRow) {
  return (
    cu.user.image?.versions?.large ??
    cu.user.image?.link ??
    cu.user.image?.versions?.medium ??
    null
  );
}
function fullName(cu: CursusUserRow) {
  return cu.user.usual_full_name ?? cu.user.displayname ?? cu.user.login;
}

function PodiumSpot({
  cu,
  place,
  isMe,
  compareHref,
}: {
  cu: CursusUserRow;
  place: 1 | 2 | 3;
  isMe: boolean;
  compareHref: string;
}) {
  const tier = place === 1 ? "gold" : place === 2 ? "silver" : "bronze";
  const lvlInt = Math.floor(cu.level);
  const lvlPct = Math.round((cu.level - lvlInt) * 100);
  return (
    <div className={`podium-spot place-${place} ${isMe ? "me" : ""}`}>
      <div className={`podium-medal ${tier}`}>{place}</div>
      <ClickableAvatar
        src={pickAvatar(cu)}
        large={pickAvatarLarge(cu)}
        alt={cu.user.login}
        login={cu.user.login}
        fullName={fullName(cu)}
        className={`podium-avatar tier-${tier}`}
      />
      <div className="podium-login">
        <ProfileLink login={cu.user.login} />
      </div>
      <div className="podium-level">
        lvl <strong>{lvlInt}</strong>
        <span className="podium-pct">.{String(lvlPct).padStart(2, "0")}</span>
      </div>
      <div className={`podium-step ${tier}`}>
        {isMe ? (
          <span className="podium-me-pill">TOI</span>
        ) : (
          <Link href={compareHref} className="podium-cmp">
            Comparer
          </Link>
        )}
      </div>
    </div>
  );
}

type Props = {
  accessToken: string;
  login: string;
  campusId: number | null;
  poolYear: string;
  cursusId: number;
  page: number;
};

export default async function RankingData({
  accessToken,
  login,
  campusId,
  poolYear,
  cursusId,
  page,
}: Props) {
  const currentPage = Math.max(1, page);
  let rows: CursusUserRow[] = [];
  let rawCount = 0;
  let error: string | null = null;
  let tokenExpired = false;
  try {
    const batch = await fetchRankingPage(
      campusId,
      poolYear,
      cursusId,
      currentPage,
      accessToken,
    );
    rows = batch;
    rawCount = batch.length;
  } catch (e) {
    if (e instanceof TokenExpiredError) tokenExpired = true;
    else error = e instanceof Error ? e.message : String(e);
  }
  if (tokenExpired) redirect("/api/auth/logout");

  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const hasNext = rawCount === PAGE_SIZE;

  const showPodium = currentPage === 1 && rows.length >= 3;
  const top3 = showPodium ? rows.slice(0, 3) : [];
  const rest = showPodium ? rows.slice(3) : rows;

  const myIdx = rows.findIndex((r) => r.user.login === login);
  const myRankOnPage = myIdx >= 0 ? startIdx + myIdx + 1 : null;
  const avgLevel =
    rows.length > 0 ? rows.reduce((s, r) => s + r.level, 0) / rows.length : 0;

  const campusParam = campusId === null ? "all" : String(campusId);

  const buildPageHref = (p: number) => {
    const params = new URLSearchParams();
    params.set("campus", campusParam);
    params.set("pool", poolYear);
    if (p > 1) params.set("page", String(p));
    return `/ranking?${params.toString()}`;
  };

  const buildCompareHref = (otherLogin: string) => {
    const params = new URLSearchParams();
    params.set("campus", campusParam);
    params.set("pool", poolYear);
    if (currentPage > 1) params.set("page", String(currentPage));
    return `/compare/${encodeURIComponent(otherLogin)}?${params.toString()}`;
  };

  return (
    <>
      <div className="hero-stats">
        {myRankOnPage && (
          <div className="stat">
            <div className="stat-value">#{myRankOnPage}</div>
            <div className="stat-label">Ta position</div>
          </div>
        )}
        <div className="stat">
          <div className="stat-value">{avgLevel.toFixed(2)}</div>
          <div className="stat-label">Moyenne page</div>
        </div>
        <div className="stat">
          <div className="stat-value">{rows.length}</div>
          <div className="stat-label">Sur cette page</div>
        </div>
      </div>

      {error && <pre className="err">{error}</pre>}
      {!error && rows.length === 0 && (
        <p className="muted">Aucun resultat.</p>
      )}

      {showPodium && (
        <section className="podium">
          <PodiumSpot
            cu={top3[1]}
            place={2}
            isMe={top3[1].user.login === login}
            compareHref={buildCompareHref(top3[1].user.login)}
          />
          <PodiumSpot
            cu={top3[0]}
            place={1}
            isMe={top3[0].user.login === login}
            compareHref={buildCompareHref(top3[0].user.login)}
          />
          <PodiumSpot
            cu={top3[2]}
            place={3}
            isMe={top3[2].user.login === login}
            compareHref={buildCompareHref(top3[2].user.login)}
          />
        </section>
      )}

      {rest.length > 0 && (
        <>
          <h2 className="section-title">
            {currentPage === 1
              ? "Suite du classement"
              : `Rangs ${4 + startIdx} - ${3 + startIdx + rest.length}`}
          </h2>
          <section className="grid">
            {rest.map((cu, i) => {
              const rank = startIdx + 4 + i;
              const isMe = cu.user.login === login;
              const lvlInt = Math.floor(cu.level);
              const lvlPct = Math.round((cu.level - lvlInt) * 100);
              const bh = blackholeInfo(cu);

              return (
                <article key={cu.id} className={`card ${isMe ? "me" : ""}`}>
                  <div className="rank-badge">#{rank}</div>
                  {isMe && <div className="me-pill">TOI</div>}

                  <div className="card-avatar-wrap">
                    <ClickableAvatar
                      src={pickAvatar(cu)}
                      large={pickAvatarLarge(cu)}
                      alt={cu.user.login}
                      login={cu.user.login}
                      fullName={fullName(cu)}
                      className="avatar avatar-lg"
                    />
                  </div>

                  <div className="card-head">
                    <div className="login">
                      <ProfileLink login={cu.user.login} />
                    </div>
                    <div className="fullname">{fullName(cu)}</div>
                  </div>

                  <div className="level-block">
                    <div className="level-line">
                      <span className="level-num">
                        lvl <strong>{lvlInt}</strong>
                      </span>
                      <span className="level-pct">{lvlPct}%</span>
                    </div>
                    <div className="progress">
                      <div
                        className="progress-fill"
                        style={{ width: `${lvlPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="meta">
                    <div className="meta-item">
                      <span className="k">Eval pts</span>
                      <span className="v">{cu.user.correction_point}</span>
                    </div>
                    <div className="meta-item">
                      <span className="k">Wallet</span>
                      <span className="v">{cu.user.wallet}</span>
                    </div>
                    <div className="meta-item">
                      <span className="k">Status</span>
                      <span className="v">
                        {cu.user.location ? (
                          <span className="dot-online">
                            <span className="dot" /> {cu.user.location}
                          </span>
                        ) : (
                          <span className="muted">offline</span>
                        )}
                      </span>
                    </div>
                    {bh && (
                      <div className="meta-item">
                        <span className="k">Cursus</span>
                        <span className={`v ${bh.cls}`}>{bh.label}</span>
                      </div>
                    )}
                  </div>

                  {!isMe && (
                    <Link
                      href={buildCompareHref(cu.user.login)}
                      className="cmp-btn"
                    >
                      Comparer →
                    </Link>
                  )}
                </article>
              );
            })}
          </section>
        </>
      )}

      {(currentPage > 1 || hasNext) && (
        <nav className="pagination">
          {currentPage > 1 ? (
            <Link href={buildPageHref(currentPage - 1)} className="page-btn">
              ← Precedent
            </Link>
          ) : (
            <span className="page-btn disabled">← Precedent</span>
          )}

          <span className="page-info">Page {currentPage}</span>

          {hasNext ? (
            <Link href={buildPageHref(currentPage + 1)} className="page-btn">
              Suivant →
            </Link>
          ) : (
            <span className="page-btn disabled">Suivant →</span>
          )}
        </nav>
      )}
    </>
  );
}
