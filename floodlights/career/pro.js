// Player Career: the professional years. Clubs bid for him through the same valuation the market uses for every
// player (asking price from rating, age and squad size), his club says yes or no, his agent brings the terms.
// Loans when he is not playing, a transfer request when he wants out, renewals, free agency, the armband, the
// national team (U17, U20, U23, senior) in the international windows, trophies and awards, and the end: a career
// summary and, if he wants, the same world as a manager.
const D = require("./data");

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = () => Math.random();
const pick = a => a[Math.floor(Math.random() * a.length)];
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const round1 = v => Math.round(v * 10) / 10;

// the international windows (0 based rounds): early autumn, autumn, spring, late spring
const INTL_ROUNDS = [8, 13, 25, 33];

function makePro(K, deps) {
  const { C, me, msg, news, money, clubLevel, weeklyWage, recordMatch, playerLine, cityOf } = K;
  const { leagueClubs, LEAGUES, askingPrice, windowOpen, tableFor, leagueAwards, marketValue, poisson } = deps;

  // ---------- who might want him ----------
  function candidateClubs(game) {
    const p = me(game);
    const out = [];
    for (const [name, cl] of Object.entries(game.clubs)) {
      if (name === p.club || !cl.squad || !(game.leagueFixtures || {})[cl.league]) continue;
      const lvl = clubLevel(game, name);
      // a club wants him when he would play: close to or above its level, and it can pay
      const fit = p.rating - (lvl - 3);
      if (fit < -6 || fit > 14) continue;
      out.push({ name, lvl, fit, cl });
    }
    return out;
  }
  function recentForm(game) {
    const c = C(game);
    const played = c.stats.log.filter(m => m.mins > 0).slice(0, 8);
    return played.length ? played.reduce((s, m) => s + m.rating, 0) / played.length : 6.4;
  }

  // ---------- bids, during the windows ----------
  function transferWeek(game) {
    const c = C(game), p = me(game);
    if (c.stage !== "pro" || !p.club || !windowOpen(game)) return;
    if (c.offers.some(o => o.status === "open" && (o.kind === "transfer" || o.kind === "loan"))) return;
    // a new signing gets a season to settle before anyone tries to buy him (unless he asks to go)
    if (!c.requested && game.season * 40 + game.round - (c.movedAt || -99) < 34) return;
    const form = recentForm(game);
    const ag = c.agent ? D.AGENTS.find(a => a.id === c.agent.id) : null;
    const heat = clamp(0.05 + (form - 6.6) * 0.06 + c.rep.national / 600 + c.rep.international / 300 + (c.requested ? 0.12 : 0) + (ag ? ag.europe * 0.006 : 0), 0.02, 0.4);
    if (rnd() > heat) return;
    const clubs = candidateClubs(game);
    if (!clubs.length) return;
    // a bigger club than his own is the dream; agents with European contacts widen the net
    clubs.sort((a, b) => (b.lvl + (b.cl.league !== p.league ? (ag ? ag.europe : 2) * 0.4 : 0) + rnd() * 6) - (a.lvl + (a.cl.league !== p.league ? (ag ? ag.europe : 2) * 0.4 : 0) + rnd() * 6));
    const buyer = clubs[0];
    const asking = askingPrice(game, p, p.club) * (c.requested ? 0.9 : 1);
    const fee = round1(Math.max(0.2, asking * (0.85 + rnd() * 0.3)));
    if ((buyer.cl.budget || 0) < fee) return;
    // his club: will they sell? A key man needs a big fee, a fringe player goes for the asking price
    const club = game.clubs[p.club];
    const rank = club.squad.map(id => game.players[id]).filter(Boolean).sort((a, b) => b.rating - a.rating).findIndex(q => q.id === p.id);
    const key = rank >= 0 && rank < 4 && c.trust > 60 && !c.requested;
    // a much bigger club, or a fee the size of the whole budget, is hard for a small club to turn down
    const gap = buyer.lvl - clubLevel(game, p.club);
    const life = fee >= Math.max(3, (club.budget || 0) * 2);
    const need = !key ? 0.95 : life || gap >= 8 ? 1 : gap >= 4 ? 1.15 : 1.3;
    const yes = fee >= asking * need;
    if (!yes) {
      msg(game, "agent", ag ? ag.name : "Your club", buyer.name + " bid £" + fee + "m for you. " + p.club + " said no, they see you as " + (key ? "a key man." : "worth more."));
      news(game, p.club + " reject a £" + fee + "m bid from " + buyer.name + " for " + p.name + ".", "transfer");
      c.rep.national = clamp(c.rep.national + 1, 0, 100);
      return;
    }
    const o = termsOffer(game, buyer.name, "transfer", fee);
    if (o) {
      news(game, p.club + " accept a £" + fee + "m bid from " + buyer.name + " for " + p.name + ". Personal terms next.", "transfer");
      msg(game, "agent", ag ? ag.name : "Your club", "Big news. " + buyer.name + " and " + p.club + " agreed £" + fee + "m. Their offer is on your phone, let us talk it through.");
    }
  }
  // the personal terms a club puts to him (a move, a loan, a free transfer or a new deal at his own club)
  function termsOffer(game, clubName, kind, fee) {
    const c = C(game), p = me(game);
    const cl = game.clubs[clubName];
    if (!cl) return null;
    const lvl = clubLevel(game, clubName);
    const gap = p.rating - (lvl - 3);
    const role = gap >= 6 ? "Star" : gap >= 1 ? "First team" : gap >= -4 ? "Rotation" : "Prospect";
    const roleF = { Prospect: 0.8, Rotation: 1, "First team": 1.3, Star: 1.8 }[role];
    const ag = c.agent ? D.AGENTS.find(a => a.id === c.agent.id) : null;
    const wage = kind === "loan" ? c.contract.wage : Math.round(weeklyWage(cl.league, p.rating, p.age) * roleF * (kind === "renewal" ? 1.05 : 1) * (1 + (ag ? ag.negotiate * 0.01 : 0)) / 10) * 10;
    const years = kind === "loan" ? 0 : role === "Star" ? 4 + Math.floor(rnd() * 2) : 3 + Math.floor(rnd() * 2);
    const grp = D.POS_GROUP[c.person.pos];
    const o = {
      id: "o" + game.season + "_" + game.round + "_" + c.offers.length, club: clubName, league: cl.league, status: "open", why: kind, kind,
      wage, years, role, fee: fee || 0, signing: kind === "loan" ? 0 : Math.round(wage * (kind === "free" ? 8 : 3) / 10) * 10,
      bonus: { app: Math.round(wage * 0.12 / 10) * 10, goal: Math.round(wage * (grp === "FW" ? 0.45 : 0.3) / 10) * 10, assist: Math.round(wage * 0.22 / 10) * 10, cs: grp === "DF" || grp === "GK" ? Math.round(wage * 0.35 / 10) * 10 : 0 },
      release: kind === "loan" ? null : (cl.league === D.ISL_NAME || /La Liga/.test(cl.league) ? round1(Math.max(1, (fee || p.value) * 2.5)) : null),
      expires: game.season * 40 + game.round + 3, negotiated: 0, first: false
    };
    c.offers.push(o);
    msg(game, "offers", "Contract offers", kind === "renewal" ? p.club + " want to extend your contract." : kind === "loan" ? clubName + " want you on loan until the summer." : clubName + " have made you an offer.", { offer: o.id });
    return o;
  }

  // ---------- not playing: a loan, or the club looks for one ----------
  function loanCheck(game) {
    const c = C(game), p = me(game);
    if (c.stage !== "pro" || !p.club || p.loanOwner || p.age > 22 || !windowOpen(game)) return;
    if (c.offers.some(o => o.status === "open")) return;
    const recent = c.stats.log.filter(m => m.pro).slice(0, 8);
    if (recent.length < 4 || recent.filter(m => m.role === "start").length > 2) return;
    if (rnd() > 0.25) return;
    const own = clubLevel(game, p.club);
    const lower = candidateClubs(game).filter(x => x.lvl < own - 3 && x.fit >= 0).sort(() => rnd() - 0.5);
    if (!lower.length) return;
    termsOffer(game, lower[0].name, "loan", 0);
    msg(game, "club", p.club, "We want you playing every week. " + lower[0].name + " would take you on loan until the end of the season. Your call.");
  }

  // ---------- asking to leave ----------
  function requestTransfer(game) {
    const c = C(game), p = me(game);
    if (c.stage !== "pro" || !p.club) return { error: "You have no club to leave." };
    if (c.requested) return { error: "You already asked. The club knows." };
    const club = game.clubs[p.club];
    const rank = club.squad.map(id => game.players[id]).filter(Boolean).sort((a, b) => b.rating - a.rating).findIndex(q => q.id === p.id);
    const key = rank >= 0 && rank < 4 && c.trust > 55;
    if (key && rnd() < 0.7) {
      c.trust = clamp(c.trust - 10, 0, 100);
      c.cond.morale = clamp(c.cond.morale - 6, 5, 99);
      msg(game, "club", p.club + " manager", "Request denied. You are important to us and you are going nowhere. Get your head right.");
      news(game, p.club + " turn down a transfer request from " + p.name + ".", "transfer");
      return { ok: true, denied: true };
    }
    c.requested = true;
    c.trust = clamp(c.trust - 6, 0, 100);
    msg(game, "club", p.club + " manager", "Disappointed, but understood. We will listen to offers.");
    news(game, p.name + " hands in a transfer request at " + p.club + ".", "transfer");
    return { ok: true, denied: false };
  }

  // signing any offer: a move, a loan, a free transfer or a renewal
  function signOffer(game, o) {
    const c = C(game), p = me(game);
    const cl = game.clubs[o.club];
    if (!cl) return { error: "That club does not exist any more." };
    const from = p.club;
    if (o.kind === "renewal") {
      c.contract = Object.assign({}, c.contract, { wage: o.wage, years: o.years, role: o.role, bonus: o.bonus, release: o.release, until: game.season + o.years });
      p.contractYears = o.years; p.squadRole = o.role; p.wage = Math.max(0.1, round1(o.wage * 52 / 1e6));
      if (o.signing) money(game, o.signing, "Signing on fee, new deal at " + o.club);
      c.trust = clamp(c.trust + 6, 0, 100);
      news(game, p.name + " signs a new " + o.years + " year deal at " + o.club + ".", "transfer");
      return { ok: true };
    }
    if (from && game.clubs[from]) {
      const old = game.clubs[from];
      old.squad = old.squad.filter(id => id !== p.id);
      if (old.lineup) old.lineup = null;
      if (o.fee) { old.budget = round1((old.budget || 0) + o.fee); cl.budget = round1((cl.budget || 0) - o.fee); }
    }
    cl.squad.push(p.id);
    p.club = o.club; p.league = cl.league;
    if (o.kind === "loan") {
      p.loanOwner = from;
      c.loan = { from, to: o.club, s: game.season };
      news(game, p.name + " joins " + o.club + " on loan from " + from + ".", "transfer");
    } else {
      delete p.loanOwner; c.loan = null;
      p.wage = Math.max(0.1, round1(o.wage * 52 / 1e6));
      p.contractYears = o.years; p.squadRole = o.role;
      c.contract = { club: o.club, wage: o.wage, years: o.years, role: o.role, bonus: o.bonus, release: o.release, since: { s: game.season, w: game.round }, until: game.season + o.years };
      if (o.signing) money(game, o.signing, "Signing on fee, " + o.club);
      c.transfers = c.transfers || [];
      c.transfers.push({ s: game.season, from: from || "", to: o.club, fee: o.fee || 0, kind: o.kind });
      c.movedAt = game.season * 40 + game.round;
      if (o.fee) {
        news(game, "DONE DEAL: " + p.name + " joins " + o.club + " from " + from + " for £" + o.fee + "m.", "transfer");
        if (!c.firsts.bigMove && o.fee >= 10) { c.firsts.bigMove = true; c.moments.bigMove = { s: game.season, w: game.round, club: o.club, fee: o.fee, seen: false }; }
      } else news(game, p.name + " signs for " + o.club + (o.kind === "free" ? " on a free transfer." : "."), "transfer");
    }
    c.requested = false;
    c.trust = o.role === "Star" ? 66 : o.role === "First team" ? 58 : o.role === "Rotation" ? 50 : 42;
    c.captain = null;
    const fromCity = c.city;
    c.city = cityOf(game, o.club);
    if (K.social) K.social.onMove(game, fromCity);
    c.seasonsAtClub = 0;
    msg(game, "club", o.club, "Welcome to " + o.club + ". Training at nine on Monday.");
    return { ok: true };
  }

  // ---------- the national team ----------
  function nationPool(game) {
    const c = C(game);
    const nat = game.nations && game.nations[c.person.nat];
    if (!nat) return null;
    return nat.playerIds.map(id => game.players[id]).filter(q => q && q.id !== c.pid);
  }
  function nationStrength(game) {
    const pool = nationPool(game);
    if (!pool || !pool.length) return 62;
    const top = pool.map(q => q.rating).sort((a, b) => b - a).slice(0, 11);
    return top.reduce((s, x) => s + x, 0) / top.length;
  }
  function intlWindow(game) {
    const c = C(game), p = me(game);
    if (!INTL_ROUNDS.includes(game.round) || c.cond.inj) return null;
    const str = nationStrength(game);
    // the level: the youngest team he still qualifies for, or the seniors if he is good enough already
    const levels = D.NATIONAL_LEVELS.filter(l => p.age <= l.maxAge);
    let chosen = null;
    const pool = nationPool(game) || [];
    const seniorCut = pool.length >= 23 ? pool.map(q => q.rating).sort((a, b) => b - a)[22] : str - 6;
    if (p.rating >= seniorCut && (c.stage === "pro" || p.rating >= str)) chosen = D.NATIONAL_LEVELS.find(l => l.id === "senior");
    else for (const l of levels) {
      if (l.id === "senior") continue;
      const need = l.need + (str - 65) * 0.55 - (c.rep.national / 25);
      if (p.rating >= need) { chosen = l; break; }
    }
    if (!chosen) return null;
    const nat = c.person.nat;
    const first = !c.national.callups.some(x => x.level === chosen.id);
    c.national.callups.push({ s: game.season, w: game.round, level: chosen.id });
    if (first) {
      c.moments["callup_" + chosen.id] = { s: game.season, w: game.round, level: chosen.label, nation: nat, seen: false };
      news(game, "CALLED UP: " + p.name + " is named in the " + nat + " " + chosen.label + " squad" + (chosen.id === "senior" ? " for the first time." : "."), "national");
      msg(game, "dad", "Dad", "The " + nat + " shirt. I am telling everyone at work. Every single person.");
    }
    // the senior squad includes him in the world's own national team
    if (chosen.id === "senior" && game.nations[nat] && !game.nations[nat].playerIds.includes(p.id)) game.nations[nat].playerIds.push(p.id);
    // the match: a friendly or a qualifier against a nation of a similar level
    const others = Object.keys(game.nations || {}).filter(n => n !== nat);
    const opp = others.length ? pick(others) : pick(["Japan", "Australia", "Qatar", "Iran", "Uzbekistan", "Jordan", "Oman"]);
    const oppStr = game.nations[opp] ? (() => { const r = game.nations[opp].playerIds.map(id => game.players[id]).filter(Boolean).map(q => q.rating).sort((a, b) => b - a).slice(0, 11); return r.reduce((s, x) => s + x, 0) / (r.length || 1); })() : str + gauss() * 5;
    const levelStr = chosen.id === "senior" ? str : str - 12;
    const gf = poisson(Math.min(4, 1.3 * Math.exp((levelStr - (chosen.id === "senior" ? oppStr : oppStr - 12)) / 10)));
    const ga = poisson(Math.min(4, 1.15 * Math.exp(((chosen.id === "senior" ? oppStr : oppStr - 12) - levelStr) / 10)));
    const starter = chosen.id !== "senior" || pool.filter(q => q.pos === p.pos).sort((a, b) => b.rating - a.rating).slice(0, { GK: 1, DF: 4, MF: 3, FW: 3 }[p.pos]).some(q => q.rating < p.rating);
    const mins = starter ? 90 : rnd() < 0.6 ? 20 + Math.floor(rnd() * 25) : 0;
    // the result his country's way round (res), and the week it was played in (wk), for the result rows
    const m = { comp: nat + " " + chosen.label + (rnd() < 0.5 ? " friendly" : " qualifier"), opp: opp + (chosen.id === "senior" ? "" : " " + chosen.label), team: nat + " " + chosen.label, gf, ga, res: gf > ga ? "W" : gf < ga ? "L" : "D", wk: game.round, role: mins ? (starter ? "start" : "sub") : "unused", mins, national: true, level: chosen.id };
    if (mins) {
      Object.assign(m, playerLine(game, gf, ga, mins / 90, levelStr));
      c.national.caps[chosen.id] = (c.national.caps[chosen.id] || 0) + 1;
      c.national.goals[chosen.id] = (c.national.goals[chosen.id] || 0) + (m.g || 0);
      c.rep.national = clamp(c.rep.national + 2 + (m.rating - 6.5) * 1.5, 0, 100);
      c.rep.international = clamp(c.rep.international + (chosen.id === "senior" ? 1.5 : 0.5) + (m.g || 0) * 0.8, 0, 100);
      if (chosen.id === "senior" && !c.firsts.cap) { c.firsts.cap = { s: game.season, w: game.round, opp }; news(game, p.name + " wins his first senior cap for " + nat + ", against " + opp + ".", "national"); }
    }
    c.national.log = c.national.log || [];
    c.national.log.unshift(Object.assign({ s: game.season, w: game.round }, m));
    if (c.national.log.length > 12) c.national.log.length = 12;
    c.national.level = chosen.id;
    c.cond.fatigue = clamp(c.cond.fatigue + mins * 0.12, 0, 100);
    return m;
  }

  // ---------- the armband ----------
  function captaincyCheck(game) {
    const c = C(game), p = me(game);
    if (c.stage !== "pro" || !p.club || c.captain === p.club || p.loanOwner) return;
    if (p.age < 23 || c.trust < 72 || c.attrs.leadership < 58 || (c.seasonsAtClub || 0) < 1) return;
    if (rnd() > 0.35) return;
    c.captain = p.club;
    c.traits.leadership = clamp(c.traits.leadership + 8, 0, 100);
    c.moments.captain = { s: game.season, w: game.round, club: p.club, seen: false };
    news(game, p.name + " is named " + p.club + " captain.", "match");
    msg(game, "mum", "Mum", "CAPTAIN!! Your grandmother wants a photo of the armband for the wall.");
  }

  // ---------- the summer: trophies, awards, renewals, contracts running out ----------
  function beforeRollover(game) {
    const c = C(game), p = me(game);
    if (c.stage !== "pro" || !p.club) return;
    c.trophies = c.trophies || [];
    c.awards = c.awards || [];
    const table = tableFor(game, p.league);
    const played = c.stats.season.apps;
    if (table.length && table[0].team === p.club && played >= 5) {
      c.trophies.push({ s: game.season, title: p.league + " champions", club: p.club });
      news(game, p.club + " are " + p.league + " champions! " + p.name + " played " + played + " times.", "match");
      if (!c.firsts.trophy) { c.firsts.trophy = true; c.moments.trophy = { s: game.season, w: game.round, club: p.club, title: p.league, seen: false }; }
    }
    for (const cup of Object.values(game.cups || {})) if (cup.winner === p.club && played >= 3) c.trophies.push({ s: game.season, title: cup.title, club: p.club });
    const aw = leagueAwards(game, p.league);
    for (const [k, label] of [["boot", "Golden Boot"], ["ball", "Golden Ball"], ["pots", "Player of the Season"]]) if (aw[k] && aw[k].id === p.id) { c.awards.push({ s: game.season, title: p.league + " " + label }); news(game, p.name + " wins the " + p.league + " " + label + ".", "match"); }
  }
  function afterRollover(game) {
    const c = C(game), p = me(game);
    if (c.stage !== "pro") return;
    c.seasonsAtClub = (c.seasonsAtClub || 0) + 1;
    // the world brought loanees home at the summer
    if (c.loan && !p.loanOwner) { news(game, p.name + " is back at " + p.club + " after his loan.", "transfer"); c.loan = null; c.city = cityOf(game, p.club); }
    if (!c.contract) return;
    if (c.contract.years <= 0 && !p.loanOwner) {
      // out of contract: he leaves for nothing and clubs can sign him for free
      const club = game.clubs[p.club];
      if (club) club.squad = club.squad.filter(id => id !== p.id);
      news(game, p.name + "'s contract at " + p.club + " has run out. He is a free agent.", "transfer");
      p.club = ""; p.league = "";
      c.contract = null; c.freeAgent = true; c.captain = null;
      freeAgentOffers(game);
      return;
    }
    // the club offers a new deal with a year left, or early when he has outgrown his deal
    const outgrown = p.rating > clubLevel(game, p.club) + 2 && c.contract.role !== "Star";
    if ((c.contract.years <= 1 || outgrown) && !p.loanOwner && rnd() < 0.85) termsOffer(game, p.club, "renewal", 0);
    captaincyCheck(game);
  }

  // a free agent: clubs that could use him put offers in
  function freeAgentOffers(game) {
    const c = C(game);
    if (!c.freeAgent || c.offers.some(o => o.status === "open")) return;
    const clubs = candidateClubs(game).sort((a, b) => b.lvl - a.lvl).slice(0, 8).sort(() => rnd() - 0.5).slice(0, 2 + Math.floor(rnd() * 2));
    for (const x of clubs) termsOffer(game, x.name, "free", 0);
  }

  // ---------- the end ----------
  function retire(game) {
    const c = C(game), p = me(game);
    if (c.retired) return { error: "Already retired." };
    if (p.age < 32 && !(c.cond.inj && c.cond.inj.total >= 8 && p.age >= 30)) return { error: "Too early to stop. Retirement opens at 32." };
    const club = p.club && game.clubs[p.club];
    if (club) club.squad = club.squad.filter(id => id !== p.id);
    const summary = careerSummary(game);
    c.retired = { s: game.season, age: p.age, lastClub: p.club, summary };
    c.moments.retire = { s: game.season, w: game.round, seen: false };
    p.club = ""; p.league = "";
    news(game, p.name + " retires from professional football at " + p.age + ".", "life");
    msg(game, "mum", "Mum", "Whatever comes next, we are proud of every single day of it.");
    return { ok: true, summary };
  }
  function careerSummary(game) {
    const c = C(game), p = me(game);
    const S = c.stats.career;
    const clubs = [];
    for (const t of c.transfers || []) if (t.to && !clubs.includes(t.to)) clubs.push(t.to);
    if (c.contract && !clubs.includes(c.contract.club)) clubs.unshift(c.contract.club);
    const earned = c.money.earned || 0;
    return {
      name: p.name, age: p.age, matches: S.apps, goals: S.g, assists: S.a, avg: S.rN ? round1(S.rSum / S.rN) : 0, best: S.best,
      clubs, trophies: c.trophies || [], awards: c.awards || [], caps: c.national.caps, intlGoals: c.national.goals,
      highestRating: Math.max(p.rating, ...((c.stats.seasons || []).map(x => x.rating || 0))), fees: (c.transfers || []).reduce((s, t) => s + (t.fee || 0), 0),
      earnings: earned, homes: ((c.life || {}).owned || []).length, cars: ((c.life || {}).cars || []).length, followers: (c.life || {}).followers || 0
    };
  }
  // the same world, now from the dugout: a club he played for, or one that needs a manager
  function becomeManager(game, user, clubName) {
    const c = C(game);
    if (!c.retired) return { error: "Retire first." };
    const options = managerOptions(game);
    if (!options.includes(clubName)) return { error: "That club is not offering you the job." };
    game.mode = "manager";
    game.users[user.name].team = clubName;
    game.clubs[clubName].conf = 60;
    c.managedFrom = { s: game.season, club: clubName };
    return { ok: true, club: clubName };
  }
  function managerOptions(game) {
    const c = C(game);
    const mine = (c.transfers || []).map(t => t.to).concat(c.retired && c.retired.lastClub ? [c.retired.lastClub] : []).filter(n => game.clubs[n] && (LEAGUES[game.clubs[n].league] || {}).playable);
    const fill = Object.keys(game.clubs).filter(n => (LEAGUES[game.clubs[n].league] || {}).playable).sort(() => rnd() - 0.5).slice(0, 3);
    return Array.from(new Set(mine.concat(fill))).slice(0, 5);
  }

  return { transferWeek, loanCheck, freeAgentOffers, requestTransfer, signOffer, intlWindow, captaincyCheck, beforeRollover, afterRollover, retire, careerSummary, becomeManager, managerOptions, nationStrength, INTL_ROUNDS };
}

module.exports = { makePro };
