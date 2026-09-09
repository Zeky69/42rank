type Props = {
  // Reserve la place du 4e filtre (periode de piscine) quand il est deja
  // actif dans l'URL, pour eviter un saut de layout a l'arrivee des donnees.
  showPoolMonth?: boolean;
};

export default function FiltersSkeleton({ showPoolMonth }: Props) {
  const count = showPoolMonth ? 4 : 3;
  return (
    <div className="filters">
      {Array.from({ length: count }).map((_, i) => (
        <div className="filter-label" key={i}>
          <span className="filter-k">&nbsp;</span>
          <div className="skel" style={{ height: 38, borderRadius: 8 }} />
        </div>
      ))}
    </div>
  );
}
