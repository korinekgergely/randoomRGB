# Daily Random Colour – handoff

Projekt mappa: `/Users/gkorinek/school/daily_random_colour_cursor` (testvér: `insta_autopost_python`).

Az Instagram autopost Python projekt **nem** része ennek; ez önálló, hosszú távú, minimál felügyeletű webapp.

## Cél

Naponta **egy** véletlen `#RRGGBB` szín (Budapest idő szerint **reggel 6:00**), megjelenítés weblapon. **Nincs képfájl** – csak hex + CSS `background-color`. A fal minden betöltéskor az adatbázisból épül fel.

## Stack

- **Cloudflare Workers** (TypeScript) – API + cron
- **Cloudflare D1** (SQLite) – színek + like-ok (adat a CF felhőben, nem GitHubon)
- **Static assets** (`public/`) – HTML/CSS/JS, Worker szolgálja ki
- **Wrangler** – dev, deploy, D1 migráció
- **yarn** – package manager

## Architektúra (user betölti az oldalt)

1. Böngésző: `index.html` + `style.css` + `app.js`
2. `app.js`: `fetch('/api/wall')` → JSON
3. Worker `src/index.ts`: D1 query (`fetchWall`) → `{ colors: [...] }`
4. Kliens DOM: flex wrap, minden színhez tile (swatch + meta)
5. Like: `POST /api/like` `{ colorId, clientKey, name? }` → D1 INSERT → újra `GET /api/wall`

**Nincs** szerver-oldali teljes HTML render; **CSR** (client-side) JSON-ból.

## Üzleti szabályok

### Szín generálás

- Cron: `0 * * * *` (óránként), Worker `scheduled` → `ensureDailyColor`
- Csak ha Budapest `hour === 6` és az adott `color_date`-hez még nincs sor
- `color_date`: `YYYY-MM-DD` Budapest naptári nap
- `hex`: random `#RRGGBB`, **UNIQUE** constraint, retry loop ha ütközés
- **Naponta pontosan egy** új szín

### Like-ok

- **Nincs** bejelentkezés
- `client_key`: böngészőben `crypto.randomUUID()` → `localStorage` (`colorWallClientKey`)
- Egy böngésző (**client_key**) **színenként max 1** like (`UNIQUE(color_id, client_key)`)
- User **több színt** is like-olhat
- **Név opcionális**; ha megadja: **színenként egyedi** név (nincs két „Béla” ugyanannál a színnél, case-insensitive)
- Üres név → megjelenítés: „Anonim”
- **IP ellenőrzés NEM** kell (client_key elég)

### UI

- Flexbox: `flex-wrap`, balról jobbra, lefelé (mint betűk)
- Színes blokk: **nem** kattintható, nincs zoom (`pointer-events: none`)
- Alatta szöveg: **hex | dátum | like lista**
- Csúszka: cella méret (`--tile-size`)
- Reszponzív

## D1 séma (`migrations/0001_init.sql`)

- `colors`: id, hex UNIQUE, color_date UNIQUE, created_at
- `likes`: id, color_id FK, client_key, name nullable, UNIQUE(color_id, client_key)
- Partial unique index: `(color_id, name)` ahol name nem üres

## Fájlok

```
daily_random_colour_cursor/
  HANDOFF.md          ← ez a fájl
  wrangler.jsonc
  package.json
  migrations/
  src/
    index.ts          ← fetch + scheduled handlers
    db.ts             ← hex, cron, wall, likes
    env.d.ts
  public/
    index.html
    style.css
    app.js
```

## Deploy sorrend (éles)

1. ~~GitHub repo (kód; **ne**: secrets, session.json)~~ — git init kész, push még nincs
2. ~~Cloudflare fiók + `wrangler login`~~
3. Opcionális: saját domain → CF DNS + custom domain a Workerhez
4. ~~`wrangler d1 create daily-random-colour-db`~~ → `database_id`: `e1ca0e2f-31a2-445c-bbdc-46abbc3be3a6`
5. ~~`yarn install && yarn db:remote`~~
6. ~~`yarn deploy`~~ → https://daily-random-colour.korinek-gergely.workers.dev

## Lokális dev

```bash
cd /Users/gkorinek/school/daily_random_colour_cursor
yarn install
yarn db:local
yarn seed:local   # opcionális teszt szín
yarn dev          # http://127.0.0.1:8787
```

## API

| Method | Path | Leírás |
|--------|------|--------|
| GET | `/api/wall` | Összes szín + like-ok |
| POST | `/api/like` | Body: `{ colorId, clientKey, name? }` |

Hibák: `name_taken`, `already_liked`, `color_not_found`, `invalid_client_key`

## Amit még lehet finomítani (opcionális)

- ~~GitHub repo létrehozás + első push~~ (git init kész)
- ~~Éles D1 `database_id`~~ (`e1ca0e2f-31a2-445c-bbdc-46abbc3be3a6`)
- Custom domain
- ~~Magyar UI szövegek véglegesítése~~
- Cron teszt élesben (első 6:00 után ellenőrzés)
- `insta_autopost_python/color-wall/` törölhető (duplikátum)

## Eredeti Python projekt

`insta_autopost_python/index_async.py` – instagrapi + session ID, Instagram poszt. **Abbahagyva** a Cloudflare irány miatt. Hex generálás logika: `random_hex_color()` – ugyanaz az elv TS-ben `db.ts`-ben.
