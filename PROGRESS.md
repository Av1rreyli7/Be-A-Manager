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

## Floodlights 3D match overhaul (looks and gameplay depth)

Goal: the 3D playable match gets player identity, Hardwood Legends level presentation, a proper HUD, and
ratings driven gameplay with skill moves, slide tackles, standing tackles and through balls. Classic stays
available and untouched. Server rules unchanged. Resume from the first unchecked box.

Decisions:
- The squad data has no per skill attributes and no shirt numbers (players are name, position, age, rating,
  role). So the 3D match derives pace, dribbling, shooting, passing, defending and physical from rating, role
  and a name hash (the same way Hardwood Legends derives its attributes from overall and archetype), and shirt
  numbers from position and role, unique inside the XI. Everything is deterministic for a given squad.
- The 3D match has its own sim, floodlights/match_sim3d.mjs, forked from the one in match.js and then grown.
  The Classic sim in match.js stays byte for byte as it was (tests-site/test_site.js checks that), so Classic
  plays exactly as before. The controller in match.js picks the deep sim when the 3D view is on.
- The 3D view owns its HUD (DOM, site design language) and the name tags. In 3D the Classic canvas is not drawn.
- Frame rate guard: the view measures its own frame times and steps quality down (shadow map, pixel ratio,
  crowd) if a normal laptop cannot hold the rate.

Checklist:
- [x] F1 deep sim: attributes, movement, shooting, passing, keeping, stamina all driven by attributes
- [x] F2 new controls in the deep sim: T through ball, X slide tackle, Space standing tackle and pressure, F skill move
- [x] F3 AI uses the same toolkit by rating: skill moves, through balls, slides, timed tackles
- [x] F4 commentary pools with personality, no instant repeats
- [x] F5 3D view: lighting with shadows, mow lines, numbered shirts, skin and hair variants, jointed figures
- [x] F6 3D view: markers and name tags, reacting nets, stadium bowl, broadcast camera with goal zoom
- [x] F7 HUD in the site design language: scorebug, clock, player card, power meter, ticker, goal banner
- [x] F8 controller and page: new keys, sim pick, help screen, loader, server route, styles
- [x] F9 tests: 3D battery extended (attribute scaling, fast v slow, tackles, through balls, skill moves), site and boot checks
- [x] F10 all batteries 0 failed run 3 times, vitest, typecheck, boot test; upload folder; push

Overhaul result: all boxes done. npm run test:all passed three times in a row with 0 failed (typecheck, vitest 81,
API battery 175, DOM battery 110, 3D checks 180, site checks 156, build, boot test 48), then the view got three
small fixes from a real browser look (ad board text fit, darker crowd, the frame rate guard) and the batteries
were run again. Played in Chrome on the production build: Arsenal v Wolves, Liverpool away and Man City away,
all in 3D, with no console errors beyond a three.js note about the shadow map type (now fixed).
- The frame rate guard measures the CPU work per frame (over 11 ms) or a floor of 24 frames a second before it
  drops a quality level. The first version used the raw frame interval, which also trips on a 30 Hz display or a
  throttled tab, so a match that drew in 6 ms a frame was losing its shadows for nothing.
- Measured on this Mac at full quality: about 6 ms of CPU work per frame, 1933 crowd seats, about 60k triangles.
- Shirt textures use the Chakra Petch font when the page has it loaded, with an Arial Black fallback.
- FLMatch.view3d() returns the live 3D view while a 3D match is open (quality(), setQuality(q), stats()).

## Dynamic OVR, events, real world travel, season sim rework, loan cap

Goal: effective OVR per player (form, morale, home or away with a personal offset, travel, injury return) drives
every match in every league and the playable match; staff upgrades become real; a pool of 200 plus unexpected
events with a per club news feed; a researched real world travel system with a fund, a planner and AI policies;
sim to a chosen week removed in favour of week by week plus one Sim Season button; one loan in per week.
Resume from the first unchecked box.

Decisions:
- New pure module floodlights/condition.js holds the maths (effective OVR, offsets, form and morale updates,
  injury return, event rolls, travel distances, options and prices, AI travel policy). The server requires it,
  and a new fast battery floodlights/test_condition.js checks it without booting a server.
- Data files: floodlights/events_data.js (the event pool) and floodlights/travel_data.js (every club: city,
  country, coordinates, main airport, three real hotels by name: budget, standard, luxury).
