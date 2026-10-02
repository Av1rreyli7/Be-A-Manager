# Data report

Fetched: **2026-09-29T19:13:37.586Z** · Season: **2026-27** · Regenerate with `npm run refresh-data`.

## Sources

| Data | Source | Notes |
|---|---|---|
| Teams, head coaches, rosters, bio (age, DOB, height, weight, college, birthplace, experience), injuries | ESPN public API (`site.api.espn.com`) | No robots.txt restrictions on API hosts |
| Draft slot, current-season contract record (salary, trade kicker, trade restriction) | ESPN core API (`sports.core.api.espn.com`) | |
| Last 3 seasons of regular-season stats | ESPN web API (`site.web.api.espn.com`) | |
| Multi-year salaries, player/team options, guaranteed totals | hoopsnightly.com team cap pages | robots.txt explicitly allows Claude agents |
| Two-way contracts | Hoops Rumors 2026/27 two-way tracker | robots.txt allows; crawl-delay honoured |
| Hard caps & exception usage (2026-27) | Hoops Rumors "NBA Teams With Hard Caps For 2026/27" | |
| 2025-26 final standings | ESPN standings API | |
| Draft picks 2027-2033 (ownership, protections, swaps) | hoopsnightly.com team draft-pick ledgers | "verified weekly against the trade record" |
| CBA figures | NBA.com / Hoops Rumors (announced 2026-06-30) | see cba.json `source` fields |

**Not used (blocked or disallowed):** Basketball-Reference, Spotrac, RealGM (HTTP 403 to automated requests / robots.txt disallows AI agents), HoopsHype (robots.txt disallows Claude), NBA.com stats (robots.txt disallows AI agents).

## Summary

- 30 teams · 605 rostered players · 635 contracts · 420 pick records
- 705 of 1285 contract-seasons are **approximate** (future years published rounded to $0.1M)
- 0 pick records failed cross-verification · 134 have complex/conditional terms kept as text

| Team | Name | Conf | Division | ESPN roster | Standard | Two-way | Camp | 2026-27 payroll* |
|---|---|---|---|---|---|---|---|---|
| ATL | Atlanta Hawks | East | Southeast | 20 | 15 | 3 | 2 | $198.5M |
| BOS | Boston Celtics | East | Atlantic | 21 | 17 | 2 | 2 | $203.9M |
| BKN | Brooklyn Nets | East | Atlantic | 19 | 15 | 3 | 1 | $161.5M |
| CHA | Charlotte Hornets | East | Southeast | 19 | 16 | 1 | 2 | $163.7M |
| CHI | Chicago Bulls | East | Central | 21 | 14 | 2 | 5 | $171.2M |
| CLE | Cleveland Cavaliers | East | Central | 21 | 14 | 3 | 4 | $209.0M |
| DAL | Dallas Mavericks | West | Southwest | 20 | 15 | 3 | 2 | $197.9M |
| DEN | Denver Nuggets | West | Northwest | 21 | 14 | 3 | 4 | $221.1M |
| DET | Detroit Pistons | East | Central | 19 | 14 | 3 | 2 | $153.2M |
| GS | Golden State Warriors | West | Pacific | 21 | 17 | 3 | 1 | $224.7M |
| HOU | Houston Rockets | West | Southwest | 19 | 16 | 3 | 0 | $205.5M |
| IND | Indiana Pacers | East | Central | 18 | 13 | 3 | 2 | $206.4M |
| LAC | LA Clippers | West | Pacific | 21 | 17 | 2 | 2 | $193.7M |
| LAL | Los Angeles Lakers | West | Pacific | 21 | 16 | 3 | 2 | $204.0M |
| MEM | Memphis Grizzlies | West | Southwest | 21 | 18 | 3 | 0 | $161.1M |
| MIA | Miami Heat | East | Southeast | 19 | 16 | 3 | 0 | $210.5M |
| MIL | Milwaukee Bucks | East | Central | 21 | 18 | 2 | 1 | $193.8M |
| MIN | Minnesota Timberwolves | West | Northwest | 21 | 14 | 3 | 4 | $215.3M |
| NO | New Orleans Pelicans | West | Southwest | 21 | 18 | 3 | 0 | $204.3M |
| NY | New York Knicks | East | Atlantic | 21 | 18 | 2 | 1 | $230.2M |
| OKC | Oklahoma City Thunder | West | Northwest | 21 | 15 | 3 | 3 | $216.2M |
| ORL | Orlando Magic | East | Southeast | 20 | 16 | 3 | 1 | $223.3M |
| PHI | Philadelphia 76ers | East | Atlantic | 21 | 18 | 2 | 1 | $213.2M |
| PHX | Phoenix Suns | West | Pacific | 20 | 15 | 3 | 2 | $216.2M |
| POR | Portland Trail Blazers | West | Northwest | 18 | 15 | 3 | 0 | $194.5M |
| SAC | Sacramento Kings | West | Pacific | 19 | 13 | 2 | 4 | $191.8M |
| SA | San Antonio Spurs | West | Southwest | 21 | 15 | 3 | 3 | $198.3M |
| TOR | Toronto Raptors | East | Atlantic | 20 | 16 | 3 | 1 | $205.1M |
| UTAH | Utah Jazz | West | Northwest | 19 | 15 | 3 | 1 | $181.9M |
| WSH | Washington Wizards | East | Southeast | 21 | 14 | 2 | 5 | $192.8M |

\* sum of standard contracts incl. dead money; excludes two-way/camp deals and cap holds.

## ⚠ Items to verify manually

### Warnings
- Head coach "Tiago Splitter" listed for CHI and POR - one is likely stale on ESPN; fix in teams.json
- Two-way tracker last updated 9-29-26 (82 entries)
- PJ Hall: two-way with BKN per Hoops Rumors, ESPN roster CHA

