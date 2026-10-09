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

## 3D match: the ball stays with you, loose balls and the man on the ball are yours

Feedback after the rebuild: "if you have the ball while running you leave the ball and run away"; running onto a
loose ball or into the man on the ball should win it. Measured on the old code: a lone runner making turns and
sprints lost the ball in 30 of 30 runs (it rolled up to 2.8 m away), and running into the AI carrier won it
5 times in 40.
- [x] Your player carries the ball: it rides just in front of the body (0.4 to 1 m, more at a sprint) through runs,
      sprints and sharp turns, swinging round the side on a turn, with a touch on the step beat so it still reads
      as dribbling. Only a tackle, a slide, a shoulder or a defender in the way takes it. Space still knocks it on.
      AI players dribble exactly as before.
- [x] A loose ball you run onto is yours (no reading roll, a little more reach, a clean first touch on a slow
      ball); a hard pass between two of theirs still has to be read. You win a 50 50 you get to.
- [x] Running into the man on the ball takes it off him, decided before the bodies meet so it is never your foul,
      and he cannot tackle straight back for 0.9 s. Your standing tackles come away with the ball.
- [x] Battery: four new checks (no losses through turns and sprints, loose balls collected 20 of 20, the man on
      the ball robbed 20 of 20 with no fouls, no instant tackle back); now lone runner losses 0 of 30.
- [x] The layout test (headless Chrome) hung once overnight when its Chrome stopped answering at start up; it now
      fails after 240 s instead of waiting for ever. Then three full runs in a row, 0 failed (vitest 81, condition
      138, API 257, DOM 167, 3D 130, layout 222, site 179, build, boot 52, server memory 226 MB).

## Player Career mode, next gen life sim, landing performance fix

Goal: a new PLAYER CAREER mode in Floodlights where you create one footballer and live his career inside the
same football world as Manager Career (same database, league sim, transfers and 3D match engine), plus a life
layer (city hub with explorable 3D places, money, homes, cars, shops, phone, social media, relationships,
family and agent drama), and first a fix for the landing page lag. The user's pasted spec is the source of
truth for features and ambition; the user's OVERRIDES win where they conflict (city hub instead of an open
world, fictional brands, one shared sim, player lock mode in the existing m3d engine, the shared site kit,
60 fps on a laptop with low/medium/high/ultra graphics). Push at the end with
"Player Career mode, next gen life sim, landing performance fix". Resume from the first unchecked box.

