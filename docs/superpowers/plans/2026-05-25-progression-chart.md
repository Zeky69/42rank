# Progression Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un graphique Recharts de l'évolution du niveau dans `/compare/[login]`, chargé en parallèle avec le diff existant, avec streaming NDJSON et barre de progression en pourcentage.

**Architecture:** `ProgressionChartServer` (Server Component) vérifie le cache mémoire partagé et passe les données (ou `null` si cache miss) à `ProgressionChart` (Client Component). En cas de cache miss, le client stream depuis `/api/experiences/[userId]` qui pagine l'API 42 page par page et envoie des events NDJSON de progression. Le cache agrégé (`xp:${userId}:${cursusId}`) est partagé entre le route handler et le server component via le Map en mémoire de `lib/ft-api.ts`.

**Tech Stack:** Next.js 14 App Router, Recharts, CSS vanilla, iron-session, API 42 `/v2/users/:id/experiences`

---

## File Map

| Action  | Fichier                                           | Rôle                                               |
|---------|---------------------------------------------------|----------------------------------------------------|
| Modify  | `lib/ft-api.ts`                                   | Types XpEvent/LevelPoint, helpers cache XP, fetchExperiencePage |
| Create  | `app/api/experiences/[userId]/route.ts`           | Route handler streaming NDJSON                    |
| Create  | `app/compare/[login]/ChartSkeleton.tsx`           | Shimmer 300px pendant Suspense                    |
| Create  | `app/compare/[login]/ProgressionChartServer.tsx`  | Server component : cache hit → data props          |
| Create  | `app/compare/[login]/ProgressionChart.tsx`        | Client component : stream + Recharts              |
| Modify  | `app/compare/[login]/page.tsx`                    | Ajouter second Suspense                           |
| Modify  | `app/globals.css`                                 | Styles chart, loading bar                         |

---

## Task 1: Installer Recharts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Installer Recharts**

```bash
npm install recharts
```

Expected output: `added N packages` sans erreur.

- [ ] **Step 2: Vérifier l'installation**

```bash
npm ls recharts
```

Expected: `recharts@x.x.x` dans la liste.

---

## Task 2: Ajouter types et helpers XP dans `lib/ft-api.ts`

**Files:**
- Modify: `lib/ft-api.ts`

- [ ] **Step 1: Ajouter les types et fonctions pures après la ligne `export function cacheInvalidate`**

Ouvrir `lib/ft-api.ts`. À la fin du fichier (après `cacheInvalidate`), ajouter :

```ts
// ── XP / Progression ─────────────────────────────────────────────────────────

export type XpEvent = { created_at: string; experience: number };
export type LevelPoint = { date: string; level: number };

export function xpToLevel(xp: number): number {
  return (Math.sqrt(84 * xp + 3025) - 55) / 42;
}

export function computeLevelPoints(events: XpEvent[]): LevelPoint[] {
  let cumXp = 0;
  return events.map((e) => {
    cumXp += e.experience;
    return { date: e.created_at, level: parseFloat(xpToLevel(cumXp).toFixed(4)) };
  });
}

export function getXpCache(userId: number, cursusId: number): XpEvent[] | null {
  const key = `xp:${userId}:${cursusId}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data as XpEvent[];
  return null;
}

export function setXpCache(userId: number, cursusId: number, events: XpEvent[]): void {
  cache.set(`xp:${userId}:${cursusId}`, {
    data: events,
    expires: Date.now() + TTL.projects,
  });
}

