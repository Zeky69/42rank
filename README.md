# 42 Rank

Site de classement entre étudiants 42, par campus et année de piscine, avec
**duel projet par projet** pour savoir exactement quoi rattraper pour dépasser
un rival, et **graphique de progression** du niveau dans le temps.

Connexion en un clic via OAuth 42 (aucun mot de passe, aucune inscription).
Toutes les données viennent en direct de l'API 42 v2.

---

## Sommaire

- [Stack technique](#stack-technique)
- [Installation locale](#installation-locale)
- [Variables d'environnement](#variables-denvironnement-env)
- [Les fonctionnalités](#les-fonctionnalités)
  - [Landing page](#1-landing-page--)
  - [Authentification OAuth 42](#2-authentification-oauth-42)
  - [Classement (campus + global)](#3-classement-ranking)
  - [Rang mondial](#4-rang-mondial-globalrank)
  - [Sélecteur de campus](#5-sélecteur-de-campus-campuspicker)
  - [Duel / comparaison](#6-duel--comparaison-compare)
  - [Graphique de progression](#7-graphique-de-progression)
  - [Photo en plein écran](#8-photo-en-plein-écran-clickableavatar)
  - [Statistiques de fréquentation](#9-statistiques-de-fréquentation)
- [Description de chaque fichier](#description-de-chaque-fichier)
- [API 42 — fetch, cache & rate limit](#api-42--fetch-cache--rate-limit)
- [Le calcul du niveau et des XP](#le-calcul-du-niveau-et-des-xp)
- [Déploiement en production](#déploiement-en-production)
- [Pistes d'évolution](#pistes-dévolution)

---

## Stack technique

| Élément | Choix |
|---|---|
| Framework | **Next.js 14** (App Router, React Server Components) |
| Langage | **TypeScript** (mode strict) |
| Session / Auth | **iron-session** (cookie chiffré) + OAuth 42 `authorization_code` |
| Graphiques | **Recharts** |
| Styles | **CSS vanilla** (`app/globals.css`, aucun framework UI) |
| Police | **Syne** (via `next/font/google`) |
| Source de données | **API 42 v2** (`api.intra.42.fr`) |
| Port de dev/prod | **4266** |

Aucune base de données : l'app est un proxy/cache au-dessus de l'API 42. Les
seules données persistées sur disque sont un petit fichier de stats et un cache
XP (voir plus bas).

---

## Installation locale

Prérequis : **Node ≥ 18.17** (`nvm use default` si besoin).

```bash
npm install
# créer et remplir le fichier .env (voir ci-dessous)
npm run dev
```

L'app écoute sur **http://localhost:4266**.

Scripts disponibles (`package.json`) :

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de dev Next.js sur le port 4266 |
| `npm run build` | Build de production |
| `npm run start` | Démarre le build de prod sur le port 4266 |

### Variables d'environnement (`.env`)

```env
UID=<client_id de l'app 42>
SECRET=<client_secret de l'app 42>
REDIRECT_URI=http://localhost:4266/auth/callback
SESSION_PASSWORD=<32+ caractères, générer avec: openssl rand -hex 32>
```

| Variable | Rôle |
|---|---|
| `UID` | Identifiant public de l'application OAuth 42 |
| `SECRET` | Clé secrète de l'application OAuth 42 |
| `REDIRECT_URI` | URL de callback ; son **origin** sert aussi de base aux redirections (`lib/base-url.ts`) |
| `SESSION_PASSWORD` | Clé de chiffrement du cookie de session (iron-session) |

L'URI de callback doit être déclarée dans
<https://profile.intra.42.fr/oauth/applications>. Pour avoir dev **et** prod,
ajouter les deux URIs dans la même application 42.

> Le scope OAuth demandé est `public` (lecture seule) — voir
> [app/api/auth/login/route.ts](app/api/auth/login/route.ts).

---

## Les fonctionnalités

### 1. Landing page (`/`)

Fichier : [app/page.tsx](app/page.tsx)

Page d'accueil pour les visiteurs **non connectés**. Si une session existe déjà,
elle redirige directement vers `/ranking`.

Elle contient :
- **Hero** avec titre, accroche et un bouton « Se connecter avec 42 » qui pointe
  vers `/api/auth/login`.
- **Aperçu mocké** d'un classement (podium + lignes) — données fictives
  (`MOCK_USERS`) à but purement décoratif.
- **Compteurs live** : nombre d'utilisateurs *actifs maintenant* et nombre total
  de membres depuis le lancement (issus de `lib/stats.ts`).
- **Bloc « Ce que tu obtiens »** : 3 cartes de fonctionnalités (`FEATURES`).
- **Bloc « Comment ça marche »** : 3 étapes (`STEPS`).
- **CTA final** répété en bas de page.

### 2. Authentification OAuth 42

Flow `authorization_code` standard, en trois routes :

| Route | Fichier | Rôle |
|---|---|---|
| `GET /api/auth/login` | [route.ts](app/api/auth/login/route.ts) | Redirige vers `/oauth/authorize` de l'API 42 (scope `public`) |
| `GET /auth/callback` | [route.ts](app/auth/callback/route.ts) | Échange le `code` contre un `access_token`, appelle `/v2/me`, crée la session, redirige vers `/ranking` |
| `GET /api/auth/logout` | [route.ts](app/api/auth/logout/route.ts) | Détruit la session, redirige vers `/` |

Le callback récupère et stocke en session : `accessToken`, `login`, `userId`,
`campusId`, `campusName`, `poolYear`, `cursusId` (cursus principal = `42cursus`,
fallback id `21`) et `image`. La session est un cookie **chiffré, httpOnly,
sameSite=lax** (`secure` en production) géré par
[lib/session.ts](lib/session.ts).

Quand l'`access_token` expire, l'API 42 renvoie un `401`. Le code lève alors une
`TokenExpiredError` qui provoque une redirection vers `/api/auth/logout` →
l'utilisateur se reconnecte proprement.

### 3. Classement (`/ranking`)

Fichiers : [app/ranking/page.tsx](app/ranking/page.tsx) (shell) +
[RankingData.tsx](app/ranking/RankingData.tsx) (données & rendu).

Page protégée (redirige vers `/` sans session). Elle affiche le classement des
étudiants d'un **campus** et d'une **année de piscine** donnés, triés par
**niveau décroissant**.

Éléments de la page :
- **Topbar** : « Connecté en tant que *login* » + lien de déconnexion.
- **Hero** : titre (« Classement » ou « Classement global »), sous-titre
  campus · piscine, et le widget [Rang mondial](#4-rang-mondial-globalrank).
- **Filtres** ([Filters.tsx](app/ranking/Filters.tsx)) : sélecteur de campus +
  menu déroulant d'année de piscine. Changer un filtre repart sur la page 1.
- **Stats de la page** (`hero-stats`) : ta position, le niveau moyen de la page,
  le nombre d'inscrits sur la page.
- **Podium** (page 1 uniquement, si ≥ 3 résultats) : top 3 avec médailles
  or/argent/bronze, photo, niveau détaillé et bouton « Comparer » (ou pastille
  « TOI »).
- **Grille de cartes** : pour chaque étudiant — rang, photo cliquable, login
  (lien vers l'intra), nom complet, badge pays + campus (en mode global), niveau
  avec barre de progression, eval points, wallet, statut en ligne/offline (avec
  sa `location`), état du **cursus** (actif / absorbé par la blackhole), et un
  bouton « Comparer ».
- **Pagination** : Précédent / Suivant. « Suivant » se désactive quand la page
  renvoie moins de 100 résultats (donc plus de page suivante).

**Mode campus vs mode global** : le filtre campus peut valoir un id précis ou
`all`. En mode global (`all`), aucun filtre `campus_id` n'est envoyé à l'API et
chaque carte est annotée d'un **badge pays + campus** récupéré via
`/v2/campus_users` (le drapeau vient de [lib/country-flags.ts](lib/country-flags.ts)).

### 4. Rang mondial (`GlobalRank`)

Fichier : [app/ranking/GlobalRank.tsx](app/ranking/GlobalRank.tsx)

Widget affiché dans le hero. Il calcule le **rang mondial exact** de
l'utilisateur dans sa promo : on parcourt le classement global (tous campus)
trié par niveau, filtré sur l'année de piscine, et on compte combien de
personnes sont classées avant lui jusqu'à le trouver (jusqu'à 20 pages de 100).
Il partage le même cache que le classement global. En cas d'erreur, le widget
disparaît silencieusement (non bloquant).

### 5. Sélecteur de campus (`CampusPicker`)

Fichier : [app/ranking/CampusPicker.tsx](app/ranking/CampusPicker.tsx)

Composant client : un dropdown custom avec **recherche** et **navigation
clavier**. Particularités :
- Option **« 🌍 Global (tous les campus) »** épinglée en haut.
- **Ton campus** épinglé juste après, avec le tag « Ton campus ».
- Le reste des campus est **groupé par pays** (ordre alphabétique), chaque
  groupe préfixé du drapeau du pays.
- Champ de recherche qui filtre par nom de campus **ou** par pays.
- Flèches haut/bas pour naviguer, Entrée pour choisir, Échap pour fermer, clic
  extérieur pour fermer.

### 6. Duel / comparaison (`/compare/[login]`)

Fichiers : [app/compare/[login]/page.tsx](app/compare/[login]/page.tsx) (shell)
+ [CompareData.tsx](app/compare/[login]/CompareData.tsx) (logique & rendu).

Compare l'utilisateur connecté (« TOI ») à un autre étudiant (« RIVAL »). On
récupère **tous les `projects_users`** des deux comptes, on ne garde que les
projets **validés** du cursus, puis on les répartit en 4 catégories :

| Catégorie | Signification |
|---|---|
| **À rendre** (`toDo`) | Projets que le rival a validés et que tu n'as pas encore faits |
| **À retry** (`toRetry`) | Projets validés par les deux, mais où le rival a une meilleure note |
| **Tu domines** (`youAhead`) | Projets validés par les deux, où **tu** as la meilleure note |
| **Toi seul** (`onlyYou`) | Projets que tu as validés et pas le rival |

Le matching entre projets utilise plusieurs index pour gérer les variantes
d'examens (même projet, `project.id` différent selon le campus/session) :
par `project.id`, par `slug`, et par `parent_id`.

Éléments de la page :
- **En-tête VS** (`vs2`) : les deux avatars, niveaux détaillés, barres de
  progression, et l'**écart de niveau** (« tu es devant » / « écart à combler »
  / « ex aequo »).
- **Bandeau KPI** : nombre de projets validés de chacun, écart en projets, et
  nombre total d'actions pour rattraper.
- **Plan d'action** (`prioritized`) : la liste fusionnée *à rendre* + *à retry*,
  **classée par XP décroissant** — commencer par le `#1` est le chemin le plus
  rapide pour rattraper le rival. Chaque carte indique le type (À RENDRE / À
  RETRY), la note (ou la transition note actuelle → note cible), et le **gain
  d'XP estimé**.
- **« Ce que tu as en plus »** (`brag`) : deux colonnes *Tu domines* et *Toi
  seul*, pour le côté fierté.
- **État vide** : si rien à rattraper, un message « Tu es au niveau ou devant ».

### 7. Graphique de progression

Fichiers :
[ProgressionChartServer.tsx](app/compare/[login]/ProgressionChartServer.tsx)
(serveur) + [ProgressionChart.tsx](app/compare/[login]/ProgressionChart.tsx)
(client) + l'endpoint streaming
[app/api/experiences/[userId]/route.ts](app/api/experiences/[userId]/route.ts).

Affiché sous le duel : une **courbe du niveau dans le temps** pour les deux
étudiants (Recharts `LineChart`). Le niveau à chaque date est reconstruit à
partir des projets validés (`marked_at`) et de l'XP de chaque projet, cumulée
puis convertie en niveau via `xpToLevel`.

Le calcul est d'abord fait **côté serveur** (`ProgressionChartServer`) pour un
premier rendu immédiat. Le composant client peut aussi se rafraîchir via
l'endpoint `/api/experiences/[userId]`, qui **streame** sa progression en
NDJSON (`{type:"total"|"progress"|"data"|"error"}`) pour afficher une barre de
chargement. Le design détaillé est documenté dans
[docs/superpowers/specs/2026-05-25-progression-chart-design.md](docs/superpowers/specs/2026-05-25-progression-chart-design.md).

### 8. Photo en plein écran (`ClickableAvatar`)

Fichier : [app/ranking/ClickableAvatar.tsx](app/ranking/ClickableAvatar.tsx)

Tout avatar est cliquable et ouvre la photo en grand dans une **lightbox**
(fermeture par clic extérieur, croix, ou touche Échap). Le modal est rendu via
`createPortal` vers `document.body` pour échapper au `transform` CSS des cartes
parentes (sinon `position: fixed` serait piégé par le containing block). Si
aucune photo n'est disponible, on affiche les deux premières lettres du login.

### 9. Statistiques de fréquentation

Fichier : [lib/stats.ts](lib/stats.ts)

Petit système de stats sans base de données, persisté dans `data/stats.json` :
- `recordActivity(userId)` est appelé au login et à chaque visite de `/ranking`.
  Il enregistre l'utilisateur (liste de membres uniques) et son `lastSeen`.
- `getStats()` renvoie `{ total, activeNow }` — `activeNow` = utilisateurs vus
  dans les **30 dernières minutes**. Ces chiffres alimentent la landing page.

Le `ProfileLink` ([app/ProfileLink.tsx](app/ProfileLink.tsx)) est un petit
composant réutilisé partout : un lien vers le profil intra
(`profile.intra.42.fr/users/<login>`) ouvert dans un nouvel onglet.

---

## Description de chaque fichier

```
app/
  layout.tsx                       Layout racine (police Syne, <html lang="fr">, métadonnées)
  globals.css                      Toute la feuille de style (vanilla CSS)
  page.tsx                         Landing page (hero, features, stats, CTA)
  ProfileLink.tsx                  Lien réutilisable vers le profil intra 42

  api/auth/login/route.ts          Redirection vers l'OAuth 42 (scope public)
  api/auth/logout/route.ts         Destruction de session
  api/experiences/[userId]/route.ts  Endpoint NDJSON streamant la progression de niveau
  auth/callback/route.ts           Callback OAuth : échange code → token, /v2/me, crée session

  ranking/
    page.tsx                       Shell : session, fetch campus, filtres, Suspense
    RankingData.tsx                Fetch + rendu (podium + cartes + pagination + badges)
    RankingSkeleton.tsx            Placeholder shimmer pendant le chargement
    Filters.tsx                    Barre de filtres (CampusPicker + select année)
    CampusPicker.tsx               Dropdown campus : recherche, clavier, groupé par pays
    GlobalRank.tsx                 Widget « rang mondial » exact dans la promo
    ClickableAvatar.tsx            Avatar + lightbox photo (via createPortal)

  compare/[login]/
    page.tsx                       Shell : session, garde anti self-compare, Suspense
    CompareData.tsx                Fetch projets des 2 users + calcul des 4 buckets + plan d'action
    CompareSkeleton.tsx            Placeholder du duel
    ProgressionChartServer.tsx     Calcul serveur des points de progression
    ProgressionChart.tsx           Courbe Recharts + streaming client + barre de progression
    ChartSkeleton.tsx              Placeholder du graphique

lib/
  session.ts                       Wrapper iron-session (typage SessionData, options cookie)
  base-url.ts                      Origin public dérivé de REDIRECT_URI
  ft-api.ts                        Client API 42 : fetch + cache mémoire + dedup + rate limit + TTLs + helpers XP
  cursus-xp-disk-cache.ts          Cache disque de la table {projectId → XP} d'un cursus
  stats.ts                         Stats de fréquentation (membres uniques + actifs)
  country-flags.ts                 Conversion nom de pays (API 42) → drapeau emoji

data/                              (git-ignoré) stats.json + cache XP par cursus
docs/superpowers/                  Spec & plan d'implémentation du graphique de progression
```

---

## API 42 — fetch, cache & rate limit

Tout passe par `ftFetch()` dans [lib/ft-api.ts](lib/ft-api.ts) :

- **Clé de cache = le path** de la requête. La donnée étant identique quel que
  soit le token, le cache est partagé entre tous les utilisateurs.
- **Déduplication (`inflight`)** : si deux requêtes simultanées visent le même
  path, une seule part vers l'API ; les deux attendent la même `Promise`.
- **Rate limiting (`tokenQueues`)** : une file par token sérialise les requêtes
  avec un délai de **550 ms** (~1,8 req/s), sous la limite anti-spam de 2 req/s
  de l'API 42.
- **TTLs** :

  | Nom | Durée | Usage |
  |---|---|---|
  | `short` | 30 s | — |
  | `ranking` | 5 min | classements, profils |
  | `projects` | 30 min | `projects_users`, expériences |
  | `longLived` | 1 h | liste des campus, XP des projets d'un cursus |

- **Stale-on-error** : si l'API répond une erreur mais qu'une version expirée
  existe en cache, on sert le périmé plutôt que de planter.
- **Gestion 401** : un `401` lève `TokenExpiredError` → redirection logout.
- Utilitaires : `cacheStats()`, `cacheInvalidate(prefix?)`.

### Stratégie ranking (1 seul appel par page affichée)

Plutôt que de pré-filtrer par liste de `user_id` (URL trop longue → erreur 414
sur les gros campus), on filtre **côté serveur** :

```
GET /v2/cursus_users
  ?filter[cursus_id]=21
  &filter[campus_id]=X          (absent en mode global)
  &range[begin_at]=YYYY-06-01,YYYY+1-08-31
  &sort=-level
  &page[size]=100
  &page[number]=N
```

La plage `begin_at` cible la fenêtre d'inscription d'une promo, puis on vérifie
`user.pool_year === année` côté client pour les bordures. Les rangs sont
numérotés de façon contiguë grâce à `countBefore()`, qui recompte les pages
précédentes (déjà en cache, donc sans re-télécharger).

### Stratégie compare

Pour `/compare/[login]`, on fetch **tous les `projects_users`** des deux users
(paginés, TTL 30 min) puis on calcule en mémoire les 4 buckets (à faire / à
retry / tu domines / toi seul) et le plan d'action priorisé par XP.

---

## Le calcul du niveau et des XP

L'API 42 ne renvoie pas toujours l'XP directement utilisable, donc l'app la
reconstruit :

- **`xpToLevel(xp)`** (dans `ft-api.ts`) convertit une XP cumulée en niveau via
  la formule officielle 42 : `(√(84·xp + 3025) − 55) / 42`.
- L'**XP d'un projet** est dérivée de `project_sessions[].maximum_xp` (ou
  `difficulty` en fallback), modulée par la note : `maximum_xp × min(note, 125) / 100`.
- Cette table `{ projectId → maximum_xp }` est coûteuse à reconstruire, donc
  elle est mise en **cache disque** par cursus dans `data/cursus-<id>-xp.json`
  ([lib/cursus-xp-disk-cache.ts](lib/cursus-xp-disk-cache.ts)), reconstruit
  automatiquement au premier besoin (le dossier `data/` n'est pas versionné).

> Les champs `xp` / `experience_points` des `projects_users` étant souvent
> vides côté API, le calcul via la table XP du cursus est la source principale ;
> les champs bruts ne servent que de fallback.

---

## Déploiement en production

Reverse proxy **Caddy** vers `localhost:4266`, process Node géré par **PM2**.

```caddy
42rank.codeky.fr {
    reverse_proxy localhost:4266 {
        header_up X-Real-IP {remote_host}
    }
    log {
        output file /var/log/caddy/rank.codeky.fr.log
        format json
    }
    tls {
        issuer acme
    }
}
```

```bash
npm run build
pm2 start npm --name 42rank -- start
pm2 save
```

Penser à mettre le bon `REDIRECT_URI` dans le `.env` de prod **et** à l'ajouter
dans l'application OAuth 42.

> ⚠️ Le cache API est en mémoire : il est **perdu au redémarrage PM2**. Le cache
> XP disque (`data/`) survit, lui, aux redéploiements.

---

## Pistes d'évolution

### UX
- **Recherche par login** : jumper sur une personne / lancer une compare sans la
  chercher dans la liste.
- **Bookmarks de rivaux** : épingler des logins, dashboard multi-rivaux.
- **Compare multi** : toi vs 3-5 personnes côte à côte, pas seulement 1v1.
- **Mode public** : `/ranking` accessible sans login via un app token partagé
  (`client_credentials`).
- **Bouton Refresh** : forcer un re-fetch en passant `{ force: true }` à
  `ftFetch`.
- **Toggle thème clair/sombre** + persistance localStorage.

### Données
- **Sélecteur de cursus** : aujourd'hui le graphique est figé sur `42cursus`
  (id 21) ; permettre C Piscine, Discovery Piscine, etc.
- **Skills radar** : `/v2/users/:id` renvoie les skills par catégorie.
- **Coalitions** : classement par coalition, top 3 par équipe.
- **Locations live** : qui est au poste maintenant (`/v2/locations`).
- **Hall of fame** : top all-time du campus, sans filtre pool_year.

### Technique
- **Cache Redis** : partager entre instances et survivre aux déploiements.
- **PWA mobile** : manifest + service worker, mode offline.
- **Rate limit guard** : lire `X-Hourly-RateLimit-Remaining` et throttle
  proactivement avant 1200/h.
- **OAuth `state`** : ajouter le paramètre anti-CSRF avant un usage public.
- **Route admin `/debug/cache`** : exposer `cacheStats()` (hit rate, taille).

### Gamification
- **Notifications** : mail/push si quelqu'un te dépasse, blackhole < 30 j, ou
  un rival valide un nouveau projet.
- **Achievements** : badges (lvl 5, top 10 campus, 50 projets, premier 125).
- **Défis 1v1** : challenger un autre étudiant sur un projet.
- **Digest hebdo** : récap par mail de ton évolution vs tes rivaux épinglés.

---

## Notes de dev

- `ClickableAvatar` utilise `createPortal` vers `document.body` pour que la
  lightbox échappe au `transform` des cartes parentes.
- Le `Suspense` du ranking a une `key={campus}-{pool}-{page}` pour forcer la
  réapparition du skeleton quand les filtres changent.
- TTL ranking 5 min : après avoir validé un projet, ton niveau bouge mais le
  classement le reflète au plus tard 5 min après.
- Le dossier `data/` est git-ignoré : `stats.json` et le cache XP par cursus
  sont générés au runtime, jamais versionnés.
```
