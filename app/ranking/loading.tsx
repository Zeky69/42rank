import FiltersSkeleton from "./FiltersSkeleton";
import RankingSkeleton from "./RankingSkeleton";

// Affiche instantanement a la navigation vers /ranking (avant meme que la
// session/les appels API du Server Component ne demarrent), pour eviter
// l'ecran blanc pendant que la page se charge.
export default function RankingLoading() {
  return (
    <main className="wide">
      <div className="topbar">
        <span className="skel skel-line" style={{ width: 160, height: 14 }} />
        <span className="skel skel-line" style={{ width: 90, height: 14 }} />
      </div>

      <header className="hero">
        <div>
          <div className="skel skel-line" style={{ width: 220, height: 28 }} />
          <div
            className="skel skel-line"
            style={{ width: 280, height: 14, marginTop: 10 }}
          />
        </div>
        <div className="global-rank loading">
          <span className="global-rank-num">#…</span>
          <span className="global-rank-lbl">Rang mondial</span>
        </div>
      </header>

      <FiltersSkeleton />

      <RankingSkeleton />
    </main>
  );
}