### Cap-sheet rows not matched to a rostered player (dead money / waived / name mismatch)
- Devin Carter - ATL dead money (now signed with BOS)
- Nick Pringle - on BKN cap sheet but not on any ESPN roster → dead money (verify)
- Buddy Hield - CHA cap sheet but ESPN roster CHI; contract assigned to CHI (verify)
- Ryan Nembhard - on CHA cap sheet but not on any ESPN roster → dead money (verify)
- Rob Dillingham - on CHI cap sheet but not on any ESPN roster → dead money (verify)
- Cam Whitmore - CLE dead money (now two-way with DEN)
- Ricky Rubio - on CLE cap sheet but not on any ESPN roster → dead money (verify)
- Klay Thompson - DAL dead money (now signed with MIA)
- JaVale McGee - on DAL cap sheet but not on any ESPN roster → dead money (verify)
- Olivier-Maxence Prosper - DAL dead money (now signed with MEM)
- Gary Harris - on DET cap sheet but not on any ESPN roster → dead money (verify)
- Nick Boyd - on GS cap sheet but not on any ESPN roster → dead money (verify)
- Keba Keita - on IND cap sheet but not on any ESPN roster → dead money (verify)
- Rienk Mast - on IND cap sheet but not on any ESPN roster → dead money (verify)
- Nicolas Batum - on LAC cap sheet but not on any ESPN roster → dead money (verify)
- Johni Broome - on LAC cap sheet but not on any ESPN roster → dead money (verify)
- Chase Ross - on LAL cap sheet but not on any ESPN roster → dead money (verify)
- Meechie Johnson - on LAL cap sheet but not on any ESPN roster → dead money (verify)
- Kentavious Caldwell-Pope - MEM dead money (now signed with PHI)
- D'Angelo Russell - on MEM cap sheet but not on any ESPN roster → dead money (verify)
- Cole Anthony - on MEM cap sheet but not on any ESPN roster → dead money (verify)
- Mamadi Diakite - on MEM cap sheet but not on any ESPN roster → dead money (verify)
- Damian Lillard - MIL dead money (now signed with POR)
- Vasilije Micic - on MIL cap sheet but not on any ESPN roster → dead money (verify)
- John Konchar - MIN dead money (now signed with NY)
- Taj Gibson - on NO cap sheet but not on any ESPN roster → dead money (verify)
- Bradley Beal - PHX dead money (now signed with LAC)
- Nassir Little - on PHX cap sheet but not on any ESPN roster → dead money (verify)
- E.J. Liddell - on PHX cap sheet but not on any ESPN roster → dead money (verify)
- Didi Louzada - on POR cap sheet but not on any ESPN roster → dead money (verify)
- KeShawn Murphy - on WSH cap sheet but not on any ESPN roster → dead money (verify)

### Two-way / contract records that could not be matched
- Michael Ajayi - two-way with Charlotte Hornets per Hoops Rumors, not on ESPN roster
- Kylan Boswell - two-way with Charlotte Hornets per Hoops Rumors, not on ESPN roster

### Current-season salary disagreements (>2%) between hoopsnightly and ESPN
- Ron Harper Jr. (BOS): hoopsnightly $3,150,752 vs ESPN $2,538,126 - using hoopsnightly
- Devin Carter (BOS): hoopsnightly $2,449,421 vs ESPN $5,158,080 - using hoopsnightly
- Day'Ron Sharpe (BKN): hoopsnightly $10,000,000 vs ESPN $6,250,000 - using hoopsnightly
- Josh Minott (BKN): hoopsnightly $4,500,000 vs ESPN $2,584,539 - using hoopsnightly
- Royce O'Neale (CHA): hoopsnightly $10,875,000 vs ESPN $11,375,000 - using hoopsnightly
- James Harden (CLE): hoopsnightly $30,647,619 vs ESPN $42,317,308 - using hoopsnightly
- DeMar DeRozan (DEN): hoopsnightly $2,449,421 vs ESPN $25,740,000 - using hoopsnightly
- Paul Reed (DET): hoopsnightly $5,602,689 vs ESPN $5,000,000 - using hoopsnightly
- Al Horford (GS): hoopsnightly $6,822,000 vs ESPN $5,969,250 - using hoopsnightly
- Dalen Terry (GS): hoopsnightly $1,357,763 vs ESPN $2,584,539 - using hoopsnightly
- Marcus Smart (HOU): hoopsnightly $6,064,000 vs ESPN $5,390,700 - using hoopsnightly
- Bogdan Bogdanovic (HOU): hoopsnightly $2,449,421 vs ESPN $16,020,000 - using hoopsnightly
- Brook Lopez (LAC): hoopsnightly $9,187,500 vs ESPN $8,750,000 - using hoopsnightly
- Bradley Beal (LAC): hoopsnightly $6,424,800 vs ESPN $5,621,700 - using hoopsnightly
- Jordan Miller (LAC): hoopsnightly $5,300,000 vs ESPN $2,497,812 - using hoopsnightly
- Kobe Sanders (LAC): hoopsnightly $2,622,139 vs ESPN $2,150,917 - using hoopsnightly
- Ziaire Williams (LAL): hoopsnightly $2,449,421 vs ESPN $6,250,000 - using hoopsnightly
- Kevon Looney (LAL): hoopsnightly $2,449,421 vs ESPN $8,000,000 - using hoopsnightly
- Klay Thompson (MIA): hoopsnightly $5,600,000 vs ESPN $17,460,317 - using hoopsnightly
- Jonathan Kuminga (MIN): hoopsnightly $6,064,000 vs ESPN $24,300,000 - using hoopsnightly
- Trendon Watford (NO): hoopsnightly $2,449,421 vs ESPN $2,801,346 - using hoopsnightly
- John Konchar (NY): hoopsnightly $2,449,421 vs ESPN $6,165,000 - using hoopsnightly
- Isaiah Hartenstein (OKC): hoopsnightly $23,148,148 vs ESPN $28,500,000 - using hoopsnightly
- Kenrich Williams (OKC): hoopsnightly $5,000,000 vs ESPN $7,163,000 - using hoopsnightly
- Jonathan Isaac (ORL): hoopsnightly $10,449,421 vs ESPN $14,500,000 - using hoopsnightly
- Kentavious Caldwell-Pope (PHI): hoopsnightly $2,449,421 vs ESPN $21,621,500 - using hoopsnightly
- Haywood Highsmith (PHX): hoopsnightly $3,449,421 vs ESPN $3,018,158 - using hoopsnightly
- Malik Monk (SAC): hoopsnightly $20,190,035 vs ESPN $21,190,034 - using hoopsnightly
- Julian Champagnie (SA): hoopsnightly $13,888,889 vs ESPN $3,000,000 - using hoopsnightly