- Storage: form (fm) and morale (mo) live on the player only when not zero. Injury return is ret (weeks left)
  and retN (weeks total). The personal home or away offset is a hash of the player id and name, never stored.
  Event effects with a duration sit on the club as a short list (fx) capped at 8. Club news is capped at 10
  entries. Travel bookings are a small object on the club keyed by trip id.
- The two byte identity checks in tests-site/test_site.js for the server rules body and the page script are
  removed on purpose: this build changes both by request. The Classic sim and world data checks stay.
- Server rules kept: one signing per week, one play per round, host simmed screen, settled stars, release to
  AI only, Romano, cups. Loans get their own one per week cap.

Checklist:
- [x] C1 condition.js: effective OVR, offsets, form and morale updates, injury return, staff effects, tuning constants
- [x] C2 events_data.js: 200 plus events, the roll function, per club news
- [x] C3 travel_data.js: 320 clubs researched, distances, transport options, prices, AI policy, trip modifiers
- [x] C4 server: strengths and simMatch use effective OVR, weekly updates, events, travel fund and bookings,
      smart fill, cup prompts and policy fallback, sim season route, simto removed, loan cap, staff effects, state
- [x] C5 page: squad form and morale columns, club news in the feed, sim buttons, advisor screen, travel planner
- [x] C6 tests: test_condition.js battery, API battery sections, DOM and site checks updated, 3 clean runs
- [x] C7 docs, upload, push

Build result: all boxes done. npm run test:all passed three times in a row with 0 failed (typecheck, vitest 81,
condition battery 58, API battery 207, DOM battery 110, 3D checks 180, site checks 156, build, boot test 48).
Clicked through in Chrome on the production build: the advisor on season start, the planner with Smart fill,
the squad form and morale arrows after four weeks, the club news block in the feed, the Sim season button and
the nudge when a cup away trip appeared mid season.

Tuning numbers (all in floodlights/condition.js, T):
- Form: win +1, win by 3 or more +2, loss -1, loss by 3 or more -2, range -3 to +3, drifts one step toward 0
  with a 35 percent chance each week when nothing happens.
- Morale: win +0.3, loss -0.3, range -2 to +2, drifts 0.1 a week, new signing +1, transfer listed -1.
- Home +1, away -1, personal offset -1 to +1 in half steps (seeded from the player id and name, never stored):
  a strong traveller loses nothing away, a homebody loses two. Match analyst: an extra +1 at home.
- Injury return: -5, healing +1 a week over 5 weeks, 3 weeks with a head physio.
- Travel: bus -1, train -0.5, economy -1, premium 0, business +0.5; budget hotel -0.75, standard 0, luxury +0.5;
  long haul (2500 km plus) an extra -0.5 unless business. Range about -2.25 to +1. AI clubs: base budget 100m
  plus travel luxury, 35m plus standard, below that cheap.
- Prices for the whole party: bus 3k plus 15 per km, train 5k plus 25 per km, economy 12k plus 11 per km,
  premium 1.9x, business 3.2x; hotels 7k, 16k, 40k a night, two nights on a long haul. A Premier League season
  of standard travel is about 500k to 600k.
- Events: 15 percent chance of one event a week per club, 8 percent of those bring a second, about 6 a season.
  Pool of 233 events. News kept for human clubs only, capped at 10 lines. Effects capped at 8 per club.
- Scout: the selling club reads a human bid 10 percent higher, settles 8 percent lower, star refusals 30
  percent instead of 45. Youth coach: academy kids gain a point in 30 percent of weeks (8 percent without).
- Balance check over three seasons against the old server: top three per league and point spreads are in the
  same range (the old sim already let Real Madrid and PSG run away), so the modifiers swing close games
  without changing who the good teams are.
- Save size: one game with 320 clubs tracked is about 1.6 MB, about the same as before.

## Dynamic OVR display, auto subs and playing time morale

Goal: every player list shows base OVR, an arrow and the effective OVR with a breakdown popover; simmed
matches use the eleven plus zero to five automatic subs; everyone who played moves with the result by his
minutes; playing time drives morale; appearances show in the squad table; subs show in the match detail.
Playable 3D and Classic matches are unchanged. Resume from the first unchecked box.

Decisions:
- Subs and playing time maths live in condition.js (rollSubCount, pickSubs, participants, recordAppearance,
  playingTime). Weights for sub counts: 7, 16, 34, 27, 11, 5 percent for zero to five. Poor form and below
  average starters come off, position matched bench players come on, changes between the 46th and 85th minute.
