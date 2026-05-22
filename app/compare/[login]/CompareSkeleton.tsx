export default function CompareSkeleton({
  theirLogin,
}: {
  theirLogin: string;
}) {
  return (
    <>
      <section className="vs2">
        <div className="vs2-side">
          <div
            className="skel"
            style={{ width: 120, height: 120, borderRadius: "50%" }}
          />
          <div
            className="skel skel-line"
            style={{ width: 50, height: 14, marginTop: 10, borderRadius: 999 }}
          />
          <div
            className="skel skel-line"
            style={{ width: 90, height: 18, marginTop: 4 }}
          />
          <div
            className="skel skel-line"
            style={{ width: 80, height: 36, marginTop: 6 }}
          />
        </div>
        <div className="vs2-center">
          <div
            className="skel"
            style={{ width: 64, height: 64, borderRadius: "50%" }}
          />
          <div
            className="skel skel-line"
            style={{ width: 90, height: 22, marginTop: 6, borderRadius: 999 }}
          />
          <div
            className="skel skel-line"
            style={{ width: 110, height: 11, marginTop: 4 }}
          />
        </div>
        <div className="vs2-side">
          <div
            className="skel"
            style={{ width: 120, height: 120, borderRadius: "50%" }}
          />
          <div
            className="skel skel-line"
            style={{ width: 50, height: 14, marginTop: 10, borderRadius: 999 }}
          />
          <div
            className="skel skel-line"
            style={{
              width: `${Math.min(theirLogin.length * 9 + 12, 120)}px`,
              height: 18,
              marginTop: 4,
            }}
          />
          <div
            className="skel skel-line"
            style={{ width: 80, height: 36, marginTop: 6 }}
          />
        </div>
      </section>

      <section className="kpi-strip">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="kpi">
            <div
              className="skel skel-line center"
              style={{ width: 50, height: 28 }}
            />
            <div
              className="skel skel-line center"
              style={{ width: 90, height: 11, marginTop: 8 }}
            />
          </div>
        ))}
      </section>

      <section className="plan">
        <div className="plan-header">
          <div
            className="skel skel-line"
            style={{ width: 180, height: 24 }}
          />
          <div
            className="skel skel-line"
            style={{ width: 260, height: 14, marginTop: 8 }}
          />
        </div>
        <div className="plan-block">
          <div className="plan-block-head">
            <div
              className="skel skel-line"
              style={{ width: 100, height: 22, borderRadius: 999 }}
            />
          </div>
          <div className="prj-cards">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="prj-card">
                <div
                  className="skel skel-line"
                  style={{ width: "60%", height: 14 }}
                />
                <div
                  className="skel skel-line"
                  style={{ width: 56, height: 24, borderRadius: 8 }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
