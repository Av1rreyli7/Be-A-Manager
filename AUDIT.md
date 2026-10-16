# Full site audit

The whole site, item by item, on the real running server: scripted headless Chrome (every console message,
every page error and every failed or hanging request recorded on every screen) plus screenshots looked at by
eye. Every defect found goes in the defect log at the bottom with how to make it happen, what caused it and
the fix. The clean pass at the end runs the whole list again from the top.

Legend: [ ] not checked yet, [-] partly checked (what is left is said on the line), [x] checked and clean (or its
defects fixed and checked again). The status below is after the first systematic pass, before the clean pass.

## 1. Landing

- [x] First visit: the intro plays (lights, the welcome flight, the two ball moments, the cards)
- [x] The intro can be skipped at once: click, Esc, wheel, key (a plain letter key does not skip it, by design: Esc, a click, the wheel or a swipe do)
- [x] Second visit in the same tab gets the short version
- [x] Reduced motion gets the calm page
- [x] Both enter buttons go to the right place (Floodlights, Game Night)
- [x] Credit line shows after the cards
- [x] Laptop (1280) and small (390) widths: nothing cut off, no sideways scroll
- [x] Console clean, no failed requests

## 2. Floodlights entry (Manager Career lobby)

- [x] Entry page: stars, frame, title, stats, name field, Create a game, join with a code, mode cards
- [x] Create a game: empty name, very long name, emoji, script tags
- [ ] Join with a code: empty, wrong code, lower case code, code with spaces, a code for a game that is gone
- [x] Lobby: code boxes, manager list, league select, pick a club, pick another club, Start world (host only)
- [x] Second manager joins the same code, picks the same club (refused), picks another
- [ ] Nation pick
- [ ] Restore from the device copy when the server lost the game
- [ ] Laptop and small widths
- [x] Console clean, no failed requests

## 3. Manager Career tabs

- [-] Squad: table, tactic select, sort select (all five), staff strip, list a player, release, loan out, recall, train, react (left: list, release, loan out, recall, train and react through the buttons; the API side is fuzzed)
- [-] Lineup: formation list (all seven), auto pick XI, drag to the pitch, tap then spot, X sends back, subs 9 max, save lineup (empty, partial, full) (left: drag, tap then spot, X, the 9 sub limit)
- [-] Transfer market: search, filters, make an offer (zero, negative, huge, fair), hijack, sign a free agent, loan in, buy a loan (search and a bid done; left: filters, hijack, free agent, loans)
- [ ] Offers: accept, reject, counter, renegotiate
- [x] Romano
- [x] Matches: results, play match surfaced, result chips
- [-] Travel: travel fund, book travel (each option), booking twice (fund done; left: booking each option and twice)
- [x] Calendar
- [x] Cups
- [-] Tables (every league) (left: the other 14 leagues)
- [x] Cabinet
- [-] Academy: promote (left: promote)
- [x] Nations
- [x] News feed: news seen
- [x] Sim a week, sim to the end of the season, next season, unlock
- [ ] Penalties
- [x] Every modal opens and closes (button, Esc, outside click) (the site has no Esc to close a popup anywhere; buttons and outside clicks work)
- [x] Laptop and small widths on every tab
- [x] Console clean, no failed requests on every tab

## 4. The 3D match

- [x] Manager mode: kick off, play to full time, result reaches the season
- [x] Player lock: control one player, play to full time
- [-] Pause, speed, camera, subs, leave mid match (and come back) (pause, quit and leaving done; left: camera, subs)
- [ ] Graphics low, medium, high
- [-] Frame rate on medium, low lighter than medium (60 a second on the default quality in both modes; left: low against medium)
- [x] Console clean

## 5. Classic 2D match

- [x] Plays to full time, result counts once
- [x] Console clean

## 6. Player Career: life screens

