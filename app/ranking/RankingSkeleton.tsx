export default function RankingSkeleton() {
  return (
    <>
      <div className="hero-stats">
        <div className="stat skel-stat">
          <div className="skel skel-line w40 center" style={{ height: 22 }} />
          <div
            className="skel skel-line w60 center"
            style={{ height: 11, marginTop: 8 }}
          />
        </div>
        <div className="stat skel-stat">
          <div className="skel skel-line w40 center" style={{ height: 22 }} />
          <div
            className="skel skel-line w60 center"
            style={{ height: 11, marginTop: 8 }}
          />
        </div>
        <div className="stat skel-stat">
          <div className="skel skel-line w40 center" style={{ height: 22 }} />
          <div
            className="skel skel-line w60 center"
            style={{ height: 11, marginTop: 8 }}
          />
        </div>
      </div>

      <section className="podium">
        <div className="podium-spot place-2">
          <div className="skel skel-circle" style={{ width: 110, height: 110 }} />
          <div
            className="skel skel-line"
            style={{ width: 80, height: 14, marginTop: 14 }}
          />
          <div
            className="skel skel-line"
            style={{ width: 60, height: 18, marginTop: 6, marginBottom: 12 }}
          />
          <div className="podium-step silver" />
        </div>
        <div className="podium-spot place-1">
          <div className="skel skel-circle" style={{ width: 130, height: 130 }} />
          <div
            className="skel skel-line"
            style={{ width: 90, height: 14, marginTop: 14 }}
          />
          <div
            className="skel skel-line"
            style={{ width: 70, height: 18, marginTop: 6, marginBottom: 12 }}
          />
          <div className="podium-step gold" />
        </div>
        <div className="podium-spot place-3">
          <div className="skel skel-circle" style={{ width: 110, height: 110 }} />
          <div
            className="skel skel-line"
            style={{ width: 80, height: 14, marginTop: 14 }}
          />
          <div
            className="skel skel-line"
            style={{ width: 60, height: 18, marginTop: 6, marginBottom: 12 }}
          />
          <div className="podium-step bronze" />
        </div>
      </section>

      <h2 className="section-title">Suite du classement</h2>
      <section className="grid">
        {Array.from({ length: 9 }).map((_, i) => (
          <article key={i} className="card skel-card">
            <div className="card-avatar-wrap">
              <div className="skel skel-circle" style={{ width: 96, height: 96 }} />
            </div>
            <div className="card-head">
              <div className="skel skel-line w60 center" style={{ height: 16 }} />
              <div
                className="skel skel-line w40 center"
                style={{ height: 12, marginTop: 6 }}
              />
            </div>
            <div className="level-block">
              <div className="skel skel-line w30" style={{ height: 14 }} />
              <div
                className="skel"
                style={{
                  height: 6,
                  borderRadius: 999,
                  marginTop: 8,
                  width: "100%",
                }}
              />
            </div>
            <div className="meta">
              <div className="skel skel-line w60" style={{ height: 24 }} />
              <div className="skel skel-line w60" style={{ height: 24 }} />
              <div className="skel skel-line w60" style={{ height: 24 }} />
              <div className="skel skel-line w60" style={{ height: 24 }} />
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
