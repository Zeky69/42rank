import { ftFetch, TTL } from "@/lib/ft-api";
import ClickableAvatar from "../../ranking/ClickableAvatar";

type ProjectsUser = {
  id: number;
  occurrence: number;
  final_mark: number | null;
  status: string;
  "validated?": boolean | null;
  cursus_ids: number[];
  marked_at: string | null;
  project: {
    id: number;
    name: string;
    slug: string;
    parent_id: number | null;
  };
};

type ApiUser = {
  id: number;
  login: string;
  displayname: string;
  usual_full_name?: string;
  image?: { link?: string; versions?: { medium?: string; large?: string } };
  cursus_users?: { cursus_id: number; level: number }[];
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
    const batch = await ftFetch<ProjectsUser[]>(path, token, {
      ttl: TTL.projects,
    });
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all.filter((p) => p.cursus_ids.includes(cursusId));
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

  try {
    [me, them] = await Promise.all([
      ftFetch<ApiUser>(`/v2/me`, accessToken, { ttl: TTL.ranking }),
      ftFetch<ApiUser>(
        `/v2/users/${encodeURIComponent(theirLogin)}`,
        accessToken,
        { ttl: TTL.ranking },
      ),
    ]);
    [myProjects, theirProjects] = await Promise.all([
      fetchAllProjects(myUserId, cursusId, accessToken),
      fetchAllProjects(them.id, cursusId, accessToken),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

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

  type Both = {
    projectId: number;
    name: string;
    myMark: number | null;
    theirMark: number | null;
    diff: number;
  };
  const toDo: ProjectsUser[] = [];
  const toRetry: Both[] = [];
  const youAhead: Both[] = [];
  const onlyYou: ProjectsUser[] = [];

  for (const tp of theirValidated) {
    const mp = myById.get(tp.project.id);
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
        diff: their - my,
      };
      if (their > my) toRetry.push(row);
      else if (my > their) youAhead.push(row);
    }
  }
  for (const mp of myValidated) {
    if (!theirById.has(mp.project.id)) onlyYou.push(mp);
  }

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
          <div className="vs2-login">{me.login}</div>
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
          <div className="vs2-login">{them.login}</div>
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

      {toDo.length + toRetry.length > 0 && (
        <section className="plan">
          <div className="plan-header">
            <h2 className="plan-title">Plan d'action</h2>
            <p className="plan-sub">
              Voici comment tu peux rattraper {them.login}.
            </p>
          </div>

          {toDo.length > 0 && (
            <div className="plan-block">
              <div className="plan-block-head">
                <span className="plan-tag todo">A RENDRE</span>
                <span className="plan-count">{toDo.length} projets</span>
              </div>
              <div className="prj-cards">
                {toDo.map((p) => (
                  <div key={p.id} className="prj-card">
                    <div className="prj-card-name">{p.project.name}</div>
                    <div className="prj-card-action">
                      <span className="prj-card-hint">son score</span>
                      <MarkChip mark={p.final_mark} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {toRetry.length > 0 && (
            <div className="plan-block">
              <div className="plan-block-head">
                <span className="plan-tag retry">A RETRY</span>
                <span className="plan-count">{toRetry.length} projets</span>
              </div>
              <div className="prj-cards">
                {toRetry.map((p) => (
                  <div key={p.projectId} className="prj-card">
                    <div className="prj-card-name">{p.name}</div>
                    <div className="prj-card-marks">
                      <MarkChip mark={p.myMark} />
                      <span className="prj-arrow">→</span>
                      <MarkChip mark={p.theirMark} />
                      <span className="prj-delta">+{p.diff}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
