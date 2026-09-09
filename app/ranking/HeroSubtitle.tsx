import { fetchAllCampuses, fetchAllCursus } from "@/lib/campus-cursus";
import { poolMonthLabel } from "@/lib/pool-months";

type Props = {
  accessToken: string;
  isGlobal: boolean;
  selectedCampusId: number | null;
  selectedCursusId: number;
  selectedPoolYear: string;
  selectedPoolMonth: string;
  myCampusId: number;
  myCampusName?: string;
};

export default async function HeroSubtitle({
  accessToken,
  isGlobal,
  selectedCampusId,
  selectedCursusId,
  selectedPoolYear,
  selectedPoolMonth,
  myCampusId,
  myCampusName,
}: Props) {
  let cursusName = `Cursus ${selectedCursusId}`;
  let campusName = isGlobal ? "Tous les campus" : `Campus ${selectedCampusId}`;
  try {
    // Partage le cache/inflight de FiltersAsync : pas de requete reseau en plus.
    const [campuses, cursuses] = await Promise.all([
      fetchAllCampuses(accessToken),
      fetchAllCursus(accessToken),
    ]);
    cursusName = cursuses.find((c) => c.id === selectedCursusId)?.name ?? cursusName;
    if (!isGlobal) {
      campusName =
        campuses.find((c) => c.id === selectedCampusId)?.name ??
        (selectedCampusId === myCampusId ? (myCampusName ?? campusName) : campusName);
    }
  } catch {
    // Repli sur les identifiants bruts si la recuperation echoue.
  }

  return (
    <p className="sub">
      {cursusName} · {campusName} · Piscine {selectedPoolYear}
      {selectedPoolMonth !== "all" ? ` · ${poolMonthLabel(selectedPoolMonth)}` : ""}
    </p>
  );
}
