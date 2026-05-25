# Graphique de progression — Design Spec

**Date:** 2026-05-25
**Feature:** Courbe de niveau dans le temps, affichee dans `/compare/[login]` pour toi et ton rival
**Stack:** Next.js 14 App Router, Recharts, CSS vanilla

---

## 1. Vue d'ensemble

On ajoute sous le diff de projets existant un graphique en courbe montrant l'evolution du niveau
des deux etudiants au fil du temps. Le bloc charge en parallele de `CompareData` sans bloquer
l'affichage existant. Si les donnees sont en cache, le graphique s'affiche immediatement ; sinon
une barre de progression reelle (pourcentage page/total) s'affiche pendant le fetch.

---

## 2. Architecture

```
app/compare/[login]/
  page.tsx                        — ajout d'un 2e Suspense pour ProgressionChartServer
  ProgressionChartServer.tsx      — Server Component : tente cache hit, passe data ou null
  ProgressionChart.tsx            — Client Component : Recharts + fetch stream si cache miss
  ChartSkeleton.tsx               — Skeleton shimmer affiché par le Suspense

app/api/experiences/[userId]/
  route.ts                        — Route Handler : stream NDJSON avec progression + data

lib/ft-api.ts                     — ajout fetchUserExperiences(userId, token) : TTL 30min
```

### Flux — cache miss (premier affichage)

```
page.tsx
  ├── <Suspense> CompareData          → résout normalement (inchangé)
  └── <Suspense fallback=ChartSkeleton>
        ProgressionChartServer        → cache miss → passe userId pair à ProgressionChart
          ProgressionChart (client)
            ├── fetch /api/experiences/[myUserId]    ─┐ en parallèle
            └── fetch /api/experiences/[theirUserId] ─┘
                  → stream NDJSON : total → progress pages → data
                  → barre de progression XX%
                  → quand data reçue : render LineChart Recharts
```

### Flux — cache hit (revisit dans les 30min)

```
ProgressionChartServer → cache hit → passe { myPoints, theirPoints } à ProgressionChart
ProgressionChart → render immédiat, zero skeleton
```

---

## 3. Cache dans `lib/ft-api.ts`

Nouvelle fonction :

```ts
fetchUserExperiences(userId: number, accessToken: string): Promise<XpEvent[]>
```

- **Endpoint :** `GET /v2/users/:id/experiences?filter[cursus_id]=21&sort=created_at&page[size]=100`
- **Clé de cache :** `experiences:${userId}:21`
- **TTL :** 30 min (cohérent avec `projects_users`)
- **Dedup :** même mécanisme que `ftFetch` — si deux requêtes simultanées sur la même clé,
  une seule part vers l'API, les deux attendent la même Promise
- **Stale-on-error :** si l'API échoue et qu'une version expirée existe, on la sert

Type `XpEvent` :
```ts
type XpEvent = { created_at: string; experience: number }
```

---

## 4. Route handler `/api/experiences/[userId]/route.ts`

Stream NDJSON (une ligne JSON par événement) :

1. Appel `page[size]=1` → lit header `X-Total` → calcule `totalPages = ceil(total / 100)`
2. Envoie `{"type":"total","pages":N}\n`
3. Pour chaque page k de 1 à N :
   - Fetch `/v2/users/:id/experiences?...&page[number]=k`
   - Accumule les events
   - Envoie `{"type":"progress","done":k,"total":N}\n`
4. Calcule les points de niveau depuis les XP cumulés (formule 42, voir §5)
5. Envoie `{"type":"data","points":[...]}\n`
6. Ferme le stream

La route lit le token d'accès depuis la session (iron-session), pas depuis les query params.

---

## 5. Formule niveau depuis XP

La formule 42 pour convertir XP cumulé en niveau :

```ts
function xpToLevel(xp: number): number {
  return (Math.sqrt(84 * xp + 3025) - 55) / 42;
}
```

On produit un tableau de points `{ date: string; level: number }` en :
1. Triant les XP events par `created_at` croissant
2. Accumulant `xpTotal += event.experience`
3. A chaque event : `level = xpToLevel(xpTotal)`

---

## 6. Composant `ProgressionChart.tsx`

Client Component. Props :

```ts
type Props = {
  myLogin: string;
  theirLogin: string;
  myUserId: number;
  theirUserId: number;
  // null = pas en cache, le composant fetch lui-même
  initialMyPoints: LevelPoint[] | null;
  initialTheirPoints: LevelPoint[] | null;
}
type LevelPoint = { date: string; level: number }
```

Comportement :
- Si `initialMyPoints` et `initialTheirPoints` non null → render Recharts direct
- Sinon → deux `fetch` parallèles vers `/api/experiences/[userId]`, lecture stream NDJSON,
  state `progress = { myDone, myTotal, theirDone, theirTotal }` → affiche pourcentage global
  `Math.round(((myDone + theirDone) / (myTotal + theirTotal)) * 100)%`

Chart Recharts :
- `ResponsiveContainer width="100%" height={300}`
- `LineChart` avec deux `<Line>` : moi (bleu `#4f8ef7`) + rival (orange `#f78f4f`)
- `XAxis` : `dataKey="date"`, `tickFormatter` format `MMM YYYY` (sans librairie date)
- `YAxis` : domaine `[0, max_level + 0.5]`, label "Niveau"
- `Tooltip` : date + niveau des deux au survol
- `Legend` avec les logins

---

## 7. Intégration dans `page.tsx`

```tsx
// Après le Suspense existant de CompareData
<Suspense key={`chart-${theirLogin}`} fallback={<ChartSkeleton />}>
  <ProgressionChartServer
    myUserId={userId!}
    theirUserId={...}   // résolu depuis le login rival via ftFetch
    myLogin={myLogin}
    theirLogin={theirLogin}
  />
</Suspense>
```

`ProgressionChartServer` fetch l'userId du rival (déjà disponible dans `CompareData`, à
extraire dans une fonction partagée dans `lib/ft-api.ts`).

---

## 8. `ChartSkeleton.tsx`

Bloc shimmer 300px de haut, même style que `RankingSkeleton` (CSS vanilla, animation pulse).

---

## 9. Hors scope

- Comparaison multi (plus de 2 users)
- Sélecteur de cursus (hardcodé sur 21)
- Export image du graphique
- Persistance côté serveur (Redis)