### Contract length disagreements between sources
- Neemias Queta (BOS): 5 seasons on cap sheet vs ESPN yearsRemaining=1
- Jordan Walsh (BOS): 4 seasons on cap sheet vs ESPN yearsRemaining=1
- Donovan Mitchell (CLE): 5 seasons on cap sheet vs ESPN yearsRemaining=2
- James Harden (CLE): 3 seasons on cap sheet vs ESPN yearsRemaining=1
- Naji Marshall (DAL): 4 seasons on cap sheet vs ESPN yearsRemaining=1
- Ausar Thompson (DET): 6 seasons on cap sheet vs ESPN yearsRemaining=1
- Amen Thompson (HOU): 6 seasons on cap sheet vs ESPN yearsRemaining=1
- Jordan Miller (LAC): 3 seasons on cap sheet vs ESPN yearsRemaining=1
- Kobe Sanders (LAC): 4 seasons on cap sheet vs ESPN yearsRemaining=1
- Andrew Wiggins (MIA): 3 seasons on cap sheet vs ESPN yearsRemaining=1
- Pelle Larsson (MIA): 5 seasons on cap sheet vs ESPN yearsRemaining=1
- Saddiq Bey (NO): 4 seasons on cap sheet vs ESPN yearsRemaining=1
- Jose Alvarado (NY): 3 seasons on cap sheet vs ESPN yearsRemaining=1
- Isaiah Hartenstein (OKC): 3 seasons on cap sheet vs ESPN yearsRemaining=1
- Jonathan Isaac (ORL): 1 seasons on cap sheet vs ESPN yearsRemaining=3
- Dillon Brooks (PHX): 4 seasons on cap sheet vs ESPN yearsRemaining=1
- Victor Wembanyama (SA): 6 seasons on cap sheet vs ESPN yearsRemaining=1
- Julian Champagnie (SA): 3 seasons on cap sheet vs ESPN yearsRemaining=1
- Kawhi Leonard (TOR): 3 seasons on cap sheet vs ESPN yearsRemaining=1
- Keyonte George (UTAH): 6 seasons on cap sheet vs ESPN yearsRemaining=1
- Trae Young (WSH): 4 seasons on cap sheet vs ESPN yearsRemaining=1

### Draft-pick records that failed cross-verification
_None._

