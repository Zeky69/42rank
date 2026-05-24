import fs from "fs";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), "data");

function filePath(cursusId: number) {
  return path.join(CACHE_DIR, `cursus-${cursusId}-xp.json`);
}

export function loadCursusXP(cursusId: number): Map<number, number> | null {
  try {
    const raw = fs.readFileSync(filePath(cursusId), "utf-8");
    const obj = JSON.parse(raw) as Record<string, number>;
    const map = new Map(Object.entries(obj).map(([k, v]) => [Number(k), v]));
    return map.size > 0 ? map : null;
  } catch {
    return null;
  }
}

export function saveCursusXP(cursusId: number, map: Map<number, number>): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const obj: Record<string, number> = {};
    for (const [k, v] of map) obj[String(k)] = v;
    fs.writeFileSync(filePath(cursusId), JSON.stringify(obj), "utf-8");
  } catch {
    // best-effort, silent fail
  }
}
