import { redirect } from "next/navigation";
import { ftFetch, Priority, TTL, TokenExpiredError } from "@/lib/ft-api";
import {
  fetchAllCampuses,
  fetchAllCursus,
  type Campus,
  type Cursus,
} from "@/lib/campus-cursus";
import Filters from "./Filters";

// La liste des cursus ouverts sur un campus change rarement : on garde le
// resultat en cache un mois, comme le reste des donnees de la barre de
// recherche (partage entre tous les utilisateurs via le cache serveur de ftFetch).
const CAMPUS_CURSUS_TTL = TTL.monthly;

async function fetchCampusCursusIds(
  campusId: number,
  cursuses: Cursus[],
  token: string,
): Promise<Set<number>> {
  const present = new Set<number>();
  await Promise.all(
    cursuses.map(async (c) => {
      try {
        const rows = await ftFetch<{ id: number }[]>(
          `/v2/cursus_users?filter[cursus_id]=${c.id}&filter[campus_id]=${campusId}&page[size]=1`,
          token,
          { ttl: CAMPUS_CURSUS_TTL, priority: Priority.low, persist: true },
        );
        if (rows.length > 0) present.add(c.id);
      } catch {
        // Cursus incertain en cas d'erreur : on le garde plutot que de le
        // masquer a tort.
        present.add(c.id);
      }
    }),
  );
  return present;
}

type Props = {
  accessToken: string;
  poolYears: string[];
  currentCampus: string;
  currentCursus: string;
  currentPoolYear: string;
  currentPoolMonth: string;
  myCampusId?: number;
  selectedCampusId: number | null;
};

export default async function FiltersAsync({
  accessToken,
  poolYears,
  currentCampus,
  currentCursus,
  currentPoolYear,
  currentPoolMonth,
  myCampusId,
  selectedCampusId,
}: Props) {
  let campuses: Campus[];
  let cursuses: Cursus[];
  try {
    // Partage le cache/inflight de HeroSubtitle : meme cle de requete, donc pas
    // de double appel reseau meme si les deux composants s'executent en parallele.
    [campuses, cursuses] = await Promise.all([
      fetchAllCampuses(accessToken),
      fetchAllCursus(accessToken),
    ]);
  } catch (e) {
    if (e instanceof TokenExpiredError) redirect("/api/auth/logout");
    // Widget secondaire : mieux vaut un select vide qu'une page cassee.
    campuses = [];
    cursuses = [];
  }

  let availableCursuses = cursuses;

  if (selectedCampusId !== null) {
    try {
      const ids = await fetchCampusCursusIds(selectedCampusId, cursuses, accessToken);
      const selectedId = parseInt(currentCursus, 10);
      // On garde toujours le cursus actuellement selectionne, meme absent du
      // campus, pour ne jamais casser l'URL/etat courant de l'utilisateur.
      const filtered = cursuses.filter((c) => ids.has(c.id) || c.id === selectedId);
      if (filtered.length > 0) availableCursuses = filtered;
    } catch {
      // Repli silencieux sur la liste complete si la decouverte echoue.
    }
  }

  return (
    <Filters
      campuses={campuses}
      cursuses={availableCursuses}
      poolYears={poolYears}
      currentCampus={currentCampus}
      currentCursus={currentCursus}
      currentPoolYear={currentPoolYear}
      currentPoolMonth={currentPoolMonth}
      myCampusId={myCampusId}
    />
  );
}
