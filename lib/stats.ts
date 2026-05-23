import { promises as fs } from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "stats.json");
const ACTIVE_MS = 30 * 60 * 1000; // actif = vu dans les 30 dernières minutes

type StatsData = {
  uniqueUsers: number[];
  lastSeen: Record<string, string>; // userId → ISO timestamp
};

async function read(): Promise<StatsData> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as StatsData;
  } catch {
    return { uniqueUsers: [], lastSeen: {} };
  }
}

async function write(data: StatsData): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data), "utf8");
}

export async function recordActivity(userId: number): Promise<void> {
  try {
    const data = await read();
    if (!data.uniqueUsers.includes(userId)) {
      data.uniqueUsers.push(userId);
    }
    data.lastSeen[String(userId)] = new Date().toISOString();
    await write(data);
  } catch {
    // non-critique, ne doit pas faire planter la page
  }
}

export async function getStats(): Promise<{ total: number; activeNow: number }> {
  try {
    const data = await read();
    const now = Date.now();
    const activeNow = Object.values(data.lastSeen).filter(
      (ts) => now - new Date(ts).getTime() < ACTIVE_MS,
    ).length;
    return { total: data.uniqueUsers.length, activeNow };
  } catch {
    return { total: 0, activeNow: 0 };
  }
}