### Complex / conditional pick terms (stored verbatim, simplified in the engine)
- 2028-1-ATL (swap): More favorable of (i) ATL and (ii) less favorable of UTH and CLE then least favorable of all to CLE (via UTH swap for CLE; via ATL swap for CLE or UTH)
- 2029-2-ATL (swap): More favorable of ATL and MIA to CHA then other to OKC (via OKC) ;; CLE
- 2031-2-ATL (swap): More favorable of ATL and HOU 31-55 [or ATL if HOU 56-60] to OKC then other to HOU (via ATL swap for HOU)
- 2027-2-BOS (swap): More favorable of BOS and ORL to UTH then other to PHX (via BOS to ORL to BOS to UTH; via ORL to CHA to PHX)
- 2028-1-BOS (protected, multi-team): 1 Own; 2-30 Own or SAN (via SAN swap for BOS) [BOS then has a complex swap right with PHL] ; LAC 17-30 or [by swap from BOS] more favorable of (i) less favorable of BOS and SAN and (ii) more favorable of PHL 1-8 and LAC 1-16 [or (ii) LAC 1-16 if PHL 9-30] then least favorable of all to PHL (via SAN swap for BOS; via BOS swap of BOS or SAN for PHL or LAC)
- 2029-1-BOS (swap): Most and least favorable of BOS, POR and MIL to POR; second most favorable to WAS (via BOS to POR; via MIL to POR; via POR to WAS)
- 2031-2-BOS (swap): Less favorable of BOS and CLE then other to UTH (via CLE to ATL to BOS) ; HOU 56-60
- 2027-1-BKN (swap): Own or HOU (via HOU swap for BRK) ; NYK
- 2027-2-BKN (swap): More favorable of BRK and DAL to WAS then other to MIL (via DAL to BRK to DET to MIL; via DET to WAS) ; LAL if LAL conveys 1st round pick to UTH in 2027
- 2028-1-BKN (swap): If (i) PHL 9-30 is third most favorable and (ii) NYK is most or second most favorable of BRK, PHL 9-30 , PHX and NYK, then most and third most favorable to BRK; or most / two most favorable to BRK in all other scenarios ; least favorable of BRK, PHX and NYK to NYK if NYK and / or if PHL 9-30 is less favorable than BRK and PHX; or second most favorable of BRK, PHX and NYK to NYK in all other scenarios ; more favorable of (i) WAS and (ii) least / less favorable of BRK, PHL 9-30 and PHX to WAS then least favorable of all to PHX [WAS can then swap with MIL] (via BRK swap of BRK or PHL for PHX; via BRK swap of BRK or PHX for NYK; via WAS swap for PHX, BRK or PHL)
- 2027-2-CHA (conditional): To OKC if SAN 1-16 in 2027 or to SAC if SAN 17-30 in 2027 (via NYK to ATL to SAN to SAC) ;; MEM (via LAC to HOU) ;; More favorable of POR and NOP (via POR)
- 2028-1-CHA (swap): Own or swap for MIN ; MIA if not already settled
- 2028-2-CHA (swap): More favorable of CHA and LAC then other to DET [DET may convey to UTH] (via CHA to DAL) ;; HOU;; MIA if DAL does not convey 1st round pick to CHA in 2027 (via SAN to DAL) ;; ORL
- 2028-2-CHI (swap): Most favorable of CHI, IND and PHX; less favorable of (i) CHI and (ii) more favorable of IND and PHX to IND (via PHX to IND; via CHI swap for IND or PHX)
- 2030-2-CHI (swap): Own or swap for IND
- 2027-1-CLE (swap): Most favorable of CLE, MIN and UTH (cannot be 1-5) to MEM; second most favorable to UTH and least favorable to PHX (via UTH)
- 2028-1-CLE (swap): Least favorable of CLE, UTH and ATL; less favorable of (i) more favorable of CLE and UTH and (ii) LAL to LAL then most favorable of all to UTH; more favorable of (i) ATL and (ii) less favorable of CLE and UTH to ATL (via UTH swap for CLE; via UTH swap of UTH or CLE for LAL; via ATL swap for CLE or UTH)
- 2029-1-CLE (swap): Most / two most favorable of CLE, UTH and MIN 6-30 to UTH; least / less favorable to CHA (via CLE and MIN to UTH; via UTH to PHX to CHA; via CHA swap of CHA, CLE or UTH for MIN) *; *CHA will also have a complex swap right with MIN and PHX will receive a least favorable pick
- 2031-2-CLE (swap): More favorable of CLE and BOS to UTH then other to BOS (via CLE to ATL to BOS)
- 2027-2-DAL (swap): More favorable of DAL and BRK to WAS then other to MIL (via DET to WAS; via DAL to BRK to DET to MIL) ;; ATL 56-60
- 2028-1-DAL (swap): Own or OKC (via OKC swap for DAL)
- 2029-1-DAL (swap): Two most favorable of DAL, HOU and PHX to HOU then other to BRK (via DAL and PHX to BRK; via DAL or PHX to HOU; via HOU swap for DAL or PHX) ; LAL
- 2030-1-DAL (swap): Own or SAN (via SAN swap for DAL) ; less favorable of (i) MIN 2-30 and (ii) more favorable of DAL and SAN [or MIN if MIN not conveyable] to MIN then most / more favorable of all to SAN [MIN may convey to CHA] (via SAN swap for DAL; via SAN swap of SAN or DAL for MIN)
- 2027-1-DEN (protected, multi-team): 1-5 Own; two most / more favorable of DEN 6-30, OKC and LAC to OKC; more favorable of (i) least / less favorable of DEN 6-30, OKC and LAC and (ii) TOR to LAC then least favorable of all to TOR (via OKC swap of OKC or DEN for LAC; via LAC swap of DEN, OKC or LAC for TOR)
- 2029-2-DEN (conditional): To CHA if DEN has conveyed a first potential 1st round pick to OKC by 2029 or to OKC if DEN has not conveyed a first potential 1st round pick to OKC by 2029
- 2030-2-DEN (swap): Most favorable of DEN, HOU and MIA to MEM; two least favorable to OKC (via DEN to CHA to OKC or DEN to OKC; via OKC to MEM)
- 2029-2-DET (swap): Two most favorable of DET, MIL and NYK then other to CHI (via MIL to BRK to DET; via NYK to DET; via DET to MEM; via MEM to DET; via SAC to CHI)
- 2027-2-GS (swap): More favorable of GOS and PHX to PHL then other to WAS [PHL may convey to WAS] (via WAS)
- 2028-2-GS (swap): Most favorable of GOS, MIL and OKC to BOS then others to PHL (via GOS to POR to WAS to PHL; via MIL to BRK to HOU to OKC to PHL; via OKC to PHL)
- 2030-2-GS (conditional): To MEM if GOS does not convey 1st round pick to MEM in 2030 (via WAS to DAL)
- 2031-2-GS (swap): More favorable of GOS and MIN to CHI then other to DET (via MIN swap for GOS)
- 2027-1-HOU (swap): Own or swap for BRK ; PHX (via BRK)
- 2027-2-HOU (swap): Most favorable of HOU, OKC, IND and MIA to PHL; second most favorable to NOP and third most favorable to NYK; more favorable of (i) SAN and (ii) least favorable of HOU, OKC, IND and MIA to SAN then least favorable of all to MIA [PHL may convey to WAS] (via HOU to DET to OKC to NYK to NOP; via IND and MIA to OKC to UTH to SAN to MIA; via OKC to PHL) ; Less favorable of POR and NOP if 56-60 (via POR to BOS)
- 2029-1-HOU (swap): Two most favorable of HOU, DAL and PHX then other to BRK (via DAL and PHX to BRK; via DAL or PHX to HOU; via HOU swap for DAL or PHX)
- 2030-2-HOU (swap): Most favorable of HOU, DEN and MIA to MEM then others to OKC (via DEN to CHA to OKC or DEN to OKC; via OKC to MEM)
- 2031-2-HOU (swap): Less favorable of HOU 31-55 and ATL then other [or ATL if HOU 56-60] to OKC (via ATL swap for HOU) ; 56-60 to BOS
- 2032-2-HOU (swap): More favorable of HOU and PHX to CHI then other to PHX (via PHX to MIN)
- 2027-2-IND (swap): Most favorable of IND, OKC, HOU and MIA to PHL; second most favorable to NOP and third most favorable to NYK; more favorable of (i) SAN and (ii) least favorable of IND, OKC, HOU and MIA to SAN then least favorable of all to MIA [PHL may convey to WAS] (via IND and MIA to OKC to UTH to SAN to MIA; via HOU to DET to OKC to NYK to NOP; via OKC to PHL) ; UTH (via CLE)
- 2028-2-IND (swap): Less favorable of (i) more favorable of IND and PHX and (ii) CHI then most favorable of all to CHI; less favorable of IND and PHX to NYK (via PHX to IND; via CHI swap for IND or PHX)
- 2029-1-IND (forfeited): Forfeited by LAC: To LAC
- 2029-1-IND: Forfeited by LAC: To LAC
- 2029-2-IND (swap): More favorable of IND and WAS then other to POR (via IND to NYK)
- 2030-2-IND (swap): Own or CHI (via CHI swap for IND)
- 2031-2-IND (swap): Least favorable of IND, MIA and MEM; more favorable of IND and MIA to WAS; more favorable of (i) MEM and (ii) less favorable of IND and MIA to MEM (via MIA swap for IND; via UTH to WAS; via MEM swap for IND or MIA)
- 2027-1-LAC (swap): More favorable of (i) least / less favorable of LAC, DEN 6-30 and OKC and (ii) TOR then least favorable of all to TOR; two most / more favorable of LAC, DEN 6-30 and OKC to OKC (via OKC swap of OKC or DEN for LAC; via LAC swap of LAC, DEN or OKC for TOR)
- 2028-1-LAC (swap): LAC 17-30 to BOS or [via swap from BOS] more favorable of (i) more favorable of LAC 1-16 and PHL 1-8 [or (i) LAC 1-16 if PHL 9-30] and (ii) less favorable of BOS and SAN to BOS then least favorable of all to PHL (via SAN swap for BOS; via BOS swap of BOS or SAN for LAC or PHL)
- 2028-2-LAC (swap): More favorable of LAC and CHA to CHA then other to DET [DET may convey to UTH] (via CHA to DAL) ;; DAL (via SAC to IND)
- 2029-1-LAC (forfeited): 1-3 Own; 4-30 Own or PHL (via PHL swap for LAC) ; Forfeited by LAC: IND
- 2029-1-LAC: 1-3 Own; 4-30 Own or PHL (via PHL swap for LAC) ; Forfeited by LAC: IND
- 2030-1-LAC (forfeited): Forfeited
- 2030-1-LAC: Forfeited
- 2030-2-LAC (swap): More favorable of LAC and UTH to CHA then other to LAC (via LAC to UTH) ;; TOR
- 2031-1-LAC (forfeited): Forfeited ; TOR
- 2031-1-LAC: Forfeited ; TOR
- 2032-1-LAC (forfeited): Forfeited
- 2032-1-LAC: Forfeited
- 2033-1-LAC (forfeited): Forfeited ; TOR
- 2033-1-LAC: Forfeited ; TOR
- 2027-2-LAL (conditional): To BRK if LAL conveys 1st round pick to MEM in 2027 or to MEM if LAL does not convey 1st round pick to MEM in 2027 (via UTH to MEM)
- 2028-1-LAL (swap): Less favorable of (i) LAL and (ii) more favorable of UTH and CLE then most favorable of all to UTH (via UTH swap for CLE; via UTH swap of UTH or CLE for LAL)
- 2028-2-LAL (swap): More favorable of LAL and WAS to ORL then other to WAS (via WAS to LAL to ORL; via LAL to WAS)
- 2030-1-LAL (swap): Own or UTH (via UTH swap for LAL)
- 2029-1-MEM (swap): Own or swap for ORL 3-30
- 2030-1-MEM (swap): More favorable of (i) MEM and (ii) less favorable of PHX and WAS then least favorable of all to PHX (via WAS swap for PHX; via MEM swap for PHX or WAS) ;; GOS 21-30 (via WAS to DAL) ;; ORL
- 2031-2-MEM (swap): More favorable of (i) MEM and (ii) less favorable of IND and MIA then least favorable of all to IND (via MIA swap for IND; via MEM swap for IND or MIA)
- 2032-2-MEM (swap): Most favorable of MEM, PHL and UTH; less favorable of (i) more favorable of MEM and PHL and (ii) UTH to WAS; less favorable of MEM and PHL to PHL (via MEM swap for PHL; via UTH to WAS; via MEM swap of MEM or PHL for UTH) ;; GOS 51-60
- 2027-2-MIA (swap): Least favorable of MIA, OKC, HOU, IND and SAN; most favorable of MIA, OKC, HOU and IND to PHL; second most favorable to NOP and third most favorable to NYK; more favorable of (i) SAN and (ii) least favorable of MIA, OKC, HOU and IND to SAN [PHL may convey to WAS] (via MIA and IND to OKC to UTH to SAN to MIA; via HOU to DET to OKC to NYK to NOP; via OKC to PHL)
- 2028-1-MIA (conditional): To CHA if not already settled
- 2028-2-MIA (conditional): To DET if DAL conveys 1st round pick to CHA in 2027 or to CHA if DAL does not convey 1st round pick to CHA in 2027 [DET may convey to UTH] (via SAN to DAL)
- 2029-2-MIA (swap): More favorable of MIA and ATL to CHA then other to OKC (via OKC)
- 2030-1-MIA (swap): Least favorable of MIA, MIL and POR; more favorable of (i) MIA and (ii) less favorable MIL and POR to MIL (via POR swap for MIL; via MIL swap of MIL or POR for MIA)
- 2030-2-MIA (swap): Most favorable of MIA, DEN and HOU to MEM then others to OKC (via DEN to CHA to OKC or DEN to OKC; via OKC to MEM)
- 2031-2-MIA (swap): More favorable of MIA and IND to WAS; more favorable of (i) MEM and (ii) less favorable of MIA and IND to MEM then least favorable of all to IND (via MIA swap for IND; via UTH to WAS; via MEM swap for IND or MIA)
- 2027-1-MIL (swap): More favorable of MIL and NOP to NOP then other to ATL if 5-30 or MIL and NOP to NOP if both 1-4 (via NOP)
- 2028-1-MIL (swap): Less favorable of (i) less favorable of MIL and POR and (ii) more favorable of (a) WAS and (b) least / less favorable of BRK, PHL 9-30 and PHX then more favorable of (i) and (ii) to WAS (via POR swap for MIL; via BRK swap of BRK or PHL for PHX; via WAS swap for PHX, BRK or PHL; via WAS swap of WAS, BRK, PHL or PHX for MIL or POR)
- 2028-2-MIL (swap): Most favorable of MIL, GOS and OKC to BOS then others to PHL (via MIL to BRK to HOU to OKC to PHL; via GOS to POR to WAS to PHL; via OKC to PHL)
- 2029-1-MIL (swap): Most and least favorable of MIL, BOS and POR to POR; second most favorable to WAS (via BOS to POR; via MIL to POR; via POR to WAS)
- 2029-2-MIL (swap): Two most favorable of MIL, DET and NYK to DET then other to CHI (via MIL to BRK to DET; via NYK to DET; via DET to MEM; via MEM to DET; via SAC to CHI)
- 2030-1-MIL (swap): More favorable of (i) less favorable MIL and POR and (ii) MIA then least favorable of all to MIA; more favorable of MIL and POR to POR (via POR swap for MIL; via MIL swap of MIL or POR for MIA)
- 2027-1-MIN (swap): Most favorable of MIN, CLE and UTH (cannot be 1-5) to MEM; second most favorable to UTH and least favorable to PHX (via UTH)
- 2028-1-MIN (swap): Own or CHA (via CHA swap for MIN)
- 2029-1-MIN (protected, multi-team): 1-5 Own; most / two most favorable of MIN 6-30, CLE and UTH to UTH then other to CHA (via CLE and MIN to UTH; via UTH to PHX to CHA; via CHA swap of CHA, CLE or UTH for MIN) * *CHA will also have a complex swap right with MIN and PHX will receive a least favorable pick
- 2029-2-MIN (conditional): To CHA if MIN conveys 1st round pick to UTH in 2029 or to UTH if MIN does not convey 1st round pick to UTH in 2029
- 2030-1-MIN (protected, multi-team): 1 Own; less favorable of (i) MIN 2-30 and (ii) more favorable of SAN and DAL then most / more favorable of all to SAN [MIN may convey to CHA] (via SAN swap for DAL; via SAN swap of SAN or DAL for MIN) * *CHA will have a complex swap right with MIN, receiving MIN, SAN or DAL
- 2031-2-MIN (swap): More favorable of MIN and GOS to CHI then other to DET (via MIN swap for GOS)
- 2027-1-NO (swap): More favorable of NOP and MIL then other to ATL if 5-30 or NOP and MIL if both 1-4 (via NOP)
- 2027-2-NO (swap): More favorable of NOP and POR to CHA then other to POR [POR may convey to HOU] (via NOP) ;; Second most favorable of OKC, HOU, IND and MIA (via HOU to DET to OKC to NYK)
- 2030-2-NO (swap): Own or ORL (via ORL swap for NOP)
- 2031-2-NO (swap): More favorable of NOP and ORL to ORL then other to OKC (via ORL swap for NOP) ; TOR
- 2028-1-NY (swap): Least favorable of NYK, BRK and PHX if NYK and / or if PHL 9-30 is less favorable than BRK and PHX; or second most favorable of NYK, BRK and PHX in all other scenarios ; if (i) PHL 9-30 is third most favorable and (ii) NYK is most or second most favorable of NYK, BRK, PHL 9-30 and PHX, then most and third most favorable to BRK; or most / two most favorable to BRK in all other scenarios (via BRK swap of BRK or PHL for PHX; via BRK swap of BRK or PHX for NYK; via WAS swap for PHX, BRK or PHL)
- 2029-2-NY (swap): Two most favorable of NYK, DET and MIL to DET then other to CHI (via MIL to BRK to DET; via NYK to DET; via DET to MEM; via MEM to DET; via SAC to CHI) ;; PHX;; SAC (via WAS to HOU)
- 2027-1-OKC (swap): Two most / more favorable of OKC, DEN 6-30 and LAC; more favorable of (i) least / less favorable of OKC, DEN 6-30 and LAC and (ii) TOR to LAC then least favorable of all to TOR (via OKC swap of OKC or DEN for LAC; via LAC swap of DEN, OKC or LAC for TOR) ;; SAN 17-30 (via SAC)
- 2027-2-OKC (swap): Most favorable of OKC, HOU, IND and MIA to PHL; second most favorable to NOP and third most favorable to NYK; more favorable of (i) SAN and (ii) least favorable of OKC, HOU, IND and MIA to SAN then least favorable of all to MIA [PHL may convey to WAS] (via HOU to DET to OKC to NYK to NOP; via IND and MIA to OKC to UTH to SAN to MIA; via OKC to PHL) ;; CHA if SAN 1-16 in 2027 (via SAC) ;; CHI (via WAS to NOP to WAS to DAL) ;; SAC if SAN 1-16 in 2027
- 2028-1-OKC (swap): Own or swap for DAL ; DEN 6-30 if not already settled
- 2028-2-OKC (swap): Most favorable of OKC, GOS and MIL to BOS then others to PHL (via OKC to PHL; GOS to POR to WAS to PHL; via MIL to BRK to HOU to OKC to PHL) ; UTH
- 2027-2-ORL (swap): More favorable of ORL and BOS to UTH then other to PHX (via BOS to ORL to BOS to UTH; via ORL to CHA to PHX)
- 2029-1-ORL (protected, multi-team): 1-2 Own; 3-30 Own or MEM (via MEM swap for ORL)
- 2029-2-ORL (conditional): To MEM if ORL 1-2 in 2029
- 2030-2-ORL (swap): Own or swap for NOP ; MIL
- 2031-2-ORL (swap): More favorable of ORL and NOP then other to OKC (via ORL swap for NOP)
- 2028-1-PHI (protected, multi-team): 1-8 Own if LAC 17-30 ; or [via swap from BOS] least favorable of (i) PHL 1-8, LAC 1-16, BOS and SAN or (ii) LAC 1-16, BOS and SAN ; more favorable of (i) more favorable of PHL 1-8 and LAC 1-16 [or (i) LAC 1-16 if PHL 9-30] and (ii) less favorable of BOS and SAN to BOS; if (i) PHL 9-30 is third most favorable and (ii) NYK is most or second most favorable of PHL 9-30 , PHX, BRK and NYK, then most and third most favorable to BRK; or most / two most favorable to BRK in all other scenarios ; least favorable of PHX, BRK and NYK to NYK if NYK and / or if PHL 9-30 is less favorable than PHX and BRK; or second most favorable of PHX, BRK and NYK to NYK in all other scenarios ; more favorable of (i) WAS and (ii) least / less favorable of PHL 9-30 , PHX and BRK to WAS then least favorable of all to PHX [WAS can then swap with MIL] (via SAN swap for BOS; via BOS swap of BOS or SAN for PHL or LAC; via BRK swap of BRK or PHL for PHX; via BRK swap of BRK or PHX for NYK; via WAS swap for PHX, BRK or PHL)
- 2028-2-PHI (conditional): To BRK if PHL 1-8 in 2028 ; DET 56-60; Two least favorable of GOS, MIL and OKC (via GOS to POR to WAS; via MIL to BRK to HOU to OKC)
- 2029-1-PHI (swap): Own or swap for LAC 4-30
- 2032-2-PHI (swap): Less favorable of PHL and MEM; less favorable of (i) more favorable of PHL and MEM and (ii) UTH to WAS then most favorable of all to MEM (via MEM swap for PHL; via UTH to WAS; via MEM swap of MEM or PHL for UTH)
- 2027-2-PHX (swap): More favorable of PHX and GOS to PHL then other to WAS [PHL may convey to WAS] (via WAS) ;; Less favorable of BOS and ORL (via BOS to ORL to CHA)
- 2028-1-PHX (swap): Least favorable of PHX, PHL 9-30, WAS and BRK; more favorable of (i) WAS and (ii) least / less favorable of PHX, PHL 9-30 and BRK to WAS [WAS can then swap with MIL] ; if (i) PHL 9-30 is third most favorable and (ii) NYK is most or second most favorable of PHX, PHL 9-30, BRK and NYK, then most and third most favorable to BRK; or most / two most favorable to BRK in all other scenarios ; least favorable of PHX, BRK and NYK to NYK if NYK and / or if PHL 9-30 is less favorable than PHX and BRK; or second most favorable of PHX, BRK and NYK to NYK in all other scenarios (via BRK swap of BRK or PHL for PHX; via BRK swap of BRK or PHX for NYK; via WAS swap for PHX, BRK or PHL)
- 2028-2-PHX (swap): L ess favorable of (i) more favorable of PHX and IND and (ii) CHI to IND then most favorable of all to CHI; less favorable of PHX and IND to NYK (via PHX to IND; via CHI swap for IND or PHX)
- 2029-1-PHX (swap): Two most favorable of PHX, DAL and HOU to HOU then other to BRK (via DAL and PHX to BRK; via DAL or PHX to HOU; via HOU swap for DAL or PHX); --- PHX will receive a least favorable pick from a complex CHA-MIN conveyance, including CHA's swap right
- 2030-1-PHX (swap): Least favorable of PHX, WAS and MEM; more favorable of (i) MEM and (ii) less favorable of PHX and WAS to MEM; more favorable of PHX and WAS to WAS (via WAS swap for PHX; via MEM swap for PHX or WAS)
- 2030-2-PHX (swap): Less favorable of (i) more favorable of PHX and POR and (ii) WAS to PHL then most favorable of all to BOS; less favorable of PHX and POR to WAS (via PHX and POR to WAS to PHL)
- 2032-2-PHX (swap): Less favorable of PHX and HOU then other to CHI (via PHX to MIN)
- 2027-2-POR (swap): Less favorable of POR and NOP then other to CHA [POR may convey to HOU; see following] ; then less favorable of POR and NOP to HOU if 56-60 (via POR to NOP to CHA; via POR to BOS to HOU) ; MIN (via HOU to OKC to NYK)
- 2028-1-POR (swap): Own or swap for MIL [WAS then has a complex swap right with MIL] ; ORL (via MEM)
- 2029-1-POR (swap): Most and least favorable of POR, BOS and MIL; second most favorable to WAS (via BOS to POR; via MIL to POR; via POR to WAS)
- 2030-1-POR (swap): Own or swap for MIL; more favorable of (i) less favorable MIL and POR and (ii) MIA to MIL then least favorable of all to MIA (via POR swap for MIL; via MIL swap of MIL or POR for MIA)
- 2030-2-POR (swap): Less favorable of (i) more favorable of POR and PHX and (ii) WAS to PHL then most favorable of all to BOS; less favorable of POR and PHX to WAS (via PHX and POR to WAS to PHL)
- 2027-2-SAC (conditional): To OKC if SAN 1-16 in 2027 ; CHA if SAN 17-30 in 2027 (via NYK to ATL to SAN)
- 2031-1-SAC (swap): Own or SAN (via SAN swap for SAC) ; MIN (via SAN)
- 2027-2-SA (swap): More favorable of (i) SAN and (ii) least favorable of OKC, HOU, IND and MIA then least favorable of all to MIA (via HOU to DET to OKC; via MIA to OKC to UTH to SAN to MIA)
- 2028-1-SA (swap): Own or swap for BOS 2-30 [BOS then has a complex swap right with PHL]
- 2030-1-SA (swap): Most / more favorable of SAN, DAL and MIN 2-30; less favorable of (i) more favorable of SAN and DAL and (ii) MIN 2-30 [or MIN if MIN not conveyable] to MIN [MIN may convey to CHA] ; less favorable of SAN and DAL to DAL (via SAN swap for DAL; via SAN swap of SAN or DAL for MIN)
- 2031-1-SA (swap): Own or swap for SAC
- 2027-1-TOR (swap): Least / less favorable of TOR, LAC, DEN 6-30 and OKC; more favorable of (i) TOR and (i) least / less favorable of LAC, DEN 6-30 and OKC to LAC (via OKC swap of OKC or DEN for LAC; via LAC swap of LAC, DEN or OKC for TOR)
- 2027-1-UTAH (swap): Second most favorable of UTH (cannot be 1-5), CLE and MIN; most favorable to MEM and least favorable to PHX (via UTH)
- 2028-1-UTAH (swap): Most favorable of UTH, CLE and LAL; less favorable of (i) more favorable of UTH and CLE and (ii) LAL to LAL; less favorable of UTH and CLE to CLE [CLE may convey UTH to ATL] (via UTH swap for CLE; via UTH swap of UTH or CLE for LAL)
- 2029-1-UTAH (swap): Most / two most favorable of UTH, CLE and MIN 6-30 to UTH; least / less favorable to CHA (via CLE and MIN to UTH; via UTH to PHX to CHA; via CHA swap of CHA, CLE or UTH for MIN) *; *CHA will also have a complex swap right with MIN and PHX will receive a least favorable pick
- 2030-1-UTAH (swap): Own or swap for LAL
- 2030-2-UTAH (swap): Less favorable of UTH and LAC then other to CHA (via LAC to UTH)
- 2032-2-UTAH (swap): Less favorable of (i) UTH and (i) more favorable of MEM and PHL to WAS then most favorable of all to MEM (via UTH to WAS; via MEM swap for PHL; via MEM swap of MEM or PHL for UTH) ;; CLE
- 2028-1-WSH (swap): More favorable of (i) more favorable of (a) WAS and (b) least / less favorable of BRK, PHL 9-30 and PHX and (ii) less favorable of MIL and POR then less favorable of (i) and (ii) to MIL; least favorable of WAS, PHL 9-30, BRK and PHX to PHX (via POR swap for MIL; via BRK swap of BRK or PHL for PHX; via WAS swap for PHX, BRK or PHL; via WAS swap of WAS, BRK, PHL or PHX for MIL or POR)
- 2028-2-WSH (swap): Less favorable of WAS and LAL then other to ORL (via WAS to LAL to ORL; via LAL to WAS) ; DEN 34-60 (via SAN to SAC)
- 2029-2-WSH (swap): More favorable of WAS and IND to IND then other to POR (via IND to NYK)
- 2030-1-WSH (swap): More favorable of WAS and PHX; more favorable of (i) MEM and (ii) less favorable of WAS and PHX to MEM then least favorable of all to PHX (via WAS swap for PHX; via MEM swap for WAS or PHX)
- 2030-2-WSH (swap): Less favorable of (i) WAS and (ii) more favorable of PHX and POR to PHL then most favorable of all to BOS (via PHX and POR to WAS to PHL) ; Less favorable of PHX and POR

