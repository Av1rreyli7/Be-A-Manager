// Player Career: the people in his life. Mum, Dad and sometimes a brother or a sister, a friend from home,
// a best mate in the dressing room, the dressing room itself, the coach or manager and the agent. They text,
// they turn up, they have opinions, and sometimes the family and the agent want different things.
// Life events: one can be decided at the end of a week. It is only teased then; the full choice pops up before
// the next week is played (the same teaser then popup flow Manager Career uses). Family drama is rate limited
// to one between matches. Every choice moves relationships, morale, confidence and sometimes the career.
const D = require("./data");

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = () => Math.random();
const pick = a => a[Math.floor(Math.random() * a.length)];

// how often a week ends with something brewing, and how much more likely family drama is when there is a reason
const EVENT_RATE = 0.26;
const SIS = ["Ananya", "Priya", "Meera", "Isha", "Riya", "Kavya", "Sara", "Diya"];
const SIS_FOREIGN = ["Grace", "Amara", "Lucia", "Sofia", "Chloe", "Ines", "Nia", "Hana"];
const FRIENDS_FOREIGN = ["Sam", "Leo", "Kofi", "Mateo", "Jonah", "Theo", "Ibrahim", "Luca"];

function makePeople(K, deps) {
  const { C, me, msg, news, money } = K;

  // ---------- the cast ----------
  function P0(game) {
    const c = C(game);
    if (!c.people) {
      const india = c.person.country === "India";
      const hasSib = rnd() < 0.65;
      const sister = rnd() < 0.5;
      c.people = {
        mum: { name: "Mum", rel: 72 },
        dad: { name: "Dad", rel: 66 },
        sib: hasSib ? { name: sister ? pick(india ? SIS : SIS_FOREIGN) : pick(india ? D.IN_FIRST : FRIENDS_FOREIGN), kind: sister ? "sister" : "brother", older: rnd() < 0.4, rel: 64 } : null,
        friend: { name: pick(india ? D.IN_FIRST : FRIENDS_FOREIGN), rel: 70 },
        best: null,
        team: 50,
        agent: 55,
        fixtures: 0, lastFamily: -1, lastEvent: -9, pending: null, log: [], answered: 0
      };
      if (c.people.sib && c.people.sib.name === c.person.first) c.people.sib.name = c.people.sib.kind === "sister" ? "Ananya" : "Kabir";
    }
    return c.people;
  }
  const weekIndex = game => game.season * 40 + game.round;
  const R = (game, who, d) => {
    const pp = P0(game);
    if (who === "team") pp.team = clamp(pp.team + d, 0, 100);
    else if (who === "agent") pp.agent = clamp(pp.agent + d, 0, 100);
    else if (who === "coach") { const c = C(game); if (c.stage === "pro") c.trust = clamp(c.trust + d, 0, 100); else c.coachRel = clamp(c.coachRel + d, 0, 100); }
    else if (who.startsWith("f:")) { const f = (pp.friends || {})[who.slice(2)]; if (f) f.rel = clamp(f.rel + d, 0, 100); }
    else if (pp[who]) pp[who].rel = clamp(pp[who].rel + d, 0, 100);
  };
  const familyMood = game => { const pp = P0(game); const xs = [pp.mum.rel, pp.dad.rel].concat(pp.sib ? [pp.sib.rel] : []); return xs.reduce((a, b) => a + b, 0) / xs.length; };

  // a new club: someone in the dressing room becomes his best mate
  function newClub(game) {
    const c = C(game), p = me(game), pp = P0(game);
    const club = p.club && game.clubs[p.club];
    if (!club) return;
    const mates = club.squad.map(id => game.players[id]).filter(q => q && q.id !== p.id && Math.abs(q.age - p.age) <= 5);
    const m = mates.length ? pick(mates) : null;
    pp.best = m ? { name: m.name, id: m.id, club: p.club, rel: 55 } : null;
    pp.team = 45 + (c.captain ? 10 : 0);
  }

  // ---------- small things every week: texts from home, the family at a game ----------
  function afterMatch(game, m) {
    const c = C(game), pp = P0(game);
    if (!m) return;
    pp.fixtures++;
    if (!m.mins) return;
    // dressing room standing follows how he plays and behaves
    pp.team = clamp(pp.team + ((m.rating || 6.5) - 6.6) * 1.2 + (m.g ? 0.8 : 0), 0, 100);
    if (pp.best && pp.best.club === (me(game).club || "")) pp.best.rel = clamp(pp.best.rel + 0.4, 0, 100);
    // the family texts about it, sometimes
    if (rnd() < 0.35) {
      const big = (m.rating || 0) >= 7.8 || (m.g || 0) >= 2;
      const bad = (m.rating || 7) < 6;
      const who = pp.sib && rnd() < 0.3 ? "sib" : rnd() < 0.55 ? "mum" : "dad";
      const name = who === "sib" ? pp.sib.name : who === "mum" ? "Mum" : "Dad";
      const lines = {
        mum: big ? ["I screamed so loud the neighbours came over. So proud of you.", "Everyone in the building is talking about you!"] : bad ? ["Not every day is a good day. Eat something proper and sleep.", "We love you whatever the score."] : ["Saw the game. Keep going, " + (c.person.country === "India" ? "beta." : "love."), "Did you eat? You looked tired."],
        dad: big ? ["That is what all those early mornings were for.", "I watched it three times. Again tomorrow."] : bad ? ["Head up. Monday you work harder than everyone.", "Watch it back once, learn, then forget it."] : ["Solid. Now do it every week.", "Good. Not finished yet."],
        sib: big ? ["Okay fine you are actually good 😭", "My friends want your autograph, it is embarrassing"] : bad ? ["Rough one. Want to play FIFA tonight?", "Ignore the comments, they are idiots"] : ["Saw it. Not bad", "Bring me a shirt next time"]
      }[who];
      msg(game, who === "sib" ? "sib" : who, name, pick(lines));
      if (who === "sib" && c.phone.threads.sib) c.phone.threads.sib.name = pp.sib.name;
    }
    // the family in the stands at a home game now and then
    if (m.home !== false && rnd() < 0.07) {
      news(game, "His family were in the stands for " + (m.team || "the game") + " against " + m.opp + ".", "life");
      c.cond.morale = clamp(c.cond.morale + 3, 5, 99);
      R(game, "mum", 2); R(game, "dad", 2);
    }
  }

  // ---------- the events ----------
  // each: id, kind ("family" counts towards the one between matches), when (it can happen now), tease, title,
  // text, and choices with their effects. Effects: rel (who: amount), morale, conf, form, fatigue, cash, local,
  // national, commercial, followers (share), trust, prof (professionalism), disc (discipline), lead, act (a
  // career action: abroadNo, agentGone, agentPick, request, home, extraRest).
  const E = [
    {
      id: "abroad", kind: "family", weight: 3,
      when: (g, c, p) => c.offers.some(o => o.status === "open" && o.league !== (D.COUNTRIES[c.person.country] || {}).league) && p.age <= 22,
      tease: "Mum has gone quiet on the phone, and your agent keeps calling.",
      title: "Mum and your agent do not agree",
      text: (g, c) => "There is an offer from abroad. Your agent says it is the chance of a lifetime and you go now or never. Mum says you are too young to live alone in another country, and that the right offer will still be there in a year.",
      choices: [
        { id: "agent", label: "Go with the agent. This is the dream.", fx: { rel: { agent: 8, mum: -10, dad: -2 }, conf: 4, morale: -2 } },
        { id: "mum", label: "Listen to Mum. Stay closer to home for now.", fx: { rel: { mum: 10, dad: 4, agent: -10 }, morale: 3, act: "abroadNo" } },
        { id: "table", label: "Get everyone round the table and decide together.", fx: { table: true } }
      ]
    },
    {
      id: "fee", kind: "family", weight: 2,
      when: (g, c) => !!c.agent && c.stage === "pro",
      tease: "Dad has been reading the small print of your contract.",
      title: "Dad thinks the agent takes too much",
      text: () => "Dad has done the maths on the agent's cut and he is not happy. He says a family friend who is a lawyer could do the same work for a flat fee. Your agent says you would never have got your deals without him.",
      choices: [
        { id: "agent", label: "Back the agent. He got you here.", fx: { rel: { agent: 7, dad: -9 }, morale: -1 } },
        { id: "dad", label: "Side with Dad and let the agent go.", fx: { rel: { dad: 9, agent: -30 }, act: "agentGone" } },
        { id: "mid", label: "Ask the agent for a smaller cut.", fx: { rel: { agent: -4, dad: 4 }, cash: 0, act: "agentCut" } }
      ]
    },
    {
      id: "exams", kind: "family", weight: 3,
      when: (g, c) => c.stage === "school" || c.stage === "college",
      tease: "Exam week is coming. So is a phone call about a photo shoot.",
      title: "Exams or a photo shoot?",
      text: () => "The Puma store in town wants you for a paid photo shoot on the same day as your exams. Your agent, or the brand's man if you have no agent, says chances like this do not wait. Mum says the exams are not negotiable.",
      choices: [
        { id: "shoot", label: "Do the shoot.", fx: { rel: { mum: -10, dad: -4, agent: 5 }, cash: 300, commercial: 2, followers: 0.05, disc: -2 } },
        { id: "exams", label: "Sit the exams.", fx: { rel: { mum: 8, dad: 5, agent: -3 }, disc: 3, morale: 1 } },
        { id: "both", label: "Shoot at dawn, exams after. No sleep.", fx: { rel: { mum: -3 }, cash: 200, fatigue: 15, form: -0.3 } }
      ]
    },
    {
      id: "dadagent", kind: "family", weight: 1,
      when: (g, c) => !!c.agent,
      tease: "Dad has an idea. Mum says brace yourself.",
      title: "Dad wants to be your agent",
      text: () => "Dad says he knows you better than anyone and could do the deals himself. Your agent says football is a business and family should stay family.",
      choices: [
        { id: "keep", label: "Keep the agent. Dad stays Dad.", fx: { rel: { dad: -8, agent: 6 } } },
        { id: "dad", label: "Let Dad handle it.", fx: { rel: { dad: 12, mum: 3, agent: -40 }, act: "agentGone", morale: 3 } },
        { id: "role", label: "Give Dad a seat in the meetings.", fx: { rel: { dad: 6, agent: -2 }, morale: 2 } }
      ]
    },
    {
      id: "sibmoney", kind: "family", weight: 2,
      when: (g, c) => !!(c.people && c.people.sib) && c.money.cash > 2000,
      tease: (g) => P0(g).sib.name + " wants to talk. About money, probably.",
      title: (g) => P0(g).sib.name + " needs help",
      text: (g) => { const s = P0(g).sib; return s.name + " wants help paying for " + (s.older ? "a course" : "a football camp") + ". Your agent says money to family never comes back. Mum says that is what family is for."; },
      choices: [
        { id: "pay", label: "Pay for it.", fx: { rel: { sib: 14, mum: 5, agent: -3 }, cash: -1500, morale: 2 } },
        { id: "no", label: "Not now.", fx: { rel: { sib: -12, mum: -4 } } },
        { id: "help", label: "Help find a scholarship instead.", fx: { rel: { sib: 6 }, time: 1 } }
      ]
    },
    {
      id: "wedding", kind: "family", weight: 2,
      when: (g, c) => c.city !== c.hometown,
      tease: "There is a wedding back home. Everyone expects you there.",
      title: "A family wedding back home",
      text: () => "Your cousin is getting married back home and the whole family is going. It falls in a big week for you. The coach says the week before a game is not the time to travel.",
      choices: [
        { id: "go", label: "Go to the wedding.", fx: { rel: { mum: 8, dad: 6, sib: 6, coach: -5 }, fatigue: 12, form: -0.3, morale: 4 } },
        { id: "stay", label: "Stay and train.", fx: { rel: { mum: -8, dad: -3, sib: -6, coach: 4 }, prof: 2 } },
        { id: "call", label: "Stay, and video call through the whole thing.", fx: { rel: { mum: -2, sib: 2 }, morale: 1 } }
      ]
    },
    {
      id: "request", kind: "family", weight: 3,
      when: (g, c) => c.stage === "pro" && !c.requested && !c.loan && c.stats.log.filter(m => m.pro).slice(0, 6).filter(m => m.role === "start").length <= 1 && c.stats.log.filter(m => m.pro).length >= 6,
      tease: "Your agent says it is time to talk about your future. Dad disagrees.",
      title: "Ask to leave, or fight for your place?",
      text: () => "You are not playing. Your agent wants you to hand in a transfer request today. Dad says nobody ever won anything by running away, and that you should fight for the shirt.",
      choices: [
        { id: "agent", label: "Hand in the request.", fx: { rel: { agent: 6, dad: -8 }, act: "request" } },
        { id: "dad", label: "Fight for your place.", fx: { rel: { dad: 8, agent: -6, coach: 3 }, prof: 3, conf: -1 } },
        { id: "ask", label: "Ask the manager what you need to do.", fx: { rel: { coach: 5 }, conf: 2 } }
      ]
    },
    {
      id: "lifestyle", kind: "family", weight: 2,
      when: (g, c) => !!(c.life && c.life.posts && c.life.posts[0] && c.life.posts[0].kind === "lifestyle"),
      tease: "Mum saw your last post.",
      title: "Mum saw the post",
      text: () => "Mum saw your post with the new things and the fans' comments under it. She says people back home work a whole year for what you spend in a week. Your agent says that post did wonders for your sponsors.",
      choices: [
        { id: "sorry", label: "Call Mum and say sorry.", fx: { rel: { mum: 8, agent: -2 }, commercial: -0.5 } },
        { id: "fine", label: "It is my money.", fx: { rel: { mum: -10, dad: -5, agent: 3 }, commercial: 0.5 } },
        { id: "give", label: "Send money to a charity back home and post that too.", fx: { rel: { mum: 10, dad: 4 }, cash: -1000, local: 3, followers: 0.02 } }
      ]
    },
    {
      id: "camp", kind: "family", weight: 3,
      when: (g, c) => c.stage !== "pro",
      tease: "The coach handed out a letter. Mum has plans for the holidays too.",
      title: "Training camp or the family trip?",
      text: () => "The coach invites you to a week long training camp in the holidays. Mum already booked the family trip to see your grandparents, the first in two years.",
      choices: [
        { id: "camp", label: "Go to the camp.", fx: { rel: { coach: 6, mum: -7, dad: 2 }, prof: 2, fatigue: 6 } },
        { id: "trip", label: "Go with the family.", fx: { rel: { mum: 8, dad: 4, coach: -4 }, morale: 4 } },
        { id: "half", label: "Half the camp, then join them.", fx: { rel: { coach: 2, mum: 2 }, fatigue: 4 } }
      ]
    },
    {
      id: "boots", kind: "family", weight: 2,
      when: (g, c) => c.stage !== "pro" && !c.contract,
      tease: "Your boots split down the side at training.",
      title: "New boots",
      text: () => "Your boots are falling apart. Dad says buy proper ones, a pair of Adidas Predators, whatever they cost, because your feet are your job. Mum says a pair of Nike Club boots from the market is fine until somebody pays you to play.",
      choices: [
        { id: "dad", label: "The proper ones, the Predators.", fx: { rel: { dad: 5, mum: -3 }, cash: -120, conf: 2 } },
        { id: "mum", label: "The cheap Nike ones.", fx: { rel: { mum: 5, dad: -2 } } },
        { id: "coach", label: "Ask the coach if the club has a spare pair.", fx: { rel: { coach: 3 }, morale: 1 } }
      ]
    },
    {
      id: "late", kind: "life", weight: 3,
      when: (g, c) => c.stage !== "pro",
      tease: "The group chat is still going at two in the morning.",
      title: "Late nights online",
      text: () => "Your friends are online until two every night this week, and they keep asking where you are.",
      choices: [
        { id: "stay", label: "Stay up with them.", fx: { morale: 3, fatigue: 10, rel: { friend: 5, team: 3 } } },
        { id: "ten", label: "Log off at ten.", fx: { prof: 2, fatigue: -4, rel: { friend: -2 } } }
      ]
    },
    {
      id: "nerves", kind: "life", weight: 3,
      when: (g, c) => c.stage !== "pro" && Object.values(c.scouts || {}).some(x => x.level >= 20),
      tease: "Word is a big scout is coming to your next game.",
      title: "A scout in the stands",
      text: () => "Everyone says a scout from a big club will be at your next match. You cannot sleep.",
      choices: [
        { id: "dad", label: "Talk it through with Dad.", fx: { conf: 5, rel: { dad: 4 } } },
        { id: "work", label: "Extra practice every evening.", fx: { conf: 2, fatigue: 8, prof: 1 } },
        { id: "off", label: "Switch off and play games.", fx: { morale: 3, conf: -1 } }
      ]
    },
    {
      id: "bully", kind: "team", weight: 2,
      when: (g, c) => c.stage !== "pro",
      tease: "Something at training did not sit right with you.",
      title: "Standing up for the new kid",
      text: () => "An older player keeps picking on a new kid at training. Nobody says anything.",
      choices: [
        { id: "stand", label: "Stand up for him.", fx: { lead: 3, rel: { coach: 3, team: -2 }, morale: 1 } },
        { id: "coach", label: "Tell the coach quietly.", fx: { rel: { coach: 2 } } },
        { id: "out", label: "Stay out of it.", fx: { morale: -1 } }
      ]
    },
    // ---------- life away from family ----------
    {
      id: "party", kind: "team", weight: 3,
      when: (g, c) => c.stage === "pro" || c.stage === "college",
      tease: "The group chat is planning something for Saturday night.",
      title: "A teammate's birthday party",
      text: () => "A teammate is throwing a birthday party the night before a game. Half the squad is going. The coach did not say no, but he did not say yes either.",
      choices: [
        { id: "go", label: "Go, and stay late.", fx: { rel: { team: 8, coach: -4 }, fatigue: 14, form: -0.4, morale: 3 } },
        { id: "early", label: "Show your face, leave early.", fx: { rel: { team: 4 }, fatigue: 4 } },
        { id: "skip", label: "Skip it. Sleep.", fx: { rel: { team: -5, coach: 2 }, prof: 2 } }
      ]
    },
    {
      id: "press", kind: "media", weight: 2,
      when: (g, c) => c.rep.national > 25,
      tease: "A journalist has been asking about you.",
      title: "A question about your rival",
      text: () => "At the press conference a journalist asks if you are better than the other team's star. The room goes quiet.",
      choices: [
        { id: "calm", label: "He is a great player. We will see on the pitch.", fx: { national: 1, rel: { coach: 2 } } },
        { id: "bold", label: "I am better. Write that down.", fx: { followers: 0.06, conf: 4, rel: { coach: -4, team: -2 } } }
      ]
    },
    {
      id: "hospital", kind: "life", weight: 2,
      when: (g, c) => c.rep.local > 15,
      tease: "The club's community team sent you an email.",
      title: "A visit to the children's hospital",
      text: () => "The club asks if you would visit the children's hospital on your day off.",
      choices: [
        { id: "go", label: "Go, and bring signed shirts.", fx: { local: 3, morale: 4, followers: 0.01, time: 1 } },
        { id: "no", label: "Not this week.", fx: { local: -1 } }
      ]
    },
    {
      id: "oldcoach", kind: "life", weight: 2,
      when: (g, c) => c.stage === "pro",
      tease: "Your old school coach sent a long message.",
      title: "Your first coach asks you to visit",
      text: () => "The coach who first saw something in you asks if you would come back and talk to the kids at your old school.",
      choices: [
        { id: "go", label: "Go back.", fx: { local: 4, morale: 3, rel: { mum: 3, friend: 5 }, time: 1 } },
        { id: "video", label: "Send a video message.", fx: { local: 1 } }
      ]
    },
    {
      id: "betting", kind: "agent", weight: 1,
      when: (g, c) => c.rep.commercial > 30,
      tease: "Your agent has a deal he is excited about. Mum will not be.",
      title: "A betting company wants you",
      text: () => "A betting company offers a lot of money to put your face on their adverts. Your agent says the money is huge. Mum says absolutely not.",
      choices: [
        { id: "yes", label: "Take the money.", fx: { cash: 25000, rel: { mum: -14, dad: -8, agent: 8 }, local: -4, national: -2 } },
        { id: "no", label: "No. Not that.", fx: { rel: { mum: 8, agent: -6 }, local: 2 } }
      ]
    },
    {
      id: "mentor", kind: "team", weight: 2,
      when: (g, c, p) => c.stage === "pro" && p.age >= 24,
      tease: "The academy director wants a word.",
      title: "Mentor a kid from the academy",
      text: () => "The club asks you to take a seventeen year old from the academy under your wing. He reminds you of you.",
      choices: [
        { id: "yes", label: "Yes. Someone did it for me.", fx: { lead: 4, rel: { coach: 4, team: 3 }, time: 1 } },
        { id: "no", label: "I have enough on.", fx: { rel: { coach: -2 } } }
      ]
    },
    {
      id: "friend", kind: "life", weight: 2,
      when: (g, c) => c.city !== c.hometown,
      tease: (g) => P0(g).friend.name + " from back home messaged you.",
      title: (g) => P0(g).friend.name + " is in town",
      text: (g) => P0(g).friend.name + ", your oldest friend, is visiting for a few days and wants to go out every night like the old days.",
      choices: [
        { id: "out", label: "Like the old days.", fx: { rel: { friend: 10 }, fatigue: 12, form: -0.3, morale: 4 } },
        { id: "dinner", label: "One good dinner, then bed.", fx: { rel: { friend: 4 }, morale: 2 } },
        { id: "busy", label: "Too busy this time.", fx: { rel: { friend: -10 } } }
      ]
    },
    {
      id: "scare", kind: "life", weight: 1,
      when: (g, c) => c.cond.fatigue > 55 && !c.cond.inj,
      tease: "Something did not feel right at the end of training.",
      title: "A twinge in the hamstring",
      text: () => "Your hamstring tightened at the end of training. The physio says it is probably nothing. The game is in two days.",
      choices: [
        { id: "push", label: "Push through. It is nothing.", fx: { injuryRisk: 0.3, rel: { coach: 2 } } },
        { id: "rest", label: "Tell the physio and rest.", fx: { fatigue: -15, form: -0.1, rel: { coach: -1 } } }
      ]
    },
    // ---------- his friends (floodlights/career/social.js): who is the closest friend he has ----------
    {
      id: "friendexam", kind: "friend", weight: 2, who: g => K.social && K.social.closest(g, 55),
      when: (g, c) => c.stage === "school" || c.stage === "college",
      tease: (g, c, f) => f.first + " has sent you five messages about the exam.",
      title: (g, c, f) => f.first + " is panicking about exams",
      text: (g, c, f) => f.first + " is sure they are going to fail and asks you to study with them all evening. You have a game at the weekend and Coach wants you rested.",
      choices: [
        { id: "study", label: "Study with them all evening.", fx: { rel: { fr: 10, mum: 2 }, fatigue: 6, disc: 1 } },
        { id: "notes", label: "Send them your notes and a good luck text.", fx: { rel: { fr: 4 } } },
        { id: "rest", label: "Tell them you need to rest for the game.", fx: { rel: { fr: -6 }, fatigue: -3 } }
      ]
    },
    {
      id: "friendparty", kind: "friend", weight: 2, who: g => K.social && K.social.closest(g, 55),
      when: (g, c, p) => p.age >= 15,
      tease: (g, c, f) => f.first + " has a birthday coming up. So do you, kind of: a game.",
      title: (g, c, f) => f.first + "'s birthday party",
      text: (g, c, f) => f.first + " is having a party the night before your next game. Everyone will be there and " + f.first + " says it will not be the same without you.",
      choices: [
        { id: "all", label: "Go, and stay until the end.", fx: { rel: { fr: 10 }, morale: 3, fatigue: 12, disc: -2 } },
        { id: "hour", label: "Show up for an hour, then home.", fx: { rel: { fr: 5 }, morale: 1, fatigue: 4 } },
        { id: "gift", label: "Skip it and send a present.", fx: { rel: { fr: -4 }, cash: -40, prof: 1 } }
      ]
    },
    {
      id: "friendloan", kind: "friend", weight: 1, who: g => K.social && K.social.closest(g, 60),
      when: (g, c) => c.money.cash >= 3000,
      tease: (g, c, f) => f.first + " wants to talk. It sounds serious.",
      title: (g, c, f) => f.first + " needs money",
      text: (g, c, f) => f.first + " is behind on rent and asks to borrow some money. They promise to pay you back when they can.",
      choices: [
        { id: "lend", label: "Lend it. That is what friends are for.", fx: { rel: { fr: 9 }, cash: -1000 } },
        { id: "half", label: "Lend half and help them make a plan.", fx: { rel: { fr: 3 }, cash: -500 } },
        { id: "no", label: "Say no. Money and friends do not mix.", fx: { rel: { fr: -8 } } }
      ]
    },
    // ---------- the one he is with ----------
    {
      id: "jealous", kind: "partner", weight: 2, who: g => K.social && K.social.partner(g, 0),
      when: (g, c) => c.life && c.life.followers > 20000,
      tease: (g, c, f) => f.first + " has been reading the comments under your posts.",
      title: (g, c, f) => f.first + " and the comments",
      text: (g, c, f) => "Your posts are full of messages from fans, some of them very forward. " + f.first + " says it does not bother her. It clearly bothers her.",
      choices: [
        { id: "post", label: "Post a photo of the two of you.", fx: { rel: { pt: 8 }, followers: 0.02 } },
        { id: "talk", label: "Talk it through over dinner.", fx: { rel: { pt: 6 }, cash: -80, morale: 1 } },
        { id: "shrug", label: "Tell her it comes with the job.", fx: { rel: { pt: -9 } } }
      ]
    },
    {
      id: "moretime", kind: "partner", weight: 2, who: g => K.social && K.social.partner(g, 0),
      when: (g, c) => true,
      tease: (g, c, f) => f.first + " sent a long message. It starts with \"We need to talk\".",
      title: (g, c, f) => f.first + " wants more of your time",
      text: (g, c, f) => f.first + " says she feels like she comes after training, the gym, the physio and your phone. She wants one evening a week that is just the two of you.",
      choices: [
        { id: "yes", label: "Promise her one evening a week, no phones.", fx: { rel: { pt: 9 }, time: 1, morale: 2 } },
        { id: "season", label: "Ask her to give it until the end of the season.", fx: { rel: { pt: -3 }, prof: 1 } },
        { id: "no", label: "Tell her football comes first. It always will.", fx: { rel: { pt: -12 }, prof: 2 } }
      ]
    },
    {
      id: "parents", kind: "partner", weight: 2, who: g => K.social && K.social.partner(g, 0),
      when: (g, c) => { const f = K.social.partner(g, 0); return f && f.stage === "serious"; },
      tease: (g, c, f) => f.first + "'s parents are coming to town.",
      title: (g, c, f) => "Meeting " + f.first + "'s parents",
      text: (g, c, f) => f.first + "'s parents want to have dinner with you on Saturday. You have a game on Sunday. Her dad, she warns you, supports your biggest rivals.",
      choices: [
        { id: "charm", label: "Go, bring flowers, talk about anything but football.", fx: { rel: { pt: 10, mum: 2 }, cash: -60 } },
        { id: "banter", label: "Go, and wind her dad up about his team.", fx: { rel: { pt: 3 }, morale: 2 } },
        { id: "skip", label: "Ask to move it. The game comes first.", fx: { rel: { pt: -8 }, prof: 1 } }
      ]
    },
    // ---------- married life ----------
    {
      id: "wifemum", kind: "family", weight: 2, who: g => K.social && K.social.partner(g, 0),
      when: (g, c) => { const f = K.social.partner(g, 0); return f && f.stage === "married"; },
      tease: (g, c, f) => "Mum and " + f.first + " were very polite to each other at lunch. Too polite.",
      title: (g, c, f) => "Mum and " + f.first + " disagree",
      text: (g, c, f) => "Mum wants everyone at hers for the holidays, like always. " + f.first + " wants your first holidays as a married couple to be at your place, with her family too. Both of them are waiting for you to say something.",
      choices: [
        { id: "wife", label: "Back your wife. Holidays at yours.", fx: { rel: { pt: 8, mum: -8 } } },
        { id: "mum", label: "Back Mum. Tradition is tradition.", fx: { rel: { mum: 6, pt: -10 } } },
        { id: "both", label: "Book a big holiday for both families.", fx: { rel: { mum: 3, pt: 4, dad: 2 }, cash: -2500, morale: 2 } }
      ]
    },
    {
      id: "wifeagent", kind: "family", weight: 2, who: g => K.social && K.social.partner(g, 0),
      when: (g, c) => { const f = K.social.partner(g, 0); return f && f.stage === "married" && !!c.agent; },
      tease: (g, c, f) => "Your agent and " + f.first + " are not speaking.",
      title: (g, c, f) => "The agent's summer plans",
      text: (g, c, f) => "Your agent has lined up a paid summer tour of sponsor events abroad. " + f.first + " says you promised her the summer at home, and that the agent treats you like a product.",
      choices: [
        { id: "tour", label: "Do the tour. The money is good.", fx: { rel: { agent: 6, pt: -9 }, cash: 3000, commercial: 2 } },
        { id: "home", label: "Summer at home with her.", fx: { rel: { pt: 8, agent: -6 }, morale: 2 } },
        { id: "both", label: "Do the tour, and take her with you.", fx: { rel: { pt: 4, agent: 2 }, fatigue: 5, cash: 1500 } }
      ]
    },
    {
      id: "abroadwife", kind: "family", weight: 3, who: g => K.social && K.social.partner(g, 0),
      when: (g, c, p) => { const f = K.social.partner(g, 0); return f && (f.stage === "married" || f.stage === "engaged") && c.offers.some(o => o.status === "open" && o.league !== (D.COUNTRIES[c.person.country] || {}).league); },
      tease: (g, c, f) => f.first + " found the offer letter on the table.",
      title: (g, c, f) => "An offer from abroad, and " + f.first,
      text: (g, c, f) => "There is an offer from a club abroad. " + f.first + " would have to leave her job, her friends and her family. She says she will support you, but her face says something else.",
      choices: [
        { id: "ask", label: "Ask her, properly, to come with you.", fx: { rel: { pt: 2 }, morale: 1 } },
        { id: "stay", label: "Turn it down for her.", fx: { rel: { pt: 9, agent: -6 }, act: "abroadNo" } },
        { id: "alone", label: "Go first, and she can follow later.", fx: { rel: { pt: -12 }, conf: 2 } }
      ]
    },
    {
      id: "ladsnight", kind: "friend", weight: 2, who: g => K.social && K.social.closest(g, 45),
      when: (g, c, p) => c.stage === "pro" && p.age >= 18,
      tease: "The squad group chat is very busy tonight.",
      title: "A night out with the lads",
      text: (g, c, f) => "After the win the lads want a night out, and " + f.first + " is the one organising it. Two days until the next game.",
      choices: [
        { id: "go", label: "Go out with them.", fx: { rel: { fr: 6, team: 4 }, morale: 3, fatigue: 8, disc: -1 } },
        { id: "dinner", label: "Dinner with them, home before midnight.", fx: { rel: { fr: 4, team: 2 }, morale: 2, fatigue: 2 } },
        { id: "home", label: "Stay in and recover.", fx: { rel: { fr: -3, team: -2 }, prof: 1, fatigue: -3 } }
      ]
    }
  ];

  // ---------- deciding and teasing ----------
  // called at the end of a week: maybe decide next week's event, and tease it
  function afterWeek(game, report) {
    const c = C(game), p = me(game), pp = P0(game);
    if (pp.pending || c.retired) return;
    if (game.round >= (game.totalRounds || 38) - 1) return;
    if (weekIndex(game) - pp.lastEvent < 2) return;
    if (rnd() > EVENT_RATE) return;
    const familyOk = pp.fixtures > pp.lastFamily;
    const ok = E.filter(e => (e.kind !== "family" || familyOk) && !(e.id === "sibmoney" && !pp.sib) && (!e.who || safe(() => e.who(game))) && safe(() => e.when(game, c, p)) && !(pp.log.slice(0, 6).some(x => x.id === e.id)));
    if (!ok.length) return;
    let total = ok.reduce((s, e) => s + e.weight, 0), r = rnd() * total, ev = ok[0];
    for (const e of ok) { r -= e.weight; if (r <= 0) { ev = e; break; } }
    queue(game, ev, report);
  }
  function queue(game, ev, report) {
    const c = C(game), pp = P0(game);
    // an event about a friend names the one it is about
    const who = ev.who ? ev.who(game) : null;
    if (ev.who && !who) return;
    const f = v => (typeof v === "function" ? v(game, c, who) : v);
    pp.pending = { id: ev.id, kind: ev.kind, s: game.season, w: game.round, fx: pp.fixtures, tease: f(ev.tease), title: f(ev.title), text: f(ev.text), choices: ev.choices.map(x => ({ id: x.id, label: x.label })) };
    if (who) pp.pending.who = who.id;
    pp.lastEvent = weekIndex(game);
    if (ev.kind === "family") pp.lastFamily = pp.fixtures;
    if (report) report.tease = pp.pending.tease;
  }
  // test hook only: put a given event up now, whatever the conditions
  function force(game, id) {
    const ev = E.find(e => e.id === id);
    if (!ev) return { error: "No such event." };
    if (ev.id === "sibmoney" && !P0(game).sib) return { error: "No brother or sister in this family." };
    if (ev.who && !ev.who(game)) return { error: "No close friend for that one." };
    queue(game, ev, null);
    return { ok: true };
  }
  function safe(fn) { try { return !!fn(); } catch (e) { return false; } }
  function blocker(game) { return P0(game).pending; }

  // ---------- answering ----------
  function answer(game, id, choice) {
    const c = C(game), p = me(game), pp = P0(game);
    const pend = pp.pending;
    if (!pend || pend.id !== id) return { error: "Nothing waiting for an answer." };
    const ev = E.find(e => e.id === id);
    const ch = ev && ev.choices.find(x => x.id === choice);
    if (!ch) return { error: "Pick one of the choices." };
    let fx = Object.assign({}, ch.fx);
    // "fr" is the friend the event is about, "pt" the one he is with
    for (const key of ["fr", "pt"]) if (fx.rel && fx.rel[key] !== undefined) { const rel = Object.assign({}, fx.rel); if (pend.who) rel["f:" + pend.who] = rel[key]; delete rel[key]; fx.rel = rel; }
    let note = "";
    // round the table: it goes well when the family trusts him and he can lead a room
    if (fx.table) {
      const odds = 0.3 + (familyMood(game) - 50) / 100 + (c.traits.leadership || 40) / 250 + pp.agent / 300;
      if (rnd() < odds) { fx = { rel: { mum: 5, dad: 4, agent: 4 }, morale: 4, conf: 2 }; note = "It took three hours and two pots of tea, but everyone came round. You go, with their blessing."; }
      else { fx = { rel: { mum: -6, dad: -3, agent: -5 }, morale: -4 }; note = "It ended with raised voices. Nobody is happy, and the decision is still yours."; }
    }
    const out = apply(game, fx);
    pp.pending = null;
    pp.answered++;
    pp.log.unshift({ id, kind: pend.kind, fx: pend.fx, s: pend.s, w: pend.w, title: pend.title, choice: ch.label, note });
    if (pp.log.length > 20) pp.log.length = 20;
    if (note) msg(game, "mum", "Mum", note.startsWith("It ended") ? "We only want what is best for you. Call me tomorrow." : "Proud of you. Go and show them.");
    news(game, pend.title.replace(/[?.!]$/, "") + ": " + ch.label.replace(/\.$/, "") + ".", "life");
    return Object.assign({ ok: true, note }, out);
  }
  function apply(game, fx) {
    const c = C(game), p = me(game), pp = P0(game), life = c.life;
    const out = {};
    for (const [who, d] of Object.entries(fx.rel || {})) R(game, who, d);
    if (fx.morale) c.cond.morale = clamp(c.cond.morale + fx.morale, 5, 99);
    if (fx.conf) c.cond.confidence = clamp(c.cond.confidence + fx.conf, 5, 99);
    if (fx.form) c.cond.form = clamp(c.cond.form + fx.form, 3, 10);
    if (fx.fatigue) c.cond.fatigue = clamp(c.cond.fatigue + fx.fatigue, 0, 100);
    if (fx.cash) money(game, fx.cash, fx.cash > 0 ? "A one off deal" : "Family and giving");
    if (fx.local) c.rep.local = clamp(c.rep.local + fx.local, 0, 100);
    if (fx.national) c.rep.national = clamp(c.rep.national + fx.national, 0, 100);
    if (fx.commercial) c.rep.commercial = clamp(c.rep.commercial + fx.commercial, 0, 100);
    if (fx.followers && life) life.followers = Math.round(life.followers * (1 + fx.followers));
    if (fx.prof) c.traits.professionalism = clamp(c.traits.professionalism + fx.prof, 0, 100);
    if (fx.disc) c.traits.discipline = clamp(c.traits.discipline + fx.disc, 0, 100);
    if (fx.lead) { c.traits.leadership = clamp(c.traits.leadership + fx.lead, 0, 100); c.attrs.leadership = Math.min(99, c.attrs.leadership + fx.lead * 0.3); }
    if (fx.time && life) life.time = Math.max(0, life.time - fx.time);
    if (fx.injuryRisk && rnd() < fx.injuryRisk) { out.injury = K.injure(game, 0.8); }
    // the career moves
    if (fx.act === "abroadNo") {
      const home = (D.COUNTRIES[c.person.country] || {}).league;
      for (const o of c.offers) if (o.status === "open" && o.league !== home) { o.status = "declined"; msg(game, "offers", "Contract offers", "You turned down " + o.club + "."); }
    }
    if (fx.act === "agentGone" && c.agent) {
      news(game, me(game).name + " parts ways with his agent.", "life");
      c.agent = null;
      pp.agent = 40;
    }
    if (fx.act === "agentCut" && c.agent) {
      c.agent.cut = Math.max(0.03, (c.agent.cut || (D.AGENTS.find(a => a.id === c.agent.id) || {}).fee || 0.08) - 0.02);
      if (pp.agent < 30 && rnd() < 0.5) { msg(game, "agent", "Agent", "If that is how you value my work, find someone else."); c.agent = null; pp.agent = 35; out.agentQuit = true; }
    }
    if (fx.act === "request") out.request = K.requestTransfer(game);
    return out;
  }

  // an agent who feels ignored for too long walks away
  function weekly(game) {
    const c = C(game), pp = P0(game);
    if (c.agent && pp.agent < 18 && rnd() < 0.15) {
      msg(game, "agent", "Agent", "I do not think this is working any more. I wish you well.");
      news(game, me(game).name + "'s agent walks away.", "life");
      c.agent = null;
      pp.agent = 40;
    }
    // relationships drift back a little towards normal
    for (const k of ["mum", "dad", "sib", "friend"]) if (pp[k]) pp[k].rel += (62 - pp[k].rel) * 0.01;
    // a new club means a new dressing room
    const p = me(game);
    if (p.club && (!pp.best || pp.best.club !== p.club)) newClub(game);
    // a happy home lifts him a little, a family at war weighs on him
    c.cond.morale = clamp(c.cond.morale + (familyMood(game) - 55) * 0.012, 5, 99);
  }

  function view(game) {
    const c = C(game), pp = P0(game);
    return {
      family: [{ id: "mum", name: "Mum", role: "Mother", rel: Math.round(pp.mum.rel) }, { id: "dad", name: "Dad", role: "Father", rel: Math.round(pp.dad.rel) }].concat(pp.sib ? [{ id: "sib", name: pp.sib.name, role: (pp.sib.older ? "Older " : "Younger ") + pp.sib.kind, rel: Math.round(pp.sib.rel) }] : []),
      friend: { name: pp.friend.name, rel: Math.round(pp.friend.rel) },
      best: pp.best ? { name: pp.best.name, rel: Math.round(pp.best.rel) } : null,
      team: Math.round(pp.team), agent: c.agent ? Math.round(pp.agent) : null,
      coach: Math.round(c.stage === "pro" ? c.trust : c.coachRel),
      pending: pp.pending, log: pp.log.slice(0, 12)
    };
  }

  return { P0, afterWeek, afterMatch, answer, blocker, weekly, view, newClub, force, rel: R, EVENTS: E };
}

module.exports = { makePeople };
