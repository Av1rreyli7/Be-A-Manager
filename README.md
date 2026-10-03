# Be-A-Manager

Two manager games on one site, by Avir & Ayanssh.

- **Floodlights** (`/floodlights/`): a multiplayer football manager. Create a room, share the 4 letter code, pick clubs and play seasons together. You can play your own matches in 3D or in the Classic top down view.
- **Game Night** (`/front-office`): two basketball games in one. Front Office is a GM game with real rosters, contracts, trades, the draft and free agency, where the matches play out on their own. Hardwood Legends is a 3D game you play yourself on the keyboard. The landing page calls this entry Game Night; the address and the app itself are unchanged.
- **The landing page** (`/`): pick a game. The featured game fills the stage, and the list on the left switches between the two.

## Run it on your computer

```
npm install
npm run build
npm start
```

Then open http://localhost:3000. For live reload while you work on it, use `npm run dev` instead of the last two lines.

## How it fits together

One Node process serves everything (`server.js`):

- **Express** owns Floodlights: the game page at `/floodlights/`, its files (`match.js`, `match3d.mjs`, `match_sim3d.mjs`, `condition.js`, `events_data.js`, `travel_data.js`, three.js, fonts) and its API at `/api/...`.
- **Next.js** serves everything else: the landing page and all of Front Office.

Why a custom server and not a static export: Front Office has pages with ids in the address (`/game/player/[id]`, `/game/team/[id]`, `/game/box/[id]`) and one API route. A static export would have meant changing Front Office itself. With the custom server Front Office needs no changes to how it works. The whole thing idles at about 170 MB of memory, well inside the 512 MB of a free Render instance.

Why the Floodlights API stayed at `/api/...`: nothing collides. Front Office only owns `/api/refresh-data`. Express answers the Floodlights paths and passes every other request on to Next.

Where things live:

| Folder | What is in it |
| --- | --- |
| `server.js` | the combined server |
| `floodlights/` | the Floodlights server (`server.js`), client (`index.html`), match engine (`match.js`), 3D match look (`match3d.mjs`) with its deep sim (`match_sim3d.mjs`), the condition and travel maths (`condition.js`), the event pool and travel dataset, world data, fonts and its two test batteries |
| `src/app/page.tsx`, `src/landing/` | the landing page (React, Motion, three.js with React Three Fiber) |
| `src/app/front-office/` | the Game Night picker with Front Office and Hardwood Legends (it used to be the home page of Front Office) |
| `src/app/game`, `src/app/gm`, `src/app/online`, `src/engine`, `src/lib`, `src/components`, `src/worker` | Front Office. The game works as before; its look now matches the rest of the site (`src/app/globals.css`, `src/lib/theme.ts`, `src/components/ui.tsx`) |
| `public/games/hardwood-legends.html` | Hardwood Legends. Its menus and HUD carry the site look; the 3D court is as it was |
| `tests/` | Front Office tests and the landing page tests (vitest) |
| `tests-site/` | 3D match checks, whole site checks, and the server boot test |

## Tests

```
npm run typecheck          # TypeScript
npm test                   # vitest: Front Office engine + the landing page
npm run test:floodlights   # the two Floodlights batteries + the 3D match checks
npm run test:site          # whole site checks (files, wording rules, upload folder)
npm run build && npm run test:boot   # boots the real server and checks every part answers
npm run test:all           # all of the above in one go
```

The Floodlights API battery uses port 3000, so nothing else may be running there while it runs.

## Deploying

See [DEPLOY.md](DEPLOY.md). Short version for Render: build command `npm install && npm run build`, start command `npm start`.

`npm run upload` makes the `upload/` folder again: a clean copy of everything that belongs on GitHub.
