# Full site audit

The whole site, item by item, on the real running server: scripted headless Chrome (every console message,
every page error and every failed or hanging request recorded on every screen) plus screenshots looked at by
eye. Every defect found goes in the defect log at the bottom with how to make it happen, what caused it and
the fix. The clean pass at the end runs the whole list again from the top.

Legend: [ ] not checked yet, [x] checked and clean (or its defects fixed and checked again).

## 1. Landing

- [ ] First visit: the intro plays (lights, the welcome flight, the two ball moments, the cards)
- [ ] The intro can be skipped at once: click, Esc, wheel, key
- [ ] Second visit in the same tab gets the short version
- [ ] Reduced motion gets the calm page
- [ ] Both enter buttons go to the right place (Floodlights, Game Night)
- [ ] Credit line shows after the cards
- [ ] Laptop (1280) and small (390) widths: nothing cut off, no sideways scroll
- [ ] Console clean, no failed requests

## 2. Floodlights entry (Manager Career lobby)

- [ ] Entry page: stars, frame, title, stats, name field, Create a game, join with a code, mode cards
- [ ] Create a game: empty name, very long name, emoji, script tags
- [ ] Join with a code: empty, wrong code, lower case code, code with spaces, a code for a game that is gone
- [ ] Lobby: code boxes, manager list, league select, pick a club, pick another club, Start world (host only)
- [ ] Second manager joins the same code, picks the same club (refused), picks another
- [ ] Nation pick
- [ ] Restore from the device copy when the server lost the game
- [ ] Laptop and small widths
- [ ] Console clean, no failed requests

## 3. Manager Career tabs

- [ ] Squad: table, tactic select, sort select (all five), staff strip, list a player, release, loan out, recall, train, react
- [ ] Lineup: formation list (all seven), auto pick XI, drag to the pitch, tap then spot, X sends back, subs 9 max, save lineup (empty, partial, full)
- [ ] Transfer market: search, filters, make an offer (zero, negative, huge, fair), hijack, sign a free agent, loan in, buy a loan
- [ ] Offers: accept, reject, counter, renegotiate
- [ ] Romano
- [ ] Matches: results, play match surfaced, result chips
- [ ] Travel: travel fund, book travel (each option), booking twice
- [ ] Calendar
- [ ] Cups
- [ ] Tables (every league)
- [ ] Cabinet
- [ ] Academy: promote
- [ ] Nations
- [ ] News feed: news seen
- [ ] Sim a week, sim to the end of the season, next season, unlock
- [ ] Penalties
- [ ] Every modal opens and closes (button, Esc, outside click)
- [ ] Laptop and small widths on every tab
- [ ] Console clean, no failed requests on every tab

## 4. The 3D match

- [ ] Manager mode: kick off, play to full time, result reaches the season
- [ ] Player lock: control one player, play to full time
- [ ] Pause, speed, camera, subs, leave mid match (and come back)
- [ ] Graphics low, medium, high
- [ ] Frame rate on medium, low lighter than medium
- [ ] Console clean

## 5. Classic 2D match

- [ ] Plays to full time, result counts once
- [ ] Console clean

## 6. Player Career: life screens

- [ ] Title: list of careers on the device, Continue, Play, Save to a file, Delete (two clicks), Load from a file (good file, broken file, empty file)
- [ ] Creator: every step, empty name, huge name, emoji, script tags, every position, every look option, back
- [ ] Hub: career tab, play the week, sim to the next event, sim the season, decisions, offers, events
- [ ] Phone: home, messages, team, agent, social, news, calendar, bank
- [ ] Social: posts, followers
- [ ] Money: bank, sponsor deals, amounts (zero, negative, huge)
- [ ] Relationships: talk, ask out, dates, partner stages
- [ ] Family
- [ ] Agent: hire, fire, negotiate
- [ ] Training: plan the week
- [ ] Matchday: match start, match result, the moment screen
- [ ] School: pass school, college, academy, trial
- [ ] Sign pro, transfer request, renewal
- [ ] Retire, retired screen
- [ ] Graphics popup: every tier, Keep it smooth
- [ ] Laptop and small widths
- [ ] Console clean, no failed requests

## 7. Open world

- [ ] City loads behind the loading screen, Esc menu, full screen
- [ ] Walking, driving, getting in and out of a car
- [ ] Bus: wait, ride, get off
- [ ] Map: open, set a waypoint, clear it, follow it
- [ ] Every store type: store, brand, sport, goods, watches, supermarket, mall, cafe, restaurant, nightclub, clinic, gym
- [ ] Buy something in each (with and without enough money)
- [ ] School campus, college campus, training ground, stadium
- [ ] Homes: buy, move in, rooms
- [ ] Garage and dealerships: buy a car with a home and without one
- [ ] Dates: pick up a date, go out, the date card
- [ ] Wedding
- [ ] 30 minutes idle and roaming: frame rate and memory
- [ ] Console clean

## 8. Front Office (Game Night)

- [ ] Hub page: both tiles, continue lines
- [ ] GM entry: create a game alone, create and join with a code (PeerJS, by hand)
- [ ] Every page in a save: roster, depth, team, player, players, compare, trade, free agency, draft, contracts, cap, finances, staff, schedule, standings, stats, box, play, playoffs, offseason, awards, history, news, finder, assets, settings, online
- [ ] Sim day, week, to the end of the season, offseason
- [ ] Trade: propose, accept, refuse
- [ ] Laptop and small widths
- [ ] Console clean

## 9. Hardwood Legends

- [ ] Entry: menu, modes, create a game, join with a code
- [ ] Quick game to the final whistle
- [ ] Season mode: continue line on the hub
- [ ] Multiplayer: create a room, a friend joins, play, leave, rejoin, wrong code, full room
- [ ] Console clean

## 10. Shared systems

- [ ] Events and popups
- [ ] Toasts
- [ ] Saves: server save file, device copies, restore
- [ ] Rooms: create, join, leave, rejoin
- [ ] Travel planner

## 11. Hostile and edge testing

- [ ] Fuzz every input: huge strings, emoji, scripts, negative numbers, zeros, NaN
- [ ] Spam clicks: buy, sign, confirm, play matchweek, save lineup (no doubles)
- [ ] Races: leave mid match, refresh mid sim, close mid purchase, Esc during loading, same save in two tabs
- [ ] Money never negative or NaN, OVR in bounds, weeks advance once, no duplicate players, owned items persist across reload and restart
- [ ] Server restart mid game: rooms come back; wrong codes; full room; leave and rejoin; two clients at once (football and basketball)
- [ ] Soak: multi season manager save, a full player career school to retirement, open world 30 minutes
- [ ] Performance: landing, open world, both 3D match modes; low lighter than medium
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

## Clean pass log
