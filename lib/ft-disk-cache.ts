import fs from "fs";
import path from "path";
import crypto from "crypto";

// Cache disque generique pour ftFetch : sert a survivre aux redemarrages du
// serveur pour les requetes a tres longue duree de vie (barre de recherche,
// etc.). Meme dossier/convention que lib/cursus-xp-disk-cache.ts.
const CACHE_DIR = path.join(process.cwd(), "data", "ft-cache");

function filePath(key: string): string {
  const hash = crypto.createHash("sha1").update(key).digest("hex");
  return path.join(CACHE_DIR, `${hash}.json`);
}

export function loadDiskCache<T>(key: string): { data: T; expires: number } | null {
  try {
    const raw = fs.readFileSync(filePath(key), "utf-8");
    const entry = JSON.parse(raw) as { data: T; expires: number };
    if (typeof entry.expires !== "number" || entry.expires <= Date.now()) return null;
    return entry;
  } catch {
    return null;
  }
}

export function saveDiskCache<T>(key: string, data: T, expires: number): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(filePath(key), JSON.stringify({ data, expires }), "utf-8");
  } catch {
    // best-effort, silent fail
  }
}