- Team strength weighs everyone by minutes, so a weak bench costs real goals.
- Form now moves in tenths so a late sub gets a sliver of the swing. Appearances are one small array on the
  player (starts, sub games, minutes), bench weeks one small number, both reset at the new season.
- Bench morale: after one week of grace, minus 0.25 a week (stars minus 0.4, kids minus 0.15), which outruns
  the 0.1 drift, so a star who never plays sinks about 1.5 in ten weeks. Playing 60 plus minutes adds 0.05.
- The page chip is one helper, ovrChip, used by the squad, lineup pitch and lists, market, academy, loans out
  and scout tips. The popover is hover or keyboard focus, in the site design language.

Checklist:
- [x] D1 condition.js: subs, participants, minutes based form, appearances, playing time morale
- [x] D2 server: strengths with subs and minutes, afterResult, subs in match detail, cond on every list
- [x] D3 page: ovrChip with popover and pulse, Apps column, subs in match detail
- [x] D4 tests: condition, API and DOM checks, 3 clean runs
- [x] D5 docs, upload, push

Build result: all boxes done. npm run test:all passed three times in a row with 0 failed (typecheck, vitest 81,
condition battery 69, API battery 209 to 210, DOM battery 116, 3D checks 180, site checks 156, build, boot
test 48). Checked in Chrome on the production build: the OVR chips with arrows in the squad table, the popover
on focus with form, morale, travel streak and this season's minutes, the Apps column (starts plus sub games,
minutes, a sub showing 1+3), and the subs line under the match detail after a simmed week.
- Sub count over 30000 rolls: about 7, 16, 34, 27, 11 and 5 percent for zero to five.
- Save size is unchanged in practice: appearances are one tiny array per player who played.

## Clean OVR display, event popups, balance tuning, unused player decline

Goal: one number on every player (effective when it differs, with a small arrow, else just the base), the
breakdown and the base in the tooltip; every event that hit your club pops up after a sim, one after another,
and lives in the News feed; gains slower than losses, hard caps, a pull toward zero that grows with the
distance, and unused players sliding down gradually. Resume from the first unchecked box.

Decisions:
- Display rule is one page function, ovrFace(base, eff): flat shows base only, otherwise the effective number
  plus an up or down arrow. The lineup ball uses the same face with the arrow in the corner, no pill.
- Popups: club news items carry a rising id, each user keeps seenNews, the state sends unseenNews oldest first,
  the page queues them and marks each seen with /api/newsseen when clicked. Human clubs keep 40 news lines so a
  Sim Season never swallows one. Event effects with a duration carry a short cause for the tooltip.
- Tuning: win +0.6 form (big win +1.0), loss -1.0 (big loss -1.6), morale win +0.2, loss -0.35. Drift a fifth
  of form a week (at least 0.15) and 15 percent of morale (at least 0.05). Caps in setForm and setMorale.
  Not playing: two weeks of grace, then morale -0.1 a week growing 0.03 a week (stars x1.3, kids x0.6) and
  rust -0.3 form a week down to -2. A full match lifts morale 0.1. The same rule runs for AI clubs.

Checklist:
- [x] E1 condition.js: asymmetric gains, proportional drift, caps, unused player decline, causes, news ids
- [x] E2 server: longer human archive, unseen list per manager, newsseen route
- [x] E3 page: ovrFace rule everywhere, lineup face, tooltip base and causes, popup queue
- [x] E4 tests and 3 clean runs
- [x] E5 upload, push

Build result: all boxes done. npm run test:all passed three times in a row with 0 failed (typecheck, vitest 81,
condition battery 88, API battery 217 to 218, DOM battery 120, 3D checks 180, site checks 156, build, boot
test 48). Checked in Chrome on the production build: three event popups in a row after eight simmed weeks,
each marked seen on click, the clean faces in the squad (93 with a small up arrow, 83 plain), the lineup
pitch balls and the bench list, and the tooltip with the base and the event cause.
- Event frequency proved two ways: the pure roll averages about 6 a club a season, and a real season over the
  API lands a human club between 2 and 12 lines (luck allowed for).
- Multi season check in the condition battery: four made up seasons with results, subs, playing time, drift
  and events keep league wide form and morale within 0.5 of zero with no upward creep and under 8 percent of
  players at the extremes. The same check runs on the real world after a Sim Season in the API battery.
