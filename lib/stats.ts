import { promises as fs } from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "stats.json");
const ACTIVE_MS = 30 * 60 * 1000; // actif = vu dans les 30 dernières minutes
const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_KEEP = 30; // nb de jours d'historique conservés
const LANDING_DAYS = 14; // nb de jours affichés sur la landing

type Peak = { count: number; at: string }; // pic d'actifs simultanés + ISO

type StatsData = {
  uniqueUsers: number[];
  lastSeen: Record<string, string>; // userId → ISO timestamp
  firstSeen: Record<string, string>; // userId → ISO de la 1re visite
  visits: Record<string, number>; // userId → nombre total de visites
  dailyActive: Record<string, number[]>; // "YYYY-MM-DD" → userIds vus ce jour
  campus: Record<string, string>; // userId → nom du campus (dernier connu)
  peak: Peak | null;
};

function empty(): StatsData {
  return {
    uniqueUsers: [],
    lastSeen: {},
    firstSeen: {},
    visits: {},
    dailyActive: {},
    campus: {},
    peak: null,
  };
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function read(): Promise<StatsData> {
  try {
    const parsed = JSON.parse(await fs.readFile(FILE, "utf8")) as Partial<StatsData>;
    // fusion avec la forme vide pour rester compatible avec les anciens fichiers
    return { ...empty(), ...parsed };
  } catch {
    return empty();
  }
}

async function write(data: StatsData): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data), "utf8");
}

// Supprime les jours plus vieux que DAILY_KEEP pour que le fichier ne grossisse
// pas indéfiniment.
function pruneDaily(daily: Record<string, number[]>): void {
  const cutoff = dayKey(new Date(Date.now() - DAILY_KEEP * DAY_MS));
  for (const key of Object.keys(daily)) {
    if (key < cutoff) delete daily[key];
  }
}

function countActive(lastSeen: Record<string, string>, now: number): number {
  return Object.values(lastSeen).filter(
    (ts) => now - new Date(ts).getTime() < ACTIVE_MS,
  ).length;
}

export async function recordActivity(
  userId: number,
  campusName?: string,
): Promise<void> {
  try {
    const data = await read();
    const now = new Date();
    const id = String(userId);
    const iso = now.toISOString();

    if (!data.uniqueUsers.includes(userId)) {
      data.uniqueUsers.push(userId);
      data.firstSeen[id] = iso;
    }
    data.lastSeen[id] = iso;
    data.visits[id] = (data.visits[id] ?? 0) + 1;
    if (campusName) data.campus[id] = campusName;

    const today = dayKey(now);
    const todayList = (data.dailyActive[today] ??= []);
    if (!todayList.includes(userId)) todayList.push(userId);
    pruneDaily(data.dailyActive);

    const active = countActive(data.lastSeen, now.getTime());
    if (!data.peak || active > data.peak.count) {
      data.peak = { count: active, at: iso };
    }

    await write(data);
  } catch {
    // non-critique, ne doit pas faire planter la page
  }
}

export type SiteStats = {
  total: number;
  activeNow: number;
  peak: Peak | null;
  daily: { date: string; count: number }[]; // série des LANDING_DAYS derniers jours
  topCampus: { name: string; count: number } | null;
  retention: { returnedD1: number; returnedD7: number; rateD1: number };
};

export async function getStats(): Promise<SiteStats> {
  try {
    const data = await read();
    const now = Date.now();
    const activeNow = countActive(data.lastSeen, now);

    // Série quotidienne : un point par jour sur la fenêtre LANDING_DAYS, 0 si
    // aucune activité ce jour-là (pour une courbe continue).
    const daily: { date: string; count: number }[] = [];
    for (let i = LANDING_DAYS - 1; i >= 0; i--) {
      const key = dayKey(new Date(now - i * DAY_MS));
      daily.push({ date: key, count: data.dailyActive[key]?.length ?? 0 });
    }

    // Campus le plus représenté.
    const campusCounts: Record<string, number> = {};
    for (const name of Object.values(data.campus)) {
      campusCounts[name] = (campusCounts[name] ?? 0) + 1;
    }
    let topCampus: { name: string; count: number } | null = null;
    for (const [name, count] of Object.entries(campusCounts)) {
      if (!topCampus || count > topCampus.count) topCampus = { name, count };
    }

    // Rétention : utilisateurs revenus au moins 1 jour / 7 jours après leur
    // première visite (écart firstSeen → lastSeen).
    let returnedD1 = 0;
    let returnedD7 = 0;
    for (const id of Object.keys(data.firstSeen)) {
      const first = new Date(data.firstSeen[id]).getTime();
      const last = new Date(data.lastSeen[id] ?? data.firstSeen[id]).getTime();
      const gap = last - first;
      if (gap >= DAY_MS) returnedD1++;
      if (gap >= 7 * DAY_MS) returnedD7++;
    }
    const total = data.uniqueUsers.length;
    const rateD1 = total > 0 ? returnedD1 / total : 0;

    return {
      total,
      activeNow,
      peak: data.peak,
      daily,
      topCampus,
      retention: { returnedD1, returnedD7, rateD1 },
    };
  } catch {
    return {
      total: 0,
      activeNow: 0,
      peak: null,
      daily: [],
      topCampus: null,
      retention: { returnedD1: 0, returnedD7: 0, rateD1: 0 },
    };
  }
}