- [-] Title: list of careers on the device, Continue, Play, Save to a file, Delete (two clicks), Load from a file (good file, broken file, empty file) (list, Continue, Play done; left: Save to a file, Delete, Load from a file)
- [x] Creator: every step, empty name, huge name, emoji, script tags, every position, every look option, back
- [x] Hub: career tab, play the week, sim to the next event, sim the season, decisions, offers, events
- [x] Phone: home, messages, team, agent, social, news, calendar, bank
- [-] Social: posts, followers (app opens; left: a post)
- [-] Money: bank, sponsor deals, amounts (zero, negative, huge) (left: the bank and sponsors through the screens; the API side is fuzzed)
- [x] Relationships: talk, ask out, dates, partner stages
- [-] Family (left: a family event through the screens)
- [-] Agent: hire, fire, negotiate (left: through the screens)
- [-] Training: plan the week (left: change the plan)
- [x] Matchday: match start, match result, the moment screen
- [x] School: pass school, college, academy, trial
- [-] Sign pro, transfer request, renewal (signing and renewals through the API in the full career soak; left: the screens)
- [-] Retire, retired screen (retired through the API; left: the retired screen)
- [x] Graphics popup: every tier, Keep it smooth
- [ ] Laptop and small widths
- [x] Console clean, no failed requests

## 7. Open world

- [x] City loads behind the loading screen, Esc menu, full screen
- [x] Walking, driving, getting in and out of a car
- [x] Bus: wait, ride, get off
- [-] Map: open, set a waypoint, clear it, follow it (left: clear and follow)
- [x] Every store type: store, brand, sport, goods, watches, supermarket, mall, cafe, restaurant, nightclub, clinic, gym
- [-] Buy something in each (with and without enough money) (left: without enough money)
- [x] School campus, college campus, training ground, stadium
- [x] Homes: buy, move in, rooms
- [x] Garage and dealerships: buy a car with a home and without one
- [x] Dates: pick up a date, go out, the date card
- [x] Wedding
- [ ] 30 minutes idle and roaming: frame rate and memory
- [x] Console clean

## 8. Front Office (Game Night)