### Fields not available from any allowed source (defaults used)
- **No-trade clauses**: not published by the sources used → all set to `false`. Known NTCs must be set by hand in contracts.json.
- **Trade kickers**: from ESPN contract records only; may be incomplete.
- **Bird rights**: derived from consecutive seasons with current team in ESPN stat rows (traded players keep Bird rights under the CBA - edit manually if needed).
- **ETO (early termination)**: only where the cap sheet marks it.
- **Future-year salaries**: rounded to $0.1M on the source; flagged `approximate: true`.
- **Rookie-scale years 3-4**: marked as team options when the player was drafted in the 1st round 2023-2026 and no option decision is published.

### CBA figures not confirmed against a 2026 publication
- `capGrowthProjection` - assumption: ~7%/yr (CBA max annual increase is 10%)
- `exceptions.disabledPlayerExceptionPct` - 2023 CBA: lesser of 50% of injured player's salary or NT-MLE
- `raises` - 2023 CBA
- `maxContractYears` - 2023 CBA
- `extensions` - 2023 CBA
- `capHolds` - 2023 CBA cap-hold schedule
- `apronRestrictions` - 2023 CBA apron rules as summarized by Hoops Rumors glossary
- `roster` - 2023 CBA
- `qualifyingOffer` - approximation of 2023 CBA qualifying-offer schedule
