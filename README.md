# Floodlights: World Career Mode

A multiplayer football career mode you host online and play with friends in the browser. One person hosts, everyone else joins with a 4 letter code, and you all run clubs (and countries) in the same living world.

## The world

- 15 playable leagues: Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Eredivisie, Primeira Liga, Belgian Pro League, Super Lig, Scottish Premiership, Saudi Pro League, MLS, Liga MX, Brasileirao and the Argentine league. Friends can all manage in different leagues in the same game.
- 5 AI run second divisions that play out their own seasons and feed the cups: the Championship, La Liga 2, Serie B, 2. Bundesliga and Ligue 2.
- Around 3,900 real players across 250 clubs, from £1m squad fillers to £300m superstars. Every club has a full squad, at least two keepers and a transfer budget that fits its level.

## What you can do

- Pick any club from any playable league. Clubs nobody picks are run by the AI, and every league plays its full season every week.
- Take a national team job on top of your club job. 16 national sides (England, France, Spain, Germany, Portugal, Netherlands, Belgium, Italy, Argentina, Brazil, Uruguay, Croatia, USA, Mexico, Turkey, Scotland) built from the real players in the game. Nations fight it out in the International Cup during the season.
- Youth academy at every human club. A few made up kids with hidden potential arrive each season, they grow every year, and you can promote the good ones into your first team before they get released at 20.
- Calendar tab. A FIFA style week by week view of your whole season: your league fixture, your cup ties, the International Cup, transfer window dates and results as they come in.
- Every competition runs at once and is simmed on set matchweeks:
  - A domestic cup for every playable league (FA Cup and EFL Cup in England, Copa del Rey, Coppa Italia, DFB Pokal, Coupe de France, Scottish Cup, King's Cup, US Open Cup, Copa do Brasil and the rest). Second division clubs enter their country's cup.
  - Champions League, Europa League and Conference League, seeded from last season's league tables from season 2 onwards.
  - Copa Libertadores for the top Brazilian and Argentine clubs.
  - The International Cup for the national teams.
  - Level after 90 goes to pens. Cup wins pay prize money and winners go in the history book.
- Pick your own starting lineup: exactly 11 starters with one keeper, plus up to 9 subs. If a starter gets sold the game auto strips him and falls back to your best XI.
- Real transfer windows. The summer window runs until matchweek 4 and the January window covers weeks 20 to 23. Outside those, no new bids and no completed deals.
- Sign players from any club in the world. AI clubs accept, decline or counter. Bid for your friends' players and haggle properly with counters both ways. Transfer list players to attract AI bids from abroad.
- Play your own matches. In the Matches tab, hit Play this match next to your fixture for the week and play it yourself in a top down 11 v 11 game: WASD to move, Shift to sprint, Q to pass, hold E to shoot, Esc to pause. How hard it is follows the real squad ratings of both clubs. Your final score is used when the host sims the week. One match per manager per week, league or cup. If you skip it or leave early, the match is simmed like normal.
- Matchday screen. When the host sims a week the whole lobby is taken to a full screen results view with your league scores and your cup ties. Nobody leaves until the host sends everyone back.
- Tables tab covers every league in the world, including the AI second divisions.
- End of season prize money scaled by league, player ageing, kids improving, academy intakes, and a fresh season with new cup draws starts automatically. Old saves from the previous version still load.

## Run it locally

```
npm install
npm start
```

Open http://localhost:3000, create a game, and share the 4 letter code. Friends open the same address and join with the code.

## Put it online free (Render)

1. Push these files to a GitHub repo. Note that `world_pack.js` and `extra_clubs.js` are needed alongside the others, so make sure every file in this folder is in the repo.
2. On render.com make a new Web Service from the repo.
3. Build command `npm install`, start command `npm start`. The free plan is fine.
4. Share the Render URL with your friends. They join with the 4 letter code like normal.

Heads up: the free Render plan restarts the server when it sleeps, and saves live in a file on the server, so a long idle spell can reset games. Keeping the tab alive during a session is enough for a normal play night.

## Files

- `server.js` runs the whole game world.
- `index.html` is the entire interface.
- `match.js` is the playable match engine. It must be uploaded next to `index.html`.
- `players.js` builds the database.
- `extra_clubs.js` and `world_pack.js` hold the club, player, nation and league data.
- `package.json` and `package-lock.json` for install.