- [x] Hub page: both tiles, continue lines
- [x] GM entry: create a game alone, create and join with a code (two browsers over PeerJS: a wrong code says so, a friend joins, both pick, the host starts, the friend follows the host's sims; after a host refresh the friend gets Reconnect and the host Open room, by design)
- [x] Every page in a save: roster, depth, team, player, players, compare, trade, free agency, draft, contracts, cap, finances, staff, schedule, standings, stats, box, play, playoffs, offseason, awards, history, news, finder, assets, settings, online
- [x] Sim day, week, to the end of the season, offseason
- [x] Trade: propose, accept, refuse (the AI's verdict, the cap check's refusal, a counter-offer request; a completed trade is covered by the trade unit tests)
- [ ] Laptop and small widths
- [x] Console clean

## 9. Hardwood Legends

- [x] Entry: menu, modes, create a game, join with a code
- [-] Quick game to the final whistle (played half a game; left: to the end with short quarters)
- [-] Season mode: continue line on the hub (left: start a season from the menu, sim, playoffs, the hub line)
- [ ] Multiplayer: create a room, a friend joins, play, leave, rejoin, wrong code, full room (the two browser battery runs in the clean pass)
- [x] Console clean

## 10. Shared systems

- [x] Events and popups
- [x] Toasts
- [-] Saves: server save file, device copies, restore (left: restore on the page; the restart battery runs in the clean pass)
- [-] Rooms: create, join, leave, rejoin (left: leave and rejoin by hand)
- [x] Travel planner

## 11. Hostile and edge testing

- [-] Fuzz every input: huge strings, emoji, scripts, negative numbers, zeros, NaN (6025 hostile requests at every route: no server error, no NaN, no negative money; left: the inputs on the screens)
- [x] Spam clicks: buy, sign, confirm, play matchweek, save lineup (no doubles)
- [x] Races: leave mid match, refresh mid sim, close mid purchase, Esc during loading, same save in two tabs
- [x] Money never negative or NaN, OVR in bounds, weeks advance once, no duplicate players, owned items persist across reload and restart
- [ ] Server restart mid game: rooms come back; wrong codes; full room; leave and rejoin; two clients at once (football and basketball)
- [-] Soak: multi season manager save, a full player career school to retirement, open world 30 minutes (a whole Player Career, 27 seasons, clean; left: a multi season Manager save, 30 minutes in the open world)
- [-] Performance: landing, open world, both 3D match modes; low lighter than medium (left: landing profile, low against medium)
- [ ] Server memory under 400 MB idle

## Defect log

| # | Area | What happens and how to make it happen | Cause | Fix | Status |
|---|------|------|------|------|------|
| 1 | Server, all games | Join any Floodlights game with the name `__proto__`, then pick a club or a nation: every object in the server takes that club and nation, so every room on the server is changed. `constructor` and `toString` as names, nations, staff or event keys did the same or crashed the request. | Names, codes and keys from a request were used straight as keys into plain objects, and a key every object inherits reaches Object.prototype. | A request carrying an inherited key is turned away at the API boundary; users, clubs, nations, staff, shootouts and moments are only read from their own entries. Hardwood rooms do the same for member names. | Fixed |
| 2 | Game Night | Going from /online or /game to /gm prints a Next.js warning and every page change in Front Office scrolls slowly to the top instead of jumping. | Next 16 no longer turns smooth scrolling off during page changes unless the html tag asks for it. | `data-scroll-behavior="smooth"` on the html tag. | Fixed |
| 3 | Entry pages, phone width | At 390 wide the Floodlights, Front Office and Hardwood entry card runs past the frame on the right (8 px gap on the left, none on the right). | The one column grid took the min content width of the widest item, 18 px more than the screen had. | The column can shrink (`minmax(0, 1fr)`), and the three stats sit a little closer below 480 px so they still fit on one row. | Fixed |
| 4 | Manager Career, every room | A friend who joins with a name like `<svg onload=alert(1)>` (it fits in 20 letters) has it run as page code in every other manager's browser: lobby list, club picker, tables, fixtures, nations, reactions, awards, the news feed, club news and the Romano wire. In Matches and Tables it showed as a big empty box next to their club. | Manager names, and the server's news lines that carry them, were written into the page as HTML. | One `escHtml` helper and every spot that shows another player's typed text goes through it (17 spots). | Fixed |
| 5 | Manager Career, the bottom ticker | The TRANSFER WIRE ticker says "Waiting for the first matchweek..." for the whole game, in week 30 as in week 0. | It looked for a feed line starting with MATCHWEEK, but the server writes the week's results as "PREMIER LEAGUE WEEK 3: ..." (the same mismatch is in the original). | It shows the latest week line, your league's first. | Fixed |
| 6 | Manager Career, matchday | While your match plays live, the league panel says "PREMIER LEAGUE · MW 1" in week 2, and "MW 3" in week 38 after a simmed season. | The label was set only at full time, after the live frame had already returned. | The label is set as soon as the week shows. | Fixed |
| 7 | Manager Career, Sim season | Sim season held the whole server for about 0.9 s here (every other request waited), on the free host's tenth of a CPU around 9 s: the same thing that lost Player Career seasons (the host thinks the server died and restarts it, which wipes its disk). | Every week of the season was played in one go without letting anything else run. | The weeks still play in one request, but the server answers everyone else between weeks (longest wait now 0.12 s) and saves each week as it lands. A second sim, Play matchweek or Start next season for that game waits until the sim is done. | Fixed |
| 8 | Player Career, phone width | At 390 wide the hub header does not fit: the Career and city tabs are squeezed to nothing, so a phone has no way into the open world, and the Graphics button sits off screen (opening it slides the whole page sideways). | The header is one row that never wraps, and the tabs scroll inside themselves, so they were the thing that shrank. | The header wraps onto a second row when it has to, and the tabs keep their size. | Fixed |
| 9 | Open world, memory | Going in and out of places leaks GPU memory: 2 geometries, 3 textures and about 50 buffers more for every door, until the browser tab dies after about 20 places (it did, twice, in the sweep). It also halved the frame rate. | Three things were never freed: the reflection map was rebuilt on every way in and out and the old one kept (with the little room it is drawn from); the instanced meshes in a shop kept their per copy data on the GPU; every body kept its skeleton's bone texture. | The reflection map is made once and freed with the scene, only its strength changes at a door; a room frees its instanced meshes; a body frees its skeleton. Repeat visits now stay flat, every place opens without a crash and the street holds 60 frames a second. | Fixed |
| 10 | Player Career, end of season | When a season ends the header, the save list and the phone say "week 39" of a 38 week season. | The label was the next week's number even when there is no next week. | It stops at the last week. | Fixed |
| 11 | Player Career, dates | A coffee date at noon opens with "I was not sure what to wear tonight", ends with "Say goodnight" and she texts "Thanks for tonight". | The date lines were written for evening dates, but dates can be at any hour from now to 23:00. | The words fit any time of day ("what to wear", "Say goodbye", "Thanks, that was fun", "The best date..."). | Fixed |
| 12 | Front Office, sim buttons | A double click on Week sims two weeks, on Day two days (even with 0 ms between the clicks), and holding the W key sims week after week. | A week can be done before the second click of a double click lands, and the shortcut keys did not ignore a held key's repeats. | The second click of a double click does nothing on every button that moves the league on (Day, Next game, Week, the More menu, FA day and week, the next step, Sim to game day, Continue to the next phase), and a held key sims once. | Fixed |
| 13 | Front Office, offseason | After a playoff run into June the draft lottery puts the date back to 12 May; a long run can do the same to the draft, Summer League, camp and free agency dates. | Each offseason step set the date to its calendar day without looking at the date it was already on. | A step lands on its own day, or the day after now when the season already ran past it (`onOrAfter`). | Fixed |
| 14 | Manager Career, entry | Three quick clicks on Create a game made two rooms (one left empty on the server). | Create and Join had nothing stopping a second press while the first was still out. | Both stay off while their request is out. | Fixed |
| 15 | Manager Career, the same game in two tabs | Two tabs (or a host and a stale second tab) pressing Play matchweek at the same moment played two weeks. | The server played a week for every press, whatever week the page was showing. | The page sends the week it shows; a press for a week that was already played is turned away quietly and the page catches up. (Kick off already worked this way.) | Fixed |
| 16 | Front Office, the online room | `ERROR PeerJS: Error: Lost connection to server.` in the console, and a red "Couldn't reach the matchmaking server" toast, whenever the room's link to the public PeerJS broker dropped for a moment (sleep, flaky Wi-Fi), even though the room reconnects by itself 1.5 s later. Made to happen every time by closing the broker socket in the lobby. | PeerJS was created with `debug: 1`, so it printed every error itself, and the room passed the dropped link to the screen as an error before its own reconnect had a chance. | PeerJS logs nothing itself (the game handles every peer error); a dropped broker link is only reported if the automatic reconnect also fails (checked: one drop reconnects silently, a reconnect that keeps failing still shows the message). | Fixed |
| 17 | Manager Career, entry | Join with an empty or short code sent a request that came back 404, a red line in the console, then said "Game not found". | The page sent any code to the server. | A code that is not four letters and numbers is not sent: "Type the 4 character room code first." (Front Office already did this.) A wrong four letter code still asks the server, which answers "Game not found". | Fixed |
| 18 | Front Office, trades, the draft, signings, commissioner edits | A double click on Propose trade showed its answer twice; Draft, Make offer, Match, 10-day and Two-way could act twice the same way. A commissioner could type a negative or astronomical salary into a contract (payroll and cap space then make no sense). | Those buttons acted on every click of a double click; the salary box took any number. | The second click of a double click does nothing on those buttons too; the salary box keeps a whole number from 0 to 1,000,000,000. | Fixed |

## Left after the first pass

Deliberately left, with the reason:
- The console warning `THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.`, printed once each
  time a Player Career 3D view opens. It comes from React Three Fiber 9.8.1 (the newest stable release) making a
  THREE.Clock inside its own store, which three.js 0.183 and later mark as deprecated. No stable React Three Fiber uses
  THREE.Timer yet (only the 10.0 alpha); hiding the message would only hide it.
- Esc does not close popups. No popup on the site has ever closed with Esc; adding it would be a new feature.

Still to do: the [-] and [ ] items above, then the clean pass.

## Clean pass log
