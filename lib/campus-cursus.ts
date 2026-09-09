import { ftFetch, TTL } from "@/lib/ft-api";

export type Campus = { id: number; name: string; country?: string };
export type Cursus = { id: number; name: string };

// TTL mensuel + cache partagé (cle = chemin) et persistant sur disque : ces
// listes changent tres rarement, donc un seul visiteur "paie" le cout de la
// premiere recuperation par mois, meme a travers un redemarrage du serveur.
export async function fetchAllCampuses(token: string): Promise<Campus[]> {
  const all: Campus[] = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await ftFetch<Campus[]>(
      `/v2/campus?page[size]=100&page[number]=${page}&sort=name`,
      token,
      { ttl: TTL.monthly, persist: true },
    );
    all.push(
      ...batch.map((c) => ({ id: c.id, name: c.name, country: c.country })),
    );
    if (batch.length < 100) break;
  }
  return all;
}

export async function fetchAllCursus(token: string): Promise<Cursus[]> {
  const all: Cursus[] = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await ftFetch<Cursus[]>(
      `/v2/cursus?page[size]=100&page[number]=${page}&sort=name`,
      token,
      { ttl: TTL.monthly, persist: true },
    );
    all.push(...batch.map((c) => ({ id: c.id, name: c.name })));
    if (batch.length < 100) break;
  }
  return all;
}
