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

## Big build: landing rebuild, colorful unification, super animation, shirts, events rework, FC27 push

Goal: one colourful game with modes inside it. A cinematic landing, one shared kit and palette, every screen
animated with GSAP, lineup shirts, the transfer market RAT bug, events revealed a week ahead with one per club
per week and 200 more events, a slower OVR climb, and a 3D match pushed toward a TV broadcast with set pieces.
This replaces the earlier unfinished U1 to U8 list (its theme removal and first kit draft were kept and built on).
Resume from the first unchecked box.

Decisions:
- Palette and kit: public/kit.css. Dark night ground (#04060a) with aurora washes. Two modes on one palette:
  pitch (Floodlights: volt #d0e85c, turf #2fd27a) and court (Game Night: orange #ff8a3d, amber #ffbe4a),
  shared aurora teal, sky, violet, gold. A page sets data-kmode="pitch" or "court"; --k-accent, --k-grad and
  the glow button follow it. Position colours: GK amber, DEF sky, MID teal, FWD coral (G sky, F teal, C violet).
- Motion: GSAP 3.15 (npm gsap, @gsap/react). One motion file, public/kit-motion.js (KitMotion: rise, cascade,
  enter, count, pop, pulse, slideIn, tabIndicator, celebrate, sparks, press). Floodlights and Hardwood Legends
  load /floodlights/vendor/gsap.min.js then /kit-motion.js; React imports src/lib/motion.ts (km, useScreenEnter).
  Transform and opacity only, clearProps after every tween, nothing touches pointer-events, reduced motion jumps
  to the end state.
- Work split for parallel workers, each keeps a checklist in site/.work/<name>.md (not uploaded):
  landing (src/landing, src/app/page.tsx), gamenight (src/app/**, src/components, globals.css, theme.ts,
  hardwood-legends.html), fl-ui (floodlights/index.html look, animation, shirts, RAT bug), events (condition.js,
  events_data.js, server.js event and OVR code, the event flow functions in index.html), match3d (match3d.mjs,
  match_sim3d.mjs, match.js controller only, tests-site/test_match3d.js).
- Ports while working: shared Next dev server 3200; standalone Floodlights servers: fl-ui 3203, events 3204,
  match3d 3205, each with FL_SAVE_FILE pointing at its own scratch file (new env override in floodlights/server.js).
  The API battery takes FL_TEST_PORT. Only the lead runs next build.
- site/ now has a local git repo for checkpoints (never pushed; the GitHub copy is ../github).

Checklist:
- [x] B0 foundation: gsap installed, kit.css palette, kit-motion.js, src/lib/motion.ts, FL_SAVE_FILE, screenshot tool
- [x] B1 landing rebuild (Part 1)
- [x] B2 Game Night and Hardwood Legends: theme system gone, kit, colour, animation, voice (Parts 2 and 3)
- [x] B3 Floodlights page: colour, kit, animation, lineup shirts, RAT bug audit, voice (Parts 2, 3, 4, 5)
- [x] B4 events rework: week ahead reveal, teaser, lobby popup, one per club per week, 200 more events (Part 6)
- [x] B5 OVR balance: slower climb, multi season check (Part 8)
- [x] B6 3D match: broadcast look, kickoff dribble, goal kick rule, corners, free kicks, penalties, crosses and
      headers, AI use, match moments (Part 7, Part 3.5)
- [x] B7 integration: side by side screenshots, test_site, all batteries 0 failed, build, boot, memory under 400 MB
- [x] B8 docs, upload folder, push to GitHub

Build result: all boxes done. npm run test:all passed with 0 failed on the first full run: typecheck, vitest 80,
condition battery 106, API battery 228 (also twice in a row by the events worker), DOM battery 150, 3D battery
242 (includes the headless 24 match loop), site checks 165, build, boot test 48 (189 MB after the checks).
Production server idles at 125 MB. Proof screenshots (landing intro moments, side by side Floodlights and Game
Night, lineup shirts, events teaser and popup, 3D match) are kept locally in site/.work/proof (not uploaded).
- Event rate measured: one every 4.0 weeks per club, never two in a week. Pool 438 events (205 new, 60 of them
  off pitch injuries).
- OVR after three real seasons: title winners' regulars +0.21 to +0.36 (was +1.45 to +1.83), league regulars
  steady at about -0.17, 1.1 to 1.3 percent of players at the extremes.
- RAT column: the live data was right in every league filter and the bad digits could not be reproduced in
  Chrome; the column misalignment (rows without an arrow shifted) is fixed with a fixed arrow slot, and ovrFace now
  refuses any value that is not a real rating (falls back to the base), with DOM checks that fail on a delta.
- Shirt numbers: the server now sends squad wide numbers with the 3D lineups, so a player wears the same number
  on the lineup shirts and in the 3D match.
- Frame rate: workers measured 60 fps on mains power (landing intro, screen entrances, lineup stagger, 3D match at
  1.6 to 5.6 ms CPU a frame). The final proof run was on battery, where Chrome caps every page (even a blank one)
  at 30 fps, so those numbers say nothing about the pages.

## Sleek glass buttons with club tint, lighter landing (visual only)

- [x] One primary button for the whole site in public/kit.css: clear glass, faint tint, thin edge, soft inner
      glow, lift on hover, small press. The old glow light bank is gone everywhere. The kit rule also styles the
      app names for the same button: .btn-glow (Game Night), .btn.primary (Hardwood Legends), button.gold
      (Floodlights, including Create a game and the match screens).
- [x] Floodlights tints the buttons with the club kit once a save is loaded (clubTint in index.html sets
      --k-tint, --k-tint-2, --k-tint-edge on the page; dark colours swap or lift so the tint always shows) and
      clears it in the lobby. Small row buttons use the same glass, quieter.
- [x] Landing cut to the intro, the two animated titles, one line each and the glass enter buttons. Gone: nav
      pills, lede, kind labels, blurbs, inside list, chips, card panels, footer (stats, 3D toggle, replay,
      credit), the stats fetch and the 3D backdrop (src/landing/Backdrop3D.tsx deleted).
- [x] Tests: typecheck, vitest 79, condition 106, API 228, DOM 150, 3D 242, site checks, build, boot 48.
      The API battery's loan ask check now plays the January window again in fresh worlds when the first one
      sees no ask by chance (about one run in eleven failed on luck; the game is unchanged).

## Welcome intro first, BAM removed (landing only)

- [x] The welcome plays first and on its own (about 2.1 s): lights, WELCOME TO tracking in from the middle, the
      big letters flipping up middle out, the colour run, a light sweep clipped to the letters (a third layer per
      letter placed by --sw), a lens streak and a heartbeat, then the flight to the headline. The cards label
      now starts only after the intro layer is gone; the football kick and basketball bounce are unchanged.
- [x] The BAM logo and mark in the header are removed (and from the first paint guard).
- [x] Landing test: the welcome comes before the cards, whole sequence under 3.8 s (about 3.7 s).

## Rating display rebuilt, transfer events, player interest, human 3D players, controls strip

Goal: fix the lineup pitch and every rating column for good, add 200 transfer window events that point at a
real target, give every player an interest level toward the player's club (FC27 style, gates deals), rebuild
the 3D players as low poly humans with real motion, and replace the old match controls overlay with a slim
key strip. Resume from the first unchecked box.

Work split: lead (floodlights/index.html, test_dom_sept.js, screenshots), market worker (server.js,
events_data.js, condition.js, new interest code, test_sept.js, the multi season transfer check), match3d
worker (match3d.mjs, match_sim3d.mjs if needed, match.js controller part only, test_match3d.js).
Ports: lead 3210, market 3204, match3d 3205, each with its own FL_SAVE_FILE.

Interest contract (server to page): any player the club does not own carries
`interest: { lv: 0..3, label: "Very Low" | "Low" | "Medium" | "High", why: [reason, reason] }` in /api/market,
scout tips and offers. Reasons are short plain words ("Happy at his club", "Your league is a step down").

Checklist:
- [x] C0 plan, root cause of the broken rating display
- [x] C1 rating display rebuilt: lineup pitch shirt cards, bench rows, one rating face for every table
- [x] C2 player interest: server model, gates on acceptance with the scout, AI clubs use a light version
- [x] C3 200 transfer window events: one per club per season, windows only, named realistic target, interest bump
- [x] C4 interest chips in the market, scout tips and offers with a two reason tooltip
- [x] C5 3D players as low poly humans: bodies, kit, skin and hair, run, idle, kick, slide, keeper dive
- [x] C6 controls strip at the top of the 3D match, fades in play, back on pause, old overlay gone
- [x] C7 multi season transfer volume check, all batteries 0 failed three times, screenshots, memory under 400 MB
- [x] C8 docs, upload folder, push to GitHub

Notes:
- Rating root cause: three things fought in the same box. The rating chip was absolutely placed over the
  bottom of each shirt, the breakdown tooltip lived inside every chip (so parent rules like .benchrow .bn span
  restyled its insides and table cells clipped it), and two old .ovr rule sets disagreed (flex and grid). On the
  bench the rating sat inline after the name and wrapped under it into the buttons. Rebuilt: one face (.rt) with
  a fixed two digit box and a fixed arrow slot for every list, one floating tooltip (#ovrTip) for the page, a
  shirt card per pitch spot (shirt, X, chip under it in normal flow) sized from the pitch width with container
  units, bench rows with their own rating column. The squad table lost its second Eff number; form and morale
  are quiet signed numbers now (the green pills full of arrows are gone).
- New tests-site/test_layout.js: headless Chrome at 1440, 1280, 1024 and 390 px measures what is really drawn:
  all 7 formations with no shirt card overlap, one clean number per chip, bench rating column, squad and market
  rating columns right aligned to the pixel, interest chips aligned. LAYOUT_SHOTS=<dir> saves screenshots.
- Interest (floodlights/interest.js): club standing from squad strength, league, money, big club, recent
  trophies, table place, form and Europe; player score from the step up or down, minutes, happiness, contract,
  age, Europe, coming home (nationality from the national squads), position need. Gate after the selling club
  agrees: High as before, Medium 68 percent (78 with the scout), Low 30 (38), Very Low 6 (10), capped at 85.
  A no holds until the window shuts. AI clubs skip Very Low targets and Low ones half the time.
- Balance (6 worlds, 3 seasons, old server against new): AI deals and loans per window 81.4 before and after
  (the weekly caps bind), stars moving to much smaller clubs 349 down to 80. Scripted managers per window:
  Fulham 1.33 to 1.47, Burnley 1.61 to 1.75, Hibernian 1.36 to 1.31. Champions pull harder next season
  (Rangers average level 1.93 to 2.57).
- Transfer events (floodlights/transfer_events_data.js): 200 templates, human clubs, window weeks only, one per
  club per season, target in one of the two thinnest positions within the rating and budget bands, interest
  bump of one or two levels that lasts to the end of the next window, same teaser and lobby popup. The popup
  shows the interest jump, the player and the asking price; Tipped to you sits at the top of the market.
- 3D players: one skinned low poly body per player on an 18 bone skeleton, 7 skin tones, 7 hair colours,
  7 hair styles, beards, kit with collar, sleeves, shorts, banded socks, boots, name and number printed on the
  back, keepers with long sleeves and gloves. Two materials in total (one per team). Walk, jog, sprint, backward
  runs, idle breathing, head tracking, kicks, slides, tackles, headers, keeper ready stance and dives.
  Draw calls about 700 to about 150; view CPU about 2 ms a frame, 60 fps held.
- Controls strip: top right in line with the score bug, kit chips, full at kick off, 0.3 after 4 s, full on
  pause, labels drop under 940 px. The old 3D help overlay and the Classic hint line are gone.
- Tests, three full npm run test:all runs, all 0 failed: typecheck, vitest 79, condition 138, API 257, DOM 167,
  3D 280 (includes the headless match loop), layout 222 (new), site checks 166, build, boot 48. The server sat
  at 203 to 204 MB after the boot checks. Proof screenshots are in site/.work/proof/oct4 (not uploaded).

## October 2026 squads, landing credit, 3D match rebuilt from scratch

Goal (three parts): 1) every club's squad matches the real squads of October 2026 (summer 2026 window verified
on the web, shirt numbers, adds and removals, ratings on the same scale); 2) a small "by avir and ayanssh" credit
line on the landing under Floodlights and Game Night; 3) the playable 3D match thrown away and rebuilt from
scratch to the full gameplay spec the user pasted (locomotion, ball physics, touches, passing, shooting,
defending, keepers, 30 skill moves, off ball AI, set pieces, visuals). Classic stays untouched. Nothing outside
the match changes. Resume from the first unchecked box.

Decisions:
- Squad source: the "Current squad" lists on each club's English Wikipedia page (raw wikitext, Fs player
  templates: number, position, name), pulled by a script and cross checked against news searches for the big
  movers. Ages from Wikidata birth dates (as of 6 Oct 2026). Detailed roles from Wikidata positions where known.
- Players already in the database keep their rating and spelling (ASCII, no accents) wherever they now play.
  New players get a rating on the same scale from the research agents (knowledge plus the club's band).
- The data lands in a new file floodlights/squads_2026.js (rows: name, pos, age, rating, shirt number, role,
  loan owner). players.js applies it after the old packs are merged, so every club's squad is replaced by the
  real one. Club list and leagues stay as they are (the game's structure, travel data and tests depend on it).
  The old byte identity check on the world data files in tests-site/test_site.js is replaced by checks on the
  new squad data, on purpose.
- Shirt numbers: kitNumbers (server) and the lineup page use the real number first, the old role rule after.
- 3D match engine: plain Three.js ES modules (no React on the Floodlights page). The Floodlights page is
  vanilla HTML with no bundler, and R3F needs React plus a bundler on that page. An imperative fixed step loop
  also keeps the frame budget under control. Gameplay at 60 steps a second, ball physics sub stepped at 240 Hz,
  AI thinking staggered at about 10 Hz, animation every render frame.
- New engine lives in floodlights/m3d/ (sim core, physics, locomotion, touches, kicks, skills, defending,
  keeper, AI, set pieces, referee) and the view in floodlights/m3d/view/ (rig, procedural animation with two
  bone IK foot planting, kits, pitch, stadium, camera, HUD). match3d.mjs and match_sim3d.mjs stay as the two
  entry files the page imports. three.js is still handed in, never imported, so node tests run the real scene.
- No weather exists in Career Mode, so the match has no weather (spec 55 only asks to react to existing weather).
- Controls: base map kept (WASD move, E shoot, Q pass, T through, X slide, Space tackle, F skill, Shift sprint),
  extended: C cross or lob, R finesse shot, G chip, V flair skills, Z shield (attack) or jockey (defend),
  Space on the ball knocks it on. Skills by F or V plus a direction relative to the body. Strip shows all of it.

Squad research notes (scratch work lives in the session scratchpad, results land in squads_2026.js):
- 9117 players listed on the 320 pages, 2926 matched to database players (ratings and spellings kept), 802 moves.
- Mazatlan was dissolved in April 2026 and its Liga MX place went to Atlante: the club becomes Atlante.
- 28 clubs with stale or undated Wikipedia lists (mostly Saudi and Liga MX) are refreshed from other sources.
- Rating agents (one per league group) rate new players on the game scale and give every player a role.

- Result: 7932 players in 320 clubs (cap 25 per club, at least the real first team), 23 loanees listed by two
  clubs kept only at the club they play for, every player rated, ages as of 6 Oct 2026, real numbers and roles.
- Web spot check (news sites, 6 Oct 2026), all 22 agree with the data: Salah (Trabzonspor, free, 6 Aug),
  Rodri (Barcelona, 18 Aug), Lewandowski (Chicago Fire, not in the game, so gone), Bruno Guimaraes (Arsenal,
  75m), Konate (Real Madrid, free), Anthony Gordon (Barcelona, 69m), Martinelli (Al-Hilal, 60m), Bernardo Silva
  (Real Madrid, free), Rashford (back at Man United, number 9), Benzema (left Al-Hilal 1 Sep, no club, so gone),
  Vlahovic (Besiktas, free), Griezmann (Orlando City), Semenyo (Man City, number 42), ter Stegen (Ajax, loan),
  Ollie Watkins (Al-Hilal), Araujo (Liverpool, loan), Son (LAFC), Kane (Bayern), Ronaldo (Al-Nassr), Messi
  (Inter Miami), Haaland (Man City), Mbappe (Real Madrid).

- Batteries after the data change: condition 138, DOM 167, API 257 / 257 / 256 with 0 failed. Two fixes came
  with it: namesakes in different clubs get a club tag like the original data did (Rodri MOR), and the API
  battery's transfer tip check now waits until the save on disk has caught up (bigger saves take a moment
  longer to write; the game itself was right).

- Final runs turned up two rare API battery failures, both in the test's own assumptions, not the game (the
  morale and board rules are unchanged): 1) the bench morale check pooled Brighton with Celtic, but the
  Scottish league ends after 22 rounds, so Celtic's benched players drift back to level over the last 16 weeks
  as designed; the real 25 man Celtic squad has more fringe players than the old data, which put the pooled
  group right on the "half negative" line. The check now judges clubs whose league is still playing (Brighton:
  9 of 9 benched players negative, average -1.49). 2) the transfer events section ran two seasons assuming no
  test manager is ever sacked; a bad run can cost one the job at the season's end (the board rule), so the
  test now takes the same club again, as a sacked manager can.

Checklist, Part 1 (squads):
- [x] S1 club to Wikipedia page map for all 320 clubs, reviewed by hand (16 wrong matches fixed by hand)
- [x] S2 fetch and parse every current squad (numbers, positions, names, loans), ages and roles from Wikidata
- [x] S3 match against the database (keep ratings and spellings), list movers, new players and leavers
- [x] S4 ratings for new players (research agents), big movers cross checked against news
- [x] S5 squads_2026.js written, players.js applies it, numbers used by kitNumbers and the lineup page
- [x] S6 spot check 20+ famous players on the web, all batteries green, screenshots of updated squads

Checklist, Part 2 (landing credit):
- [x] L1 credit line under the two game entries, small and quiet, after the intro, tests updated

Engine notes (floodlights/m3d, sim side written first, then the view):
- Modules: consts, util, attrs (29 attributes and a movement profile per player from rating, role, age, name),
  ball (drag, Magnus, bounce with friction and spin, roll, posts, bar, net, body deflections, 240 Hz), body
  (intention to body response: burst, build up, braking, grip limited turning, pivots, strafe and backpedal caps,
  gait clock that plants every footstep, balance, stamina and sprint reserve, falls, collisions with shoulder
  and foul outcomes), control (touch dribbling on the footstep beat, close and sprint dribbling, first touch
  grades perfect to failed, shielding, loose ball contests), kick (wind up, run onto the ball, contact quality,
  launch solved against the real physics for every pass, cross and shot kind), defend (jockey, standing and
  poke tackles judged on where the ball is, slides, shoulder, blocks, interceptions), keeper (angle positioning,
  set, reaction, ballistic dives, catch or parry with rebounds, punch, smother, rush, claim, distribute),
  skills (30 moves as programs with feints that fool AI defenders), aerial (headers and volleys of every kind),
  ai (team brain, shape, pressing, marking, runs, carrier decisions), rules (laws, restarts, offside, cards),
  user (keys to intentions and actions), sim (the fixed step loop).
- First AI v AI telemetry after tuning (4 matches, 78 v 78): 2.5 goals, 6.8 shots (4 on target), 113 passes at
  84 percent, 22 tackles, 10 skill moves a match, no NaN, no crashes, about 2.3 s of CPU for a whole match.
  Restarts were eating 211 of 360 seconds until takers hurried and the clock slowed during set up.

View notes (m3d/view): rig.mjs builds one skinned body per player (26 bones, about 4440 triangles, kit regions,
numbers and names from a per team sheet, 9 hair styles, beards, faces, keeper gloves). anim.mjs poses every body
each frame from the sim: stance feet locked to the sim's footprints (checked: within 3 mm while running), swing
feet to the next plant, pelvis drop when a planted foot would be out of reach, lean into acceleration and turns,
arms by style, head look and shoulder checks, kicks, touches, all 30 skills as foot paths pulled onto the real
ball at each contact, tackles, slides, headers, keeper stance and dives, falls and get ups, stumbles, limps,
celebrations, gestures, jaw and brows, hem and hair springs. About 0.18 ms a frame for all 22 in node.
- The mirror: the sim's top down frame (x right, y down the screen) is a mirror of three.js, so the sim's foot 0
  (on the body's +y side) is the right leg on screen. Right footed players use foot index 0 for their strong foot.
- pitch.mjs and stadium.mjs (helper agent) and hud.mjs (helper agent) follow .work/m3d-view.md.

Checklist, Part 3 (3D match rebuilt), each phase tested before the next:
- [x] M0 old 3D match removed (match3d.mjs and match_sim3d.mjs are now two line entries into m3d/), module layout,
      server route for m3d/, controller wiring (held, pressed and released keys with hold times, new keys C R G V Z,
      13 chip strip, help and pause text, sub step alpha for smooth motion), new test battery
- [x] M1 locomotion and ball physics: player profiles from ratings, accel and braking, turning, plant and cut,
      backpedal and strafe, stumbles; ball with drag, spin, Magnus, bounce, roll, posts, net; touch based
      dribbling (no magnet), close and sprint dribbling, first touch outcomes, shielding; rig with IK feet
- [x] M2 passing and shooting: kick model (contact, foot, balance, pressure), every pass and cross type, through
      balls into space, first time balls, every shot type, volleys and headers by ball height
- [x] M3 defending and keeper: jockey, standing and poke tackles, slides, blocks, interceptions, shoulder
      challenges, collisions with outcomes, falls by direction, get ups; keeper positioning, set, dives,
      catch, parry with rebound physics, punch, smother, rush, one on ones, recovery
- [x] M4 skill moves: all 30 with prep, execution, contact, rotation, exit, recovery, interruptible
- [x] M5 off ball AI: shape, marking, cover, lanes, runs of every kind, scanning and calling, carrier decisions
- [x] M6 set pieces and referee: kick off, throw ins, corners, goal kicks, free kicks with walls, penalties,
      offside, fouls, advantage, cards, knocks, stamina and fatigue body language
- [x] M7 polish and visuals: kits, boots, hair and cloth motion, pitch wear marks, shadows and ball shadow,
      stadium and crowd, broadcast camera, HUD, celebrations and reactions, frame budget on a laptop
- [x] M8 headless match battery (full matches, goal rates, no NaN, no stuck states, fouls and set pieces)

Phase testing: each phase has its own block in tests-site/test_match3d.js (ball physics, locomotion and gait,
dribbling and first touch, kicks, keepers, defending, skills, user control, set pieces through the headless
matches, the view with a stub renderer), run after the phase was built and again after every later change.

Polish pass notes (M7, found by watching matches in headless Chrome and with scratch telemetry):
- Running looked like a lunge: feet landed 56 cm ahead of the hips at a jog and the hips sank 8 to 17 cm to
  reach them. Now the foot lands about a third of the stance ahead (35 cm at a jog), the ankle rolls heel to toe
  while planted, the heel rises earlier, a back foot out of reach rolls onto its toes before the hips drop, the
  swing starts from the toe off pose (the heel used to snap flat for a frame), and the hip bounce is lowest at mid
  stance in a run. Hips now ride 0.83 to 0.90 m at every speed (0.95 standing).
- Getting up from a dive or a slide flipped the body's lying side in one frame; the side is now kept and the lift
  eased. Keeper hands blend in and out of the ball reach. Half time dips to black while the teams change ends.
- Kits looked washed out: softer key light and exposure. The low goal camera rises over the near stand.
- End bias: with identical teams the side attacking +x took about 2.5 times the shots. An exact mirror test (the
  same seed with both teams turned round) found three causes: the shot aim solver corrected the wrong way when
  shooting toward -x, the AI first touch averaged two angles as plain numbers (near 180 degrees that sends the
  touch backward), and a few restart spots used fixed sideways offsets. All fixed; a mirrored kick off now stays
  a mirror image until rounding noise, and 32 identical team matches came out 91 shots one way, 102 the other.
  The mirror test is in the battery so this cannot come back quietly.
- Watching a whole match in the browser: a keeper who got a hand to an on target shot was credited with an own
  goal; now the shooter keeps the goal unless the shot was going wide (the real convention). Corners were taken
  while the attackers were still jogging back (2.8 in the box on average); a corner or a free kick with a wall
  now waits for the players around the ball, up to 7 s, and has 4.9 in the box with no more restart time over a
  match. A deep free kick no longer gets the goal framing (the ball sat at the edge of the screen).

Final:
- [x] F1 all batteries 0 failed three times, typecheck, vitest, boot test, memory under 400 MB idle
      (three runs in a row: vitest 81, condition 138, API 255 to 257, DOM 167, 3D 126, layout 222, site 179,
      build, boot 52, server memory 226 to 274 MB)
- [x] F2 screenshots (match, credit line, squads), upload folder, push to GitHub, report
