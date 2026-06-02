import { redirect } from "next/navigation";
import { ftFetch, TTL, TokenExpiredError } from "@/lib/ft-api";
import { loadCursusXP, saveCursusXP } from "@/lib/cursus-xp-disk-cache";
import ClickableAvatar from "../../ranking/ClickableAvatar";
import ProfileLink from "../../ProfileLink";

type ProjectsUser = {
  id: number;
  occurrence: number;
  final_mark: number | null;
  status: string;
  "validated?": boolean | null;
  cursus_ids: number[];
  marked_at: string | null;
  xp?: number;
  experience_points?: number;
  project: {
    id: number;
    name: string;
    slug: string;
    parent_id: number | null;
  };
};

function projectXP(p: ProjectsUser): number | null {
  const v = p.xp ?? p.experience_points ?? null;
  return v !== null && v > 0 ? v : null;
}

type ApiUser = {
  id: number;
  login: string;
  displayname: string;
  usual_full_name?: string;
  image?: { link?: string; versions?: { medium?: string; large?: string } };
  cursus_users?: { cursus_id: number; level: number; experience_points?: number }[];
  correction_point: number;
  wallet: number;
};

async function fetchAllProjects(
  userId: number,
  cursusId: number,
  token: string,
): Promise<ProjectsUser[]> {
  const all: ProjectsUser[] = [];
  for (let page = 1; page <= 10; page++) {
    const path = `/v2/users/${userId}/projects_users?page[size]=100&page[number]=${page}`;
    const batch = await ftFetch<ProjectsUser[]>(path, token, { ttl: TTL.projects });
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all.filter((p) => p.cursus_ids.includes(cursusId));
}


async function fetchAllCursusProjectXP(
  cursusId: number,
  token: string,
): Promise<Map<number, number>> {
  const disk = loadCursusXP(cursusId);
  if (disk) return disk;

  const map = new Map<number, number>();
  try {
    for (let page = 1; page <= 5; page++) {
      const batch = await ftFetch<
        Array<{
          id: number;
          difficulty?: number;
          project_sessions?: Array<{ maximum_xp?: number; is_primary?: boolean }>;
        }>
      >(
        `/v2/cursus/${cursusId}/projects?page[size]=100&page[number]=${page}`,
        token,
        { ttl: TTL.longLived },
      );
      for (const proj of batch) {
        const session =
          proj.project_sessions?.find((s) => s.is_primary) ?? proj.project_sessions?.[0];
        const xp = session?.maximum_xp ?? proj.difficulty ?? null;
        if (xp != null && xp > 0) map.set(proj.id, xp);
      }
      if (batch.length < 100) break;
    }
  } catch {
    // silent fail — caller falls back to per-project fetches
  }

  if (map.size > 0) saveCursusXP(cursusId, map);
  return map;
}

async function fetchProjectBaseXP(projectId: number, token: string): Promise<number | null> {
  try {
    const data = await ftFetch<{
      difficulty?: number;
      project_sessions?: Array<{ maximum_xp?: number; is_primary?: boolean }>;
    }>(`/v2/projects/${projectId}`, token, { ttl: TTL.longLived });
    const session =
      data.project_sessions?.find((s) => s.is_primary) ?? data.project_sessions?.[0];
    return session?.maximum_xp ?? data.difficulty ?? null;
  } catch {
    return null;
  }
}

function fmtXP(xp: number): string {
  return xp.toLocaleString("fr-FR");
}

function markClass(mark: number | null): string {
  if (mark === null) return "mark-na";
  if (mark >= 125) return "mark-gold";
  if (mark >= 100) return "mark-perfect";
  if (mark >= 75) return "mark-good";
  if (mark >= 50) return "mark-ok";
  return "mark-bad";
}

function MarkChip({ mark }: { mark: number | null }) {
  return <span className={`mark-chip ${markClass(mark)}`}>{mark ?? "—"}</span>;
}

function fmtLevel(level: number) {
  const i = Math.floor(level);
  const p = Math.round((level - i) * 100);
  return { int: i, pct: String(p).padStart(2, "0") };
}

type Props = {
  accessToken: string;
  myUserId: number;
  cursusId: number;
  theirLogin: string;
};

export default async function CompareData({
  accessToken,
  myUserId,
  cursusId,
  theirLogin,
}: Props) {
  let error: string | null = null;
  let me: ApiUser | null = null;
  let them: ApiUser | null = null;
  let myProjects: ProjectsUser[] = [];
  let theirProjects: ProjectsUser[] = [];
  let allCursusXP = new Map<number, number>();

  let tokenExpired = false;
  try {
    [me, them] = await Promise.all([
      ftFetch<ApiUser>(`/v2/users/${myUserId}`, accessToken, { ttl: TTL.ranking }),
      ftFetch<ApiUser>(
        `/v2/users/${encodeURIComponent(theirLogin)}`,
        accessToken,
        { ttl: TTL.ranking },
      ),
    ]);
    [myProjects, theirProjects, allCursusXP] = await Promise.all([
      fetchAllProjects(myUserId, cursusId, accessToken),
      fetchAllProjects(them.id, cursusId, accessToken),
      fetchAllCursusProjectXP(cursusId, accessToken),
    ]);
  } catch (e) {
    if (e instanceof TokenExpiredError) tokenExpired = true;
    else error = e instanceof Error ? e.message : String(e);
  }
  if (tokenExpired) redirect("/api/auth/logout");

  const myLevel =
    me?.cursus_users?.find((c) => c.cursus_id === cursusId)?.level ?? 0;
  const theirLevel =
    them?.cursus_users?.find((c) => c.cursus_id === cursusId)?.level ?? 0;
  const levelDiff = theirLevel - myLevel;
  const youAheadOnLevel = levelDiff < 0;

  const myValidated = myProjects.filter((p) => p["validated?"] === true);
  const theirValidated = theirProjects.filter((p) => p["validated?"] === true);
  const myById = new Map(myValidated.map((p) => [p.project.id, p]));
  const theirById = new Map(theirValidated.map((p) => [p.project.id, p]));
  // Secondary indexes for matching exam variants (same name, different project.id per campus/session)
  const myBySlug = new Map(myValidated.map((p) => [p.project.slug, p]));
  const theirBySlug = new Map(theirValidated.map((p) => [p.project.slug, p]));
  // parent_id lookup: child project → map keyed by parent's ID
  const myByParentId = new Map(
    myValidated.filter((p) => p.project.parent_id != null).map((p) => [p.project.parent_id!, p]),
  );
  const theirByParentId = new Map(
    theirValidated.filter((p) => p.project.parent_id != null).map((p) => [p.project.parent_id!, p]),
  );

  const findMyMatch = (tp: ProjectsUser): ProjectsUser | undefined =>
    myById.get(tp.project.id) ??
    myBySlug.get(tp.project.slug) ??
    myByParentId.get(tp.project.id) ??
    (tp.project.parent_id != null ? myById.get(tp.project.parent_id) : undefined);

  const findTheirMatch = (mp: ProjectsUser): boolean =>
    theirById.has(mp.project.id) ||
    theirBySlug.has(mp.project.slug) ||
    theirByParentId.has(mp.project.id) ||
    (mp.project.parent_id != null ? theirById.has(mp.project.parent_id) : false);

  type Both = {
    projectId: number;
    name: string;
    myMark: number | null;
    theirMark: number | null;
    myXp: number | null;
    theirXp: number | null;
    diff: number;
    xpGain: number; // XP à gagner en améliorant ce projet
  };
  const toDo: ProjectsUser[] = [];
  const toRetry: Both[] = [];
  const youAhead: Both[] = [];
  const onlyYou: ProjectsUser[] = [];

  for (const tp of theirValidated) {
    const mp = findMyMatch(tp);
    if (!mp) {
      toDo.push(tp);
    } else {
      const my = mp.final_mark ?? 0;
      const their = tp.final_mark ?? 0;
      const row: Both = {
        projectId: tp.project.id,
        name: tp.project.name,
        myMark: mp.final_mark,
        theirMark: tp.final_mark,
        myXp: projectXP(mp),
        theirXp: projectXP(tp),
        diff: their - my,
        xpGain: (projectXP(tp) ?? 0) - (projectXP(mp) ?? 0),
      };
      if (their > my) toRetry.push(row);
      else if (my > their) youAhead.push(row);
    }
  }
  for (const mp of myValidated) {
    if (!findTheirMatch(mp)) onlyYou.push(mp);
  }

  // Build projectBaseXPMap from batch-fetched cursus XP; fallback for missing IDs
  const projectBaseXPMap = new Map<number, number>(allCursusXP);
  if (!error) {
    const missingIds = [
      ...new Set([
        ...toDo.map((p) => p.project.id),
        ...toRetry.map((p) => p.projectId),
      ]),
    ].filter((id) => !projectBaseXPMap.has(id));
    if (missingIds.length > 0) {
      const xps = await Promise.all(missingIds.map((id) => fetchProjectBaseXP(id, accessToken)));
      missingIds.forEach((id, i) => {
        if (xps[i] !== null) projectBaseXPMap.set(id, xps[i]!);
      });
    }
  }

  type PriorityItem =
    | { kind: "todo"; project: ProjectsUser; impact: number; baseXP: number | null }
    | { kind: "retry"; project: Both; impact: number; baseXP: number | null; calcXpGain: number | null };

  const prioritized: PriorityItem[] = [
    ...toDo.map((p) => {
      const baseXP = projectBaseXPMap.get(p.project.id) ?? null;
      const impact =
        projectXP(p) ??
        (baseXP != null ? Math.round(baseXP * Math.min(p.final_mark ?? 100, 125) / 100) : (p.final_mark ?? 0) * 15);
      return { kind: "todo" as const, project: p, impact, baseXP };
    }),
    ...toRetry.map((p) => {
      const baseXP = projectBaseXPMap.get(p.projectId) ?? null;
      const calcXpGain = baseXP != null ? Math.round(baseXP * p.diff / 100) : null;
      const impact =
        p.xpGain > 0 ? p.xpGain :
        calcXpGain != null && calcXpGain > 0 ? calcXpGain :
        p.diff * 10;
      return { kind: "retry" as const, project: p, impact, baseXP, calcXpGain };
    }),
  ].sort((a, b) => b.impact - a.impact);

  toDo.sort((a, b) => (b.final_mark ?? 0) - (a.final_mark ?? 0));
  toRetry.sort((a, b) => b.diff - a.diff);
  youAhead.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  onlyYou.sort((a, b) => (b.final_mark ?? 0) - (a.final_mark ?? 0));

  const myL = fmtLevel(myLevel);
  const theirL = fmtLevel(theirLevel);
  const projDiff = theirValidated.length - myValidated.length;


  if (error) {
    return <pre className="err">{error}</pre>;
  }
  if (!me || !them) {
    return <p className="muted">Donnees indisponibles.</p>;
  }

  return (
    <>
      <section className="vs2">
        <div className={`vs2-side ${youAheadOnLevel ? "ahead" : ""}`}>
          <ClickableAvatar
            src={me.image?.versions?.medium ?? me.image?.link ?? null}
            large={me.image?.versions?.large ?? me.image?.link ?? null}
            alt={me.login}
            login={me.login}
            fullName={me.usual_full_name ?? me.displayname}
            className="vs2-avatar"
          />
          <div className="vs2-tag">TOI</div>
          <div className="vs2-login">
            <ProfileLink login={me.login} />
          </div>
          <div className="vs2-lvl">
            <span className="vs2-lvl-num">{myL.int}</span>
            <span className="vs2-lvl-pct">.{myL.pct}</span>
          </div>
          <div className="vs2-bar">
            <div
              className="vs2-bar-fill me"
              style={{ width: `${parseInt(myL.pct, 10)}%` }}
            />
          </div>
        </div>

        <div className="vs2-center">
          <div className="vs2-badge">VS</div>
          <div
            className={`vs2-gap ${youAheadOnLevel ? "pos" : levelDiff === 0 ? "neu" : "neg"}`}
          >
            {levelDiff === 0
              ? "egalite"
              : youAheadOnLevel
                ? `+${Math.abs(levelDiff).toFixed(2)} lvl`
                : `-${levelDiff.toFixed(2)} lvl`}
          </div>
          <div className="vs2-gap-label">
            {youAheadOnLevel
              ? "tu es devant"
              : levelDiff === 0
                ? "ex aequo"
                : "ecart a combler"}
          </div>
        </div>

        <div
          className={`vs2-side ${!youAheadOnLevel && levelDiff !== 0 ? "ahead" : ""}`}
        >
          <ClickableAvatar
            src={them.image?.versions?.medium ?? them.image?.link ?? null}
            large={them.image?.versions?.large ?? them.image?.link ?? null}
            alt={them.login}
            login={them.login}
            fullName={them.usual_full_name ?? them.displayname}
            className="vs2-avatar"
          />
          <div className="vs2-tag them">RIVAL</div>
          <div className="vs2-login">
            <ProfileLink login={them.login} />
          </div>
          <div className="vs2-lvl">
            <span className="vs2-lvl-num">{theirL.int}</span>
            <span className="vs2-lvl-pct">.{theirL.pct}</span>
          </div>
          <div className="vs2-bar">
            <div
              className="vs2-bar-fill them"
              style={{ width: `${parseInt(theirL.pct, 10)}%` }}
            />
          </div>
        </div>
      </section>

      <section className="kpi-strip">
        <div className="kpi">
          <div className="kpi-val">{myValidated.length}</div>
          <div className="kpi-lbl">projets valides (toi)</div>
        </div>
        <div className="kpi">
          <div className="kpi-val">{theirValidated.length}</div>
          <div className="kpi-lbl">projets valides ({them.login})</div>
        </div>
        <div className={`kpi ${projDiff > 0 ? "warn" : "good"}`}>
          <div className="kpi-val">
            {projDiff > 0 ? `-${projDiff}` : `+${-projDiff}`}
          </div>
          <div className="kpi-lbl">ecart en projets</div>
        </div>
        <div className="kpi action">
          <div className="kpi-val">{toDo.length + toRetry.length}</div>
          <div className="kpi-lbl">actions pour rattraper</div>
        </div>
      </section>

      {prioritized.length > 0 && (
        <section className="plan">
          <div className="plan-header">
            <h2 className="plan-title">Plan d'action</h2>
            <p className="plan-sub">
              Classé par XP — commence par le #1 pour rattraper {them.login} le plus vite possible.
            </p>
          </div>

          <div className="prj-cards">
            {prioritized.map((item, i) => {
              const name = item.kind === "todo" ? item.project.project.name : item.project.name;
              const xpGainVal =
                item.kind === "todo"
                  ? item.baseXP != null
                    ? Math.round(item.baseXP * Math.min(item.project.final_mark ?? 100, 125) / 100)
                    : null
                  : item.baseXP != null
                    ? (item.calcXpGain ?? item.project.xpGain)
                    : item.project.xpGain > 0
                      ? item.project.xpGain
                      : null;
              return (
                <div
                  key={item.kind === "todo" ? item.project.id : item.project.projectId}
                  className="prj-card prj-card-priority"
                >
                  <div className="prj-priority-num">#{i + 1}</div>
                  <div className="prj-card-body">
                    <div className="prj-card-top">
                      <span className={`plan-tag ${item.kind === "todo" ? "todo" : "retry"}`}>
                        {item.kind === "todo" ? "À RENDRE" : "À RETRY"}
                      </span>
                    </div>
                    <div className="prj-card-name">{name}</div>
                    <div className="prj-data-row">
                      <span className="prj-marks-flow">
                        {item.kind === "todo" ? (
                          <>
                            <span className="prj-card-hint">{them.login}</span>
                            <MarkChip mark={item.project.final_mark} />
                          </>
                        ) : (
                          <>
                            <MarkChip mark={item.project.myMark} />
                            <span className="prj-arrow">→</span>
                            <MarkChip mark={item.project.theirMark} />
                            <span className="prj-delta">+{item.project.diff} pts</span>
                          </>
                        )}
                      </span>
                      {xpGainVal != null && (
                        <span className="prj-xp-badge">+{fmtXP(xpGainVal)} XP</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {(youAhead.length > 0 || onlyYou.length > 0) && (
        <section className="brag">
          <h2 className="brag-title">Ce que tu as en plus</h2>
          <div className="brag-cols">
            {youAhead.length > 0 && (
              <div className="brag-col">
                <div className="brag-head">
                  <span className="plan-tag win">TU DOMINES</span>
                  <span className="plan-count">{youAhead.length}</span>
                </div>
                <div className="brag-list">
                  {youAhead.map((p) => (
                    <div key={p.projectId} className="brag-row">
                      <span className="brag-name">{p.name}</span>
                      <span className="brag-marks">
                        <MarkChip mark={p.myMark} />
                        <span className="prj-delta pos">+{-p.diff}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {onlyYou.length > 0 && (
              <div className="brag-col">
                <div className="brag-head">
                  <span className="plan-tag solo">TOI SEUL</span>
                  <span className="plan-count">{onlyYou.length}</span>
                </div>
                <div className="brag-list">
                  {onlyYou.map((p) => (
                    <div key={p.id} className="brag-row">
                      <span className="brag-name">{p.project.name}</span>
                      <span className="brag-marks">
                        <MarkChip mark={p.final_mark} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {toDo.length === 0 && toRetry.length === 0 && (
        <section className="empty-state">
          <div className="empty-badge">🏆</div>
          <h2>Tu es au niveau ou devant {them.login}</h2>
          <p className="muted">Aucun projet a rattraper. Continue comme ca.</p>
        </section>
      )}
    </>
  );
}
