export default function ChartSkeleton() {
  return (
    <section className="progression-section">
      <div className="skel skel-line" style={{ width: 200, height: 20, marginBottom: 16 }} />
      <div className="skel" style={{ width: "100%", height: 300, borderRadius: 12 }} />
    </section>
  );
}