Decisions (made at the start, change only with a note):
- Server: Player Career saves are ordinary Floodlights games with mode "player" and a small `career` block
  (the created player's id, pathway, life layer, phone, relationships). The world (clubs, players, fixtures,
  weekly sim, transfers, cups, ageing) is the existing code, run unchanged; no manager user owns a club. All
  career logic lives in new modules (floodlights/career/*.js) called from new /api/pc/* routes, so Manager
  Career code paths are untouched. The created player is a normal record in game.players once he joins a club.
- Client: a Next.js page at /floodlights/career (Express does not own that path, so Next serves it), React for
  the deep UI (creator, hub, phone, social, shops) on the shared kit (public/kit.css, kit-motion, site fonts),
  React Three Fiber for every 3D scene (creator stage, city hub, interiors). The Floodlights lobby gets a
  PLAYER CAREER entry next to Manager Career. No new npm packages: three/addons (RoomEnvironment, post passes)
  cover environment lighting and effects.
- One body everywhere: the m3d rig (floodlights/m3d/view/rig.mjs) is extended with the creator's face, hair,
  body and accessory options (old options keep their exact look, so the match is unchanged) and is used by the
  creator, the hub, the interiors and the match, so the footballer looks the same in all of them.
- Graphics tiers low, medium, high, ultra: pixel ratio cap, shadow map size, post effects, crowd and prop
  counts, reflections. A frame guard steps down when frames run long. 60 fps wins over any flourish.
- Matches: player lock mode in m3d (control only your footballer, no switching; call for the ball, runs and
  press off the ball; manager instructions; live match rating), launched through the same FLMatch overlay.
  Simming uses the existing server sim; the career module turns its result into your rating and stats.
- India pathway: real school names (allowed by the user), fictional colleges and academies; other countries
  start in a club youth academy. All product brands are invented (cars, watches, clothing, boots, phones).
- Family layer: parents and maybe a sibling with opinions; they can disagree with the agent; at most one
  family drama between matches, through the existing teaser then popup event flow.
- Tests: a new Player Career battery (tests-site/test_career.js) next to the existing ones, wired into
  test:floodlights; the match battery gains player lock checks.

Checklist (commit locally after each phase; each phase is tested before the next):
- [x] P0 landing lag: measure (frames, paints, raster and GPU time), fix, measure again, landing tests green
      Cause: the intro moved letters, balls and lights that had no GPU layer of their own, so the browser kept
      redrawing the whole page behind them (about 1500 raster tasks in the 4 s intro), and the two beams used a
      screen blend plus a CSS mask, which costs a full screen blend pass every frame. Fix: the sky (aurora,
      stars, scrim) is one static layer drawn once; the beams are cone images (src/landing/beams.ts) drawn
      once with no blend, mask or filter; while the intro plays (data-anim on the root) every animated piece has
      its own layer, dropped when it ends; the big letters' colour and light sweep copies sit on their own
      layers so the glowing white letter is never redrawn. Measured in headless Chrome at 1440 by 900, old and
      new builds side by side, the intro replayed after load, medians of interleaved runs:
        DPR 2: 32 fps and 27 frames over 20 ms before, 59.7 fps and 2 after; GPU 693 ms to 378 ms, raster 311
        to 191 ms. DPR 2 with the CPU slowed 4x: 28.6 fps (31 slow frames) to 58.3 fps (7). DPR 1: 59.7 to 60
        fps, GPU 553 ms to 129 ms, raster 129 ms to 15 ms. Frames compared side by side: the look is the same.
      The machine was heavily loaded (load average 50 to 70) during the runs, which is why old and new ran
      interleaved in one Chrome.
- [x] P1 career spine: data (schools, colleges, academies, agents, brands), create player (all creator
      fields), server model and routes, India school and college pathway, training plans with fatigue and
      injury risk, development, scouting and trials, first contract offers and the signing moment
      Server: floodlights/career/data.js and core.js, /api/pc/* routes, guards so the world's AI market,
      free agents, loans and retirements never move the created footballer (p.pc). Indian Super League (12
      clubs, generated squads) and India's national pool exist only in Player Career saves. Development by
      age curve, coaching, professionalism, fatigue and room to the hidden potential; scouts at youth games
      by exposure; trials at 16 plus (a pass at 16 becomes a promise at 17); offers with wage, length, role,
      signing bonus, appearance, goal, assist and clean sheet bonuses, release clauses; agents negotiate.
      Wages: an exponential curve per league (about 420 a week for a 17 year old in India, about 27k for an
      80 rated Premier League regular, 190k for a 93). Three test careers signed at 17 for 270 to 550 a week.
      Client: /floodlights/career (Next page, React, R3F): title, a seven step creator next to a live stage,
      the hub (player card with a 3D portrait, the week, training plan, decisions, attributes, season,
      scouts, news, money, phone) and the first contract moment. Close up bodies come from the match's own
      builder at high detail: a sculpted head with seated eyes and a painted face texture (brows, lips,
      stubble and beards, the scalp), shell hair cut into strands by a shader (sixteen styles, smooth
      hairlines and fades), smoothed limbs, accessories, physically based materials per part. Match players
      are built byte for byte as before (checked with a geometry fingerprint).
- [x] P2 pro loop: weekly cycle on the shared sim, selection and manager trust, match rating from the sim,
      wages and bonuses, form, morale, reputation (5 kinds), transfers and loans through the shared market,
      renewals, captaincy, national team call ups (U17, U20, U23, senior), injuries and rehab, retirement
      summary and Continue as Manager
      Server: floodlights/career/pro.js. Selection: the manager picks him by rating against his position
      group, trust and form; the week's XI is handed to the world sim (club.lineup) and his minutes, goals and
      assists come back from the sim's own appearance and scoring records. Bids in the windows from clubs he
      would play for, priced by the market's asking price; his club says no to a key man unless the fee is
      big, but small clubs sell to much bigger ones. Personal terms of four kinds (transfer with fee, loan,
      free transfer, renewal), loans when a young player is not starting, a transfer request, free agency
      when a deal runs out, the armband (trust, leadership, a season at the club), national windows in rounds
      9, 14, 26 and 34 at the youngest level he still fits (senior once his rating is in the country's top 23),
      league titles and cups, league awards, retirement from 32 with a career summary, and the switch to
      Manager Career at a club of his choice in the same world. Manager Career refuses to open a Player Career
      code until then. Client: offers by kind with the fee, a career panel (games, goals, caps by level, the
      last internationals, honours, moves), captain, loan and transfer listed tags, a transfer request, retire
      with a confirm step, the retirement page, and broadcast style cards for the big days (debut, first goal,
      call ups, captaincy, first trophy, a big move). The Floodlights lobby has a Player Career entry.
      Long test career: 17 to 25, about 190 games, 36 senior caps, several moves, trophies, money in the
      millions, no stuck states. test:all green (career battery 58 passed).
- [x] P3 life layer: Player Career entry in the lobby, the career page, character creator stage, city hub
      (per city look), explorable places (home, training ground, stadium, shops, restaurant, gym, mall),
      homes to buy, cars, shops with fictional brands, money and bank, the phone (messages, agent, social,
      news, calendar, bank, team chat), social media followers and posts
      Server: floodlights/career/life.js and life_data.js. Three slots of free time a week (rest, the gym,
      a meal out, extra sessions, meeting fans); shopping is free of time. Homes from the family home and a
      hostel room to a hilltop mansion (rent or buy, one per city, sold back at market price, moves follow
      the club), seven made up cars from a scooter at fifteen to a hypercar, shops (Northline, Kurobe, Lumen,
      Pixelforge in the mall; Arden, Solenne, Halcyon, Celestor, Maison Orrè on the high street) whose watches,
      chains and earrings go on him in 3D, meals, gym sessions that train real attributes, weekly bills, a
      savings account, followers that follow fame, one post a week with fan comments and a backlash risk,
      commercial reputation, sponsors (food, drinks, sportswear, tech, a bank, gaming, cars, watches and three
      boot brands; a boot deal puts their boots on him), weather per city and month, the team group chat.
      Client: a City tab next to Career. The city is drawn from shapes and shaders: lit windows worked out in
      the shader, one instanced mesh for the buildings, traffic, trees, a sky dome with the low sun and stars,
      rain, snow, fog and lightning, the hour moving through dusk week to week, and the seven places with their
      own buildings (the home changes with the home he has). Each place is a room he walks around as himself
      (click to walk or WASD, a blended walk cycle), with glowing spots to use things, walls that drop when
      they block the camera, a view of the city's own skyline out of the window, his trophies in the cabinet
      and his car in the bay of a big house. The phone has seven apps (messages, agent and sponsors, social,
      team chat, news, calendar, bank). Measured in headless Chrome on High: 60 fps in the city and in every
      place, worst frame 17 ms.
- [x] P4 relationships, family and events: teammates, coach, manager, agent (and changing agents), friends,
      family characters with opinions, family against agent choice events, dynamic life events with real
      consequences, teaser and popup flow, rate limits
      Server: floodlights/career/people.js. Mum and Dad, a brother or a sister in about two families in three,
      an oldest friend from home, a best mate picked from each new dressing room, the dressing room, the coach
      or manager and the agent, each with a relationship that moves. The family texts after games (proud,
      kind or blunt), turns up in the stands now and then, and its mood lifts or weighs on his morale. The
      agent takes his cut of wages and sponsor money, can be let go or replaced, and walks away if ignored too
      long. Twenty one life events, most with the family and the agent pulling different ways (a move abroad,
      the agent's fee, Dad wanting to do the deals, exams against a paid shoot, a camp against the family trip,
      a wedding back home, a transfer request against fighting for the shirt, money for a brother or sister,
      Mum seeing a lifestyle post, a betting sponsor), plus the dressing room, the press, the hospital visit,
      a mentoring request, a hamstring scare and more. Choices move relationships, morale, confidence, form,
      fatigue, money, reputation, traits and the career itself (offers abroad turned down, the agent gone or
      cheaper, a transfer request handed in, an injury risk taken). Round the table: a family meeting that
      works or blows up depending on how the family feels and how well he leads. The flow is Manager Career's:
      an event is decided at the end of a week and only teased in the week report; the popup comes before the
      next week can be played, and the week carries on once it is answered. At most one family event between
      two of his matches (checked by the battery), one event every two weeks at most.
      Client: the teaser in the week report and the alerts, the event popup, a note when a family meeting
      goes well or badly, a People panel (family, friend, best mate, dressing room, coach or manager, agent,
      find or drop an agent, the choices he made).
- [x] P5 player lock match mode: lock to your footballer, off ball calls and runs, manager instructions,
      live rating, your look on the pitch, results back into the career, headless battery checks
      Engine: floodlights/m3d/lock.mjs plus small hooks guarded by m.lock (null in every Manager match). A
      setup row marked pc is the only player the person controls: no switching, set pieces only when they are
      his to take (the AI takes the rest, the AI keeper faces penalties). Without the ball Q calls for it and T
      makes a run; a team mate on the ball looks up quickly, rates him first, and chips it over when the ground
      lane is shut, but never plays into a lane that is all but closed. His own match is counted from the
      engine's events (touches, passes and completed passes, shots on and off target, goals, assists, tackles
      won, skills, the ball lost) into a live rating from 3 to 10 that counts each habit less the more there
      is of it. The manager's instruction comes by position (shots for a striker, runs for a winger, passes
      for a midfielder, tackles for a defender) and doing it or not moves the rating and his trust. His face,
      hair, build and boots come with the row. The broadcast camera frames him and the ball together. Checked:
      Manager matches are identical byte for byte (same seeded scores, stats, ball position and event hash
      before and after), Classic is untouched.
      Flow: Play the match on the career hub opens the Floodlights page at #pcmatch, which runs the same
      FLMatch overlay (lock help, lock key strip, 3D only, rating card on the HUD). /api/pc/matchstart checks he
      starts this week (fit, picked, no event or choice waiting, one go a week) and builds both teams the way
      Manager kickoffs do; /api/pc/matchresult puts the score in game.plays so the week's sim uses it, his line
      replaces the sim's (and the league's scoring records are put in line), and the week plays on. Leaving
      early sims the match. Keepers' matches are simmed. Browser check: 60 fps in the live match on High.
- [x] P6 cinematics and polish: first contract signing, debut, first goal, call up, big transfer, trophy,
      captaincy, retirement; graphics settings menu, frame guard, weather in the hub, screenshots
      The big days are scenes now: his own 3D body turning under the lights in the shirt of the day (his
      club's colours, or his country's for a call up, the same colours the match uses), a gold cup floating
      beside him for a first trophy, the broadcast card sliding in next to him. The first contract keeps its
      signing on paper. The retirement page stands him in his last club's kit beside the career numbers.
      A graphics menu (Low, Medium, High, Ultra, each said in plain words) with a Keep it smooth switch for the
      frame guard, remembered in the browser. Close up bodies get real hands (a palm, four curled fingers, a
      thumb) and a rounded cap where the sleeve meets the shoulder; match bodies keep their exact geometry
      (the same fingerprint as before).
- [x] F1 all batteries 0 failed three times (typecheck, vitest, condition, API, DOM, 3D, layout, career,
      site, build, boot), memory under 400 MB idle, screenshots (creator, hub, home interior, phone, player
      lock match)
      test:all three times in a row, every battery 0 failed: typecheck, vitest 81, condition 138, API 257,
      DOM 167, 3D match 144 (with player lock), layout 222, Player Career 111, site 195, build, boot 52. The
      career battery is now part of test:floodlights. Two old flaky checks in the API battery were fixed in the
      test (a save read that raced the server's delayed write; a pick that could land on a star whose refusal
      is a different, correct path). Runs that stalled turned out to be the machine sleeping; the final runs
      used caffeinate. Memory: 78 MB at boot, 213 MB idle with a Manager game and two Player Careers loaded.
      A Player Career save is about 2.55 MB against 2.28 MB for a Manager save; the career itself is 19 KB,
      the rest is the Indian league those worlds carry. Screenshots taken in headless Chrome on the production
      build: the creator (all seven steps), the career hub, the city (rain and clear), every place (home, gym,
      restaurant, mall, the shops, training ground, stadium), the phone (home, social, bank), life events,
      the People panel, the big day scenes, the retirement page, the graphics menu and a player lock match.
- [x] F2 upload folder, push with the given message, report

## Result chips, play match surfaced, free roam city with real brands and driving

Goal (the user's pasted spec is the source of truth): match result rows that say who won (your team first, the
score your way, a W, L or D chip), PLAY MATCH and SIM MATCH on every Player Career matchday with the player lock
match checked end to end, and the city rebuilt as a real free roam open world (walk, drive, take the bus; people,
traffic, day and night; distinct places you walk inside and buy from by walking to the items; real brands for
clothes, watches, boots, cars and sponsors; homes on the map; a garage; a map with waypoints and fast travel;
a different city after a transfer; 60 fps on a laptop on Medium). Push at the end with
"Result chips, play match surfaced, free roam city with real brands and driving". Resume from the first unchecked box.

Decisions (made at the start, change only with a note):
- Real brands replace the made up ones (the user's call, a personal project). Old saves keep working: every id a
  save can hold (items, cars, homes, sponsors) stays; only the names, prices and looks change.
- The server owns places, prices and gates. A city's places (stores, mall, supermarket, cafes, restaurant, club,
  clinic, gym, training ground, stadium, dealerships, homes) come from the server per city, so the same rules
  check every purchase. Top end things are gated by fame as well as money (Ferrari allocations, Rolex and Richard
  Mille waiting lists), so a Ferrari and an RM stay out of reach until he is a star.
- The open world is drawn on the client from a seed per city: the street grid, districts, the sea front when the
  city has water, the architecture flavour and which stores exist. Chunks stream in and out around him, every
  repeated thing is instanced (buildings, windows, trees, lamps, pedestrians, traffic), far things drop detail.
- People and traffic are instanced and animated in the shader (one draw call per kind), so a busy street costs
  little. Only the footballer himself is a full body.
- Interiors are rooms built per place, each with its own look; items sit on rails, shelves, plinths and stands,
  and he walks up to one to see it and buy it.
- Work is split: match rows and the play flow; server data and actions; interiors; the world. Each part keeps to
  its own files (scratchpad contract). One local commit per phase.

Checklist:
- [x] Q1 result rows: your team first, the score your way, W L D chips (Player Career rows, internationals, the
      Manager Career calendar), career battery checks
      Every result row is "Your Team 2-1 Opponent" with a small W, L or D chip (a new kit chip, .k-wdl, with a
      Floodlights twin), then the competition, the week, started or off the bench, goals and assists on a quieter
      line and the rating at the end: the week reports, a Results list in the Season panel, the internationals
      and the phone's calendar. Old saved lines fall back cleanly. Manager Career's calendar now puts the
      manager's own goals first with the same chip (pens marked). Lines carry res and wk from the server.
- [x] Q2 PLAY MATCH and SIM MATCH on every matchday (youth matches can be played live too), the chain checked
      headless and in Chrome, rating from the live performance, battery checks
      The matchday block shows the fixture with his team first and two equal buttons, PLAY MATCH and SIM MATCH;
      when PLAY is not possible it stays visible and disabled with the reason (bench, left out, injured, a
      choice or an event to answer, already kicked off, keepers). School, college, academy and centre matches
      can now be played live in player lock: both sides are made up for the week (names that fit the country,
      a 4-3-3, ages and ratings for the level), his row carries his look, and the result goes into his record
      the way a simmed youth match does. The match screen opens from a peek that uses nothing up; the real
      start happens on Kick off. Fixed on the way: the youth cup opponent changed every time it was asked for,
      the hub and the sim could disagree on the team sheet, wing backs and wide midfielders played as centre
      backs and centre mids in the engine, a missing rating saved as 3.0, and the instruction said "Manager"
      in school games (now the coach). Checked headless (the engine keeps control on him every step; a good
      game rates 10 against about 6 for a poor one) and in Chrome (career page, PLAY, kick off, his own player
      under control, full time, back to the career with the new row and the live rating). Keepers stay on SIM:
      the engine has no human keeper controls. Batteries: career 150, 3D match 158, both 0 failed.
- [x] Q3 real brands and the server side of the city: places per city, catalog (clothes, watches, boots, tech,
      groceries, cars with a driving feel, homes), new actions (visit, buy, order, night out, clinic, fan
      moments, garage), fame gates, price pacing, old saves migrated, life battery
      floodlights/career/life_data.js and life.js: 133 items and 35 vehicles at UK retail prices. Clothes from
      Zara (16 to 60) through Nike, Adidas, Essentials, Stussy, Ralph Lauren, AMI Paris to Givenchy, Gucci,
      Dior and Louis Vuitton (up to 5,900), each store with its own palette and feel; tops and bottoms change
      what he wears in the city. A watch boutique from a 20 pound Casio F-91W through Guess, Tissot, TAG Heuer,
      Omega, Rolex (Datejust, Submariner, GMT, Daytona, Day-Date) and Audemars Piguet to a 960,000 pound Richard
      Mille RM 27-04; boots from Nike, Adidas and Puma at four tiers; tech, Tiffany and Cartier; 23 groceries
      in six aisles; menus for the cafes, the restaurant, the club and the clinic. Four dealers: Toyota and
      Honda, a prestige dealer (BMW M, Mercedes-AMG, Brabus, Porsche, Range Rover), a supercar showroom
      (Ferrari, Lamborghini) and bikes (an e-scooter to a Panigale V4 S), each with its own feel, upkeep and
      minimum age. Places per city from a seed: three tiers by size, real malls, supermarkets and cafes by
      country, the club's real ground, homes in real neighbourhoods. Fame gates against commercial reputation
      (a Rolex Daytona at 40, Ferrari SF90 at 75, Richard Mille from 70) with a plain reason when locked.
      New actions: visit, buy, wear, car, garage sell and drive, home buy and rent, supermarket, cafe,
      restaurant, a night out (18 and over), the clinic (a week off an injury, or a check up that lowers the
      risk), fan photos and chats. Moments for the first Rolex, the first Richard Mille, the first big watch,
      car, supercar and home (news lines and family messages). Sponsors are real brands now (Nike, Adidas and
      Puma boot deals put their boots on him). Old saves: every id kept, names upgraded once by id.
      Battery tests-site/test_career_life.js: 162 passed, 0 failed. Creator boot names are real too.
- [x] Q4 open world core: city generator per city, streamed chunks, LOD, third person walking with collisions,
      day and night, street lights, sounds, doors into places
      src/career/world: gen.ts works out a city from its name, style and the server's places: a street grid
      (10 to 12 blocks a side by city size), districts (centre, a ring of homes and offices, the hill, a sports
      corner, sheds and showrooms, the sea front), the sea for coastal cities and a river with bridges for the
      inland ones with water, every place on its own lot with its door on the pavement, filler buildings along
      every free street front (pitched roofs in Britain and Europe, towers in the centre, villas on the hill),
      lamps, trees, benches, parked cars kept clear of doors, a bus loop with stops named after what is near, and
      a collision grid. The look of the streets follows the country (brick in Britain, stone in Europe,
      terracotta on the Med, sand and glass in the Gulf, colour in India) and the traffic drives on the left in
      Britain and India. scene.ts builds it: one merged mesh for every place front with all the signs in one
      texture, buildings in 3 by 3 block chunks that stream in and out with a window shader that lights up at
      night, close up trims and shop windows only near him, instanced lamps with pools of light at night, trees,
      benches and traffic lights that follow the junction clock. World.tsx: third person walking (WASD, Shift to
      run, drag to look, the wheel to zoom, a camera that pulls in when a building is in the way), the kerb step,
      the day turning (45 seconds an hour) with the sun, shadows that follow him, clouds, dusk and stars, rain
      and snow, doors that glow (E to go in, the nightclub turns away under 18s), his home marked, the waypoint
      beam. audio.ts makes the city hum, rain, birds, footsteps, traffic, his engine and the door chime in the
      browser, with a mute switch. Measured in Chrome on the M3 with the frame cap lifted: about 4.3 ms a frame
      on Medium, 66 draw calls; a unit battery (tests/world.test.ts, 8 checks) covers the plan.
- [x] Q5 the living street: pedestrians, small talk and fan photos, parked and moving traffic, buses with stops
      people.ts: one instanced mesh for every pedestrian, legs and arms swinging in the vertex shader, dressed
      per person, tall and short, broad and slim, a soft patch of shade under each; they walk round the blocks
      near him, stop at shop windows, step round him, wait for his car, and the far ones are moved to blocks near
      him. E says hello: small talk, or once he is known a fan asks for a photo (a second E takes it: a flash, a
      camera click and the server's fan moment). vehicles.ts: traffic on both sides of every street that turns
      at corners, stops at red lights, keeps its distance and brakes for him; parked cars; the bus (red in
      Britain) that stops at every stop. E at a stop waits for it; it pulls in, he gets on, the camera rides
      with it, E gets him off at the next stop.
- [x] Q6 driving: his cars from the garage, arcade physics with a feel per car, bikes, the garage at home
      drive.ts: arcade driving with a real velocity, so the tail steps out when a corner asks too much of the
      tyres and the handbrake slides it; each car's feel from the catalog (top speed, pull, grip, weight), bikes
      lean; buildings stop it with a bump, traffic shoves it. F gets in and out of his parked car; his daily car
      waits by the kerb at home; the speed and the car's name on the screen; the engine note rises with the revs
      and drops at each gear. Touch screens get a thumb stick (walk, run, drive) and E and Car buttons.
      Done: driving, his parked car, getting in and out, the drive out request carrying the kerb position of
      the garage's own home (City.tsx garageOf and leave({ drive })).
      Checked in Chrome on the real City tab (resume run): home, "Lift to the garage", walk up to the Porsche
      (its card: top speed, 0 to 100, the weekly cost, Drive it out, Sell), E, and he is in it on the street
      with the speed and the car's name on the screen and "F Get out".
- [x] Q7 interiors: supermarket aisles, the mall and its stores, brand stores, the watch boutique, dealerships,
      cafes, the seaside restaurant, the nightclub, the clinic, gym, training ground, stadium, homes to view, buy
      and walk around
      Done: src/career/city/interiors/*.ts builds every place kind from its WorldPlace (store styled per brand,
      the mall with its stores inside, supermarket aisles, watch boutique, cafes, restaurant with a sea view,
      nightclub, clinic, gym, training ground, stadium, the four dealers, homes by tier, the garage);
      src/career/city/ShopHud.tsx is the walk up card (name, brand, price, why it is locked, Buy, Wear, Order,
      Drive, Treat, Night out, Buy or rent a home; a card for the first Rolex). Interior.tsx takes a WorldPlace
      (old place ids still work). City.tsx is wired: E at a door goes in, the room is read fresh from the latest
      state, the shop card handles E, home to garage and back, drive out, "Back to the street". Screenshots of
      eleven interiors were taken by the interiors helper (scratchpad, not in the repo).
      Resume run, checked against the code: the boots, tech and jewellery shops already have their own
      fixtures (store.ts picks lit boot shelves, tech tables or glass cases by what the shop sells), and no old
      made up shop name is left anywhere (only "Northline Representation", a made up agents' firm, which is
      fine). In Chrome on the real City tab: walk in, walk up to an item, its card, E to buy, worn at once
      ("Take it off" on the card), the supermarket, the dealers, the mall, the watch boutique, the penthouse, the
      garage and driving out. The nightclub age gate and the clinic are covered by the life battery.
      Fixed on the way:
      - the watch boutique was missing in mid sized cities (Manchester among them): the server put it in the
        mall as an eighth shop, the mall has seven units, so the room dropped it and its watches could not be
        reached. Now a full mall sends the boutique to the luxury row, as the biggest cities already do
        (MALL_UNITS in floodlights/career/life.js); the life battery checks ten cities.
      - in the mall's hall every shop's item names showed at once and piled up; names of things for sale now
        fade out past about nine metres (places to use always show), and the hall has paving outside its doors
        so the camera behind him at the way out sees ground.
      Frame times on Medium in Chrome on the M3 with the frame cap lifted (median, slowest 5 in 100): the street
      at night 4.0 and 13.5 ms, supermarket 3.6 and 7.0, Louis Vuitton 3.4 and 6.8, watch boutique 4.1 and 7.6,
      mall 6.4 and 10.1, supercar dealer 4.6 and 7.4, penthouse 4.5 and 6.9, stadium 4.8 and 7.8, nightclub 3.9
      and 8.3. All well inside 60 a second.
- [x] Q8 map overlay, waypoints and the direction marker, fast travel, a new city after a transfer
      CityMap.tsx (M or the Map button): the streets, districts, sea or river, every place in its colour, his
      home ringed, the bus loop and stops, him as an arrow. Click to set a waypoint (a beam in the street, an
      arrow and the distance at the top of the screen, cleared when he gets there); places he has been to (the
      server's visited list) and his home can be reached at once. A transfer means a new city name and new
      places from the server, so the whole plan is built again: layout, sea or not, look, stores.
- [x] Q9 performance on Medium, screenshots, every battery 0 failed three times, memory under 400 MB, upload, push
      Frame times on Medium are under Q7, the screenshots under R4 below. test:all three times in a row, every
      battery 0 failed: typecheck, vitest 89, condition 138, API 255 then 257 and 257, DOM 167, 3D match 167,
      layout 222, Player Career 149 then 149 and 150, life 163, site 202, build, boot 52 (227 MB after its
      checks). Memory of the production server with a Manager game and two Player Careers loaded: 130 MB at
      boot, 174 MB with them loaded, 127 MB idle a minute later. Upload folder refreshed, pushed to GitHub with
      "Result chips, play match surfaced, free roam city with real brands and driving".

Resume run (8 Oct 2026, evening). The user's list: delete the two lab pages, fix the tackle bug properly, keep
keepers on SIM with a clean disabled PLAY, take the acceptance screenshots, test:all three times, memory, push.
- [x] R1 the two temporary lab pages are gone (src/app/floodlights/career/lab with its fixture, and worldlab).
      Nothing linked to them; the build no longer has those routes. A dev server the earlier run left on port
      3700 (old code, sharing floodlights/games.json with the batteries) was stopped.
- [x] R2 the tackle bug: running into the man on the ball is a real challenge now, not a free win
      Cause: control.mjs userWin gave the person's player the ball whenever he touched the man on it, so a
      scripted player who only chased and bumped won 20 to 33 balls a match and school games 6-0 to 11-0
      (Manager matches the same: 7-0 to 12-0).
      Now (control.mjs userChallenge): decided once as they meet, before the bodies touch. His defending,
      strength, reactions and balance against the man's dribbling, strength, balance and shielding (a skill
      move's shield counts), with the angle (face on with the ball showing helps, into his back hurts, side on is
      weight against weight) and the timing (a ball run away from the man's feet helps; flying in hurts, judged by
      how fast they really close, so chasing a man who runs away is not flying in; a man who runs the ball into a
      set defender gives it up more). Five outcomes: won clean, poked loose, bounced off, the man knocks it past
      him and goes (mostly when he dived in), or a foul (likely into the back at speed, rare for a slow nudge, the
      card follows how hard it was). A challenge that does not come off leaves him a moment to recover. It works
      both ways: one of theirs who meets the person's man on the ball challenges him the same way, and a
      defender a few steps in the path of the person's man running at him steps across and stands him up
      (ai.mjs stepIn), where before only the one presser ever engaged. Also made real contests: a 50 50 he
      reaches with one of theirs (his only if he is clearly first), and a ball the man on the other side has just
      fumbled at his own feet. His sure clean first touch now needs no man on him. Holding Space to close a man
      down goes round his side to get goal side instead of through his back (it used to give away pushes).
      AI against AI is untouched: the headless battery's eight matches are the same scores and stats as before.
      Measured with scripted matches (24 a kind; the chaser runs flat out at the man on the ball, bumps, then
      runs at goal and shoots): school 2.8 goals for and 0.5 against a game (21 won, 1 drawn, 2 lost; was 7.9
      and 0), pro 2.2 and 0.7 (15, 7, 2), Manager 2.8 and 0.5 (21, 2, 1; was 9.9 and 0.1). A careful player who
      closes down with Space: 0.9 fouls a game, no cards in 40 games. In Chrome a live school match with the
      battery's sensible player ended 3-0 (he used to win those 6-0 and up).
      Still true and older than this bug: a person who is always on the ball wins a lot of games, as he did on
      the engine before the ball carry change (a Manager chaser scored 4.3 a game there).
      Battery: test_match3d.js (167): challenge outcomes by situation, no retry at once, no tackle straight
      back, their challenges on him, the call for the ball checked directly (with a man near the lane the mate
      plays it 10 times in 10 when he calls, 0 in 10 when he does not), and four chaser matches with no win by
      6 or more. "Control stays on him" now means control never moves to someone else (a red card leaves no
      one under control, which the career battery once tripped over).
- [x] R3 keepers stay on SIM: PLAY MATCH is off and dimmed (not allowed cursor), the reason sits under it in amber
      and is tied to the button for screen readers ("Keepers cannot be played live yet. Sim the match: your
      rating still comes from how you play."), SIM MATCH stays the bright choice. Checked at 1440 and 390 wide.
- [x] R4 acceptance screenshots on the production build with the ready script (scratchpad accept.mjs, extended
      with the garage and shops inside the mall): street with people, the map, a waypoint, the supermarket,
      Louis Vuitton, the watch boutique, the prestige and supercar dealers, the mall, the penthouse, the garage
      with his Porsche, driving it out, buying and wearing a tee, the keeper's matchday, a live school match.
      Copies in Be-A-Manager/acceptance_shots (next to site and github, not in the repo).

## Campuses, relationships to marriage, venue correct matches, camera fix

Goal (the user's pasted spec is the source of truth): every school, college and club has walkable grounds on the
city map (school campus with classrooms, corridors, a canteen and a plain pitch; a nicer college with a small
stand; a Carrington style training ground with pitches, gym, changing rooms, physio and recovery, canteen and a
car park, the stadium a separate place); friends at school; dating from college on (200 and more partners, texts,
picking her up in the car, dates as real outings with choices, stages from talking to married, gifts, rows and
break ups, a ring, a proposal, a wedding, married life); every match at the right ground (school, college, pro)
with sound that fits; and the free roam camera driven by the mouse or a trackpad glide, not zoom. Push at the end
with "Campuses, relationships to marriage, venue correct matches, camera fix". Resume from the first unchecked box.

Decisions (made at the start, change only with a note):
- Grounds work the way the training ground and stadium already do: on the city map each campus takes a whole
  block and shows from the street as what it is (fence and gate, its buildings, its pitch with goals, the small
  stand at a college, the pitches and car park at a training ground). Walking through the gate opens its grounds
  as their own outdoor scene, bigger than the block, and its buildings are rooms inside that (the way the garage
  is a room of a home): corridors, classrooms, canteen, the club's gym, changing room, physio and recovery. So the
  street keeps its chunks and LOD and a campus costs nothing until he walks in.
- Which grounds a city has: his own school, college or academy and his club's training ground and stadium, plus
  the other schools, colleges and clubs based in that city, up to a cap so the map stays readable (four more
  schools, two more colleges, two more clubs). Every other school, college and club still gets its own ground
  for matches, worked out from its name, so an away game is always at the other side's ground.
- Each institution looks like itself: a seed from its name, scaled by its standing (school facilities and
  fees, college reputation and facilities, club budget and league). Bigger and nicer means more and better
  buildings, a better pitch, a bigger stand, more pitches.
- Daily life flows through them: classes at school and college, training sessions at the training ground, the
  physio and recovery room there, the club gym, the canteen. They plug into the existing free time, training and
  condition numbers.
- One people system: friends and partners are new members of the existing cast in floodlights/career/people.js
  (relationship numbers, texts through msg(), events through the existing teaser then popup flow, morale), with
  the dating and marriage rules in a new module beside it (floodlights/career/love.js). No second phone, no
  second event system. The phone gains replies: a thread from a friend or a partner can be answered with a few
  choices, and dates are planned there (a place and a time).
- School age is friendships only. Dating opens at college or later once he is 18, and every partner is an adult
  close to his own age. Everything stays tasteful: talk, texts, dates, gifts and story moments.
- The partner pool: over 200 distinct women made from a seed per career and city (names by country, looks,
  personality, interests, what she does), met on campus, in cafes, at events and later at clubs.
- Dates run on the city clock: a date has a place and an hour. Picking her up means driving to her place, where
  she waits outside and gets into the passenger seat; on foot she walks with him. Late or forgotten hurts. A
  date is a small scene at the place (the seaside restaurant, a cafe, the mall, the club when old enough) or out in
  the city (a walk, a drive) with dialogue choices that decide how it went.
- Bodies: the rig gets a woman's figure, long hair styles and clothes (tops, skirts, dresses, jeans) as options
  that are off for every match player, so match bodies stay byte for byte the same (the geometry fingerprint).
- Venues: the server says where each live match is (kind school, college, academy or pro, home or away, which
  institution, its standing and colours). The match view builds that ground: a school field with no stands, a
  few people on the touchline and school buildings in daylight; a college pitch with a small stand partly full and
  the campus behind; an academy pitch at the club's training ground; the pro stadium as now. Match sound is new
  and comes with the venue (shouts and a whistle at school, a murmur and claps at college, a roar in the pros);
  Manager Career matches pass no venue and stay exactly as they are.
- Camera: one look controller for the street, the rooms and the car. A click on the view captures the mouse
  (pointer lock) and moving it orbits him; a two finger glide on a trackpad orbits too; a plain mouse wheel and a
  pinch are a gentle zoom that never fights the look; pinch never zooms the page. Esc frees the mouse. Dragging
  still works as a fallback and on touch screens. In the car the camera is a slight chase cam he can look round
  with, easing back behind the car.

Checklist (commit locally after each phase; each phase is tested before the next):
- [x] W1 camera: look controller on the street, inside places and in the car; no page zoom; help text
      src/career/world/look.ts, hosted once by City.tsx on the view and handed whatever is active (the street,
      the room, the car). A click captures the mouse and moving it turns the camera; a two finger glide turns
      it; a wheel notch (lines, or round steps of 120) and a pinch are a gentle zoom; every wheel over the view is
      kept from the page and a pinch anywhere over the world never zooms it (Safari's gesture events too). Rooms
      gained a camera that turns and tilts (WalkCtl.pitch; the default view is where it was). In the car the
      camera eases back behind it 1.4 s after he stops looking, with a slight chase. Esc with the mouse captured
      only frees it, the next Esc leaves a place; P opens the phone, M the map, and Q does the shop card's second
      action, so nothing needs the mouse freed. A click while captured never walks him to a stale point.
      Checked: tests/look.test.ts (8, jsdom) and in Chrome on the real City tab (11 of 11: glide turns and tilts
      without zoom, wheel and pinch zoom, no page zoom even over the HUD, drag still turns, the same in a room,
      the car cam looks round and eases back). Headless Chrome does not grant pointer lock; the unit tests cover it.
- [x] W2 institutions on the server: data and standing, places per city, the venue for every fixture, daily life
      actions at campuses, life battery checks
      floodlights/career/campus.js: an institution for every school (the six with real numbers, the rival schools),
      college (the six, the university sides by city), club (strength from its best fourteen, its kit, real
      training ground names for the big ones: Carrington, City Football Academy, Cobham, Milanello...), academy
      and centre, with a standing from 1 to 10, a seed and colours. A city's world shows his own grounds (his
      school is "school", his college "college", his club or academy keeps "training" and "stadium") and up to
      four more schools, two colleges and two clubs of its own (training ground and stadium each); the made up
      "training pitches" are gone once he has real grounds. venueFor() says where any match is: the home side's
      school, college or academy pitch in daylight with a small crowd, or the home club's stadium under the
      lights with a crowd by its standing; live youth setups and the pro match start (peek and kick off) send it.
      Daily life at his own grounds: classes (two a week, free time, discipline, the family pleased), the canteen,
      extra sessions on the school or college pitch, and at the training ground the physio (fatigue down, now and
      then a week off an injury), the club gym, the canteen and the dressing room (the squad and his best mate).
      Life battery 183 (17 new: places, actions and limits, the live venue, standing, every venue kind, caps).
- [x] W3 grounds you walk: campus fronts on the street, school, college and training ground scenes with their
      rooms (corridor, classroom, canteen, gym, changing room, physio), his car in the club car park
      Street: schools sit in the suburbs and colleges in the middle of town on whole blocks (52 by 52 m), with a
      front by kind (a wall with gate pillars and the name, a block with window rows, a pitch with goals, dust on
      the poorer ones, a stand at college; the training ground behind a fence with two or three pitches, a glass
      main building and a car park). The map has its own colours and labels for schools, colleges, training
      grounds and stadiums. Inside: src/career/city/interiors/campus.ts builds the grounds by standing and seed,
      so every school and college looks different: a school is about 90 by 80 m (classroom block, canteen, a
      proper pitch with lines, nets and flags but no stands, a court at the better ones); a college is about
      130 by 100 m (lecture block, student cafe, library, a quad, a pitch with a small stand, a roof on it from
      standing 7, a running track from 8). A training ground is 150 to 180 m wide: two to four pitches,
      floodlights at the bigger clubs, a glass main building in the club's colours, a crest, and a car park with
      the squad's cars by club size and his own daily car first in the row. Rooms are sub rooms of the place
      (school/corridor, training/physio): the corridor (lockers, notice board, trophy cabinet, doors), a
      classroom or lecture room with desks in rows and his seat, the canteen, the club gym (racks with bars and
      plates, dumbbells, treadmills, bikes, a mirror and the club band), the dressing room (wooden cubbies round
      three walls, shirts on hangers with numbers, padded benches in the club colours, his name over his own peg,
      the crest on the floor) and the physio room (tables, ice baths, the cryo chamber). Weather greys and dims
      the light outdoors. Walking is quicker on big grounds (3 m/s, 6.2 with shift, a cruise on long clicks);
      far labels fade past 40 m so doors across a ground do not pile up.
      Checked in Chrome on the real City tab: a school (gate, classroom block, corridor, class, back out, the
      canteen), a college in Goa (lecture block, lecture room, student cafe) and City Football Academy (gym,
      dressing room, physio, canteen), each action giving its card and result. Rooms open in under a second;
      frame medians on Medium 1.6 to 2.2 ms on the grounds and 1.7 to 5 ms in rooms; 19 to 52 draw calls.
- [x] W4 a woman's figure in the rig: shape, long hair, clothes; match bodies unchanged
      floodlights/m3d/view/rig.mjs and hero.mjs: look.fem gives a woman's figure (narrower shoulders and waist,
      wider hips, slimmer arms, calves and feet, a gentle fullness at the chest, a softer face with longer lashes
      and a lip colour). Everyday clothes for anyone: bottom trousers, skirt, dress (the top's colour), gown (to
      the floor, lined, for the wedding), a bare armed top, plain tops without kit panels, shoes in any colours,
      tights. A skirt's hem follows each leg part of the way and the thigh under it wears its colour, so a stride
      never shows through. Six long styles (16 to 21: long, ponytail, bob, long curls, a plait, a top knot) at
      both details; in close up long hair falls behind the shoulders and down the back, moving more with the
      body than the head. src/career/body.ts: outfits carry the clothes; a light body (the match's head and hair,
      no face texture or hair shells, shared materials, about 10k triangles) for the people round him, a seed so
      a group never breathes in step, and a sitting pose (passenger seat, restaurant table).
      tests/rig.test.ts: fingerprints of 60 match players and 32 career bodies taken before the change are byte
      for byte the same; every new option changes the body; a gown hides the legs and a skirt shows them.
- [x] W5 friends: classmates and teammates you meet and talk to on campus, friendships, texts, hanging out,
      friends in events, the People panel
      floodlights/career/social.js (data in social_data.js), its state kept with the rest of his people
      (people.js): the same relationship numbers ("f:<id>" in the same rel()), the same phone threads, the same
      life events, the same morale. Each school and college has a class of twelve (mixed at school and
      college, lads at an academy or centre; Indian names in India, international ones elsewhere); a pro club's
      people are its real squad. Everyone has a personality (funny, driven, quiet, outgoing, creative, sporty,
      bookish, kind), two things they are into, a body from a seed (light bodies, W4) and clothes: the school
      uniform in its colours, training kit at the club, their own clothes at college. Each week some are on
      the grounds (by the doors, on a bench, by the pitch), the class sits in the classroom, a few eat in the
      canteen, the lads sit on the dressing room benches, and friends turn up more than strangers.
      Walking up to someone: a card with who they are, E to talk. They open with something about what they
      are into; he picks one of three replies (listening to what they said, a joke, a plan, or turning it to
      football) and it lands well or badly by who they are; the first chat of a week counts most. At 40 they
      are a friend: swap numbers (their chat appears on the phone), hang out (a free evening, a little morale).
      Friends text with replies to pick from; a text left a week costs a little; months out of touch fades.
      The closest friends lift his mood. Life events about the closest friend: exams, a birthday party the
      night before a game, a loan, a night out with the lads (their name in it, the answer moves that
      friendship). Friends from school stay friends ("Friend from <school>") when he moves on.
      The People panel lists friends with their level and a bar; names over people fade in near him, no rings.
      Checked: life battery 207 (24 new), career battery 150; in Chrome at a school (five classmates on the
      grounds, the class seated, a chat with the numbered answers, Esc says goodbye without leaving) and at
      City Football Academy (the lads on the dressing room benches); frames 2.2 to 2.6 ms with them there.
- [x] W6 dating: the partner pool, meeting, her number, texts with replies, asking her out, planning a date,
      picking her up, dates as scenes with choices, stages, gifts, rows and break ups
      Open from eighteen, away from school (college, an academy, the pros). 240 women per part of the world
      (Indian names in India, international elsewhere, a few of each in both), every one with her own name,
      face, body, hair, clothes for the day and for the evening, a personality and two interests; each week one
      or two are at each cafe, the mall, the gym, the restaurant bar, two at the club, and some on the college
      grounds. The chat is the friends' chat with her own openers by place ("Is this seat taken?"); at 35 he can
      ask for her number (her yes depends on how it went and on how well known he is; a no waits a week).
      Her texts have replies; going quiet costs, more so once together. Asking her out is on her phone chat:
      the restaurant, the cafe, the mall, a walk, a drive or the club, a time later today on the city clock, and
      whether he picks her up in the car (a walk and a drive start from her door). It books a free evening.
      Her door is one of the homes in the middle of town or the suburbs, the same one every time; a pink marker
      shows it and "Show the way" points there. Pulling up outside (or walking up for a walk) she comes out,
      walks to the car and gets in; on foot she walks a step behind his shoulder; when he gets out she gets out
      on her side. At the place, as he walks in, the date starts: at the restaurant a candlelit table for two on
      the terrace by the water (and a table in the cafe) where they both sit and the camera comes in over his
      shoulder; at the mall and the club she stands with him; a walk or a drive turns into the date after a
      while together. Four moments (arriving, the place, "tell me something nobody knows", goodbye), three
      answers each, judged by who she is and what she likes; late costs. Dinner and the club cost real money (a
      card that bounces is remembered). A good first date and you are seeing each other; weeks of good dates
      and she is serious (her mum wants to meet you); she ends it if things get bad; he can end it from the
      phone. Presents: anything in the shops, bought for her (a thoughtful present beats an expensive one).
      Chasing someone else while with her, she can find out. Events: the comments under his posts, wanting
      more of his time, meeting her parents. She texts after his games. Being with someone good lifts morale.
      Checked: life battery 226 (19 new: no dating at school or under 18, 240 distinct women per region with
      varied looks, venues, her number, a date has to be later today, one a week, at the right place, the four
      moments, paid, now dating, a present, an event about her, stood up, ending it, no NaN); career battery 0
      failed; in Chrome: her number, the planner on the phone, the pick up at her door (she walks out to the
      car), the drive, out of the car, into Thalassa, the table for two by the water, the four moments, the end.
- [x] W7 the ring, the proposal, the wedding scene, married life (at home, texts, big matches, events, moves abroad)
      The watch boutique has an engagement ring case (Tiffany & Co. solitaire, Cartier halo, Graff three stone),
      sold only once it is serious with someone, one ring in his pocket at a time. At the end of a date with the
      ring on him the last moment has "Take out the ring"; her answer weighs how she feels, how long it has been
      serious, the ring, the place (the restaurant by the water best, the club worst) and how the night went.
      Yes: engaged, "She said yes" in gold, the news, Mum's message, followers. No: it hurts, the ring stays.
      Engaged, her phone chat plans the wedding: small (family and closest friends), big (and the squad) or
      huge (a destination wedding by the sea, magazine cover), each with its real cost; it is booked for today
      and a banner in the city takes him there. The venue is a place of its own: a garden (or a terrace over the
      sea) with an aisle, white chairs in rows, a flower arch, lights, the cake, and the guests seated: Mum, Dad,
      his brother or sister, his friends, then the squad and both families for a bigger one, all in smart
      clothes, him in a suit. She walks down the aisle in a white gown with the camera ahead of her, then the
      two of them under the arch; three moments (the walk, the vows, the first dance), petals falling at the end.
      Married: paid, in the news (by size), followers and commercial pull up, a big lift in morale. Married
      life: she lives in his home in the city and is there when he walks in (they talk), she texts (dinner, his
      mum, the weekend), she is in the family section at his games, a good marriage steadies him more than
      dating; events: Mum and his wife disagree, the agent's summer tour against a summer at home, an offer from
      abroad and what she thinks. A move for football asks her: a new city, a new country (if things are good she
      is already packing; if not, it hurts); someone he is dating becomes long distance. A marriage is not ended
      with a text. She carries forward through every stage of his career.
      Checked: life battery 240 (14 new); in Chrome: the ring case, the proposal on the terrace, booking on the
      phone, the banner, a big and a huge wedding (24 and 40 guests; 155 and 237 draw calls, frames 2.7 to 2.8
      ms), her walk down the aisle, the vows, the petals, then his wife at home in their flat in Goa.
- [x] W8 matches at the right venue: school, college, academy and pro grounds, daylight or floodlights, crowd and
      sound by venue, home and away
      The venue (W2's venueFor, the home side's ground) goes from the career's match page into FLMatch.open and
      the 3D view (match.js passes it only in open(); Classic's sim never sees it; a Manager Career match passes
      none). floodlights/m3d/view/ground.mjs builds a school, college or academy ground in place of the stadium,
      same interface: the school's own buildings in its colours round the field, trees, a fence, benches, and a
      few people standing along both touchlines (no stands); a college adds a small stand along the far side,
      filled by the crowd figure, with a roof at the better ones and a running track at the best, and bigger
      campus blocks behind; an academy is the club's training ground (the glass building with the club's band,
      dugouts, other pitches, floodlights at a big club) with a small stand of supporters in the club's colour.
      All scenery is one merged mesh, the people two instanced meshes that bob and jump for their side's goals.
      In the day the view lights it like the day: sky, a sun, softer fog, brighter exposure, and the pitch's run
      off turned to grass (pitch.daylight(), never called for a stadium). Pro matches keep the stadium.
      Sound (sound.mjs, made in the browser, Player Career only): a school is quiet with shouts and claps from
      the touchline, a college murmurs, an academy has a small crowd, a pro stadium roars and surges near goal;
      the referee's whistle for fouls, kick off, half time and full time (three blasts). It follows the city's
      mute setting. Manager Career matches have no venue, so no ground, no daylight and no sound: unchanged.
      Checked: 3D match battery 177 (8 new: each ground's make up, goals and no NaN, cheap, a school match at
      the school ground, a Manager match at the stadium, the venue never in Classic's sim); every Floodlights
      battery 0 failed; in Chrome live matches at a school (away, at the other school), a college, an academy
      (away at Brighton's) and the pros (Mumbai City at the stadium): 2.2 to 3.5 ms a frame, 76 to 82 calls.
- [x] W9 batteries extended (friendships, dating stages, marriage, venue selection), screenshots, every battery 0
      failed three times, memory under 400 MB, upload, push
      Batteries: the life battery covers friendships (24), dating (19), the ring, wedding and married life (14)
      and venue selection (7 from W2); the 3D match battery covers the grounds and venues (8). Found while
      shooting and fixed: the second column of training pitches ran into the main building at most clubs (the
      ground is now 208 to 224 m wide with a clear gap), the training ground roof was painted all in the club's
      colour (now grey with a club fascia), and campus fronts on the street were one unstreamed mesh (each
      campus now has a near version with every detail within 150 m and a plain far version out to the draw
      distance, nothing beyond, like the city's chunks). A good marriage now also steadies his form. One test
      fix: the career battery's coach's sheet check no longer counts a week he was injured in that week's
      training (training runs after the sheet is picked, so the role is "injured"; the game was right).
      test:all three times in a row, all green: typecheck, vitest 101, test_condition 138, test_sept 255 to 257,
      test_dom_sept 167, test_match3d 177, test_layout 222, test_career 149 to 150, test_career_life 240,
      test_site 202, test_boot 52 (some batteries count a check or two only when a random event happens).
      Idle memory on the production server with a Manager game and two careers: 150 MB (130 at boot).
      Acceptance screenshots on the production build in Be-A-Manager/acceptance_shots/campuses (not in the
      repo): the school pitch (floating labels hidden for that one shot) and corridor, the college campus with
      its stand, a training ground (his club's, City Football Academy, Carrington style: pitches, floodlights,
      the glass building, the car park, the lads), a school match away (no stands, people on the touchline), a
      college match (the small stand partly full), a pro match in Mumbai City's stadium, picking her up in the
      car, a date at Thalassa by the water, and the wedding (her walk down the aisle, then under the arch).

## Open world full screen, Esc menu, loading screen

- [x] Full screen: the city tab shows the open world in a fixed layer over the whole window, edge to edge; the
      career header is not drawn and the page cannot scroll behind it. The career's calls (a choice, offers,
      something brewing) stay in reach down the right side; popups (the phone, events, moments) sit on top.
- [x] Esc: in the street, Esc opens a glass pause card (Resume, Back to Career, the graphics tiers and Keep it
      smooth) and the world stands still; Esc again or Resume closes it; Back to Career goes back to the Career
      tab. Unchanged: with the mouse captured the first Esc frees it, inside a place Esc leaves it, the map,
      chats, dates and popups keep their own Esc. Getting in is the same city tab as before.
- [x] Loading: a plain dark screen with the brand's three dots pulsing in turn and "Loading the city", one
      element from the moment he steps in until the world has drawn its first frames, then a half second fade.
      Only transform and opacity animate, so it keeps moving while the city is built.
      Checked in Chrome (dev and production): the world is 1440 by 900 at 1440 by 900 with no header, the clock
      stands still while paused, focus lands on Resume, the map's Esc and a place's Esc are as before, graphics
      change from the card, Back to Career, a second entry shows the loader again. Screenshots in
      Be-A-Manager/acceptance_shots/open_world. One battery fix for chance in the simulated career: a benched
      pro at a stacked club is made good enough to start before the live league match check. test:all green.
