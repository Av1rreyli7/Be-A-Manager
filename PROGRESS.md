# Be-A-Manager combined site: progress

Resume from the first unchecked box. Each phase lists what "done" means.

- [x] Phase 0: references split into stratum_reference.md, vesper_reference.md, vertex_spaceedu_reference.md (parent folder)
- [x] Phase 1: read both codebases and all four references (plus motion.dev docs and the design skill file)
- [x] Phase 2: scaffold combined app (site folder, dependencies, custom server.js, first build and boot proven)
- [x] Phase 3: port Floodlights server and client into site/floodlights (router + standalone mode, batteries adapted: 175 and 110 pass)
- [x] Phase 4: landing page at the root (src/landing, src/app/page.tsx). Old Front Office hub moved to /front-office.
- [x] Phase 5: Floodlights restyle (tokens, fonts, buttons, panels, lobby frame, starfield, decode labels)
- [x] Phase 6: 3D match (floodlights/match3d.mjs, look picker on the kick off screen, Classic kept)
- [x] Phase 7: testing
  - [x] tests-site/test_match3d.js (48 pass)
  - [x] landing tests (vitest, jsdom): tests/landing.test.tsx, 79 vitest tests pass in total
  - [x] combined server boot test: tests-site/test_boot.js (47 pass, about 170 MB idle)
  - [x] dash cleanup in Front Office source and data (tests-site/test_site.js checks every file, 148 pass)
  - [x] landing preview screenshots in public/landing
  - [x] everything run 3 times in a row with 0 failed: typecheck, vitest 79, API battery 175, DOM battery 110,
        3D checks 48, site checks 148, build, boot test 47 (npm run test:all)
- [x] Phase 8: deploy docs (DEPLOY.md, render.yaml, README.md) and upload folder (npm run upload)

All phases are done. Nothing is left to resume.

## Notes for a resumed run
- site/ started as a copy of front-office/ (Next.js 16 shell). Floodlights files live in site/floodlights/.
- Choice made: custom server (Express + Next in one process), not static export. Front Office has
  dynamic routes (/game/player/[id] and friends) and an API route, so a static export would need changes
  to Front Office itself. Idle memory of the combined server measured at about 170 MB.
- Floodlights API stays at /api/... because it does not collide with Front Office (which only owns /api/refresh-data).
  The Floodlights page moved from / to /floodlights/ and match.js to /floodlights/match.js.
- Fonts are self hosted in floodlights/fonts (Inter, Chakra Petch, Instrument Serif italic, Geist Mono). All downloads worked.
- One accent for the whole site: floodlight volt #d0e85c.
- Scratch tool used for screenshots: headless Chrome over the DevTools protocol (not part of the site).
- Resume check after the overnight crash (2 Oct): no file was cut off or corrupted. This checklist was behind
  the real state, and the upload folder held an older floodlights/test_sept.js. Both are fixed now.
- test_sept.js section about playing against another manager: the cup draw is random, and about one world in
  thirty paired the two managers in the EFL Cup, which made that section fail by chance. The test now makes
  worlds until the draw keeps the two apart. The game itself was not changed.
- Two more rare chance failures in test_sept.js were found by running it 118 times (2 failures) and fixed in the
  test only: a loan request can go to the second manager's club, so the Host now only answers one sent to
  Arsenal; and a player who moves club mid season gets a new deal, which the "contracts did not tick down"
  check now skips. The game itself was not changed.
- Later change: the side preview card on the landing (the browser mock with the ALSO HERE label) was removed,
  with its two preview images in public/landing. The rail on the left switches the featured game.
- Later change: on the landing page the second entry is now called Game Night (kicker BASKETBALL BUNDLE), with
  one line each for the two games inside it, Front Office and Hardwood Legends. Landing naming only: the app
  at /front-office, its path and the internal id "frontoffice" are unchanged.

## Game Night restyle (visual only)

Goal: the app at /front-office (Front Office and Hardwood Legends) gets the same look as the landing page and
Floodlights: black ground, hairlines at 13 percent white, chamfered corners, Inter for reading, Chakra Petch for
labels and big numbers, liquid glass buttons, the glow button for the main action, volt as the one accent.
No logic, data, routes or save formats change. Resume from the first unchecked box.

Decisions:
- The look is driven from the middle: tokens and shared classes in src/app/globals.css, the palette in
  src/lib/theme.ts, fonts in src/app/layout.tsx, shared parts in src/components/ui.tsx. Screens mostly follow.
- Dark mode is the site look. Light mode and the Colorful / Plain switch still work (they are features).
  The accent is volt for every team. Team colours stay only where they name a team: the header band, team
  marks, hero and card washes.
- Fonts are the self hosted files in floodlights/fonts, so the build no longer downloads Google fonts.

Checklist:
- [x] R0 scratch tour tool (headless Chrome, saved league, screenshots of every screen)
- [x] R1 foundation: fonts, tokens, theme.ts, globals.css (panels, labels, chips, inputs, tables, motion)
- [x] R2 shared parts: ui.tsx (Card, Button, Tabs, Modal, PageHeader, Stat, Rating, PlayerCard), DataTable,
      SimControls, Toasts, NewsList, PickList, PlayerActions, AppearancePicker
- [x] R3 Game Night hub (/front-office)
- [x] R4 Front Office main menu (/gm) and online lobby (/online)
- [x] R5 app shell (game/layout.tsx): header band, side menu, ticker, phone bottom bar, boot screen
- [x] R6 Team screens: dashboard, roster, depth, schedule, cap, finances, staff
- [x] R7 Front office screens: trade, finder, assets, free-agency, contracts, draft, offseason
- [x] R8 League screens: standings, playoffs, stats, news, awards, history, players, compare
- [x] R9 Detail screens: player/[id], team/[id], box/[id], play, settings, modals, the More menu
- [x] R10 Hardwood Legends: menus, team pick, season screens, pause and help, HUD (the 3D court stays as is)
- [x] R11 light mode and phone width pass
- [x] R12 tests: typecheck, vitest, Floodlights batteries, site checks, build, boot test, click through
- [x] R13 docs, upload folder, push

Restyle result: all boxes done. One full run of npm run test:all passed with 0 failed (typecheck, vitest 81,
API battery 175, DOM battery 110, 3D checks 48, site checks 154, build, boot test 47). Clicked through on the
production build: landing to Game Night, new league, roster auto fix, sim, trade screen, save and load, a game
day played in Hardwood Legends from Front Office, and a Hardwood Legends quick play game.
- One layout fix came with it: the page entrance animation kept a transform on the page, which trapped the
  full screen Hardwood Legends game inside the page column when started from Front Office. It now fills the
  whole window. This was already so before the restyle.
- Not clicked through with two real players: the online friends league (only its screens were checked).