export async function fetchExperiencePage(
  userId: number,
  cursusId: number,
  page: number,
  accessToken: string,
): Promise<{ events: XpEvent[]; total: number }> {
  const path = `/v2/users/${userId}/experiences?filter[cursus_id]=${cursusId}&sort=created_at&page[size]=100&page[number]=${page}`;
  await acquireSlot(accessToken);
  const res = await fetch(`https://api.intra.42.fr${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    if (res.status === 401) throw new TokenExpiredError();
    throw new Error(`42 API ${res.status} ${path} — ${(await res.text()).slice(0, 200)}`);
  }
  const total = parseInt(res.headers.get("X-Total") ?? "0", 10);
  const events = (await res.json()) as XpEvent[];
  cache.set(path, { data: events, expires: Date.now() + TTL.projects });
  return { events, total };
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add lib/ft-api.ts
git commit -m "feat: add XP types, cache helpers, and fetchExperiencePage to ft-api"
```

---

## Task 3: Route handler streaming NDJSON

**Files:**
- Create: `app/api/experiences/[userId]/route.ts`

- [ ] **Step 1: Créer le dossier et le fichier**

```bash
mkdir -p "app/api/experiences/[userId]"
```

- [ ] **Step 2: Écrire le route handler**

Créer `app/api/experiences/[userId]/route.ts` avec le contenu suivant :

```ts
import { getSession } from "@/lib/session";
import {
  fetchExperiencePage,
  computeLevelPoints,
  getXpCache,
  setXpCache,
  TokenExpiredError,
} from "@/lib/ft-api";

const CURSUS_ID = 21;

export async function GET(
  _req: Request,
  { params }: { params: { userId: string } },
) {
  const session = await getSession();
  if (!session.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = parseInt(params.userId, 10);
  if (isNaN(userId)) return new Response("Bad Request", { status: 400 });

  const token = session.accessToken;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        const cached = getXpCache(userId, CURSUS_ID);
        if (cached) {
          send({ type: "total", pages: 0 });
          send({ type: "data", points: computeLevelPoints(cached) });
          return;
        }

        const { events: firstBatch, total } = await fetchExperiencePage(
          userId,
          CURSUS_ID,
          1,
          token,
        );

        const totalPages = Math.max(1, Math.ceil(total / 100));
        send({ type: "total", pages: totalPages });

        const allEvents = [...firstBatch];
        send({ type: "progress", done: 1, total: totalPages });

        for (let page = 2; page <= totalPages; page++) {
          const { events } = await fetchExperiencePage(
            userId,
            CURSUS_ID,
            page,
            token,
          );
          allEvents.push(...events);
          send({ type: "progress", done: page, total: totalPages });
        }

        setXpCache(userId, CURSUS_ID, allEvents);
        send({ type: "data", points: computeLevelPoints(allEvents) });
      } catch (e) {
        if (e instanceof TokenExpiredError) {
          send({ type: "error", message: "token_expired" });
        } else {
          send({
            type: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
```

- [ ] **Step 3: Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 4: Tester le endpoint manuellement**

Démarrer le serveur de dev :

```bash
npm run dev
```

Se connecter sur http://localhost:4266, puis dans un terminal :

```bash
curl -s http://localhost:4266/api/experiences/12345 \
  -H "Cookie: $(cat /tmp/ft_session_cookie 2>/dev/null || echo '')"
```

_(Remplacer 12345 par un userId réel, ou tester depuis le navigateur DevTools → Network après s'être connecté)_

Expected : des lignes NDJSON `{"type":"total",...}`, `{"type":"progress",...}`, `{"type":"data",...}` ou `{"type":"error","message":"Unauthorized"}` si pas de session.

- [ ] **Step 5: Commit**

```bash
git add "app/api/experiences/[userId]/route.ts"
git commit -m "feat: add streaming NDJSON route handler for user XP experiences"
```

---

## Task 4: ChartSkeleton

**Files:**
- Create: `app/compare/[login]/ChartSkeleton.tsx`

- [ ] **Step 1: Créer le composant skeleton**

Créer `app/compare/[login]/ChartSkeleton.tsx` :

```tsx
export default function ChartSkeleton() {
  return (
    <section className="progression-section">
      <div className="skel skel-line" style={{ width: 200, height: 20, marginBottom: 16 }} />
      <div className="skel" style={{ width: "100%", height: 300, borderRadius: 12 }} />
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/compare/[login]/ChartSkeleton.tsx"
git commit -m "feat: add ChartSkeleton shimmer for progression chart Suspense fallback"
```

---

## Task 5: ProgressionChart — Client Component

**Files:**
- Create: `app/compare/[login]/ProgressionChart.tsx`

- [ ] **Step 1: Créer le composant**

Créer `app/compare/[login]/ProgressionChart.tsx` :

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { LevelPoint } from "@/lib/ft-api";

type Props = {
  myLogin: string;
  theirLogin: string;
  myUserId: number;
  theirUserId: number;
  initialMyPoints: LevelPoint[] | null;
  initialTheirPoints: LevelPoint[] | null;
};

type Progress = { done: number; total: number };

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const months = [
    "jan","fév","mar","avr","mai","jun",
    "jul","aoû","sep","oct","nov","déc",
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

async function streamExperiences(
  userId: number,
  onProgress: (done: number, total: number) => void,
): Promise<LevelPoint[]> {
  const res = await fetch(`/api/experiences/${userId}`);
  if (!res.ok || !res.body) throw new Error(`fetch /api/experiences/${userId} failed`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let points: LevelPoint[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      if (event.type === "total") onProgress(0, event.pages);
      else if (event.type === "progress") onProgress(event.done, event.total);
      else if (event.type === "data") points = event.points;
      else if (event.type === "error") throw new Error(event.message);
    }
  }

  return points;
}

function buildChartData(
  myPoints: LevelPoint[],
  theirPoints: LevelPoint[],
): { date: string; me: number; them: number }[] {
  const dates = Array.from(
    new Set([...myPoints.map((p) => p.date), ...theirPoints.map((p) => p.date)]),
  ).sort();

  let myLevel = 0;
  let myIdx = 0;
  let theirLevel = 0;
  let theirIdx = 0;

  return dates.map((date) => {
    while (myIdx < myPoints.length && myPoints[myIdx].date <= date) {
      myLevel = myPoints[myIdx].level;
      myIdx++;
    }
    while (theirIdx < theirPoints.length && theirPoints[theirIdx].date <= date) {
      theirLevel = theirPoints[theirIdx].level;
      theirIdx++;
    }
    return { date, me: parseFloat(myLevel.toFixed(2)), them: parseFloat(theirLevel.toFixed(2)) };
  });
}

export default function ProgressionChart({
  myLogin,
  theirLogin,
  myUserId,
  theirUserId,
  initialMyPoints,
  initialTheirPoints,
}: Props) {
  const [myPoints, setMyPoints] = useState<LevelPoint[] | null>(initialMyPoints);
  const [theirPoints, setTheirPoints] = useState<LevelPoint[] | null>(initialTheirPoints);
  const [myProg, setMyProg] = useState<Progress>({ done: 0, total: 1 });
  const [theirProg, setTheirProg] = useState<Progress>({ done: 0, total: 1 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialMyPoints && initialTheirPoints) return;

    let cancelled = false;

    Promise.all([
      initialMyPoints
        ? Promise.resolve(initialMyPoints)
        : streamExperiences(myUserId, (done, total) => {
            if (!cancelled) setMyProg({ done, total: Math.max(total, 1) });
          }),
      initialTheirPoints
        ? Promise.resolve(initialTheirPoints)
        : streamExperiences(theirUserId, (done, total) => {
            if (!cancelled) setTheirProg({ done, total: Math.max(total, 1) });
          }),
    ])
      .then(([mp, tp]) => {
        if (!cancelled) {
          setMyPoints(mp);
          setTheirPoints(tp);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [myUserId, theirUserId, initialMyPoints, initialTheirPoints]);

  const totalPages = myProg.total + theirProg.total;
  const donePages = myProg.done + theirProg.done;
  const pct = totalPages > 0 ? Math.round((donePages / totalPages) * 100) : 0;

  if (error) {
    return (
      <section className="progression-section">
        <p className="muted">Graphique indisponible : {error}</p>
      </section>
    );
  }

  if (!myPoints || !theirPoints) {
    return (
      <section className="progression-section">
        <h2 className="progression-title">Évolution du niveau</h2>
        <div className="chart-loading">
          <div className="chart-progress-bar">
            <div className="chart-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="chart-progress-label">{pct}% — chargement de la progression…</p>
        </div>
      </section>
    );
  }

  if (myPoints.length === 0 && theirPoints.length === 0) {
    return (
      <section className="progression-section">
        <p className="muted">Pas de données de progression disponibles.</p>
      </section>
    );
  }

  const data = buildChartData(myPoints, theirPoints);

  return (
    <section className="progression-section">
      <h2 className="progression-title">Évolution du niveau</h2>
      <div className="progression-chart-wrap">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
            <XAxis
              dataKey="date"
              tickFormatter={fmtDate}
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              minTickGap={60}
            />
            <YAxis
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => v.toFixed(1)}
            />
            <Tooltip
              contentStyle={{
                background: "#111827",
                border: "1px solid #1f2937",
                borderRadius: 8,
                fontSize: 13,
              }}
              labelFormatter={fmtDate}
              formatter={(value: unknown, name: string) => [
                typeof value === "number" ? value.toFixed(2) : value,
                name === "me" ? myLogin : theirLogin,
              ]}
            />
            <Legend
              formatter={(value: string) => (value === "me" ? myLogin : theirLogin)}
            />
            <Line
              type="monotone"
              dataKey="me"
              stroke="#4f8ef7"
              dot={false}
              strokeWidth={2}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="them"
              stroke="#f78f4f"
              dot={false}
              strokeWidth={2}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add "app/compare/[login]/ProgressionChart.tsx"
git commit -m "feat: add ProgressionChart client component with NDJSON stream and Recharts"
```

---

## Task 6: ProgressionChartServer — Server Component

**Files:**
- Create: `app/compare/[login]/ProgressionChartServer.tsx`

- [ ] **Step 1: Créer le composant**

Créer `app/compare/[login]/ProgressionChartServer.tsx` :

```tsx
import { ftFetch, TTL, getXpCache, computeLevelPoints } from "@/lib/ft-api";
import ProgressionChart from "./ProgressionChart";

const CURSUS_ID = 21;

type ApiUser = { id: number };

type Props = {
  accessToken: string;
  myUserId: number;
  myLogin: string;
  theirLogin: string;
};

export default async function ProgressionChartServer({
  accessToken,
  myUserId,
  myLogin,
  theirLogin,
}: Props) {
  // Résolution de theirUserId via le cache ftFetch (cache hit si CompareData a déjà fetchée)
  const them = await ftFetch<ApiUser>(
    `/v2/users/${encodeURIComponent(theirLogin)}`,
    accessToken,
    { ttl: TTL.ranking },
  );
  const theirUserId = them.id;

  const myEvents = getXpCache(myUserId, CURSUS_ID);
  const theirEvents = getXpCache(theirUserId, CURSUS_ID);

  return (
    <ProgressionChart
      myLogin={myLogin}
      theirLogin={theirLogin}
      myUserId={myUserId}
      theirUserId={theirUserId}
      initialMyPoints={myEvents ? computeLevelPoints(myEvents) : null}
      initialTheirPoints={theirEvents ? computeLevelPoints(theirEvents) : null}
    />
  );
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add "app/compare/[login]/ProgressionChartServer.tsx"
git commit -m "feat: add ProgressionChartServer for cache-hit fast path"
```

---

## Task 7: Modifier `page.tsx` pour ajouter le second Suspense

**Files:**
- Modify: `app/compare/[login]/page.tsx`

- [ ] **Step 1: Ajouter les imports en haut du fichier**

Dans `app/compare/[login]/page.tsx`, ajouter ces imports après les imports existants :

```ts
import ProgressionChartServer from "./ProgressionChartServer";
import ChartSkeleton from "./ChartSkeleton";
```

- [ ] **Step 2: Ajouter le second Suspense après le premier**

Dans la JSX de `ComparePage`, après le bloc `<Suspense key={theirLogin} ...>`, ajouter :

```tsx
<Suspense key={`chart-${theirLogin}`} fallback={<ChartSkeleton />}>
  <ProgressionChartServer
    accessToken={accessToken!}
    myUserId={userId!}
    myLogin={login!}
    theirLogin={theirLogin}
  />
</Suspense>
```

Le JSX final de la page doit ressembler à :

```tsx
return (
  <main className="wide compare-page">
    <div className="topbar">
      <Link href={backHref}>← Retour au classement</Link>
      <a href="/api/auth/logout">Se deconnecter</a>
    </div>

    <Suspense
      key={theirLogin}
      fallback={<CompareSkeleton theirLogin={theirLogin} />}
    >
      <CompareData
        accessToken={accessToken!}
        myUserId={userId!}
        cursusId={cursusId!}
        theirLogin={theirLogin}
      />
    </Suspense>

    <Suspense key={`chart-${theirLogin}`} fallback={<ChartSkeleton />}>
      <ProgressionChartServer
        accessToken={accessToken!}
        myUserId={userId!}
        myLogin={login!}
        theirLogin={theirLogin}
      />
    </Suspense>
  </main>
);
```

- [ ] **Step 3: Vérifier que `login` est bien extrait de la session**

Dans `page.tsx`, la session donne `login: myLogin`. Si la variable s'appelle `myLogin` dans le destructuring, adapter l'attribut `myLogin={myLogin}`. Vérifier la ligne :

```ts
const { accessToken, login: myLogin, userId, cursusId } = session;
```

Et ajuster le prop en conséquence : `myLogin={myLogin}`.

- [ ] **Step 4: Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add "app/compare/[login]/page.tsx"
git commit -m "feat: wire ProgressionChartServer into compare page via Suspense"
```

---

## Task 8: CSS pour le graphique

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Ajouter les styles à la fin de `app/globals.css`**

```css
/* ── Progression chart ───────────────────────────────────────────────── */

.progression-section {
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid #1f2937;
}

.progression-title {
  margin: 0 0 20px;
  font-size: 15px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #9ca3af;
  font-weight: 600;
}

.progression-chart-wrap {
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid #1f2937;
  padding: 12px 4px 4px;
}

.chart-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 0;
}

.chart-progress-bar {
  width: 100%;
  max-width: 400px;
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  overflow: hidden;
}

.chart-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4f8ef7, #7dd3fc);
  border-radius: 999px;
  transition: width 0.3s ease;
}

.chart-progress-label {
  margin: 0;
  font-size: 13px;
  color: #9ca3af;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "feat: add CSS for progression chart section and loading bar"
```

---

## Task 9: Vérification manuelle complète

**Files:** aucun

- [ ] **Step 1: Démarrer le serveur de dev**

```bash
npm run dev
```

- [ ] **Step 2: Ouvrir une page de comparaison**

Aller sur http://localhost:4266, se connecter, puis naviguer sur `/compare/<login-dun-etudiant>`.

- [ ] **Step 3: Vérifier le chargement parallèle**

Ouvrir les DevTools → Network. Vérifier que :
- La page affiche le diff de projets (CompareData) normalement, sans être bloquée par le chart
- La requête `GET /api/experiences/<myUserId>` et `GET /api/experiences/<theirUserId>` partent en parallèle
- La barre de progression affiche un pourcentage croissant (0% → 100%)

- [ ] **Step 4: Vérifier le chart**

Une fois les données chargées :
- Le graphique Recharts s'affiche avec deux courbes (bleu = toi, orange = rival)
- Le tooltip au survol affiche le login + le niveau avec 2 décimales
- La légende affiche les deux logins

- [ ] **Step 5: Vérifier le cache (second chargement)**

Naviguer ailleurs (retour au ranking) puis revenir sur la même page de compare.
- Le graphique doit apparaître immédiatement, sans barre de progression (cache hit)
- Les DevTools ne doivent pas montrer de nouvelle requête `/api/experiences/`

- [ ] **Step 6: Vérifier le cas sans données**

Si un étudiant n'a pas d'expériences (niveau 0) : le graphique doit afficher "Pas de données de progression disponibles." sans erreur.

- [ ] **Step 7: Vérifier TypeScript et build final**

```bash
npx tsc --noEmit && npm run build
```

Expected: build réussi sans erreur TS ni erreur Next.js.
