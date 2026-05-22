# 42 Rank

Site de classement entre etudiants 42 par campus et annee de piscine, avec
comparaison projet par projet pour savoir quoi rattraper.

## Stack

- Next.js 14 (App Router) + TypeScript
- iron-session pour la session OAuth 42 (flow `authorization_code`)
- CSS vanilla (pas de framework UI)
- API 42 v2

## Installation locale

Prerequis: Node >= 18.17 (`nvm use default` si besoin).

```bash
npm install
# remplir .env (voir ci-dessous)
npm run dev
```

L'app ecoute sur http://localhost:4266.

### .env

```
UID=<client_id de l'app 42>
SECRET=<client_secret>
REDIRECT_URI=http://localhost:4266/auth/callback
SESSION_PASSWORD=<32+ chars, generer avec: openssl rand -hex 32>
```

L'URI de callback doit etre declaree dans
https://profile.intra.42.fr/oauth/applications.
Pour avoir dev + prod, ajouter les deux URIs dans la meme app.

## Architecture

```
app/
  page.tsx                   landing avec bouton "Login with 42"
  api/auth/login/route.ts    redirect vers /oauth/authorize
  auth/callback/route.ts     exchange code + cree la session
  api/auth/logout/route.ts   destroy session
  ranking/
    page.tsx                 shell (header + filtres + Suspense)
    RankingData.tsx          fetch + render (podium + cards + pagination)
    RankingSkeleton.tsx      placeholder shimmer
    Filters.tsx              dropdowns campus + annee
    ClickableAvatar.tsx      lightbox photo (portal pour echapper aux transform)
  compare/[login]/
    page.tsx                 shell + Suspense
    CompareData.tsx          fetch projets des 2 users + calcule le diff
    CompareSkeleton.tsx

lib/
  session.ts                 wrapper iron-session
  ft-api.ts                  fetch 42 + cache memoire + dedup + TTLs
```

## API 42 — fetch & cache

`lib/ft-api.ts` :
- Cle de cache = path (partage entre tous les utilisateurs, la donnee est
  identique quel que soit le token)
- Dedup : si 2 requetes simultanees pour le meme path, une seule part vers
  l'API, les deux attendent la meme Promise
- TTLs : `ranking` 5min, `projects` 30min, `longLived` 1h
- Stale-on-error : si l'API renvoie une erreur mais qu'on a une version
  expiree en cache, on la sert au lieu de planter

### Strategie ranking (1 seul appel par page affichee)

Au lieu de pre-filtrer par liste de `user_id` (URL trop longue pour les gros
campus, on tape un 414), on filtre cote serveur :

```
GET /v2/cursus_users
  ?filter[campus_id]=X
  &filter[cursus_id]=21
  &range[begin_at]=YYYY-06-01,YYYY+1-08-31
  &sort=-level
  &page[size]=100
  &page[number]=N
```

Puis on verifie `user.pool_year === selectedYear` cote client pour les
bordures. Pagination : Prev/Next, "Suivant" se desactive quand la page rend
moins de 100 resultats.

### Strategie compare

Pour `/compare/[login]`, on fetch tous les `projects_users` des deux users
(paginates, TTL 30min) puis on calcule en memoire les 4 buckets : a faire /
a retry / tu domines / toi seul.

## Deploiement prod

Caddy reverse proxy vers `localhost:4266`, PM2 pour le process Node.

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

Penser a changer `REDIRECT_URI` dans le `.env` de prod et a l'ajouter dans
l'app OAuth 42.

## Pistes d'evolution

### UX

- **Recherche par login** : champ pour jumper sur une personne ou lancer une
  compare sans la chercher dans la liste
- **Bookmarks de rivaux** : epingler des logins (localStorage ou DB),
  dashboard multi-rivaux avec leurs niveaux a cote du tien
- **Graphique de progression** : niveau dans le temps via les `marked_at`
  des projets valides
- **Compare multi** : toi vs 3-5 personnes cote a cote, pas seulement 1v1
- **Mode public** : rendre `/ranking` accessible sans login via un app token
  partage (`client_credentials`), avec une banner "se connecter pour
  comparer"
- **Refresh button** : forcer un re-fetch et bypasser le cache
- **Dark/light toggle** + persistance localStorage

### Donnees

- **Selecteur de cursus** : aujourd'hui hardcode sur 42cursus (id 21),
  permettre C Piscine, Discovery Piscine, etc.
- **Skills radar** : `/v2/users/:id` renvoie les skills par categorie,
  afficher en radar chart
- **Coalitions** : classement par coalition au campus, top 3 par equipe
- **Locations live** : `/v2/locations?filter[active]=true&filter[campus_id]=X`
  pour voir qui est au poste maintenant (refresh 30s)
- **Hall of fame** : top all-time du campus, sans filtre pool_year
- **Activite recente** : feed des derniers projets valides au campus
- **Stats par projet** : distribution des notes pour chaque projet du cursus

### Technique

- **Cache Redis** : aujourd'hui en memoire, perdu au restart PM2. Redis
  permet de partager entre instances et survivre aux deploys
- **PWA mobile** : manifest + service worker, install sur ecran d'accueil,
  mode offline avec derniere donnee cachee
- **Disk persistence** : dump JSON du cache toutes les N minutes pour
  retrouver l'etat au cold start sans re-taper l'API
- **Rate limit guard** : lire `X-Hourly-RateLimit-Remaining` des reponses 42
  et throttle proactivement avant 1200/h
- **OAuth state param** : ajouter le `state` anti-CSRF dans le flow OAuth
  avant prod publique
- **Stats endpoint** : route admin `/debug/cache` qui affiche `cacheStats()`
  (hit rate, taille, entries en cours)

### Gamification

- **Notifications** : mail ou push si quelqu'un te depasse, blackhole < 30j,
  ou un rival valide un nouveau projet
- **Achievements** : badges pour milestones (lvl 5, top 10 campus, 50
  projets valides, premier 125)
- **Defis 1v1** : challenger un autre etudiant sur un projet, comparer les
  scores une fois valides
- **Hebdo digest** : recap par mail de ton evolution vs tes rivaux epingles

## Notes de dev

- `ClickableAvatar` utilise `createPortal` vers `document.body` pour que le
  lightbox echappe au `transform` des cards parentes (sinon `position: fixed`
  est trappe par le containing block du transform)
- Le `Suspense` du ranking a un `key={campusId}-${poolYear}-${page}` pour
  forcer la reapparition du skeleton quand les filtres changent
- TTL ranking 5min : si tu valides un projet, ton niveau bouge mais le
  ranking le reflete au max 5min plus tard. Acceptable mais pas instantane.
  Pour rafraichir tout de suite, ajouter un bouton "Refresh" qui passe
  `{force: true}` a `ftFetch`
