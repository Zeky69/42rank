import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getStats } from "@/lib/stats";

const MOCK_USERS = [
  { login: "lparent",  level: "21.68", initial: "L", color: "#92400e" },
  { login: "fayache",  level: "18.34", initial: "F", color: "#1e3a5f" },
  { login: "zekak",    level: "16.91", initial: "Z", color: "#3b1f6e" },
  { login: "mbouabid", level: "14.22", initial: "M", color: "#1a3a2a" },
  { login: "achahbar", level: "12.55", initial: "A", color: "#2a1a1a" },
];


const FEATURES = [
  {
    icon: "🏆",
    title: "Classement live",
    desc: "Vois ton rang parmi ta promo, filtré par campus et année de piscine. Podium animé pour le top 3, actualisé toutes les 5 minutes.",
    tags: ["Par campus", "Par promo", "Top 3 podium"],
  },
  {
    icon: "⚔️",
    title: "Duel projet par projet",
    desc: "Compare ta progression avec n'importe quel étudiant. Un plan d'action automatique liste tes projets à rattraper et tes points forts.",
    tags: ["100+ projets", "Plan d'action", "Points forts"],
  },
  {
    icon: "📍",
    title: "Ta position en un clin d'œil",
    desc: "Dès la connexion, ton rang apparaît. Niveau, eval points, wallet, statut blackhole — tout en un seul endroit.",
    tags: ["Niveau détaillé", "Eval points", "Blackhole"],
  },
];

const STEPS = [
  {
    n: "01",
    title: "Connecte-toi",
    desc: "Un clic via OAuth 42. Aucun mot de passe, aucune inscription.",
  },
  {
    n: "02",
    title: "Vois ton classement",
    desc: "Ton rang, ton niveau et le podium de ta promo s'affichent immédiatement.",
  },
  {
    n: "03",
    title: "Compare et progresse",
    desc: "Lance un duel avec un pair pour voir exactement où gagner du terrain.",
  },
];

export default async function HomePage() {
  const session = await getSession();
  if (session.accessToken) redirect("/ranking");

  const { total, activeNow } = await getStats();
  const [gold, silver, bronze] = MOCK_USERS;
  const rest = MOCK_USERS.slice(3);

  return (
    <main className="lp">
      <div className="lp-grid" aria-hidden />
      <div className="lp-glow lp-glow-teal" aria-hidden />
      <div className="lp-glow lp-glow-purple" aria-hidden />

      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="lp-inner">
        <div className="lp-copy">
          <span className="lp-badge">Bêta · 42 Network</span>

          <h1 className="lp-title">
            Ton rang parmi<br />
            <span className="lp-title-grad">les meilleurs.</span>
          </h1>

          <p className="lp-desc">
            Classement en temps réel des étudiants 42 par campus et
            année de piscine. Vois qui domine, compare tes projets,
            mesure ton avance.
          </p>

          <a href="/api/auth/login" className="lp-btn">
            Se connecter avec 42
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </a>

          <p className="lp-note">OAuth 42 · Aucun mot de passe requis</p>
        </div>

        {/* Mock preview */}
        <div className="lp-preview" aria-hidden>
          <div className="prev-chrome">
            <span className="prev-dot prev-dot-r" />
            <span className="prev-dot prev-dot-y" />
            <span className="prev-dot prev-dot-g" />
            <span className="prev-url">42rank.app · Classement</span>
          </div>

          <div className="prev-podium">
            <div className="prev-spot prev-silver">
              <div className="prev-av" style={{ background: silver.color }}>{silver.initial}</div>
              <div className="prev-login">{silver.login}</div>
              <div className="prev-lvl">{silver.level}</div>
              <div className="prev-step prev-step-silver" />
            </div>
            <div className="prev-spot prev-gold">
              <div className="prev-crown">👑</div>
              <div className="prev-av prev-av-gold" style={{ background: gold.color }}>{gold.initial}</div>
              <div className="prev-login">{gold.login}</div>
              <div className="prev-lvl prev-lvl-gold">{gold.level}</div>
              <div className="prev-step prev-step-gold" />
            </div>
            <div className="prev-spot prev-bronze">
              <div className="prev-av" style={{ background: bronze.color }}>{bronze.initial}</div>
              <div className="prev-login">{bronze.login}</div>
              <div className="prev-lvl">{bronze.level}</div>
              <div className="prev-step prev-step-bronze" />
            </div>
          </div>

          {rest.map((u, i) => (
            <div key={u.login} className="prev-row">
              <span className="prev-rank">#{i + 4}</span>
              <span className="prev-row-av" style={{ background: u.color }}>{u.initial}</span>
              <span className="prev-row-login">{u.login}</span>
              <span className="prev-row-lvl">lvl {u.level}</span>
              <span className="prev-bar-wrap">
                <span className="prev-bar-fill" style={{ width: `${(parseFloat(u.level) / 22) * 100}%` }} />
              </span>
            </div>
          ))}
          <div className="prev-blur-bottom" />
        </div>
      </div>

      {/* ── Live stats ────────────────────────────────────── */}
      <div className="lp-sections">
        <div className="lp-live-stats">
          <div className="lp-live-card">
            <div className="lp-live-dot-wrap">
              <span className="lp-live-dot" />
              <span className="lp-live-label">actifs maintenant</span>
            </div>
            <div className="lp-live-val">{activeNow}</div>
          </div>
          <div className="lp-live-divider" />
          <div className="lp-live-card">
            <div className="lp-live-label lp-live-label-plain">membres depuis le lancement</div>
            <div className="lp-live-val lp-live-val-muted">{total}</div>
          </div>
        </div>

        {/* ── Features ────────────────────────────────────── */}
        <section className="lp-features">
          <h2 className="lp-section-title">Ce que tu obtiens</h2>
          <div className="lp-feat-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="lp-feat-card">
                <div className="lp-feat-icon">{f.icon}</div>
                <h3 className="lp-feat-title">{f.title}</h3>
                <p className="lp-feat-desc">{f.desc}</p>
                <div className="lp-feat-tags">
                  {f.tags.map((t) => (
                    <span key={t} className="lp-feat-tag">{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ────────────────────────────────── */}
        <section className="lp-steps">
          <h2 className="lp-section-title">Comment ça marche</h2>
          <div className="lp-steps-row">
            {STEPS.map((s, i) => (
              <div key={s.n} className="lp-step">
                <div className="lp-step-num">{s.n}</div>
                <div className="lp-step-connector" aria-hidden={i === STEPS.length - 1} />
                <h3 className="lp-step-title">{s.title}</h3>
                <p className="lp-step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Bottom CTA ──────────────────────────────────── */}
        <div className="lp-cta-bottom">
          <p className="lp-cta-label">Prêt à voir où tu te situes ?</p>
          <a href="/api/auth/login" className="lp-btn lp-btn-center">
            Se connecter avec 42
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </a>
        </div>
      </div>
    </main>
  );
}
