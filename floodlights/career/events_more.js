// Player Career: about a thousand more things that can happen in a week. Each family below is one situation
// (a lost wallet, a journalist at the door, a neighbour's dog) and each of its takes is its own event with its own
// id: a different place, person, twist or stake. They use the same shape as the hand written events in people.js
// (kind, weight, when, tease, title, text, choices with fx) and the same effects, plus two more: spend and earn,
// an amount that grows with what he has (1 small, 2 middling, 3 big), so a schoolboy and a millionaire both get
// sums that make sense. Every event marks its calm choice, the one a simmed season takes for him.
// The text names his world: the cafe and the restaurant in his city, his team, his best mate, his family.
"use strict";
const D = require("./data");

module.exports = function moreEvents(K, P0) {
  const { C, me } = K;
  // ---------- the words an event can use about his world (worked out once, when it comes up) ----------
  function ctx(g, f) {
    const c = C(g), p = me(g), pp = P0(g);
    let w = null;
    try { w = K.life ? K.life.world(g) : null; } catch (e) { w = null; }
    const place = (kind, fallback) => { const x = w && w.places.find(q => q.kind === kind); return x ? x.name : fallback; };
    const school = c.school ? (D.SCHOOLS.find(x => x.id === c.school) || {}).name : null;
    const college = c.college ? (D.COLLEGES.find(x => x.id === c.college) || {}).name : null;
    const team = c.stage === "pro" ? p.club : c.stage === "academy" && c.academy ? c.academy.club + " academy" : c.stage === "centre" && c.centre ? c.centre.name : c.stage === "college" ? college : school;
    return {
      first: c.person.first, city: c.city, home: c.hometown || (D.COUNTRIES[c.person.country] || {}).city || c.city,
      cafe: place("cafe", "the cafe on the corner"), restaurant: place("restaurant", "the restaurant in town"), mall: place("mall", "the mall"),
      club: place("club", "the club in town"), gym: place("gym", "the gym"), market: place("supermarket", "the supermarket"), clinic: place("clinic", "the clinic"),
      team: team || "the team", coach: c.stage === "pro" ? "the manager" : "the coach", ground: c.stage === "pro" ? "the training ground" : "the training pitch",
      mate: pp.best ? pp.best.name.split(" ")[0] : "a teammate", friend: pp.friend ? pp.friend.name : "an old friend",
      sib: pp.sib ? pp.sib.name : "your cousin", bro: pp.sib ? (pp.sib.kind === "sister" ? "sister" : "brother") : "cousin",
      who: f ? f.first : "",
    };
  }
  const GATE = {
    any: () => true,
    youth: (g, c) => c.stage !== "pro",
    school: (g, c) => c.stage === "school",
    student: (g, c) => c.stage === "school" || c.stage === "college",
    academy: (g, c) => c.stage === "academy" || c.stage === "centre",
    pro: (g, c) => c.stage === "pro",
    adult: (g, c, p) => p.age >= 18,
    teen: (g, c, p) => p.age < 18,
    sib: g => !!P0(g).sib,
    best: g => !!P0(g).best,
    partner: g => !!(K.social && K.social.partner(g, 0)),
    car: (g, c) => !!(c.life && c.life.car),
    known: (g, c) => (c.rep.commercial || 0) >= 20 || (c.rep.local || 0) >= 30,
    rich: (g, c) => (c.money.cash || 0) >= 20000,
    hurt: (g, c) => !!c.cond.inj,
  };
  const WEIGHT = 0.1;
  const out = [];
  // a line is plain words or a function of his world; {cafe}, {city} and the rest name his own places
  const val = (v, g, f) => {
    const x = ctx(g, f);
    return String(typeof v === "function" ? v(x) : v).replace(/\{(\w+)\}/g, (m, k) => (x[k] !== undefined ? x[k] : m));
  };
  // one family: its gates (all must pass), its takes (each an event) and how a take reads and plays out
  function fam(key, kind, gates, takes, build) {
    const gs = [].concat(gates).map(n => GATE[n]);
    for (const t of takes) {
      const b = build(t);
      const partnerWho = b.who === "pt" ? (g => K.social && K.social.partner(g, 0)) : null;
      out.push({
        id: "x_" + key + "_" + t[0], fam: key, kind, weight: WEIGHT, more: true, calm: b.calm || b.choices[b.choices.length - 1][0],
        who: partnerWho || undefined,
        when: (g, c, p) => gs.every(fn => fn(g, c, p)),
        tease: (g, c, f) => val(b.tease, g, f), title: (g, c, f) => val(b.title, g, f), text: (g, c, f) => val(b.text, g, f),
        choices: b.choices.map(([id, label, fx]) => ({ id, label, fx })),
      });
    }
  }

  // =====================================================================================================
  // EVERYDAY LIFE (any stage)
  // =====================================================================================================
  fam("wallet", "life", "any", [
    ["bus", "on the bus home", "The driver says lost property opens at nine."],
    ["cafe", "at the cafe", "The girl at the counter thinks someone handed one in, then is not sure."],
    ["taxi", "in a taxi", "You have the receipt, but not the driver's number."],
    ["park", "on a bench in the park", "It rained in the night."],
    ["mall", "somewhere in the mall", "Security says to check back after closing."],
    ["train", "on the train", "It went on to the end of the line without you."],
    ["cinema", "at the cinema", "The cleaners have already been through."],
    ["ground", "at the training ground", "Half the squad uses the same bench."],
  ], t => ({
    tease: "Pockets: phone, keys, and... no wallet.",
    title: "Lost wallet",
    text: x => "You left your wallet " + t[1] + ". " + t[2] + " Cards, some cash and the only photo of your grandad you had on you.",
    choices: [
      ["back", "Go back and look for it properly.", { time: 1, fatigue: 2, morale: 1 }],
      ["post", "Post about it and hope someone kind finds it.", { followers: 0.01, local: 1, morale: -1 }],
      ["cancel", "Cancel the cards, buy a new one and move on.", { spend: 1, morale: -1 }],
    ], calm: "cancel",
  }));
  fam("phone", "life", "any", [
    ["drop", "slips out of your hand on the stairs", "The screen is a spider's web."],
    ["water", "goes in the sink while you brush your teeth", "It is still on, but only just."],
    ["sat", "gets sat on by your own backside", "It now bends a little."],
    ["thief", "is gone from your bag after a busy street", "Find my phone says it is moving fast."],
    ["dead", "will not turn on after an update", "The shop says maybe, maybe not."],
    ["pitch", "falls out of your bag onto the pitch and a sprinkler gets it", "It smells of wet grass now."],
    ["dog", "gets chewed by a neighbour's puppy", "The puppy looks very proud."],
  ], t => ({
    tease: "Your phone has had a bad day.",
    title: "Broken phone",
    text: x => "Your phone " + t[1] + ". " + t[2] + " Everything is on it: training plans, the family chat, your music.",
    choices: [
      ["new", "Buy a new one today.", { spend: 2, morale: 1 }],
      ["fix", "Get it fixed and live without it for a few days.", { spend: 1, prof: 1, time: 1 }],
      ["off", "Take a few days off screens. Might be good.", { morale: 1, conf: 1, followers: -0.01 }],
    ], calm: "fix",
  }));
  fam("rain", "life", "any", [
    ["walk", "on the walk to training", "Your boots are full of water before the warm up."],
    ["date", "just as you leave to meet friends", "Your hair took twenty minutes."],
    ["kit", "on the washing you left outside", "Your only clean kit is soaked again."],
    ["bike", "halfway home on your bike", "There is no shelter for two miles."],
    ["power", "with a storm that knocks the power out", "The fridge is warming up."],
    ["roof", "through a leak in the ceiling", "It is dripping right onto your bed."],
    ["match", "during a youth match you came to watch", "The kids keep playing anyway."],
    ["flood", "so hard the street floods", "Cars are crawling past like boats."],
  ], t => ({
    tease: "The sky looks angry.",
    title: "Caught in the rain",
    text: x => "It pours " + t[1] + ". " + t[2],
    choices: [
      ["laugh", "Laugh about it. It is only water.", { morale: 2, fatigue: 1 }],
      ["help", "Help the people around you before yourself.", { local: 1, morale: 1, fatigue: 3 }],
      ["home", "Stay in, dry off and rest.", { fatigue: -2, time: 1 }],
    ], calm: "home",
  }));
  fam("neighbour", "life", "any", [
    ["music", "plays loud music until three in the morning", "Your alarm goes off at six."],
    ["drill", "starts drilling every morning at seven", "On your rest day too."],
    ["parcel", "has been taking in your parcels and opening them", "Your new boots were in one."],
    ["party", "is having a party and invites you", "There are about sixty people already."],
    ["help", "needs help carrying a sofa up four floors", "Their back is bad."],
    ["cat", "asks you to feed their cat for a week", "The cat does not like you."],
    ["fan", "turns out to be a big fan and keeps knocking", "With a new thing to sign each time."],
    ["old", "is an old man who lives alone and seems lonely", "He used to play, he says, in the old days."],
  ], t => ({
    tease: "Your neighbour wants a word.",
    title: "The neighbour",
    text: x => "The neighbour next door " + t[1] + ". " + t[2],
    choices: [
      ["kind", "Be kind about it. Say yes, or talk it through.", { local: 1, morale: 1, fatigue: 2 }],
      ["firm", "Be polite but firm.", { conf: 1, morale: -1 }],
      ["avoid", "Keep your head down and avoid them.", { morale: -1, prof: 1 }],
    ], calm: "firm",
  }));
  fam("bus", "life", "any", [
    ["late", "is twenty minutes late", "You will miss the start of the session."],
    ["full", "goes past full", "The next one is in half an hour."],
    ["strike", "does not come at all: there is a strike", "Nobody knows how long for."],
    ["wrong", "takes you the wrong way: you got on the wrong number", "You are now across the city."],
    ["fan", "is full of fans who recognise you", "Everyone wants a photo between stops."],
    ["fight", "has two men arguing loudly at the back", "The driver stops the bus."],
    ["kid", "has a crying kid whose mum looks exhausted", "The kid is wearing a football shirt."],
  ], t => ({
    tease: "Public transport, again.",
    title: "The bus",
    text: x => "The bus to " + x.ground + " " + t[1] + ". " + t[2],
    choices: [
      ["taxi", "Get a taxi and pay for it.", { spend: 1, prof: 1 }],
      ["run", "Run the rest of the way.", { fatigue: 4, prof: 1, morale: 1 }],
      ["wait", "Wait, and message " + "the coach" + " to say sorry.", { rel: { coach: -1 }, morale: -1 }],
    ], calm: "taxi",
  }));
  fam("food", "life", "any", [
    ["bad", "the chicken you cooked last night was not quite done", "Your stomach is making noises."],
    ["spicy", "a challenge with the hottest chilli in the market", "Your mouth is still on fire an hour later."],
    ["gift", "a fan dropped off a huge box of homemade sweets", "There are at least two hundred."],
    ["diet", "the club nutritionist sent a new plan with no sugar at all", "Not even in coffee."],
    ["mum", "your mum sends enough food for a family of six", "Your freezer is already full."],
    ["new", "a new place opened near " + "home" + " and everyone says it is great", "It is very fried."],
    ["fast", "a teammate says fasting before games changed his life", "He is very loud about it."],
    ["cook", "you try to cook a proper meal for the first time", "The smoke alarm has opinions."],
  ], t => ({
    tease: "Something about food.",
    title: "What to eat",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["care", "Be careful. Eat plain and sensible.", { prof: 1, form: 0.1 }],
      ["enjoy", "Enjoy it. Life is short.", { morale: 2, fatigue: 2, form: -0.1 }],
      ["share", "Share it round the dressing room.", { rel: { team: 3 }, morale: 1 }],
    ], calm: "care",
  }));
  fam("scam", "life", "any", [
    ["bank", "a text says your bank account is locked: click the link", "It looks very real."],
    ["prize", "an email says you won a car in a draw you never entered", "It wants a small fee first."],
    ["agent", "a man calling himself an agent wants money up front for a trial abroad", "He knows your name and your club."],
    ["crypto", "someone in your messages offers a coin that will make you rich", "He has your picture on his page."],
    ["charity", "a caller collects for a children's charity you have never heard of", "He is very pushy."],
    ["boots", "a website sells your favourite boots at a quarter of the price", "Reviews are all five stars and all from yesterday."],
    ["parcel", "a text says a parcel is waiting: pay the delivery fee", "You are not expecting anything."],
  ], t => ({
    tease: "A message that looks too good, or too bad, to be true.",
    title: "Is it a scam?",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["ignore", "Ignore it and block it.", { prof: 1 }],
      ["warn", "Warn people about it online.", { followers: 0.01, local: 1 }],
      ["ask", "Ask " + "your dad" + " what he thinks.", { rel: { dad: 3 }, morale: 1 }],
    ], calm: "ignore",
  }));
  fam("pet", "life", "any", [
    ["stray", "a stray dog follows you home from the park", "It sits outside your door and will not leave."],
    ["kitten", "a kitten is crying under a parked car", "It is tiny and soaked."],
    ["bird", "a bird with a hurt wing lands on your balcony", "It cannot fly."],
    ["fish", "a teammate is moving and asks you to take his fish tank", "There are eleven fish and they all have names."],
    ["puppy", "your " + "family" + " sends a photo of a puppy they want", "They want you to say yes."],
    ["lost", "a lost dog with a collar wanders onto the pitch", "There is a phone number on the tag."],
    ["club", "the club's pet cat has gone missing before a big game", "The kit man is very upset."],
  ], t => ({
    tease: "An animal needs someone.",
    title: "An animal in need",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["help", "Help it, whatever it takes.", { morale: 3, local: 1, time: 1, spend: 1 }],
      ["call", "Call someone who knows what to do.", { morale: 1, local: 1 }],
      ["leave", "Leave it. You have enough on.", { morale: -2, prof: 1 }],
    ], calm: "call",
  }));
  fam("sleep", "life", "any", [
    ["noise", "the street outside is being dug up at night", "You get about three hours a night."],
    ["mind", "your mind will not switch off before bed", "You go over every pass you made."],
    ["heat", "it is far too hot to sleep", "The fan just moves the hot air around."],
    ["phone", "you are scrolling until two every night", "You know you are doing it."],
    ["dream", "you keep having the same dream about missing a penalty", "You wake up sweating."],
    ["bed", "your bed is broken and sags in the middle", "Your back hurts in the mornings."],
    ["snore", "your roommate on away trips snores like a lorry", "The next trip is this week."],
  ], t => ({
    tease: "You are tired in the mornings.",
    title: "Not sleeping",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["fix", "Sort it properly, whatever it costs.", { spend: 1, fatigue: -4, prof: 1 }],
      ["talk", "Talk to the club doctor or physio about it.", { fatigue: -2, rel: { coach: 1 } }],
      ["push", "Push through. It will pass.", { fatigue: 4, morale: -1 }],
    ], calm: "talk",
  }));
  fam("kindness", "life", "any", [
    ["old", "an old woman drops her shopping all over the road", "Oranges are rolling under cars."],
    ["kid", "a kid outside " + "the stadium" + " has no money for a ticket", "He is wearing a homemade shirt with your number."],
    ["blind", "a blind man is trying to cross a busy road", "Nobody else is stopping."],
    ["tourist", "lost tourists ask you the way in broken English", "They are miles from where they want to be."],
    ["homeless", "a homeless man outside {cafe} asks for a coffee", "It is very cold."],
    ["crash", "a cyclist gets knocked off in front of you", "He is sitting up but dazed."],
    ["mum", "a mum with three kids is stuck with a flat tyre", "The kids are all crying."],
    ["shop", "the shopkeeper you buy from every day looks like he has been crying", "He says business is bad."],
  ], t => ({
    tease: "A small moment on the street.",
    title: "A chance to help",
    text: x => "Out in " + x.city + ", " + t[1] + ". " + t[2],
    choices: [
      ["help", "Stop and help, properly.", { morale: 3, local: 2, time: 1 }],
      ["money", "Give some money and keep moving.", { spend: 1, morale: 1, local: 1 }],
      ["walk", "Keep walking. Someone else will help.", { morale: -2 }],
    ], calm: "help",
  }));
  fam("hobby", "life", "any", [
    ["guitar", "teach yourself the guitar", "Your fingers hurt already."],
    ["chess", "play chess online", "You lost forty games in a row last night."],
    ["cook", "learn to cook properly", "A teammate's mum offered lessons."],
    ["read", "read a book a week", "The first one is very long."],
    ["paint", "paint", "Your first one looks like a potato. It was meant to be the sea."],
    ["lang", "learn a new language", "The app sends you very guilty reminders."],
    ["garden", "grow your own vegetables on the balcony", "So far you have one tomato."],
    ["photo", "take photos of the city", "People keep asking why the footballer is photographing bins."],
  ], t => ({
    tease: "Something new to do with your free time.",
    title: "A new hobby",
    text: x => "You have started to " + t[1] + ". " + t[2],
    choices: [
      ["keep", "Stick with it. It is good for your head.", { morale: 2, conf: 1, time: 1 }],
      ["post", "Share your progress online.", { followers: 0.02, morale: 1 }],
      ["drop", "Drop it. Football comes first.", { prof: 1, morale: -1 }],
    ], calm: "keep",
  }));
  fam("lost", "life", "any", [
    ["keys", "locked yourself out of the flat", "Your keys are on the kitchen table, you can see them through the window."],
    ["boots", "left your boots on the bus", "Training is in an hour."],
    ["bag", "left your kit bag at the cafe", "It has your passport in it."],
    ["watch", "lost the watch your dad gave you", "It was his dad's."],
    ["card", "lost your club pass", "The gate staff are very strict."],
    ["ticket", "lost the tickets you bought for your family", "The game is on Saturday."],
    ["glasses", "sat on your reading glasses", "You cannot read the tactics board."],
  ], t => ({
    tease: "Where did you put it?",
    title: "Lost again",
    text: x => "You " + t[1] + ". " + t[2],
    choices: [
      ["calm", "Stay calm and sort it out step by step.", { prof: 1, conf: 1 }],
      ["call", "Call " + "Mum" + " in a panic.", { rel: { mum: 2 }, morale: -1 }],
      ["pay", "Throw money at it until it is fixed.", { spend: 1 }],
    ], calm: "calm",
  }));
  fam("fitness", "life", "any", [
    ["run", "a running club in the park asks you to join their Sunday run", "They are mostly over sixty and very fast."],
    ["yoga", "a teammate swears yoga fixed his hamstrings", "There is a class on your rest day."],
    ["swim", "the pool near home has early morning swims", "Six o'clock, every day."],
    ["box", "a boxing gym offers you free sessions", "The owner trained a world champion once."],
    ["ice", "everyone online is doing ice baths", "Your bath is very small."],
    ["climb", "friends invite you to an indoor climbing wall", "Your agent would hate it."],
    ["dance", "a friend signs you both up for a dance class", "It is salsa."],
  ], t => ({
    tease: "A different kind of workout.",
    title: "Something new for the body",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["try", "Give it a go.", { morale: 2, fatigue: 3, conf: 1 }],
      ["ask", "Ask the club's fitness coach first.", { prof: 1, rel: { coach: 1 } }],
      ["no", "Say no. Rest is training too.", { fatigue: -2 }],
    ], calm: "ask",
  }));
  fam("weather", "life", "any", [
    ["heat", "a heatwave", "It is too hot to train at midday."],
    ["snow", "a cold snap", "The pitches are frozen."],
    ["wind", "a storm with huge winds", "Trees are down across the roads."],
    ["fog", "a week of thick fog", "You can barely see the ball in training."],
    ["smog", "bad air", "The city is grey and your chest feels tight."],
    ["humid", "sticky, heavy heat", "You sweat through two shirts before breakfast."],
  ], t => ({
    tease: "The weather is turning.",
    title: "Weather week",
    text: x => x.city + " is having " + t[1] + ". " + t[2],
    choices: [
      ["adapt", "Adapt: train early, drink lots, rest well.", { prof: 1, fatigue: -1 }],
      ["indoor", "Do extra work indoors at " + "the gym" + ".", { fatigue: 3, conf: 1, spend: 1 }],
      ["moan", "Moan about it with everyone else.", { rel: { team: 2 }, morale: -1 }],
    ], calm: "adapt",
  }));
  fam("gaming", "life", "any", [
    ["tour", "you are invited to a gaming tournament for a children's charity", "Against other footballers."],
    ["late", "you played until four in the morning last night", "Your eyes are burning."],
    ["rated", "the new football game has rated you", "Much lower than you think you are."],
    ["stream", "a big streamer wants you on his live stream", "He has a million followers."],
    ["team", "the squad starts a league on the new game", "The loser buys dinner."],
    ["rage", "you broke a controller in anger", "The cat saw everything."],
  ], t => ({
    tease: "Games night.",
    title: "Gaming",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["play", "Play, and have fun with it.", { morale: 2, followers: 0.01, fatigue: 2 }],
      ["limit", "Play, but in bed by eleven.", { morale: 1, prof: 1 }],
      ["skip", "Skip it this week.", { prof: 1, rel: { team: -1 } }],
    ], calm: "limit",
  }));
  fam("mistake", "life", "any", [
    ["name", "you call the coach by the wrong name in front of everyone", "Twice."],
    ["text", "you send a message meant for your mum to the team group", "It had a lot of kisses in it."],
    ["kit", "you turn up to training in the away kit", "Everyone else is in the home kit."],
    ["late", "you sleep through your alarm", "Eleven missed calls."],
    ["car", "you scrape someone's car in the car park", "It is the club captain's."],
    ["door", "you walk into a glass door at the club", "In front of the new signing."],
    ["mic", "you say something rude thinking the microphone was off", "It was on."],
  ], t => ({
    tease: "Oh no.",
    title: "Embarrassing moment",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["own", "Own it, apologise and laugh at yourself.", { rel: { team: 3 }, conf: 1, morale: 1 }],
      ["quiet", "Say sorry quietly and hope it is forgotten.", { morale: -1 }],
      ["blame", "Find someone else to blame.", { rel: { team: -3 }, disc: -1 }],
    ], calm: "own",
  }));
  fam("money", "life", "any", [
    ["found", "you find a bag of money on the pavement", "There is a name and an address inside."],
    ["change", "a shop gives you far too much change", "The boy at the till looks about fifteen."],
    ["bank", "your bank pays you twice by mistake", "It is a lot."],
    ["bet", "a teammate wants you in on a bet on another league's game", "Just a small one, he says."],
    ["loan", "an old school friend asks to borrow money", "He says it is for his mum."],
    ["tax", "a letter says you owe tax you did not know about", "With a penalty."],
    ["invest", "a friend of your dad wants you to invest in his restaurant", "He has a business plan."],
  ], t => ({
    tease: "Money, money.",
    title: "A money question",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["right", "Do the honest, careful thing.", { prof: 1, local: 1, morale: 1 }],
      ["advice", "Ask for advice first.", { rel: { agent: 2, dad: 2 } }],
      ["risk", "Take the chance.", { earn: 1, disc: -1, morale: 1 }],
    ], calm: "right",
  }));
  fam("health", "life", "any", [
    ["cold", "you wake up with a cold", "Your nose is blocked and your head is heavy."],
    ["tooth", "a tooth starts aching", "It is worse when you drink cold water."],
    ["eye", "your eye is red and itchy", "The physio says it might be catching."],
    ["back", "your back is stiff from a long journey", "You cannot touch your toes."],
    ["skin", "a rash comes up on your arm", "You think it is the new washing powder."],
    ["stomach", "your stomach is bad after a meal out", "You have been up half the night."],
    ["ears", "your ears are ringing after a concert", "It is not stopping."],
    ["hay", "hay fever hits you hard", "The pitches have just been cut."],
  ], t => ({
    tease: "You do not feel quite right.",
    title: "Feeling rough",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["clinic", "Go to " + "the clinic" + " and get it looked at.", { spend: 1, fatigue: -2, prof: 1 }],
      ["rest", "Rest it at home for a couple of days.", { fatigue: -4, morale: -1, time: 1 }],
      ["play", "Ignore it and train as normal.", { fatigue: 4, conf: 1, injuryRisk: 0.04 }],
    ], calm: "clinic",
  }));
  fam("internet", "life", "any", [
    ["meme", "a clip of you falling over becomes a meme", "It has been watched two million times."],
    ["fake", "someone made a fake account pretending to be you", "It has more followers than you."],
    ["troll", "one account leaves a nasty comment on everything you post", "Every single post."],
    ["old", "someone digs up an old silly post of yours from years ago", "It is very cringe."],
    ["edit", "a fan made an amazing video of your best moments", "It has slow motion and dramatic music."],
    ["rumour", "a rumour says you are moving to a big club", "You have never heard of it."],
    ["photo", "a photo of you eating chips goes round", "It is the one cheat meal you had all month."],
  ], t => ({
    tease: "Your phone is buzzing a lot.",
    title: "Online",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["joke", "Have fun with it and reply with a joke.", { followers: 0.03, commercial: 1, morale: 1 }],
      ["ignore", "Ignore it. Log off for a while.", { prof: 1, morale: 1 }],
      ["angry", "Hit back hard.", { followers: 0.01, disc: -1, morale: -1 }],
    ], calm: "ignore",
  }));
  fam("transport", "life", "any", [
    ["flat", "your bike gets a flat tyre", "On the way to an early session."],
    ["chain", "the metro stops between stations for an hour", "No signal and no air."],
    ["lift", "you get stuck in a lift", "With a man who talks about his divorce."],
    ["jam", "a huge traffic jam blocks the road to " + "training", "Nothing has moved in twenty minutes."],
    ["missed", "you miss your train home", "The next one is in the morning."],
    ["lift2", "a stranger offers you a lift", "He says he is a big fan."],
  ], t => ({
    tease: "Getting around is hard this week.",
    title: "Stuck",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["patient", "Stay patient and make the best of it.", { morale: 1, prof: 1 }],
      ["call", "Call ahead and explain.", { rel: { coach: 1 } }],
      ["rush", "Rush and take a risk to get there.", { fatigue: 3, injuryRisk: 0.03, conf: 1 }],
    ], calm: "call",
  }));
  fam("idol", "life", "any", [
    ["shop", "your childhood hero is in the same shop as you", "Buying socks."],
    ["plane", "your childhood hero is on your flight", "Two rows in front."],
    ["gym", "your childhood hero trains at " + "the gym" + " you use", "He is on the treadmill next to yours."],
    ["cafe", "your childhood hero is having lunch at " + "the cafe", "Alone, with a newspaper."],
    ["event", "your childhood hero is at a charity event you go to", "He is talking to your agent."],
    ["street", "your childhood hero walks past you in the street", "He is shorter than you thought."],
  ], t => ({
    tease: "Is that who you think it is?",
    title: "Your hero",
    text: x => "This week " + t[1] + ". " + t[2] + " You had his poster on your wall for years.",
    choices: [
      ["talk", "Go and say hello.", { conf: 2, morale: 3 }],
      ["photo", "Ask for a photo and post it.", { followers: 0.02, morale: 2 }],
      ["leave", "Leave him alone. He deserves his peace.", { prof: 1, morale: -1 }],
    ], calm: "talk",
  }));

  // =====================================================================================================
  // FAMILY AND FRIENDS
  // =====================================================================================================
  fam("sib", "family", "sib", [
    ["exam", "has a big exam and is panicking", "They want you to test them on everything, tonight."],
    ["breakup", "has just been dumped", "They have not stopped crying for a day."],
    ["job", "has a job interview and nothing smart to wear", "It is tomorrow morning."],
    ["bully", "is being picked on at school", "They made you promise not to tell Mum."],
    ["trip", "needs money for a school trip", "Everyone else in their class is going."],
    ["visit", "wants to come and watch you train", "With six of their friends."],
    ["car", "crashed Dad's car, only a dent, and wants your help", "Before Dad gets home."],
    ["band", "has started a band and wants you in the video", "The song is about you."],
  ], t => ({
    tease: x => x.sib + " needs you.",
    title: x => x.sib + " needs a favour",
    text: x => "Your " + x.bro + ", " + x.sib + ", " + t[1] + ". " + t[2],
    choices: [
      ["help", "Drop everything and help.", { rel: { sib: 7 }, morale: 2, time: 1 }],
      ["money", "Send money and a kind message.", { rel: { sib: 3 }, spend: 1 }],
      ["busy", "Tell them you are too busy right now.", { rel: { sib: -6 }, prof: 1 }],
    ], calm: "help",
  }));
  fam("mum", "family", "any", [
    ["aunt", "says your aunt is unwell and would love a call from you", "She has not heard your voice in a year."],
    ["festival", "wants you home for the festival weekend", "The whole family will be there."],
    ["photos", "found a box of your old football photos", "She wants to make a book of them."],
    ["thin", "thinks you look too thin on TV", "She is sending food. A lot of it."],
    ["gossip", "heard from a neighbour that you were out late", "It was a team dinner. She does not believe you."],
    ["birthday", "reminds you it was her birthday yesterday", "You forgot."],
    ["fanpage", "has started a fan page for you", "It has forty followers and they are all aunties."],
    ["worry", "saw a bad tackle on you on the news", "She has not slept."],
  ], t => ({
    tease: "Mum is calling.",
    title: "A call from Mum",
    text: x => "Mum " + t[1] + ". " + t[2],
    choices: [
      ["call", "Call her back and talk for an hour.", { rel: { mum: 6 }, morale: 2, time: 1 }],
      ["gift", "Send something nice to say sorry, or thank you.", { rel: { mum: 4 }, spend: 1 }],
      ["later", "Text her that you will call later.", { rel: { mum: -3 }, prof: 1 }],
    ], calm: "call",
  }));
  fam("dad", "family", "any", [
    ["every", "wants to come to every training session", "And stand by the fence and shout."],
    ["critic", "sends you a long list of everything you did wrong in your last game", "Numbered, with timestamps."],
    ["job", "has lost his job", "He did not want you to know."],
    ["business", "is starting a business and wants your name on it", "It is a car wash."],
    ["health", "had a scare with his heart", "He says it is nothing. Mum says it is not nothing."],
    ["proud", "cried watching your highlights", "Mum filmed it."],
    ["coach", "wants to work with your coach on your weak foot", "Your coach has not asked for help."],
    ["argue", "and Mum are not talking after an argument", "Both of them call you to explain."],
  ], t => ({
    tease: "Dad has something on his mind.",
    title: "Your dad",
    text: x => "Your dad " + t[1] + ". " + t[2],
    choices: [
      ["listen", "Sit down with him and really listen.", { rel: { dad: 6 }, morale: 1, time: 1 }],
      ["help", "Help him out with money or time.", { rel: { dad: 4 }, spend: 1 }],
      ["line", "Draw a line. Football is your thing.", { rel: { dad: -5 }, conf: 1 }],
    ], calm: "listen",
  }));
  fam("homefriend", "friend", "any", [
    ["visit", "is coming to visit you in the city", "For a whole week, on your sofa."],
    ["trouble", "is in some trouble back home", "He needs someone to talk to."],
    ["wedding", "is getting married and wants you as best man", "The wedding is the day before a game."],
    ["job", "asks if you can find him a job at the club", "Any job, he says."],
    ["band", "has started a band and wants you at their first gig", "It is in a basement."],
    ["jealous", "has been making jokes about you forgetting where you came from", "In the group chat."],
    ["sick", "is in hospital after an accident", "He is okay but scared."],
    ["baby", "is going to be a dad", "He wants you to be the godfather."],
  ], t => ({
    tease: x => x.friend + " from home.",
    title: x => x.friend + " from home",
    text: x => "Your old friend " + x.friend + " " + t[1] + ". " + t[2],
    choices: [
      ["there", "Be there for him, whatever it takes.", { rel: { friend: 8 }, morale: 2, fatigue: 2, time: 1 }],
      ["call", "Call him and help how you can.", { rel: { friend: 4 }, morale: 1 }],
      ["busy", "Tell him football comes first right now.", { rel: { friend: -7 }, prof: 1 }],
    ], calm: "call",
  }));
  fam("best", "friend", "best", [
    ["dropped", "has been dropped and is taking it badly", "He has not spoken all week."],
    ["love", "has fallen in love and talks about nothing else", "You have heard her name four hundred times."],
    ["coach", "had a shouting match with " + "the coach", "He wants you on his side."],
    ["movein", "asks if he can stay with you for a while", "His landlord kicked him out."],
    ["crash", "scraped his car and is too scared to tell his dad", "He wants you to say you were driving."],
    ["birthday", "has a birthday this week", "He says he does not want a fuss. He wants a fuss."],
    ["homesick", "is homesick and thinking of quitting", "He says football is not fun any more."],
    ["spend", "is spending all his money on clothes", "He owes three people."],
  ], t => ({
    tease: x => x.mate + " needs a mate.",
    title: x => x.mate + ", your best mate",
    text: x => x.mate + " " + t[1] + ". " + t[2],
    choices: [
      ["back", "Back him up and spend time with him.", { rel: { best: 8, team: 1 }, morale: 1, time: 1 }],
      ["honest", "Be honest with him, even if it stings.", { rel: { best: 2 }, lead: 1 }],
      ["stay", "Stay out of it.", { rel: { best: -5 }, prof: 1 }],
    ], calm: "honest",
  }));
  fam("relatives", "family", "any", [
    ["wedding", "a cousin's wedding is the same weekend as a match", "The family assumes you will come."],
    ["grandma", "your grandma turns ninety", "She wants you to sit next to her."],
    ["uncle", "an uncle you barely know asks to borrow money", "A lot of money."],
    ["reunion", "the family is planning a big reunion", "They want you to pay for the hall."],
    ["aunt", "an aunt wants to stay with you for a month", "To see the city, she says."],
    ["grandpa", "your grandpa is in hospital", "He keeps asking for you."],
    ["chat", "the family group chat has exploded in an argument", "About who gets your signed shirt."],
    ["baby", "a new baby in the family has been named after you", "Your middle name too."],
  ], t => ({
    tease: "Family news.",
    title: "The wider family",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["go", "Show up for the family.", { rel: { mum: 4, dad: 3 }, morale: 2, fatigue: 3, time: 1 }],
      ["gift", "Send a gift and your love.", { rel: { mum: 2 }, spend: 1 }],
      ["no", "Say no. You cannot do everything.", { rel: { mum: -3, dad: -2 }, prof: 1 }],
    ], calm: "gift",
  }));
  fam("celebrate", "family", "any", [
    ["festival", "the biggest festival of the year", "Everyone is going home."],
    ["newyear", "the new year", "There are parties everywhere."],
    ["birthday", "your own birthday", "Nobody at the club seems to know."],
    ["mum", "your mum's birthday", "She says she wants nothing. She wants you there."],
    ["anniv", "your parents' anniversary", "Twenty five years."],
    ["holiday", "a long holiday weekend", "Training is still on Saturday."],
  ], t => ({
    tease: "A day to celebrate.",
    title: "A day to celebrate",
    text: x => "It is " + t[1] + ". " + t[2],
    choices: [
      ["home", "Go home and celebrate with the family.", { rel: { mum: 5, dad: 4 }, morale: 3, fatigue: 3 }],
      ["team", "Celebrate with the lads in " + "the city" + ".", { rel: { team: 4 }, morale: 2, fatigue: 2, spend: 1 }],
      ["quiet", "Keep it quiet and stay focused.", { prof: 1, morale: -1 }],
    ], calm: "home",
  }));

  // =====================================================================================================
  // SCHOOL AND COLLEGE
  // =====================================================================================================
  fam("exam", "family", "student", [
    ["maths", "a maths exam", "You have not opened the book since the season started."],
    ["science", "a science practical", "You have to dissect something."],
    ["english", "an English essay due", "Two thousand words on a poem you have not read."],
    ["history", "a history test", "Dates were never your thing."],
    ["final", "the end of year exams", "They decide whether you move up a year."],
    ["language", "a language oral exam", "You have to talk for five minutes, in front of the teacher."],
    ["resit", "a resit of the test you failed", "Mum does not know you failed it."],
    ["project", "a group project", "The others have done nothing."],
  ], t => ({
    tease: "The books are calling.",
    title: "Exam week",
    text: x => "It is " + t[1] + " this week. " + t[2] + " There is also a match on Saturday.",
    choices: [
      ["study", "Study hard, even if training suffers.", { rel: { mum: 4, coach: -2 }, fatigue: 3, prof: 1 }],
      ["both", "Do both: study late, train early.", { fatigue: 6, rel: { mum: 2 }, conf: 1 }],
      ["football", "Football first. Wing the exam.", { rel: { mum: -5, coach: 2 }, morale: 1 }],
    ], calm: "both",
  }));
  fam("teacher", "family", "student", [
    ["hates", "a teacher who clearly does not like footballers", "She calls you 'the athlete' in a funny voice."],
    ["fan", "a teacher who is a huge fan", "He talks about your games in class."],
    ["detention", "a teacher who gives you detention for being late", "It clashes with training."],
    ["mentor", "a teacher who says you could go to university", "Nobody ever said that before."],
    ["coach", "the PE teacher who thinks he knows better than your coach", "He wants you to change your position."],
    ["strict", "a strict new head teacher", "No phones, no hair gel, no excuses."],
    ["sick", "your favourite teacher, who is off sick", "The class is making a card."],
  ], t => ({
    tease: "Something at school.",
    title: "A teacher",
    text: x => "At school this week there is " + t[1] + ". " + t[2],
    choices: [
      ["respect", "Show respect and work hard in class.", { prof: 1, rel: { mum: 2 }, morale: 1 }],
      ["talk", "Talk to them, one to one.", { conf: 1, lead: 1 }],
      ["skip", "Keep your head down and count the days.", { morale: -1 }],
    ], calm: "respect",
  }));
  fam("schooltrip", "family", "student", [
    ["museum", "a museum trip", "It is on a training day."],
    ["camp", "a three day camping trip", "No phones, no football, lots of mud."],
    ["abroad", "a trip abroad", "It costs a lot and Mum is not sure."],
    ["beach", "a day at the beach", "Everyone in your class is going."],
    ["factory", "a visit to a chocolate factory", "Free samples."],
    ["science", "a science fair in another city", "Your team built a robot."],
  ], t => ({
    tease: "A school trip is coming.",
    title: "School trip",
    text: x => "Your class is going on " + t[1] + ". " + t[2],
    choices: [
      ["go", "Go. You are only young once.", { morale: 3, rel: { mum: 2 }, fatigue: 2, spend: 1 }],
      ["train", "Stay and train.", { prof: 1, rel: { coach: 2 }, morale: -1 }],
      ["half", "Go for one day and come back.", { morale: 1, fatigue: 2 }],
    ], calm: "half",
  }));
  fam("job", "family", ["student", "teen"], [
    ["shop", "the corner shop", "Saturdays only."],
    ["deliver", "delivering food on a bike", "Evenings, in all weather."],
    ["cafe", "the cafe", "Washing up and smiling at customers."],
    ["kids", "coaching little kids at a holiday camp", "Forty six year olds and one whistle."],
    ["car", "washing cars at the garage", "The owner pays in cash."],
    ["tutor", "tutoring a younger kid in maths", "His mum is very intense."],
  ], t => ({
    tease: "A chance to earn some money.",
    title: "A part time job",
    text: x => "You have been offered a part time job at " + t[1] + ". " + t[2],
    choices: [
      ["take", "Take it. Your own money feels good.", { earn: 1, fatigue: 4, conf: 1, rel: { dad: 2 } }],
      ["part", "Do it for a month and see.", { earn: 1, fatigue: 2 }],
      ["no", "Say no. Training needs the time.", { prof: 1, rel: { coach: 1 } }],
    ], calm: "no",
  }));
  fam("curfew", "family", "teen", [
    ["party", "a party on Friday night", "Everyone from school will be there."],
    ["concert", "a concert in the city", "It finishes at midnight."],
    ["sleepover", "a sleepover at a friend's", "Watching films all night."],
    ["late", "you came home an hour late last week", "Dad is still angry."],
    ["game", "a big game on TV at night", "Kick off is at eleven."],
    ["festival", "a street festival", "Music until two."],
  ], t => ({
    tease: "Mum and Dad have rules.",
    title: "Home by ten",
    text: x => "There is " + t[1] + ". " + t[2] + " Your parents want you home by ten.",
    choices: [
      ["rules", "Follow the rules.", { rel: { mum: 3, dad: 3 }, prof: 1, morale: -1 }],
      ["ask", "Ask nicely for an hour more.", { rel: { mum: 1 }, morale: 1 }],
      ["sneak", "Go anyway and sneak back in.", { rel: { mum: -5, dad: -5 }, morale: 2, fatigue: 3, disc: -1 }],
    ], calm: "rules",
  }));
  fam("older", "team", "youth", [
    ["kit", "make you carry all the kit after every session", "Every session."],
    ["names", "give you a nickname you hate", "It is catching on."],
    ["boots", "hide your boots before training", "Again."],
    ["seat", "tell you to sit at the back of the bus", "Forever, they say."],
    ["song", "make you sing in front of everyone", "It is the tradition, they say."],
    ["laugh", "laugh every time you make a mistake", "Loudly."],
  ], t => ({
    tease: "The older lads are at it again.",
    title: "The older lads",
    text: x => "Some older players at " + x.team + " " + t[1] + ". " + t[2],
    choices: [
      ["laugh", "Laugh it off and earn their respect on the pitch.", { rel: { team: 4 }, conf: 1 }],
      ["stand", "Stand up for yourself.", { conf: 2, rel: { team: -1 }, lead: 1 }],
      ["tell", "Tell " + "the coach" + ".", { rel: { coach: 2, team: -3 } }],
    ], calm: "laugh",
  }));
  fam("report", "family", "student", [
    ["great", "a great school report", "Even your maths teacher says something nice."],
    ["bad", "a bad school report", "The word 'distracted' appears four times."],
    ["mixed", "a mixed report", "Top marks in PE, bottom in everything else."],
    ["absent", "a report that says you missed too many days", "Mostly for football."],
    ["praise", "a report with a note praising your attitude", "Mum wants to frame it."],
    ["warning", "a warning letter about your grades", "The school wants a meeting."],
  ], t => ({
    tease: "Report card day.",
    title: "Report card",
    text: x => "You bring home " + t[1] + ". " + t[2],
    choices: [
      ["promise", "Promise to do better and mean it.", { rel: { mum: 4, dad: 3 }, prof: 1 }],
      ["proud", "Show it off proudly, or laugh it off.", { morale: 2, rel: { dad: -1 } }],
      ["hide", "Hide it for a while.", { rel: { mum: -4 }, morale: -1 }],
    ], calm: "promise",
  }));
  fam("crush", "friend", "student", [
    ["class", "someone in your class keeps smiling at you", "Your friends have noticed."],
    ["note", "someone left a note in your bag", "It is not signed."],
    ["dance", "someone asks you to the school dance", "In front of everyone."],
    ["game", "someone you like came to watch your game", "You played terribly."],
    ["text", "someone you like texts you first", "With a lot of emojis."],
    ["friend", "your best friend likes the same person you do", "He told you first."],
  ], t => ({
    tease: "Butterflies.",
    title: "A crush",
    text: x => "At school " + t[1] + ". " + t[2],
    choices: [
      ["brave", "Be brave and say something.", { conf: 2, morale: 2 }],
      ["slow", "Take it slow. Be friendly first.", { morale: 1 }],
      ["focus", "Focus on football. No time for this.", { prof: 1, morale: -1 }],
    ], calm: "slow",
  }));
  fam("phonetaken", "family", "student", [
    ["class", "a teacher takes your phone in class", "Until the end of term."],
    ["mum", "Mum takes your phone after bad marks", "For two weeks."],
    ["coach", "the coach bans phones at the training ground", "Lockers at the door."],
    ["exam", "your phone goes off in an exam", "It was the family group chat."],
    ["night", "your parents take your phone at night", "Off at ten, back at seven."],
  ], t => ({
    tease: "Your phone is going away.",
    title: "No phone",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["accept", "Accept it. It might even help.", { prof: 1, fatigue: -2, morale: -1 }],
      ["argue", "Argue your case.", { conf: 1, rel: { mum: -2 } }],
      ["spare", "Use an old spare phone in secret.", { disc: -1, morale: 1 }],
    ], calm: "accept",
  }));
  fam("captain", "team", "youth", [
    ["armband", "the coach asks you to be captain for the next game", "The usual captain is ill."],
    ["speech", "the coach asks you to give the team talk", "In front of the parents too."],
    ["vote", "the squad votes for a new captain", "Your name is on the list."],
    ["young", "the coach makes you captain of the younger age group", "For a tournament."],
    ["fight", "two teammates fall out and the coach asks you to sort it", "They will not talk to each other."],
    ["new", "a new boy joins and the coach asks you to look after him", "He does not speak the language."],
  ], t => ({
    tease: "The coach wants a word.",
    title: "A chance to lead",
    text: x => "At " + x.team + " " + t[1] + ". " + t[2],
    choices: [
      ["lead", "Step up and lead.", { lead: 2, conf: 2, rel: { coach: 3, team: 2 }, fatigue: 1 }],
      ["share", "Do it, but quietly, your own way.", { lead: 1, rel: { coach: 1 } }],
      ["no", "Say you are not ready.", { rel: { coach: -2 }, morale: -1 }],
    ], calm: "share",
  }));
  fam("class", "family", "student", [
    ["clown", "the class clown keeps trying to get you to laugh in lessons", "You are both on a warning."],
    ["copy", "a classmate wants to copy your homework", "Every week."],
    ["group", "your class wants you to play in the staff versus students match", "The teachers take it very seriously."],
    ["show", "the school wants you to talk at assembly about football", "In front of the whole school."],
    ["photo", "the school wants your photo on the wall of fame", "Next to a famous old pupil."],
    ["fight", "two boys in your class get into a fight", "One of them is your friend."],
  ], t => ({
    tease: "A day at school.",
    title: "At school",
    text: x => "At school " + t[1] + ". " + t[2],
    choices: [
      ["good", "Do the right thing.", { prof: 1, rel: { mum: 2 }, morale: 1 }],
      ["fun", "Go along with it. It is fun.", { morale: 2, disc: -1 }],
      ["away", "Stay out of it.", { morale: -1 }],
    ], calm: "good",
  }));
  fam("campus", "team", "student", [
    ["pitch", "the school pitch is being dug up for a car park", "Your team has nowhere to train."],
    ["kit", "the team's kit is falling apart", "There is no money for a new one."],
    ["bus", "the team bus broke down", "The away game is tomorrow."],
    ["ref", "there is no referee for the next home game", "The coach looks at you."],
    ["fund", "the team needs money for a tournament", "The coach asks if you can help raise it."],
    ["fans", "barely anyone comes to watch home games", "Twelve people and a dog."],
  ], t => ({
    tease: "The team has a problem.",
    title: "Team trouble",
    text: x => "At " + x.team + " " + t[1] + ". " + t[2],
    choices: [
      ["help", "Organise something to help.", { lead: 2, local: 2, rel: { coach: 3, team: 3 }, fatigue: 2, time: 1 }],
      ["money", "Put some of your own money in.", { spend: 1, rel: { team: 3, coach: 2 } }],
      ["leave", "Leave it to the adults.", { morale: -1 }],
    ], calm: "help",
  }));

  // =====================================================================================================
  // THE ACADEMY YEARS
  // =====================================================================================================
  fam("hostel", "team", "academy", [
    ["roommate", "your roommate in the residence never cleans", "There is something growing in his cup."],
    ["food", "the residence food has been the same pasta for a month", "Even the chef looks bored."],
    ["noise", "the room above yours plays music every night", "The walls are very thin."],
    ["curfew", "the residence has a new strict curfew", "Nine thirty, lights out."],
    ["theft", "things are going missing from rooms in the residence", "Your watch is gone."],
    ["prank", "the older boys are planning a prank on the new ones", "They want you in on it."],
    ["warden", "the residence warden is a grumpy old man", "He used to be a sergeant."],
    ["laundry", "the washing machine in the residence broke", "Your kit smells."],
  ], t => ({
    tease: "Life in the residence.",
    title: "The residence",
    text: x => "At the " + x.team + " residence, " + t[1] + ". " + t[2],
    choices: [
      ["sort", "Sort it out like a grown up.", { lead: 1, rel: { team: 2 }, prof: 1 }],
      ["moan", "Moan with the others.", { rel: { team: 2 }, morale: -1 }],
      ["keep", "Keep your head down.", { prof: 1 }],
    ], calm: "sort",
  }));
  fam("strict", "team", "academy", [
    ["phone", "the academy coach takes your phone for checking it at lunch", "For a week."],
    ["hair", "the academy coach tells you to cut your hair", "It is in your eyes, he says."],
    ["run", "the whole squad is made to run until someone is sick", "Because one boy was late."],
    ["video", "the coach shows your mistakes on the big screen", "Slowly. Three times."],
    ["bench", "the coach benches you for talking back", "You only asked a question."],
    ["diet", "the coach checks everyone's lunch boxes", "Yours has crisps in it."],
    ["silent", "the coach does not speak to you for a week", "Nobody knows why."],
  ], t => ({
    tease: "The academy coach is hard on you.",
    title: "A hard coach",
    text: x => "At " + x.team + " " + t[1] + ". " + t[2],
    choices: [
      ["take", "Take it on the chin and work harder.", { prof: 2, rel: { coach: 3 }, morale: -1 }],
      ["ask", "Ask him, politely, what you can do better.", { conf: 1, rel: { coach: 2 } }],
      ["push", "Push back.", { conf: 1, rel: { coach: -5 }, disc: -1 }],
    ], calm: "ask",
  }));
  fam("homesick", "family", "academy", [
    ["food", "you miss Mum's cooking", "Nothing here tastes like home."],
    ["night", "you cannot sleep for missing home", "You lie awake listening to the traffic."],
    ["call", "your family's video call keeps cutting out", "You just saw Dad's ceiling."],
    ["birthday", "you missed your sibling's birthday", "They had a party without you."],
    ["festival", "you are stuck here for the big festival", "Everyone at home is together."],
    ["friend", "your old friends post photos of a trip without you", "They look happy."],
    ["dog", "your family's dog is getting old", "Mum sent a video. He looks for you."],
  ], t => ({
    tease: "Home feels far away.",
    title: "Homesick",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["call", "Call home every night this week.", { rel: { mum: 4, dad: 3 }, morale: 2 }],
      ["mates", "Lean on the lads in the residence.", { rel: { team: 4 }, morale: 1 }],
      ["train", "Throw yourself into training.", { prof: 1, fatigue: 3, morale: -1 }],
    ], calm: "call",
  }));
  fam("released", "team", "academy", [
    ["mate", "your roommate has been let go by the academy", "He is packing his bags tonight."],
    ["captain", "the youth captain has been released", "Nobody saw it coming."],
    ["rival", "the boy who plays your position has been released", "You feel guilty for feeling relieved."],
    ["three", "three boys from your age group have been released", "The residence is very quiet."],
    ["injury", "a friend has been released after a bad injury", "He is only sixteen."],
    ["late", "a boy you know has been released for bad behaviour", "He says it was not his fault."],
  ], t => ({
    tease: "Bad news in the academy.",
    title: "Released",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["support", "Help him and stay in touch.", { rel: { team: 3 }, morale: -1, lead: 1, time: 1 }],
      ["focus", "Feel for him, but make it fuel for you.", { prof: 2, morale: -1 }],
      ["worry", "Worry it could be you next.", { conf: -2, morale: -2 }],
    ], calm: "support",
  }));
  fam("scout", "team", "youth", [
    ["big", "a scout from a big club is coming to your next game", "You find out the night before."],
    ["abroad", "a scout from a club abroad has been asking about you", "Your coach heard it from a friend."],
    ["rival", "a scout from your club's biggest rival watched you", "He left before the end."],
    ["nation", "the national youth team coach is in the stand", "He is writing things down."],
    ["agent", "a scout with an agent beside him is at training", "The agent waves at you."],
    ["camera", "your game is being filmed for scouts", "Every touch."],
  ], t => ({
    tease: "Someone important is watching.",
    title: "Being watched",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["normal", "Play your normal game. Do not change a thing.", { conf: 1, form: 0.1 }],
      ["show", "Try to show everything you can do.", { conf: 2, form: -0.1, morale: 1 }],
      ["nervous", "Let the nerves in.", { conf: -2, form: -0.2 }],
    ], calm: "normal",
  }));
  fam("youthfirst", "team", "academy", [
    ["firstteam", "you are asked to train with the first team for a day", "The senior pros are not gentle."],
    ["kit", "a senior pro gives you his old boots", "They are a size too big."],
    ["advice", "a senior pro takes you aside after training", "He says you remind him of himself."],
    ["warmup", "you are picked to warm up with the first team before a game", "In front of a full stadium."],
    ["bench", "you are on the first team bench for a cup game", "You might not get on."],
    ["gym", "a senior pro invites you to his gym session", "It is at six in the morning."],
  ], t => ({
    tease: "A taste of the big time.",
    title: "With the pros",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["learn", "Watch, listen and learn everything.", { prof: 2, conf: 1, rel: { coach: 2 } }],
      ["show", "Show them what you can do.", { conf: 2, fatigue: 3, injuryRisk: 0.03 }],
      ["quiet", "Stay quiet and do as you are told.", { prof: 1 }],
    ], calm: "learn",
  }));

  // =====================================================================================================
  // THE PROFESSIONAL GAME
  // =====================================================================================================
  fam("press", "media", "pro", [
    ["loss", "after a heavy defeat", "A reporter asks if the manager has lost the dressing room."],
    ["rival", "before the derby", "A reporter asks what you think of their captain."],
    ["form", "about your bad run of form", "A reporter reads out your stats. They are not good."],
    ["contract", "about your contract", "A reporter asks if you will sign a new deal."],
    ["ref", "after a bad refereeing call", "A reporter asks if the referee cost you the game."],
    ["win", "after a big win", "A reporter asks if you can win the league now."],
    ["fans", "about the fans booing", "A reporter asks if you heard them."],
    ["teammate", "about a teammate's red card", "A reporter asks if he let the team down."],
  ], t => ({
    tease: "You are up in front of the press.",
    title: "Press conference",
    text: x => "The club puts you in front of the press " + t[1] + ". " + t[2],
    choices: [
      ["calm", "Calm and polite. Say nothing that makes a headline.", { prof: 1, rel: { coach: 2 } }],
      ["honest", "Be honest and say what you really think.", { national: 2, followers: 0.02, rel: { coach: -2 }, conf: 1 }],
      ["joke", "Crack a joke and lighten the mood.", { commercial: 1, followers: 0.02, morale: 1 }],
    ], calm: "calm",
  }));
  fam("journalist", "media", "pro", [
    ["door", "turns up at your front door", "He wants a quote about a transfer rumour."],
    ["family", "has been calling your parents", "Mum told him your shoe size."],
    ["exclusive", "offers you a big interview", "On the condition you talk about your private life."],
    ["story", "is writing a story about your childhood", "He has photos from your old school."],
    ["error", "printed a story about you that is wrong", "It says you want to leave."],
    ["kind", "wrote a lovely piece about your rise", "Your grandma cut it out."],
    ["podcast", "invites you on a popular football podcast", "Three hours, unedited."],
    ["follow", "has been following you around " + "the city", "With a camera."],
  ], t => ({
    tease: "A journalist wants something.",
    title: "A journalist",
    text: x => "A journalist " + t[1] + ". " + t[2],
    choices: [
      ["club", "Pass it to the club's media team.", { prof: 1, rel: { coach: 1 } }],
      ["talk", "Talk to him yourself.", { national: 2, followers: 0.02, conf: 1, disc: -1 }],
      ["firm", "Tell him firmly to leave you and your family alone.", { conf: 1, national: -1, rel: { mum: 2 } }],
    ], calm: "club",
  }));
  fam("fans", "media", ["pro", "known"], [
    ["street", "a group of fans spots you in the street", "They start singing your name."],
    ["shop", "fans crowd you in a shop", "The manager asks you to leave by the back door."],
    ["kid", "a kid cries when he meets you", "His dad says you are his hero."],
    ["angry", "an angry fan shouts at you about the last result", "In front of your family."],
    ["rival", "fans of a rival club recognise you", "They are not friendly."],
    ["airport", "fans wait for you at the airport", "Hundreds of them."],
    ["window", "fans gather outside " + "your flat", "Asking you to come to the window."],
    ["dinner", "a fan pays for your dinner at " + "the restaurant", "He left before you could thank him."],
  ], t => ({
    tease: "Fans.",
    title: "Meeting the fans",
    text: x => "In " + x.city + " " + t[1] + ". " + t[2],
    choices: [
      ["time", "Make time for them.", { local: 2, followers: 0.02, morale: 2, fatigue: 2 }],
      ["quick", "A quick wave and a smile, then go.", { local: 1 }],
      ["avoid", "Avoid them.", { local: -2, morale: -1 }],
    ], calm: "quick",
  }));
  fam("ultras", "media", "pro", [
    ["banner", "the hard core fans unfurl a banner about you", "It is not kind."],
    ["meeting", "the leader of the fan group wants to meet you", "At a pub near the ground."],
    ["flare", "fans let off flares and the game is stopped", "The club wants players to calm them."],
    ["chant", "fans have a new chant about you", "Your mum would not like the words."],
    ["protest", "fans protest against the owner before the game", "They want players to join in."],
    ["away", "a small group of fans travelled ten hours to an away game", "They are standing in the rain."],
  ], t => ({
    tease: "The hard core fans.",
    title: "The ultras",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["respect", "Show them respect, but keep your distance.", { local: 1, prof: 1 }],
      ["join", "Go over to them and connect.", { local: 3, rel: { coach: -1 }, conf: 1 }],
      ["club", "Leave it to the club.", { prof: 1 }],
    ], calm: "respect",
  }));
  fam("sponsor", "media", ["pro", "known"], [
    ["shoot", "a sponsor shoot runs four hours over", "On your rest day."],
    ["drink", "a drinks brand wants you in an advert", "It is a fizzy drink full of sugar."],
    ["post", "a sponsor wants you to post about their product", "You have never used it."],
    ["event", "a brand wants you at a shop opening", "Signing things for two hours."],
    ["rival", "a rival brand offers you more money", "You are under contract."],
    ["boots", "a boot company wants you to wear a new colour", "It is very bright pink."],
    ["video", "a sponsor wants a dance video for social media", "You cannot dance."],
    ["kids", "a sponsor wants you to visit a kids' football camp", "It is two hours away."],
  ], t => ({
    tease: "A sponsor wants something.",
    title: "Sponsor work",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["yes", "Do it, with a smile.", { earn: 2, commercial: 2, fatigue: 3 }],
      ["deal", "Do a shorter version of it.", { earn: 1, commercial: 1 }],
      ["no", "Turn it down.", { commercial: -1, prof: 1 }],
    ], calm: "deal",
  }));
  fam("teammate", "team", "pro", [
    ["late", "a teammate is always late and the fines are adding up", "He asks you to cover for him."],
    ["moan", "a teammate moans about the manager to anyone who listens", "Now he is moaning to you."],
    ["divorce", "a teammate is going through a divorce", "He has not been himself."],
    ["party", "a teammate throws a huge party at his house", "Three days before a game."],
    ["joke", "a teammate pulls a prank on you", "Your car is full of balloons."],
    ["kit", "a teammate keeps borrowing your kit", "And not giving it back."],
    ["lang", "a new teammate does not speak the language", "He sits alone at lunch."],
    ["fight", "two teammates nearly fight in training", "Everyone looks at you."],
  ], t => ({
    tease: "Something in the dressing room.",
    title: "A teammate",
    text: x => "At " + x.team + " " + t[1] + ". " + t[2],
    choices: [
      ["help", "Step in and help.", { rel: { team: 4 }, lead: 1, fatigue: 1 }],
      ["laugh", "Keep it light. Laugh it off.", { rel: { team: 2 }, morale: 1 }],
      ["away", "Keep out of it.", { prof: 1, rel: { team: -1 } }],
    ], calm: "help",
  }));
  fam("manager", "team", "pro", [
    ["position", "wants to try you in a new position", "Somewhere you have never played."],
    ["rest", "says you are being rested for the next game", "You feel fine."],
    ["fitness", "says your fitness numbers are down", "In front of the whole squad."],
    ["praise", "praises you in front of everyone", "The others are looking at you."],
    ["meeting", "calls you into his office", "He shuts the door."],
    ["tactic", "has a new system that does not suit you", "The others love it."],
    ["diet", "says you have put on weight", "One kilo."],
    ["role", "wants you to mentor a young player", "The kid is seventeen and very cocky."],
  ], t => ({
    tease: x => x.coach + " wants you.",
    title: "The manager",
    text: x => "The manager " + t[1] + ". " + t[2],
    choices: [
      ["accept", "Accept it and give everything.", { rel: { coach: 4 }, prof: 1, morale: -1 }],
      ["ask", "Ask him to explain, one to one.", { rel: { coach: 2 }, conf: 1 }],
      ["argue", "Argue your case.", { rel: { coach: -4 }, conf: 1 }],
    ], calm: "accept",
  }));
  fam("staff", "team", "pro", [
    ["kitman", "the kit man is retiring after thirty years", "The squad wants to do something."],
    ["chef", "the club chef asks you to taste his new menu", "It is very green."],
    ["cleaner", "a cleaner at the training ground is having a hard time", "Her son is ill."],
    ["driver", "the team bus driver has a birthday", "He has driven the team for twenty years."],
    ["ground", "the groundsman is furious about boot marks on his pitch", "He thinks they are yours."],
    ["physio", "the physio is leaving for another club", "She knows your body better than you do."],
    ["analyst", "the club analyst made a video just for you", "It is two hours long."],
  ], t => ({
    tease: "The people behind the scenes.",
    title: "Behind the scenes",
    text: x => "At " + x.ground + " " + t[1] + ". " + t[2],
    choices: [
      ["kind", "Do something kind for them.", { rel: { team: 3 }, local: 1, spend: 1, morale: 2 }],
      ["thanks", "Thank them, properly, face to face.", { rel: { team: 2 }, morale: 1 }],
      ["busy", "Nod and get on with your day.", { prof: 1 }],
    ], calm: "thanks",
  }));
  fam("charity", "media", "pro", [
    ["hospital", "visit a children's hospital", "Some of the kids are very poorly."],
    ["school", "open a new pitch at a school", "The kids have made a banner."],
    ["food", "help at a food bank", "The queue goes round the block."],
    ["walk", "do a sponsored walk", "Twenty miles, two days after a game."],
    ["shave", "shave your head for charity", "The lads are already filming."],
    ["dinner", "speak at a charity dinner", "Five hundred people in suits."],
    ["camp", "coach at a camp for kids from poor areas", "Some have never had boots."],
    ["old", "visit an old people's home", "One lady says she watched your grandad play."],
  ], t => ({
    tease: "A chance to give something back.",
    title: "Charity day",
    text: x => "The club asks you to " + t[1] + ". " + t[2],
    choices: [
      ["all", "Give it everything.", { local: 3, national: 1, morale: 3, fatigue: 3, time: 1 }],
      ["go", "Go and do your bit.", { local: 2, morale: 1 }],
      ["skip", "Ask someone else to go.", { local: -1, prof: 1 }],
    ], calm: "go",
  }));
  fam("hotel", "team", "pro", [
    ["noise", "the team hotel is next to a nightclub", "The bass comes through the floor."],
    ["food", "the team hotel kitchen gets the order wrong", "Everyone gets fish. You hate fish."],
    ["fans", "rival fans are outside the team hotel", "Honking and singing all night."],
    ["fire", "the fire alarm goes off in the team hotel at three", "Everyone stands outside in towels."],
    ["room", "your hotel room has no hot water", "The game is tomorrow."],
    ["roommate", "your hotel roommate is the club's loudest snorer", "You have earplugs. They are not enough."],
    ["pool", "the hotel pool is open late", "Some of the lads are going in."],
  ], t => ({
    tease: "Away trip trouble.",
    title: "The away hotel",
    text: x => "On an away trip, " + t[1] + ". " + t[2],
    choices: [
      ["adapt", "Adapt and get what sleep you can.", { fatigue: 2, prof: 1 }],
      ["complain", "Complain to the staff.", { conf: 1, fatigue: -1 }],
      ["join", "Join in. Might as well have fun.", { rel: { team: 3 }, fatigue: 4, disc: -1 }],
    ], calm: "adapt",
  }));
  fam("airport", "team", "pro", [
    ["delay", "the team flight is delayed by five hours", "The squad is lying on the floor."],
    ["lost", "your bag is lost on the way to an away game", "Your boots are in it."],
    ["fans", "fans mob the team at the airport", "Security is overwhelmed."],
    ["upgrade", "you get upgraded to first class", "The captain is still in economy."],
    ["fear", "a teammate is terrified of flying", "He is sitting next to you."],
    ["passport", "you forgot your passport", "The team leaves in an hour."],
  ], t => ({
    tease: "Travel day.",
    title: "At the airport",
    text: x => "On the way to an away game, " + t[1] + ". " + t[2],
    choices: [
      ["calm", "Stay calm and help sort it out.", { rel: { team: 3 }, lead: 1 }],
      ["fun", "Make the best of it with the lads.", { rel: { team: 2 }, morale: 1, fatigue: 2 }],
      ["moan", "Get stressed about it.", { morale: -2, fatigue: 2 }],
    ], calm: "calm",
  }));
  fam("fines", "team", "pro", [
    ["phone", "your phone rang in a team meeting", "The fine is double for team meetings."],
    ["kit", "you wore the wrong colour socks to training", "There is a fine for that too."],
    ["late", "you were two minutes late for the bus", "The captain has a list."],
    ["weight", "you were a little over your target weight", "The fitness coach weighs everyone on Monday."],
    ["gel", "you used too much hair gel before a photo", "There is no rule for this. They made one."],
  ], t => ({
    tease: "The fines book is out.",
    title: "Dressing room fine",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["pay", "Pay it with a smile.", { spend: 1, rel: { team: 3 } }],
      ["argue", "Argue it.", { rel: { team: -1 }, conf: 1 }],
      ["double", "Pay double and buy everyone coffee.", { spend: 2, rel: { team: 5 }, morale: 1 }],
    ], calm: "pay",
  }));
  fam("rumour", "media", "pro", [
    ["big", "a big club wants to sign you", "Your teammates have seen it."],
    ["abroad", "a club abroad is about to bid for you", "Your mum is already worried."],
    ["swap", "you are part of a swap deal", "You did not know you were for sale."],
    ["fallout", "you have fallen out with the manager", "You have not."],
    ["captain", "you will be the next club captain", "The current captain has seen it."],
    ["retire", "you are thinking of quitting football", "You laughed when you read it."],
    ["money", "you asked for a huge pay rise", "You did not."],
    ["rival", "the club's biggest rival wants you", "The fans are furious."],
  ], t => ({
    tease: "The papers are writing about you.",
    title: "Transfer rumour",
    text: x => "The papers say " + t[1] + ". " + t[2],
    choices: [
      ["deny", "Say clearly that you are happy at the club.", { local: 2, rel: { coach: 2 }, prof: 1 }],
      ["silent", "Say nothing. Let your football talk.", { conf: 1 }],
      ["tease", "Drop a hint that you are open to it.", { national: 2, commercial: 1, local: -3, rel: { agent: 3 } }],
    ], calm: "silent",
  }));
  fam("rival", "media", "pro", [
    ["talk", "a rival player says in an interview that you are overrated", "Everyone is asking you about it."],
    ["foul", "a rival player fouled you on purpose last time", "You play them again this week."],
    ["friend", "a rival player is your old friend from home", "He wants dinner after the game."],
    ["swap", "a rival player wants to swap shirts with you", "His fans hate you."],
    ["post", "a rival player posted a picture mocking your team", "It has a crying emoji."],
    ["record", "a rival player is chasing the same record as you", "The papers love it."],
    ["injured", "a rival player you battle every year is badly injured", "You know how that feels."],
  ], t => ({
    tease: "A rival.",
    title: "A rival",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["class", "Show class. Be gracious.", { national: 2, prof: 1, conf: 1 }],
      ["fire", "Use it as fuel.", { conf: 2, form: 0.1, fatigue: 2 }],
      ["back", "Hit back in public.", { followers: 0.03, national: 1, disc: -1 }],
    ], calm: "class",
  }));
  fam("referee", "media", "pro", [
    ["card", "a referee booked you for something you did not do", "Video proves it."],
    ["missed", "a referee missed a clear penalty for your team", "The fans are furious."],
    ["chat", "a referee was rude to you on the pitch", "You have a witness."],
    ["praise", "a referee you thought was bad actually got every call right", "The pundits say so."],
    ["var", "a video review took four minutes and went against you", "The stadium is booing."],
    ["young", "a young referee in his first big game had a nightmare", "He looks close to tears."],
  ], t => ({
    tease: "The referee.",
    title: "The referee",
    text: x => "Last game " + t[1] + ". " + t[2],
    choices: [
      ["accept", "Accept it and move on.", { prof: 1, rel: { coach: 1 } }],
      ["speak", "Speak up about it after the game.", { national: 1, followers: 0.02, disc: -1 }],
      ["kind", "Say something kind to the referee.", { national: 1, conf: 1 }],
    ], calm: "accept",
  }));
  fam("medic", "team", "pro", [
    ["scan", "the club doctor wants you to have a scan", "Just to be safe, he says."],
    ["sleep", "the club wants you to wear a sleep tracker", "It buzzes when you check your phone."],
    ["diet", "the nutritionist wants to change your whole diet", "No bread. No rice. No joy."],
    ["test", "you have a drug test after the game", "You are so dehydrated you cannot go."],
    ["eyes", "an eye test shows you need contact lenses", "You have been playing half blind."],
    ["blood", "your blood tests show you are low on iron", "The doctor asks what you eat."],
  ], t => ({
    tease: "The medical team wants a word.",
    title: "The medical team",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["follow", "Do everything they say.", { prof: 2, fatigue: -2, form: 0.1 }],
      ["half", "Do the parts you like.", { prof: 1 }],
      ["ignore", "Ignore it. You feel fine.", { disc: -1, injuryRisk: 0.03 }],
    ], calm: "follow",
  }));
  fam("legend", "team", "pro", [
    ["advice", "a club legend comes to watch training", "He wants a word with you."],
    ["critic", "a club legend says on TV you are not good enough", "He used to play your position."],
    ["statue", "a club legend's statue is unveiled", "The club wants you to speak."],
    ["dinner", "a club legend invites you to dinner", "He has stories."],
    ["shirt", "a club legend gives you his old shirt number", "It means a lot to the fans."],
    ["ill", "a club legend is very ill", "The fans are holding a tribute."],
  ], t => ({
    tease: "A club legend.",
    title: "A club legend",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["honour", "Honour him. Listen, and learn.", { local: 2, prof: 1, conf: 1 }],
      ["prove", "Prove him wrong on the pitch.", { conf: 2, fatigue: 2 }],
      ["polite", "Be polite and keep your distance.", { prof: 1 }],
    ], calm: "honour",
  }));
  fam("youngster", "team", "pro", [
    ["advice", "a young academy player asks you for advice", "He is shaking."],
    ["boots", "a young player asks for your old boots", "He cannot afford good ones."],
    ["cocky", "a young player mocks you in training", "In front of the manager."],
    ["sad", "a young player has been crying in the car park", "He has just been told he is not getting a contract."],
    ["copy", "a young player copies everything you do", "Even your haircut."],
    ["drive", "a young player asks you for a lift home every day", "He lives the other way."],
    ["debut", "a young player is about to make his debut", "He has not slept for two days."],
  ], t => ({
    tease: "A youngster at the club.",
    title: "A youngster",
    text: x => "At " + x.team + " " + t[1] + ". " + t[2],
    choices: [
      ["mentor", "Take him under your wing.", { lead: 2, rel: { team: 3, coach: 2 }, time: 1 }],
      ["word", "Say a few kind words.", { lead: 1, rel: { team: 1 } }],
      ["busy", "You have your own career to worry about.", { prof: 1 }],
    ], calm: "word",
  }));
  fam("newsign", "team", "pro", [
    ["position", "the club signs a player in your position", "He cost a lot more than you."],
    ["star", "the club signs a world famous star", "He wants the number you wear."],
    ["friend", "the club signs your old friend", "You will be competing for one spot."],
    ["diva", "the new signing turns up late on his first day", "And leaves early."],
    ["shy", "the new signing is very shy", "He has been eating lunch in his car."],
    ["loud", "the new signing is very loud", "He has already changed the dressing room music."],
    ["foreign", "the new signing has just moved country", "His family has not arrived yet."],
    ["young", "the club signs a teenage wonderkid", "The papers say he will replace you."],
  ], t => ({
    tease: "A new face at the club.",
    title: "The new signing",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["welcome", "Welcome him properly.", { rel: { team: 3 }, lead: 1, morale: 1 }],
      ["compete", "Respect him, then outwork him.", { prof: 1, conf: 1, fatigue: 2 }],
      ["cold", "Keep your distance.", { rel: { team: -2 }, conf: 1 }],
    ], calm: "welcome",
  }));
  fam("dropped", "team", "pro", [
    ["bench", "you are on the bench for the big game", "You found out from the team sheet."],
    ["out", "you are left out of the squad entirely", "No reason given."],
    ["swap", "you are taken off at half time", "You thought you were playing well."],
    ["kids", "you are sent to train with the reserves", "For a week."],
    ["rest", "you are rested, the manager says", "You have never felt more rested."],
    ["fit", "you are told you are not fit enough to start", "You feel fitter than ever."],
  ], t => ({
    tease: "Bad news from the manager.",
    title: "Dropped",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["work", "Work harder than ever and force your way back.", { prof: 2, fatigue: 3, rel: { coach: 3 } }],
      ["talk", "Ask the manager what you need to do.", { rel: { coach: 2 }, conf: 1 }],
      ["sulk", "Sulk. You deserve better.", { rel: { coach: -4, team: -1 }, morale: -2 }],
    ], calm: "talk",
  }));
  fam("pundit", "media", "pro", [
    ["lazy", "a TV pundit calls you lazy", "He played thirty years ago."],
    ["praise", "a TV pundit says you are the best young player in the country", "Your agent sends it to everyone."],
    ["hair", "a TV pundit talks only about your haircut", "For five minutes."],
    ["weak", "a TV pundit says your weak foot is useless", "He shows clips."],
    ["future", "a TV pundit says you will play for a top club one day", "Your teammates have started calling you 'top club'."],
    ["wrong", "a TV pundit gets your name wrong", "Every single time."],
    ["mistake", "a TV pundit blames you for the goal", "It was not your man."],
    ["legend", "a TV pundit you idolised as a kid praises you", "He says you play like he did."],
  ], t => ({
    tease: "They are talking about you on TV.",
    title: "On TV",
    text: x => "On TV this week " + t[1] + ". " + t[2],
    choices: [
      ["ignore", "Do not watch. Do not read.", { prof: 1, conf: 1 }],
      ["learn", "Take the useful bit and work on it.", { prof: 1, form: 0.1 }],
      ["reply", "Reply on social media.", { followers: 0.03, national: 1, disc: -1 }],
    ], calm: "ignore",
  }));
  fam("award", "media", "pro", [
    ["month", "you are nominated for player of the month", "Fans vote online."],
    ["goal", "your goal is up for goal of the month", "Against three better known names."],
    ["young", "you are on the shortlist for young player of the year", "The ceremony is in a fancy hotel."],
    ["fans", "the fans' club names you their player of the year", "At a dinner on a Tuesday."],
    ["team", "you are in the team of the week", "Your mum has screenshotted it."],
    ["kids", "a kids' club votes you their favourite player", "They made a trophy out of a jam jar."],
  ], t => ({
    tease: "You have been nominated.",
    title: "A nomination",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["thanks", "Thank everyone and enjoy it.", { morale: 2, local: 2, followers: 0.02 }],
      ["campaign", "Ask your followers to vote for you.", { followers: 0.03, commercial: 1, rel: { team: -1 } }],
      ["team", "Say it belongs to the whole team.", { rel: { team: 3 }, local: 1 }],
    ], calm: "team",
  }));
  fam("autograph", "media", ["pro", "known"], [
    ["shirts", "a man brings fifty shirts for you to sign", "He sells them online."],
    ["kid", "a kid has waited three hours in the rain for your autograph", "His dad is soaked too."],
    ["odd", "a fan asks you to sign their arm", "They want it as a tattoo."],
    ["hospital", "a nurse asks you to sign a card for a sick fan", "He is in the hospital across the road."],
    ["rude", "a fan pushes in front of the kids for an autograph", "He is very rude about it."],
    ["photo", "a fan wants a photo for their gran", "Gran is on video call."],
  ], t => ({
    tease: "Can I get an autograph?",
    title: "Autographs",
    text: x => "After training " + t[1] + ". " + t[2],
    choices: [
      ["all", "Sign for everyone, however long it takes.", { local: 3, morale: 1, fatigue: 2 }],
      ["kids", "Kids first, then the rest.", { local: 2 }],
      ["no", "Not today.", { local: -2 }],
    ], calm: "kids",
  }));
  fam("training", "team", "pro", [
    ["fight", "a training game gets heated and you get kicked", "On purpose, you think."],
    ["extra", "you stay after training for extra finishing", "The manager notices."],
    ["drill", "a new drill makes everyone look stupid", "Including you."],
    ["test", "there is a fitness test on Monday", "The famous beep test."],
    ["boot", "your new boots are giving you blisters", "Big ones."],
    ["rain", "training is in a storm", "The manager does not care."],
    ["record", "you break the club's sprint record in training", "The old record holder is watching."],
    ["camera", "a TV crew films training for a documentary", "The manager swears a lot."],
  ], t => ({
    tease: "Training.",
    title: "At training",
    text: x => "At " + x.ground + " " + t[1] + ". " + t[2],
    choices: [
      ["focus", "Focus and do it properly.", { prof: 1, form: 0.1, fatigue: 2 }],
      ["fun", "Keep it fun.", { rel: { team: 2 }, morale: 1 }],
      ["hard", "Go extra hard.", { conf: 1, fatigue: 4, injuryRisk: 0.03 }],
    ], calm: "focus",
  }));
  fam("documentary", "media", "pro", [
    ["home", "a documentary crew wants to film at your home", "For a whole week."],
    ["family", "a documentary crew wants to interview your parents", "Your dad has bought a new shirt."],
    ["day", "a documentary crew wants to follow you for a day", "From six in the morning."],
    ["dressing", "a documentary crew is in the dressing room", "At half time."],
    ["old", "a documentary crew wants to film at your old school", "Your old teachers are excited."],
  ], t => ({
    tease: "Cameras.",
    title: "A documentary",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["yes", "Say yes and be yourself.", { commercial: 2, followers: 0.04, fatigue: 2 }],
      ["limits", "Say yes, with limits.", { commercial: 1, followers: 0.02 }],
      ["no", "Say no. Keep your life private.", { prof: 1 }],
    ], calm: "limits",
  }));

  // =====================================================================================================
  // GROWN UP LIFE (eighteen and over)
  // =====================================================================================================
  fam("nightout", "friend", "adult", [
    ["birthday", "a teammate's birthday at " + "a club in town", "Two days before a game."],
    ["win", "the lads want to celebrate a big win", "Tonight."],
    ["friends", "old friends are in town and want a big night", "They have plans. Many plans."],
    ["vip", "a promoter offers you a free VIP table", "If you post about it."],
    ["karaoke", "the squad is going to karaoke", "The captain has already picked your song."],
    ["dinner", "a long dinner that turns into a night out", "It is already midnight."],
    ["casino", "someone suggests the casino", "Just for a look."],
    ["rooftop", "a rooftop party with the city's famous people", "You know nobody."],
  ], t => ({
    tease: "Plans for tonight.",
    title: "A night out",
    text: x => "This week it is " + t[1] + ". " + t[2],
    choices: [
      ["go", "Go and enjoy it.", { rel: { team: 3, friend: 2 }, morale: 3, fatigue: 6, disc: -1 }],
      ["early", "Go, but leave early.", { rel: { team: 2 }, morale: 1, fatigue: 2 }],
      ["home", "Stay home and rest.", { prof: 1, fatigue: -2, rel: { team: -1 } }],
    ], calm: "early",
  }));
  fam("drive", "life", ["adult", "car"], [
    ["ticket", "you get a parking ticket outside {gym}", "You were in there ten minutes."],
    ["speed", "a speed camera flashes you", "You did not see the sign."],
    ["dent", "someone dents your car in a car park", "No note."],
    ["fan", "a fan chases your car on a scooter", "Waving a shirt."],
    ["breakdown", "your car breaks down on the motorway", "In the rain."],
    ["lift", "a teammate needs a lift to the airport", "At five in the morning."],
    ["race", "a man at the lights revs his engine at you", "He wants to race."],
    ["wash", "a kid offers to wash your car for money", "He is about ten."],
  ], t => ({
    tease: "Something on the road.",
    title: "On the road",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["right", "Do the right, sensible thing.", { prof: 1, local: 1 }],
      ["pay", "Pay to make it go away.", { spend: 1 }],
      ["hot", "Lose your temper.", { disc: -1, morale: -1, local: -1 }],
    ], calm: "right",
  }));
  fam("flat", "life", "adult", [
    ["leak", "the flat upstairs leaks into your kitchen", "The landlord is not answering."],
    ["mould", "black mould appears in the bathroom", "It smells."],
    ["rent", "the landlord puts the rent up", "By a lot."],
    ["mice", "you hear something in the walls at night", "Small feet."],
    ["heat", "the heating breaks", "In the coldest week of the year."],
    ["view", "a building site starts outside your window", "Your view is now a crane."],
    ["move", "you find a nicer place for the same money", "Moving would take a whole week."],
    ["noise", "the people below complain about your footsteps", "You were just walking."],
  ], t => ({
    tease: "Trouble at home.",
    title: "Your flat",
    text: x => "At home, " + t[1] + ". " + t[2],
    choices: [
      ["fix", "Fix it yourself and pay for it.", { spend: 1, morale: 1 }],
      ["push", "Push the landlord to sort it.", { conf: 1, fatigue: 1 }],
      ["live", "Live with it.", { morale: -2, fatigue: 2 }],
    ], calm: "push",
  }));
  fam("splurge", "life", "adult", [
    ["watch", "you see a watch you love in a window at " + "the mall", "It costs two months' wages."],
    ["trainers", "a limited pair of trainers drops online", "Only five hundred pairs in the world."],
    ["jacket", "a teammate shows off a designer jacket", "You want one."],
    ["tech", "a new phone and laptop come out the same week", "Yours work fine."],
    ["art", "a gallery has a painting you cannot stop looking at", "It is very expensive."],
    ["sale", "there is a huge sale at your favourite shop", "Everything is half price."],
    ["gift", "you want to buy your mum something big", "She always says she needs nothing."],
  ], t => ({
    tease: "Something shiny.",
    title: "Want it",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["buy", "Buy it. You earned it.", { spend: 2, morale: 2, commercial: 1 }],
      ["wait", "Wait a week and see if you still want it.", { prof: 1 }],
      ["save", "Save the money instead.", { morale: -1, rel: { dad: 2 } }],
    ], calm: "wait",
  }));
  fam("concert", "friend", "adult", [
    ["star", "a world famous singer plays " + "the city", "Tickets sold out in minutes. You have two."],
    ["band", "your favourite band from when you were a kid plays a small venue", "It is on a Friday."],
    ["festival", "a three day music festival is happening", "In a field, with camping."],
    ["backstage", "a singer who supports your club invites you backstage", "He wants a photo with you."],
    ["opera", "a sponsor invites you to the opera", "Four hours long."],
    ["dj", "a famous DJ wants you on stage at his show", "At midnight."],
  ], t => ({
    tease: "Music.",
    title: "A concert",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["go", "Go and have a great night.", { morale: 3, fatigue: 4, followers: 0.01 }],
      ["take", "Take someone who would love it more than you.", { rel: { mum: 2, friend: 3 }, morale: 2, fatigue: 2 }],
      ["skip", "Skip it. Rest first.", { prof: 1 }],
    ], calm: "take",
  }));
  fam("holiday", "family", "adult", [
    ["beach", "the lads plan a beach trip for the break", "Ten days, no rules."],
    ["family", "your family wants a holiday together", "Somewhere quiet, Mum says."],
    ["solo", "you think about a trip on your own", "Somewhere nobody knows you."],
    ["camp", "a famous trainer offers a summer fitness camp", "In the mountains, very hard."],
    ["home", "you could just go home for the break", "Your old bedroom is still there."],
    ["charity", "a charity asks you to visit their projects abroad", "For a week of the break."],
  ], t => ({
    tease: "The break is coming.",
    title: "Plans for the break",
    text: x => "With a break coming, " + t[1] + ". " + t[2],
    choices: [
      ["rest", "Choose the one that rests you most.", { fatigue: -5, morale: 2 }],
      ["fit", "Choose the one that keeps you fittest.", { prof: 2, fatigue: 2, form: 0.1 }],
      ["fun", "Choose the most fun.", { morale: 4, spend: 1, fatigue: 2 }],
    ], calm: "rest",
  }));
  fam("partner", "partner", "partner", [
    ["anniv", "it is your anniversary this week", "You had a game booked for that night."],
    ["parents", "she wants you to meet her parents", "Her dad does not like football."],
    ["argue", "you had an argument about how little you see each other", "She is not wrong."],
    ["trip", "she has planned a surprise weekend away", "On a weekend you have a game."],
    ["job", "she has been offered a job in another city", "It is her dream job."],
    ["pet", "she wants to get a dog together", "A big one."],
    ["friends", "her friends do not like how famous you are getting", "They say it is changing you."],
    ["cook", "she wants to cook you a special dinner", "You are on a strict diet this week."],
  ], t => ({
    who: "pt",
    tease: x => x.who + ".",
    title: x => "You and " + x.who,
    text: x => "With " + x.who + ": " + t[1] + ". " + t[2],
    choices: [
      ["her", "Put her first this time.", { rel: { pt: 8 }, morale: 2, fatigue: 2 }],
      ["talk", "Talk it through honestly.", { rel: { pt: 4 }, conf: 1 }],
      ["football", "Football first. She knew that.", { rel: { pt: -7 }, prof: 1 }],
    ], calm: "talk",
  }));

  // =====================================================================================================
  // A NAME PEOPLE KNOW
  // =====================================================================================================
  fam("fame", "media", "known", [
    ["mural", "a street artist paints a huge mural of you in " + "your home town", "Your nose is enormous."],
    ["baby", "a fan names their baby after you", "They send you a photo."],
    ["tattoo", "a fan gets a tattoo of your face", "It is not a good likeness."],
    ["song", "a local band writes a song about you", "It is quite catchy."],
    ["school", "your old school renames its pitch after you", "They want you at the opening."],
    ["meal", "a restaurant names a dish after you", "It is very spicy."],
    ["kid", "a dying kid's last wish is to meet you", "His family wrote to the club."],
    ["lookalike", "a lookalike is making money pretending to be you", "At birthday parties."],
  ], t => ({
    tease: "Being known.",
    title: "Famous",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["warm", "Be warm about it and say thank you.", { local: 3, followers: 0.02, morale: 2 }],
      ["visit", "Go in person.", { local: 4, morale: 3, fatigue: 2, time: 1 }],
      ["private", "Keep it private.", { prof: 1 }],
    ], calm: "warm",
  }));
  fam("paparazzi", "media", ["known", "adult"], [
    ["dinner", "photographers catch you at dinner with friends", "The headline says 'party boy'."],
    ["gym", "photographers wait outside " + "the gym", "Every morning."],
    ["beach", "photographers catch you on a beach on your day off", "You were eating ice cream."],
    ["family", "photographers follow your family to the shops", "Your mum is upset."],
    ["date", "photographers say you are dating someone you have never met", "She says the same."],
    ["fall", "photographers catch you tripping over a kerb", "Front page."],
  ], t => ({
    tease: "Cameras everywhere.",
    title: "The photographers",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["smile", "Smile and get on with your life.", { commercial: 1, conf: 1 }],
      ["lawyer", "Get the club's lawyers to warn them off.", { spend: 1, rel: { mum: 2 } }],
      ["hide", "Stay home more.", { morale: -2, fatigue: -1 }],
    ], calm: "smile",
  }));
  fam("requests", "media", "known", [
    ["wedding", "a stranger asks you to come to their wedding", "They say it would make their day."],
    ["video", "a fan asks for a birthday video for her son", "He is seven and loves you."],
    ["shirt", "a school asks for a signed shirt for their raffle", "They want to fix their roof."],
    ["visit", "a nursing home asks if you could visit", "The residents watch every game."],
    ["talk", "a youth prison asks you to talk to the boys", "Some of them used to play."],
    ["advert", "a local shop wants you in their advert for free", "They say it will save the shop."],
    ["letter", "a sick fan writes you a long letter", "Handwritten, ten pages."],
  ], t => ({
    tease: "Someone asked for you.",
    title: "A request",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["yes", "Say yes.", { local: 3, morale: 2, fatigue: 2, time: 1 }],
      ["small", "Do something small for them.", { local: 1, morale: 1 }],
      ["no", "Politely say no. You cannot do everything.", { prof: 1 }],
    ], calm: "small",
  }));

  // =====================================================================================================
  // MONEY IN THE BANK
  // =====================================================================================================
  fam("invest", "agent", "rich", [
    ["bar", "a friend wants you to invest in a bar", "Your name would be on the sign."],
    ["app", "two young men pitch you an app", "It is like a dating app, but for dogs."],
    ["house", "an agent offers you a house to rent out", "In a town you have never been to."],
    ["coin", "a teammate swears by a new online coin", "It doubled last week."],
    ["shop", "your family wants to open a shop with your money", "Your uncle would run it."],
    ["academy", "a coach wants you to fund a football school for poor kids", "He has the land."],
    ["boots", "a small boot maker wants you as a partner", "Their boots are actually very good."],
  ], t => ({
    tease: "An investment pitch.",
    title: "A business idea",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["advice", "Ask a proper adviser first.", { prof: 1, rel: { agent: 2 } }],
      ["in", "Put money in.", { spend: 2, commercial: 1, morale: 1 }],
      ["no", "Say no thanks.", { prof: 1 }],
    ], calm: "advice",
  }));
  fam("gala", "media", ["rich", "adult"], [
    ["charity", "a charity gala wants you to bid in their auction", "The lots start very high."],
    ["award", "a business award dinner invites you", "Black tie."],
    ["fashion", "a fashion week show sends you front row tickets", "On a Tuesday."],
    ["yacht", "a businessman invites you to a party on his yacht", "Nobody knows what his business is."],
    ["polo", "a sponsor invites you to a polo match", "You do not know the rules."],
    ["premiere", "a film premiere invites you to the red carpet", "You have not seen the film."],
  ], t => ({
    tease: "An invite to somewhere fancy.",
    title: "A fancy invite",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["go", "Go and enjoy it.", { commercial: 2, followers: 0.02, fatigue: 3, spend: 1 }],
      ["give", "Do not go, but give to the good cause.", { spend: 1, local: 2 }],
      ["skip", "Skip it.", { prof: 1 }],
    ], calm: "skip",
  }));
  fam("family_money", "family", "rich", [
    ["house", "your parents want a bigger house", "They hint at it every call."],
    ["car", "your cousin wants you to buy him a car", "For his job, he says."],
    ["debt", "you find out your dad has debts", "He is ashamed."],
    ["wedding", "your sibling's wedding is coming", "The family assumes you will pay."],
    ["school", "a young cousin needs fees for a good school", "His parents cannot afford it."],
    ["hospital", "a relative needs an expensive operation", "There is a waiting list without money."],
  ], t => ({
    tease: "The family and money.",
    title: "Family and money",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["help", "Help them. It is family.", { spend: 2, rel: { mum: 5, dad: 5 }, morale: 2 }],
      ["part", "Help with part of it.", { spend: 1, rel: { mum: 2, dad: 2 } }],
      ["no", "Say no, kindly.", { rel: { mum: -3, dad: -3 }, prof: 1 }],
    ], calm: "part",
  }));

  // =====================================================================================================
  // INJURED
  // =====================================================================================================
  fam("rehab", "team", "hurt", [
    ["bored", "rehab is boring", "The same exercises, every day, for weeks."],
    ["cure", "someone online swears by a miracle cure for injuries", "It costs a lot and is not allowed by the club."],
    ["early", "you feel ready to play again", "The physio says two more weeks."],
    ["sad", "you feel left out watching the team play", "Nobody calls much."],
    ["cards", "fans send hundreds of get well cards", "The kit room is full of them."],
    ["crutches", "life on crutches is hard", "You cannot carry a cup of tea."],
    ["food", "you are putting on weight while injured", "You eat when you are bored."],
  ], t => ({
    tease: "The injury.",
    title: "Injured",
    text: x => "With the injury, " + t[1] + ". " + t[2],
    choices: [
      ["patient", "Be patient. Do exactly what the physio says.", { prof: 2, fatigue: -3, morale: -1 }],
      ["mind", "Work on your mind: watch games, study, read.", { conf: 1, morale: 1 }],
      ["rush", "Push to come back early.", { conf: 1, injuryRisk: 0.08, rel: { coach: 1 } }],
    ], calm: "patient",
  }));

  // =====================================================================================================
  // THE CITY AND THE COMMUNITY
  // =====================================================================================================
  fam("street", "life", "any", [
    ["kids", "kids playing football in the street ask you to join in", "Jumpers for goalposts."],
    ["cage", "a game in a cage pitch by the flats needs one more player", "They have no idea who you are."],
    ["challenge", "a group of teenagers challenge you to a crossbar challenge", "Loser buys drinks."],
    ["park", "a dad and his son are practising in the park", "The son keeps missing the ball."],
    ["beach", "a beach football game is happening on your walk", "Barefoot, in the sand."],
    ["rooftop", "a rooftop five a side court has a game going", "City lights all around."],
    ["old", "a group of old men play every Sunday in the park", "They are very serious about it."],
    ["girls", "a girls' team is training in the park with no coach", "They ask if you can show them something."],
  ], t => ({
    tease: "A ball in the street.",
    title: "Street football",
    text: x => "Out in " + x.city + ", " + t[1] + ". " + t[2],
    choices: [
      ["play", "Play. This is why you love it.", { morale: 3, local: 2, fatigue: 2, injuryRisk: 0.02 }],
      ["coach", "Show them a trick or two, then go.", { local: 2, morale: 2, lead: 1 }],
      ["walk", "Smile and keep walking.", { prof: 1 }],
    ], calm: "coach",
  }));
  fam("pitch", "life", "any", [
    ["closing", "the park pitch where you learned to play is being closed", "For flats."],
    ["broken", "the goals at the local park are broken", "The kids use bins."],
    ["lights", "the floodlights at the local club have failed", "No money to fix them."],
    ["club", "your first ever club is about to fold", "They owe money to everyone."],
    ["new", "a new pitch is opening in a poor part of {city}", "They want a famous face."],
    ["girls", "the girls' league has no pitches to play on", "They share with the car boot sale."],
  ], t => ({
    tease: "The grass roots.",
    title: "Grass roots football",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["fight", "Speak up and fight for it.", { local: 3, lead: 1, followers: 0.02, time: 1 }],
      ["money", "Put some money in.", { spend: 2, local: 3, morale: 2 }],
      ["share", "Share it online.", { followers: 0.01, local: 1 }],
    ], calm: "share",
  }));
  fam("civic", "media", "known", [
    ["politician", "a politician wants a photo with you before an election", "He did not ask what you think."],
    ["protest", "a protest in the city wants your support", "Your club says stay out of politics."],
    ["blood", "a hospital asks you to front a blood donation drive", "You hate needles."],
    ["tree", "a school asks you to plant a tree with the kids", "In the rain."],
    ["library", "the city library asks you to read to kids", "A book about a dragon."],
    ["vote", "an advert wants you to remind young people to vote", "No party, just vote."],
    ["clean", "a beach clean up wants you to come", "Starting at six in the morning."],
  ], t => ({
    tease: "The city asks for you.",
    title: "For the city",
    text: x => "In " + x.city + " " + t[1] + ". " + t[2],
    choices: [
      ["yes", "Say yes if it is for everyone.", { local: 3, morale: 1, fatigue: 1 }],
      ["club", "Check with the club first.", { prof: 1, rel: { coach: 1 } }],
      ["no", "Stay out of it.", { prof: 1 }],
    ], calm: "club",
  }));
  fam("market", "life", "any", [
    ["queue", "the queue at {market} is huge", "Everyone is staring at you."],
    ["voucher", "you win a year's free shopping at {market}", "In a draw you forgot you entered."],
    ["drop", "you drop a bottle of oil all over the floor in a shop", "It goes everywhere."],
    ["fan", "the cashier asks for a selfie", "There are people waiting."],
    ["fruit", "an old man at the market gives you free fruit every week", "He says it is for strength."],
    ["thief", "you see a kid stealing food from a shop", "He looks hungry."],
    ["sample", "a woman giving out samples gives you ten", "You are on a diet."],
  ], t => ({
    tease: "At the shops.",
    title: "At the shops",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["kind", "Be kind and patient about it.", { local: 2, morale: 1 }],
      ["help", "Help out, whatever it costs you.", { local: 2, spend: 1, morale: 2 }],
      ["quick", "Get in and out fast.", { prof: 1 }],
    ], calm: "kind",
  }));
  fam("lucky", "life", "any", [
    ["ticket", "you buy a lottery ticket for a laugh", "You win a small prize."],
    ["coin", "you find a rare old coin in your change", "A collector would pay well for it."],
    ["upgrade", "a hotel gives you a free upgrade by mistake", "It is the best suite."],
    ["raffle", "you win the raffle at a charity night", "It is a fridge."],
    ["bet", "a teammate bet you could not hit the crossbar ten times", "You did it eleven times."],
    ["seat", "you are picked out of the crowd at a concert", "To go on stage."],
    ["birthday", "you share a birthday with a famous player", "He sends you a message."],
  ], t => ({
    tease: "A lucky week.",
    title: "Lucky",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["share", "Share the luck with others.", { morale: 2, local: 2 }],
      ["enjoy", "Enjoy it yourself.", { morale: 3, earn: 1 }],
      ["humble", "Shrug. Luck comes and goes.", { prof: 1 }],
    ], calm: "share",
  }));
  fam("strange", "life", "any", [
    ["parcel", "a parcel arrives for you with no name on it", "It is full of socks."],
    ["letter", "an old letter arrives that you wrote to yourself at age ten", "It says 'be a footballer'."],
    ["twin", "a man who looks exactly like you lives in your street", "People keep confusing you."],
    ["dream", "you dream you scored a hat trick, then you score in training", "Three in a row."],
    ["bird", "a parrot at the cafe says your name", "Clearly."],
    ["coincidence", "you meet someone born on the same day in the same hospital", "In a lift in another country."],
    ["phone", "you get a wrong number call from someone with your name", "He is also a footballer, in a lower league."],
  ], t => ({
    tease: "A strange week.",
    title: "Strange things",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["laugh", "Laugh about it.", { morale: 2 }],
      ["post", "Tell the world about it.", { followers: 0.02, morale: 1 }],
      ["think", "Take it as a sign.", { conf: 1 }],
    ], calm: "laugh",
  }));
  fam("delivery", "life", "any", [
    ["wrong", "a delivery driver brings you someone else's dinner", "It looks better than yours."],
    ["late", "your food delivery is two hours late", "You are starving."],
    ["fan", "the delivery rider is a big fan", "He wants to chat for half an hour."],
    ["broken", "your new boots arrive in a soaked box", "The left one is missing."],
    ["huge", "you ordered one chair and got twenty", "They are in the hallway."],
    ["gift", "a mystery gift arrives from a fan abroad", "Homemade cake that took two weeks to arrive."],
  ], t => ({
    tease: "A delivery.",
    title: "A delivery",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["kind", "Be kind to the driver.", { morale: 1, local: 1 }],
      ["sort", "Sort it out properly.", { prof: 1 }],
      ["moan", "Complain online.", { followers: 0.01, local: -1 }],
    ], calm: "kind",
  }));
  fam("study", "life", "any", [
    ["course", "a club offers an online course in coaching", "It takes three evenings a week."],
    ["uni", "a university offers you a place to study part time", "Sport science."],
    ["money", "a teammate starts teaching you about saving money", "With spreadsheets."],
    ["language", "the club offers language lessons", "For the players moving abroad one day."],
    ["cook", "the club chef offers cooking lessons", "Healthy food that tastes nice, he says."],
    ["drive", "you could start driving lessons", "Your instructor is very nervous."],
  ], t => ({
    tease: "A chance to learn.",
    title: "Learning something",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["yes", "Sign up.", { prof: 1, conf: 1, time: 1, morale: 1 }],
      ["later", "Maybe next season.", { morale: -1 }],
      ["no", "No, football is enough.", { prof: 1 }],
    ], calm: "yes",
  }));

  // =====================================================================================================
  // MATCHDAY, RITUALS AND THE COUNTRY
  // =====================================================================================================
  fam("ritual", "team", "any", [
    ["socks", "you lose the lucky socks you have worn every game", "The kit man says they are gone."],
    ["song", "the song you listen to before every game is banned from the dressing room", "The new captain hates it."],
    ["food", "the cafe that makes your pre match meal has closed", "For good."],
    ["seat", "someone has taken your seat on the team bus", "You have sat there for a year."],
    ["boots", "your old boots finally split", "You have scored in them every week."],
    ["number", "your shirt number is changed", "For a sponsor reason."],
    ["routine", "the club changes the matchday routine", "Earlier wake up, new warm up, no music."],
  ], t => ({
    tease: "Your routine is broken.",
    title: "A broken ritual",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["new", "Make a new ritual.", { conf: 1, morale: 1 }],
      ["none", "Play without it. Rituals are just habits.", { conf: 2, prof: 1 }],
      ["panic", "Let it get to you.", { conf: -2, form: -0.2 }],
    ], calm: "new",
  }));
  fam("matchday", "team", "any", [
    ["tunnel", "an opponent says something nasty in the tunnel", "About your family."],
    ["mascot", "your match mascot is a nervous little girl", "She will not let go of your hand."],
    ["crowd", "the crowd is the biggest you have ever played in front of", "You can hear your heart."],
    ["rain", "the pitch is waterlogged and the game might be off", "Everyone waits in the dressing room."],
    ["family", "your whole family is in the stand for the first time", "With a banner."],
    ["kit", "your shirt rips in the warm up", "There is no spare with your name."],
    ["nerves", "you feel sick with nerves before kick off", "It has never happened before."],
    ["captain", "the captain gives a speech that makes the room go quiet", "He looks at you at the end."],
  ], t => ({
    tease: "Matchday.",
    title: "Matchday moment",
    text: x => "On matchday, " + t[1] + ". " + t[2],
    choices: [
      ["calm", "Breathe. Stay calm. Play your game.", { conf: 1, form: 0.1 }],
      ["fire", "Let it fire you up.", { conf: 2, disc: -1, form: 0.1 }],
      ["shaken", "It shakes you a bit.", { conf: -1, form: -0.1 }],
    ], calm: "calm",
  }));
  fam("country", "media", ["pro", "known"], [
    ["anthem", "the national anthem is played before a big game", "You do not know all the words."],
    ["call", "there are rumours of a national team call up", "Your phone has not rung yet."],
    ["shirt", "a national team shirt with your name is in the shop window", "Your dad buys three."],
    ["coach", "the national coach says you are close to a call", "In a TV interview."],
    ["other", "another country asks if you would play for them", "Through your grandparents."],
    ["kids", "kids in your home town wear your country shirt with your name", "Homemade, on the back."],
  ], t => ({
    tease: "Your country.",
    title: "For your country",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["proud", "Say how proud it would make you.", { national: 2, morale: 2 }],
      ["focus", "Say your club comes first right now.", { local: 2, prof: 1 }],
      ["quiet", "Say nothing.", { prof: 1 }],
    ], calm: "focus",
  }));

  // =====================================================================================================
  // THE MIND
  // =====================================================================================================
  fam("mind", "life", "any", [
    ["doubt", "you start doubting yourself", "Every pass feels like it will go wrong."],
    ["pressure", "the pressure of expectations feels heavy", "Everyone wants something from you."],
    ["flat", "you feel flat and cannot say why", "Even good news feels grey."],
    ["anger", "you snap at people over small things", "Your friends have noticed."],
    ["worry", "you worry about what happens if football ends", "At night, mostly."],
    ["compare", "you keep comparing yourself to players your age", "They seem further ahead."],
    ["joy", "football feels fun again", "Like when you were small."],
    ["calm", "you find a calm you have not felt in months", "You are not sure why."],
  ], t => ({
    tease: "Your head.",
    title: "In your head",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["talk", "Talk to someone you trust about it.", { morale: 2, conf: 1, rel: { mum: 2 } }],
      ["help", "Ask the club for proper help.", { morale: 2, prof: 1, rel: { coach: 1 } }],
      ["alone", "Keep it to yourself.", { morale: -2 }],
    ], calm: "talk",
  }));
  fam("social", "media", "any", [
    ["break", "you think about deleting all your social media", "For a month."],
    ["viral", "a training clip of yours goes viral", "People are copying your skill."],
    ["dm", "a famous player sends you a message", "He says keep going."],
    ["hate", "hateful messages fill your inbox after a game", "Some are about your family."],
    ["trend", "a dance trend wants you to join in", "Every player is doing it."],
    ["live", "your followers want a live chat with you", "Questions from anyone."],
  ], t => ({
    tease: "Your social media.",
    title: "Social media",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["engage", "Engage, but wisely.", { followers: 0.03, commercial: 1 }],
      ["club", "Let the club's team handle it.", { prof: 1 }],
      ["off", "Log off for a while.", { morale: 1, followers: -0.01 }],
    ], calm: "club",
  }));

  // =====================================================================================================
  // HOME AND THE HOUSE
  // =====================================================================================================
  fam("house", "life", "any", [
    ["boiler", "the boiler breaks", "Cold showers until someone can come."],
    ["leak", "water starts dripping through the ceiling", "Right above your bed."],
    ["mouse", "there is a mouse in the kitchen", "It is eating your protein bars."],
    ["power", "the power goes off for a whole evening", "Your phone is on two percent."],
    ["noise", "the people upstairs are building something every night", "Until midnight."],
    ["key", "you lock yourself out", "In your training kit, in the rain."],
    ["washing", "the washing machine floods the floor", "Your kit for tomorrow is inside."],
    ["wifi", "the internet at home goes down for a week", "The company keeps cancelling."],
  ], t => ({
    tease: "Trouble at home.",
    title: "Trouble at home",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["fix", "Pay someone to fix it right away.", { spend: 1, morale: 1 }],
      ["diy", "Try to fix it yourself.", { morale: 1, fatigue: 1, conf: 1 }],
      ["wait", "Put up with it for now.", { morale: -1 }],
    ], calm: "fix",
  }));
  fam("move", "life", "adult", [
    ["boxes", "you help a teammate move house", "His sofa does not fit through the door."],
    ["view", "a flat with a view of the stadium comes up for rent", "It costs a lot more."],
    ["mum", "your mum thinks you should move back home for a while", "To save money and eat properly."],
    ["share", "a teammate asks you to share a flat", "He is very messy."],
    ["quiet", "a quiet house out of town is for rent", "A long drive to training."],
    ["landlord", "your landlord says he is selling the flat", "You have two months to find somewhere."],
  ], t => ({
    tease: "A move.",
    title: "Where you live",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["yes", "Go for it.", { morale: 2, spend: 1, time: 1 }],
      ["think", "Think it over with your family.", { rel: { mum: 1, dad: 1 } }],
      ["stay", "Stay as you are.", { prof: 1 }],
    ], calm: "think",
  }));
  fam("chores", "life", "any", [
    ["dishes", "the dishes have piled up for a week", "Something is growing in a mug."],
    ["laundry", "you run out of clean clothes", "You go to training in your dad's shirt."],
    ["cook", "you try to cook a proper meal for once", "The smoke alarm goes off."],
    ["clean", "your room is so messy you lose your boots in it", "On a match day."],
    ["plants", "every plant you own has died", "Even the cactus."],
    ["bins", "you forget bin day three weeks running", "The neighbours have noticed."],
  ], t => ({
    tease: "Chores.",
    title: "Chores",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["sort", "Spend a day sorting your life out.", { prof: 1, disc: 1, morale: 1 }],
      ["pay", "Pay someone to help.", { spend: 1, morale: 1 }],
      ["ignore", "It can wait.", { disc: -1 }],
    ], calm: "sort",
  }));

  // =====================================================================================================
  // FOOD AND THE BODY
  // =====================================================================================================
  fam("diet", "team", "any", [
    ["chef", "the club chef says you eat too much sugar", "He has seen your lunch."],
    ["scale", "the weekly weigh in says you are two kilos up", "The fitness coach is not happy."],
    ["vegan", "a teammate tries to get you to go vegan", "He says it changed his life."],
    ["cheat", "your friends want a big takeaway night", "On a Thursday before a game."],
    ["water", "the club says you are not drinking enough water", "They give you a big bottle with lines on."],
    ["snack", "you are caught with sweets in your bag", "By the fitness coach."],
    ["meal", "the club gives you a meal plan", "Broccoli with everything."],
    ["coffee", "you are drinking five coffees a day", "You cannot sleep."],
  ], t => ({
    tease: "What you eat.",
    title: "What you eat",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["follow", "Follow the advice properly.", { prof: 2, form: 0.1, morale: -1 }],
      ["half", "Try to be a bit better.", { prof: 1 }],
      ["ignore", "Eat what you like.", { morale: 2, prof: -1, fatigue: 1 }],
    ], calm: "half",
  }));
  fam("ill", "life", "any", [
    ["cold", "you catch a bad cold", "Your nose will not stop."],
    ["tooth", "you get a terrible toothache", "The dentist has a two week wait."],
    ["stomach", "something you ate does not agree with you", "You spend the night in the bathroom."],
    ["eyes", "an eye test says you need glasses for reading", "Your teammates have opinions."],
    ["allergy", "hay fever hits you hard", "Training on fresh cut grass is torture."],
    ["back", "you wake up with a stiff back", "From a bad pillow."],
    ["hiccups", "you get hiccups that last all day", "Even in training."],
    ["flu", "flu goes round the dressing room", "Half the squad is off."],
  ], t => ({
    tease: "Not feeling well.",
    title: "Not feeling well",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["rest", "Rest and get it seen to.", { fatigue: -2, form: -0.1, prof: 1 }],
      ["push", "Push through it.", { fatigue: 3, conf: 1, injuryRisk: 0.02 }],
      ["home", "Go home to your mum to be looked after.", { rel: { mum: 2 }, morale: 2, fatigue: -1 }],
    ], calm: "rest",
  }));
  fam("habit", "life", "any", [
    ["screen", "your phone says you spent nine hours a day on it", "Mostly watching clips of yourself."],
    ["late", "you keep staying up until three", "Watching other leagues."],
    ["read", "a teammate lends you a book", "About a climber who lost his fingers."],
    ["journal", "the club psychologist suggests writing a diary", "Three lines every night."],
    ["breathe", "a yoga teacher comes to training", "Everyone laughs, then everyone sleeps better."],
    ["ice", "a teammate swears by ice baths every morning", "At home, in a wheelie bin."],
    ["walk", "you start walking after dinner", "It clears your head."],
  ], t => ({
    tease: "A new habit.",
    title: "A habit",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["try", "Give it a real go.", { prof: 1, morale: 1, fatigue: -1 }],
      ["laugh", "Laugh it off.", { morale: 1 }],
      ["stop", "Change nothing.", { disc: -1 }],
    ], calm: "try",
  }));

  // =====================================================================================================
  // DAYS IN THE YEAR
  // =====================================================================================================
  fam("dates", "family", "any", [
    ["birthday", "it is your birthday and training is at nine", "Your teammates have a cake ready."],
    ["xmas", "you are playing on Boxing Day", "No Christmas dinner for you."],
    ["newyear", "it is New Year's Eve", "Everyone is going out. You have a game on the second."],
    ["mumday", "it is Mother's Day", "You forgot until this morning."],
    ["dadday", "it is Father's Day", "Your dad says he wants nothing. He means it this time."],
    ["anniv", "it is the anniversary of the day you signed your first form", "Your mum kept the pen."],
    ["festival", "it is a big festival back home", "The whole family is there without you."],
    ["halloween", "it is Halloween and kids come to your door", "You have no sweets, only protein bars."],
  ], t => ({
    tease: "A special day.",
    title: "A special day",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["family", "Make time for family, even for an hour.", { rel: { mum: 2, dad: 2 }, morale: 2, fatigue: 1 }],
      ["small", "A quick call and a gift.", { rel: { mum: 1 }, spend: 1, morale: 1 }],
      ["work", "It is just another day. Football first.", { prof: 1, morale: -1 }],
    ], calm: "small",
  }));
  fam("weatheryear", "life", "any", [
    ["heat", "a heatwave hits", "Training moves to six in the morning."],
    ["snow", "snow closes the whole city", "No training for three days."],
    ["storm", "a storm knocks a tree onto your street", "Nobody can get out."],
    ["fog", "fog is so thick the game is off at half time", "You were winning."],
    ["flood", "floods hit your home town", "Your old school is under water."],
    ["wind", "the wind is so strong the corner flags fly away", "A ball ends up in the car park."],
  ], t => ({
    tease: "Wild weather.",
    title: "Wild weather",
    text: x => "In " + x.city + " this week " + t[1] + ". " + t[2],
    choices: [
      ["help", "Help out where you can.", { local: 3, morale: 1, fatigue: 1 }],
      ["train", "Train at home anyway.", { prof: 2, fatigue: 1 }],
      ["rest", "Enjoy the rest.", { fatigue: -2, morale: 1 }],
    ], calm: "train",
  }));

  // =====================================================================================================
  // FRIENDS AND PLANS
  // =====================================================================================================
  fam("plans", "friend", "any", [
    ["wedding", "an old friend asks you to be at his wedding", "On a match day."],
    ["band", "a friend's band has their first gig", "On the night before a game."],
    ["lift", "a friend needs a lift to the airport", "At four in the morning."],
    ["move", "a friend needs help moving house", "Up five floors, no lift."],
    ["break", "a friend has been dumped and is in bits", "He wants to talk all night."],
    ["job", "a friend lost his job", "He is too proud to ask for help."],
    ["baby", "a friend just had a baby", "He wants you to be the godfather."],
    ["shop", "a friend opens a little shop", "He asks you to come to the opening."],
  ], t => ({
    tease: "A friend needs you.",
    title: "A friend",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["there", "Be there for him.", { rel: { friend: 3 }, morale: 2, fatigue: 1, time: 1 }],
      ["help", "Help in another way.", { rel: { friend: 1 }, spend: 1 }],
      ["no", "Say you cannot this time.", { rel: { friend: -2 }, prof: 1 }],
    ], calm: "help",
  }));
  fam("games", "friend", "any", [
    ["quiz", "your mates enter a pub quiz", "They need someone for the sport round."],
    ["golf", "a teammate takes you to play golf", "You lose six balls on the first hole."],
    ["bowling", "the squad goes bowling", "The captain is very competitive."],
    ["karaoke", "a karaoke night is planned", "You are the first name on the list."],
    ["escape", "your friends book an escape room", "Nobody can read the clues."],
    ["cards", "a card game on the team bus gets serious", "Real money is on the table."],
    ["chess", "a teammate challenges you to chess", "He says he has never lost."],
    ["darts", "a darts night with the lads", "Someone hits the light."],
  ], t => ({
    tease: "A night of games.",
    title: "Games night",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["in", "Join in.", { morale: 2, rel: { team: 2, friend: 1 } }],
      ["win", "Play to win.", { conf: 2, rel: { team: -1 } }],
      ["skip", "Sit this one out.", { fatigue: -1 }],
    ], calm: "in",
  }));

  // =====================================================================================================
  // SCHOOL DAYS
  // =====================================================================================================
  fam("schoollife", "life", "school", [
    ["play", "you are cast in the school play", "As a tree. With a line."],
    ["sports", "it is sports day", "You are expected to win everything."],
    ["detention", "you get a detention for talking", "It clashes with training."],
    ["disco", "it is the school disco", "Everyone says you have to dance."],
    ["homework", "you forget your homework three times this week", "The teacher calls your mum."],
    ["new", "a new kid joins the class", "Nobody sits with him."],
    ["bully", "an older kid keeps picking on someone in your year", "Everyone looks away."],
    ["prize", "you are up for a prize at school", "For effort, not football."],
  ], t => ({
    tease: "At school.",
    title: "School days",
    text: x => "At school this week " + t[1] + ". " + t[2],
    choices: [
      ["right", "Do the right thing.", { prof: 1, lead: 1, morale: 1 }],
      ["fun", "Have fun with it.", { morale: 2, rel: { friend: 1 } }],
      ["foot", "Football comes first.", { prof: 1, rel: { mum: -1 } }],
    ], calm: "right",
  }));
  fam("schoolfoot", "team", "school", [
    ["final", "the school team is in a cup final", "In front of the whole school."],
    ["kit", "the school team has no money for kit", "They play in old shirts."],
    ["pe", "the PE teacher wants you to play in goal", "To teach you something."],
    ["older", "you are asked to play for the year above", "They are a lot bigger."],
    ["girls", "a girl in your class is the best player in the school", "The boys will not pass to her."],
    ["scout", "a scout is at the school game", "Nobody knows who he has come to see."],
  ], t => ({
    tease: "School football.",
    title: "School football",
    text: x => "At " + x.team + " this week " + t[1] + ". " + t[2],
    choices: [
      ["team", "Play for the team, not yourself.", { lead: 1, rel: { team: 2 }, morale: 1 }],
      ["show", "Show what you can do.", { conf: 2, local: 1 }],
      ["easy", "Take it easy.", { fatigue: -1 }],
    ], calm: "team",
  }));

  // =====================================================================================================
  // ACADEMY AND YOUTH FOOTBALL
  // =====================================================================================================
  fam("youthlife", "team", "academy", [
    ["prank", "someone puts cling film over your bed", "The whole corridor heard you."],
    ["kit", "it is your week to wash the first team's kit", "Mud everywhere."],
    ["loan", "there is talk of sending you on loan", "To a club in a small town far away."],
    ["coach", "the youth coach leaves for another club", "He was the one who signed you."],
    ["first", "you are asked to train with the first team for a day", "Nobody tells you why."],
    ["boots", "a boot company sends free boots to the best youth player", "They sent them to your teammate."],
    ["video", "the coach shows the whole group a clip of your mistake", "Over and over."],
    ["tournament", "the academy is going to a tournament abroad", "Only fourteen can go."],
  ], t => ({
    tease: "Life at the academy.",
    title: "Academy life",
    text: x => "At " + x.team + " this week " + t[1] + ". " + t[2],
    choices: [
      ["work", "Keep your head down and work.", { prof: 2, form: 0.1 }],
      ["speak", "Speak up for yourself.", { conf: 2, rel: { coach: -1 } }],
      ["laugh", "Laugh it off with the lads.", { rel: { team: 2 }, morale: 1 }],
    ], calm: "work",
  }));
  fam("parent", "family", "youth", [
    ["shout", "your dad shouts at the referee from the sideline", "Everyone turns round."],
    ["coach", "your mum tells the coach how to pick the team", "In the car park."],
    ["drive", "your dad has driven you to every game for years", "His car is falling apart."],
    ["money", "your parents are paying a lot for your football", "You heard them talking about it."],
    ["proud", "your mum tells the whole street about your goal", "Twice."],
    ["miss", "your dad misses your big game for work", "He has never missed one before."],
  ], t => ({
    tease: "Your parents.",
    title: "Your parents",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["talk", "Talk to them kindly about it.", { rel: { mum: 2, dad: 2 }, morale: 1 }],
      ["thank", "Thank them for everything.", { rel: { mum: 3, dad: 3 }, morale: 2 }],
      ["leave", "Say nothing.", { morale: -1 }],
    ], calm: "thank",
  }));

  // =====================================================================================================
  // PRO LIFE, ON THE ROAD
  // =====================================================================================================
  fam("away", "team", "pro", [
    ["bus", "the team bus breaks down on the motorway", "You wait three hours on the hard shoulder."],
    ["fans", "away fans throw coins at you taking a corner", "One hits you."],
    ["food", "the hotel food makes half the squad sick", "The day before the game."],
    ["room", "you share a room with a teammate who snores", "Like a chainsaw."],
    ["flight", "the flight home is delayed until morning", "You sleep on the airport floor."],
    ["alarm", "the hotel fire alarm goes off at three in the morning", "Somebody's prank."],
    ["kit", "the kit van goes to the wrong ground", "You warm up in borrowed shirts."],
    ["pitch", "the away pitch is a muddy mess", "It is more like a farm."],
  ], t => ({
    tease: "On the road.",
    title: "Away days",
    text: x => "On the road with " + x.team + ", " + t[1] + ". " + t[2],
    choices: [
      ["lead", "Keep the mood up.", { lead: 2, rel: { team: 2 }, morale: 1 }],
      ["focus", "Stay focused on the game.", { prof: 1, conf: 1 }],
      ["moan", "Moan with everyone else.", { morale: -1, rel: { team: 1 } }],
    ], calm: "focus",
  }));
  fam("tour", "team", "pro", [
    ["asia", "the club goes on a pre season tour far away", "Twelve hour flights and big crowds."],
    ["camp", "pre season camp is in the mountains", "Three sessions a day, no phones."],
    ["army", "pre season includes a day with the army", "Mud, ropes and shouting."],
    ["bonding", "the club books a team bonding trip", "Rafting. You cannot swim well."],
    ["friendly", "a friendly against a famous club is set up", "In a stadium of eighty thousand."],
    ["sponsor", "the tour is packed with sponsor events", "More selfies than training."],
  ], t => ({
    tease: "Pre season.",
    title: "Pre season",
    text: x => "This summer " + t[1] + ". " + t[2],
    choices: [
      ["all", "Give it everything.", { prof: 2, form: 0.2, fatigue: 2 }],
      ["smart", "Work hard but rest well.", { prof: 1, form: 0.1 }],
      ["coast", "Coast through it.", { form: -0.1, morale: 1 }],
    ], calm: "smart",
  }));
  fam("role", "team", "pro", [
    ["pens", "you ask to take penalties", "The regular taker says no."],
    ["freekick", "you start practising free kicks after training", "Every day, an hour."],
    ["armband", "the captain is out and the armband is up for grabs", "Three players want it."],
    ["position", "the manager wants to try you in a new position", "One you have never played."],
    ["wall", "you are asked to stand in the wall for free kicks", "Nobody else wants to."],
    ["corners", "the coach puts you in charge of corners", "He wants new routines."],
  ], t => ({
    tease: "A new job in the team.",
    title: "Your role",
    text: x => "At " + x.team + " this week " + t[1] + ". " + t[2],
    choices: [
      ["take", "Take it on.", { conf: 2, lead: 1, rel: { coach: 1 } }],
      ["team", "Do whatever the team needs.", { rel: { coach: 2, team: 1 }, prof: 1 }],
      ["no", "Say it is not for you.", { rel: { coach: -1 }, morale: 1 }],
    ], calm: "team",
  }));
  fam("analyst", "team", "pro", [
    ["data", "the club analyst shows you your running data", "You walk more than you think."],
    ["clip", "the analyst sends you clips of a winger you will face", "He is very fast."],
    ["gps", "your GPS vest says you sprint less than anyone", "The coach saw it too."],
    ["press", "the stats say you lose the ball too often", "In your own half."],
    ["shots", "the data says you shoot from bad spots", "Too far out."],
    ["best", "the analyst says your numbers are the best in the squad", "He wants to show the others."],
  ], t => ({
    tease: "The numbers.",
    title: "The numbers say",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["learn", "Sit down and learn from it.", { prof: 2, form: 0.1, rel: { coach: 1 } }],
      ["trust", "Trust your eyes, not the data.", { conf: 1, rel: { coach: -1 } }],
      ["nod", "Nod and move on.", { prof: 1 }],
    ], calm: "learn",
  }));
  fam("window", "agent", "pro", [
    ["rumour", "a paper says a big club is watching you", "Your agent says it is nothing, yet."],
    ["swap", "you hear you might be used in a swap deal", "Without anyone asking you."],
    ["mate", "your best mate in the squad is sold", "On the last day of the window."],
    ["bid", "a bid comes in and the club turns it down", "You only find out on the news."],
    ["agent", "a different agent keeps calling you", "He says he can get you a better deal."],
    ["deadline", "it is deadline day and your phone is ringing", "Nobody tells you anything."],
  ], t => ({
    tease: "The window.",
    title: "Transfer window",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["focus", "Block it out and play.", { prof: 2, conf: 1 }],
      ["agent", "Ask your agent what is going on.", { rel: { agent: 2 } }],
      ["stir", "Drop a hint you would like to move.", { rel: { coach: -2 }, national: 1 }],
    ], calm: "focus",
  }));
  fam("deals", "media", ["pro", "known"], [
    ["boots", "a boot company offers you a deal", "You have to wear bright pink boots."],
    ["game", "you are in the new football video game", "Your rating is lower than you hoped."],
    ["kit", "you are asked to launch the new club shirt", "It is very ugly."],
    ["drink", "an energy drink brand wants you", "You do not drink it."],
    ["watch", "a watch brand offers you a deal", "Only if you post about it every week."],
    ["car", "a car brand offers you a free car for a year", "With their name on the side."],
    ["food", "a fast food chain wants you in an advert", "Eating a burger."],
  ], t => ({
    tease: "A brand calls.",
    title: "A brand deal",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["yes", "Take the deal.", { earn: 2, commercial: 3, followers: 0.02 }],
      ["agent", "Let your agent handle it.", { earn: 1, commercial: 1, rel: { agent: 1 } }],
      ["no", "Turn it down.", { prof: 1, local: 1 }],
    ], calm: "agent",
  }));
  fam("shows", "media", "known", [
    ["podcast", "a big podcast asks you on", "Two hours, no editing."],
    ["kids", "a kids' TV show wants you to judge a skills contest", "With puppets."],
    ["quiz", "a TV quiz show wants you as a guest", "Your general knowledge is poor."],
    ["cook", "a cooking show wants you to cook against a teammate", "You cannot cook."],
    ["cover", "a magazine wants you on the cover", "Shirtless."],
    ["fashion", "a fashion brand wants you in their show", "Walking down a catwalk."],
    ["radio", "a radio station wants you to pick songs for an hour", "Live."],
  ], t => ({
    tease: "On the telly.",
    title: "On the telly",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["yes", "Say yes and have fun.", { commercial: 2, followers: 0.03, morale: 1, time: 1 }],
      ["club", "Ask the club first.", { prof: 1 }],
      ["no", "Say no. You are a footballer.", { prof: 1 }],
    ], calm: "club",
  }));
  fam("giving", "media", ["pro", "known"], [
    ["hospital", "the club visits the children's hospital", "A boy asks you to promise him a goal."],
    ["foodbank", "a food bank near the ground is running out", "Queues out of the door."],
    ["hospice", "a hospice asks you to visit a dying fan", "He is nine."],
    ["shirts", "a charity asks for signed shirts", "For an auction."],
    ["run", "a charity run needs a famous runner", "Ten kilometres, on your day off."],
    ["school", "a school in a poor area has no PE kit", "The kids play in their uniforms."],
    ["home", "a care home asks if you could visit", "The residents watch every game."],
  ], t => ({
    tease: "A chance to help.",
    title: "Giving back",
    text: x => "In " + x.city + " this week " + t[1] + ". " + t[2],
    choices: [
      ["go", "Go and give your time.", { local: 3, morale: 2, fatigue: 1 }],
      ["money", "Give money quietly.", { spend: 1, local: 1, morale: 1 }],
      ["busy", "Say you are too busy.", { local: -1 }],
    ], calm: "go",
  }));

  // =====================================================================================================
  // THE PEOPLE CLOSEST TO YOU
  // =====================================================================================================
  fam("date", "partner", "partner", [
    ["film", "she wants to see a long, sad film", "Three hours, subtitles."],
    ["dance", "she signs you both up for dance classes", "Salsa, on Tuesday nights."],
    ["photo", "she posts a photo of you asleep on the sofa", "Mouth open. It has a lot of likes."],
    ["game", "she comes to watch you play for the first time", "She cheers at the wrong moments."],
    ["gift", "she buys you a jumper you do not like", "She wants you to wear it to training."],
    ["cook", "she wants you to cook for her friends", "Six of them, on Saturday."],
    ["sick", "she is ill and home alone", "On the night of a team dinner."],
  ], t => ({
    who: "pt",
    tease: x => x.who + ".",
    title: x => "You and " + x.who,
    text: x => "With " + x.who + ": " + t[1] + ". " + t[2],
    choices: [
      ["sweet", "Go along with it and smile.", { rel: { pt: 6 }, morale: 2 }],
      ["honest", "Be honest about how you feel.", { rel: { pt: 2 }, conf: 1 }],
      ["dodge", "Find a way out of it.", { rel: { pt: -5 }, fatigue: -1 }],
    ], calm: "sweet",
  }));
  fam("sib2", "family", "sib", [
    ["shirt", "wears your shirt to school every day", "Even on non uniform day."],
    ["fight", "got into a fight defending your name", "The school wants to see your parents."],
    ["money", "asks to borrow money for a phone", "They promise to pay you back."],
    ["club", "wants to try out for a football team too", "They are worried they will be compared to you."],
    ["secret", "tells you a secret about Mum and Dad", "They are having money trouble."],
    ["copy", "has started copying your goal celebration", "In the garden, every day."],
    ["ignore", "says you never call any more", "Since you got famous."],
  ], t => ({
    tease: x => "Your " + x.bro + ".",
    title: x => "Your " + x.bro,
    text: x => "Your " + x.bro + " " + x.sib + " " + t[1] + ". " + t[2],
    choices: [
      ["call", "Call them and really talk.", { rel: { sib: 4 }, morale: 2 }],
      ["help", "Help them out.", { rel: { sib: 3 }, spend: 1 }],
      ["later", "You will sort it out later.", { rel: { sib: -2 } }],
    ], calm: "call",
  }));
  fam("best2", "friend", "best", [
    ["dropped", "has been dropped and is gutted", "He thinks the coach hates him."],
    ["contract", "has been offered a new deal and you have not", "He is not sure how to tell you."],
    ["party", "wants to throw a big party at his place", "The night before a game."],
    ["girl", "has fallen for someone and will not stop talking about it", "On every drive to training."],
    ["leave", "might be leaving for another club", "He wants your advice."],
    ["kit", "keeps borrowing your kit and not giving it back", "Your best boots are at his place."],
    ["fit", "is working twice as hard as you this week", "It is making you look lazy."],
  ], t => ({
    tease: x => x.mate + ".",
    title: x => "Your mate " + x.mate,
    text: x => x.mate + " " + t[1] + ". " + t[2],
    choices: [
      ["back", "Back him all the way.", { rel: { best: 4 }, morale: 1 }],
      ["truth", "Tell him the truth, kindly.", { rel: { best: 2 }, lead: 1 }],
      ["self", "Look after yourself first.", { rel: { best: -3 }, prof: 1 }],
    ], calm: "truth",
  }));
  fam("car2", "life", ["adult", "car"], [
    ["tyre", "you get a flat tyre on the way to training", "You have never changed a tyre."],
    ["scratch", "someone scratches a rude word into your car", "Outside the ground."],
    ["valet", "a valet at a restaurant crashes your car", "Into a bin."],
    ["photo", "fans keep taking photos of your car", "One sits on the bonnet."],
    ["fuel", "you put the wrong fuel in", "The car stops after a mile."],
    ["clamp", "your car gets clamped", "You parked in the manager's spot."],
    ["sell", "a teammate wants to buy your car", "Cheap. He says you are mates."],
  ], t => ({
    tease: "Your car.",
    title: "Your car",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["calm", "Stay calm and sort it out.", { prof: 1, spend: 1 }],
      ["laugh", "Laugh about it with the lads.", { rel: { team: 1 }, morale: 1, spend: 1 }],
      ["angry", "Lose your temper.", { disc: -1, morale: -1 }],
    ], calm: "calm",
  }));
  fam("rich2", "life", "rich", [
    ["watch", "a jeweller offers you a very rare watch", "It costs more than your dad's house."],
    ["house", "you could buy your parents a new house", "They say they do not want one."],
    ["yacht", "a rich fan invites you onto his yacht", "With people you do not know."],
    ["art", "an art dealer says a painting is a great investment", "It is a blue square."],
    ["coin", "a teammate says you should buy a new online coin", "He says it will go up ten times."],
    ["poker", "a high stakes card game is happening after a game", "Other players are going."],
    ["cousins", "cousins you have never met start asking for money", "Lots of them."],
  ], t => ({
    tease: "Money talks.",
    title: "Money talks",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["wise", "Ask someone you trust for advice.", { prof: 1, rel: { dad: 1 } }],
      ["buy", "Go for it.", { spend: 3, morale: 2 }],
      ["no", "Say no. Keep your money safe.", { prof: 1, disc: 1 }],
    ], calm: "no",
  }));
  fam("rehab2", "life", "hurt", [
    ["pool", "you do your rehab in the pool every day", "With old ladies doing aqua aerobics."],
    ["bored", "you are bored out of your mind", "You have watched every film ever made."],
    ["second", "a doctor gives a different opinion on your injury", "He says you need surgery."],
    ["stand", "you watch the team play from the stand", "They are losing and you can do nothing."],
    ["early", "you feel ready to come back early", "The physio says two more weeks."],
    ["visit", "teammates come to cheer you up", "They bring pizza and a card."],
  ], t => ({
    tease: "The injury.",
    title: "Getting back",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["patient", "Be patient. Do it properly.", { prof: 2, injuryRisk: -0.02, morale: -1 }],
      ["positive", "Stay positive and help the team from the side.", { lead: 1, rel: { team: 2 }, morale: 1 }],
      ["rush", "Push to come back fast.", { conf: 1, injuryRisk: 0.04 }],
    ], calm: "patient",
  }));
  fam("teen2", "life", "teen", [
    ["growth", "you grow five centimetres in a few months", "Your knees ache and your touch is gone."],
    ["voice", "your voice keeps cracking", "In the middle of team talks."],
    ["spots", "your face breaks out in spots", "On picture day."],
    ["shave", "you try shaving for the first time", "There is a lot of blood."],
    ["phone", "your parents take your phone at night", "You are not happy."],
    ["clothes", "your mum still buys your clothes", "Your friends have noticed."],
  ], t => ({
    tease: "Growing up.",
    title: "Growing up",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["laugh", "Laugh at yourself.", { morale: 2, conf: 1 }],
      ["talk", "Talk to your mum or dad about it.", { rel: { mum: 2, dad: 2 } }],
      ["hide", "Keep your head down.", { morale: -1 }],
    ], calm: "laugh",
  }));
  fam("college2", "life", "student", [
    ["essay", "a big essay is due on the day of a game", "You have not started."],
    ["room", "your roommate plays loud music every night", "Mostly sad songs."],
    ["group", "your group project partners do nothing", "It is your grade too."],
    ["party", "there is a huge party on campus", "Everyone is going."],
    ["tutor", "a tutor offers extra help", "On Sunday mornings."],
    ["choice", "your teacher says you could be a great engineer", "If you studied more."],
  ], t => ({
    tease: "Studies.",
    title: "Studies",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["study", "Put the work in.", { prof: 1, fatigue: 1, rel: { mum: 1 } }],
      ["balance", "Find a balance.", { morale: 1 }],
      ["skip", "Football first, books later.", { prof: -1, form: 0.1 }],
    ], calm: "balance",
  }));

  // =====================================================================================================
  // THE DRESSING ROOM AND THE FANS
  // =====================================================================================================
  fam("dressing", "team", ["pro"], [
    ["music", "nobody can agree on the dressing room music", "It ends in a shouting match."],
    ["kitman", "the kit man is retiring after thirty years", "Everyone loved him."],
    ["santa", "you are picked for the team's secret gift swap", "You got the manager."],
    ["fines", "the fines board says you owe the most", "For being late and wearing odd socks."],
    ["photo", "it is team photo day", "You blink in every shot."],
    ["new", "a new signing has no friends yet", "He sits alone at lunch."],
    ["birthday", "it is the captain's birthday", "Someone needs to sort a gift."],
    ["prank", "a prank goes too far", "Someone's car is full of balloons."],
  ], t => ({
    tease: "The dressing room.",
    title: "Dressing room",
    text: x => "At " + x.team + " this week " + t[1] + ". " + t[2],
    choices: [
      ["lead", "Step up and sort it out.", { lead: 2, rel: { team: 2 } }],
      ["fun", "Join in the fun.", { morale: 2, rel: { team: 1 } }],
      ["quiet", "Keep out of it.", { prof: 1 }],
    ], calm: "fun",
  }));
  fam("fanmail", "media", ["pro", "known"], [
    ["banner", "fans make a banner with your face on it", "The face looks nothing like you."],
    ["chant", "the fans make up a song about you", "It rhymes your name with something rude."],
    ["letter", "a boy writes you a letter", "He has the same name and wants to be you."],
    ["tattoo", "a fan gets your face tattooed on his leg", "He sends you a photo."],
    ["wedding", "a fan invites you to his wedding", "His bride does not know yet."],
    ["door", "an angry fan knocks on your door", "About your last game."],
    ["gran", "a fan's gran knits you a scarf", "In your club colours."],
  ], t => ({
    tease: "The fans.",
    title: "The fans",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["thank", "Thank them warmly.", { local: 3, followers: 0.01, morale: 1 }],
      ["club", "Pass it to the club.", { prof: 1 }],
      ["ignore", "Ignore it.", { local: -1 }],
    ], calm: "thank",
  }));
  fam("hurtmate", "team", "any", [
    ["tackle", "your tackle in training hurts a teammate", "He limps off."],
    ["clash", "you clash heads with a teammate", "You both need stitches."],
    ["ball", "your shot hits the youth coach in the face", "His glasses break."],
    ["slip", "you slip in the shower and take a teammate down", "Nobody is badly hurt."],
    ["bag", "you leave a bag in the doorway", "The physio falls over it."],
    ["door", "you shut a door on the kit man's finger", "He yells for a long time."],
  ], t => ({
    tease: "An accident.",
    title: "An accident",
    text: x => "At " + x.ground + " this week " + t[1] + ". " + t[2],
    choices: [
      ["sorry", "Say sorry and check on them.", { rel: { team: 2 }, prof: 1 }],
      ["gift", "Buy them something to say sorry.", { rel: { team: 2 }, spend: 1 }],
      ["accident", "It was an accident. Move on.", { rel: { team: -2 } }],
    ], calm: "sorry",
  }));
  fam("gaffe", "media", ["pro"], [
    ["name", "you say the wrong club name in an interview", "Your old club."],
    ["swear", "you swear on live TV", "Your mum saw."],
    ["meme", "your face after a miss becomes a meme", "Everyone is using it."],
    ["dance", "your goal celebration dance goes wrong", "You fall over."],
    ["mic", "a microphone picks up you moaning about the pitch", "The groundsman heard it."],
    ["map", "you are asked where your next opponents are from", "You get the country wrong."],
  ], t => ({
    tease: "Oops.",
    title: "Oops",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["laugh", "Laugh at yourself in public.", { followers: 0.03, local: 2, morale: 1 }],
      ["sorry", "Say sorry.", { prof: 1, local: 1 }],
      ["angry", "Get angry about it.", { local: -2, morale: -1 }],
    ], calm: "laugh",
  }));

  // =====================================================================================================
  // OUT AND ABOUT
  // =====================================================================================================
  fam("travel", "life", "any", [
    ["bag", "the airline loses your bag", "Your boots are in it."],
    ["passport", "your passport has run out", "You fly in five days."],
    ["train", "you get on the wrong train", "You wake up in another city."],
    ["missed", "you miss your flight by two minutes", "The gate shuts in your face."],
    ["jetlag", "jet lag hits you hard", "You are awake at three every night."],
    ["seat", "you get the middle seat on a long flight", "Between two people who snore."],
  ], t => ({
    tease: "A trip goes wrong.",
    title: "Travel trouble",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["calm", "Stay calm and fix it.", { prof: 1, spend: 1 }],
      ["laugh", "Turn it into a funny story.", { morale: 1, followers: 0.01 }],
      ["stress", "Let it stress you out.", { morale: -2, fatigue: 1 }],
    ], calm: "calm",
  }));
  fam("bills", "life", "adult", [
    ["tax", "a letter about tax arrives", "You do not understand a word of it."],
    ["card", "your bank card is blocked", "While you are paying for dinner."],
    ["charge", "you find you have been paying for an app you never use", "For two years."],
    ["refund", "a shop owes you a refund", "They keep saying next week."],
    ["phone", "your phone bill is huge", "You used data abroad."],
    ["rent", "your rent is going up", "By a lot."],
  ], t => ({
    tease: "Money admin.",
    title: "Money admin",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["sort", "Sit down and sort it out.", { prof: 1, disc: 1 }],
      ["help", "Ask your dad or agent to help.", { rel: { dad: 1 } }],
      ["pay", "Just pay and forget about it.", { spend: 1 }],
    ], calm: "sort",
  }));
  fam("animals", "life", "any", [
    ["dog", "a dog runs onto the pitch during training", "It will not let anyone near the ball."],
    ["fox", "a fox lives in your garden", "It steals your trainers."],
    ["cat", "a cat lives at the training ground", "It sleeps on your bag every day."],
    ["bird", "a bird does its business on you in the warm up", "Your teammates say it is lucky."],
    ["horse", "a police horse at the game takes a liking to you", "It follows you along the touchline."],
    ["puppy", "a teammate's puppy chews your boots", "The expensive ones."],
  ], t => ({
    tease: "Animals.",
    title: "Animal trouble",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["love", "Love it. Animals are great.", { morale: 2, followers: 0.01 }],
      ["film", "Film it for social media.", { followers: 0.02 }],
      ["annoyed", "Be annoyed about it.", { morale: -1 }],
    ], calm: "love",
  }));
  fam("outdoors", "life", "any", [
    ["hike", "a friend asks you to climb a mountain on your day off", "A big one."],
    ["fish", "your dad wants to take you fishing", "Like when you were little."],
    ["camp", "your friends plan a camping weekend", "In a field with no toilets."],
    ["beach", "a sunny day at the beach comes up", "The water is freezing."],
    ["bike", "a teammate wants to cycle to training", "Thirty kilometres."],
    ["swim", "someone suggests a swim in the lake", "It is very cold."],
  ], t => ({
    tease: "Fresh air.",
    title: "Fresh air",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["go", "Go and enjoy it.", { morale: 3, fatigue: 1, rel: { dad: 1, friend: 1 } }],
      ["easy", "Go, but take it easy.", { morale: 2 }],
      ["rest", "Rest your legs instead.", { fatigue: -2 }],
    ], calm: "easy",
  }));
  fam("music", "life", "any", [
    ["guitar", "you start learning the guitar", "Your fingers hurt."],
    ["dj", "a teammate wants you to DJ at his party", "You have never done it."],
    ["song", "a singer writes a song that mentions you", "It is quite good."],
    ["piano", "your mum wants you to play piano again", "Like you did when you were eight."],
    ["choir", "the club wants players to sing a Christmas song", "For charity."],
    ["drums", "you buy a drum kit", "Your neighbours are not happy."],
  ], t => ({
    tease: "Music.",
    title: "Music",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["play", "Go for it.", { morale: 2, conf: 1 }],
      ["share", "Share it with the world.", { followers: 0.02, morale: 1 }],
      ["no", "Not for you.", { prof: 1 }],
    ], calm: "play",
  }));
  fam("tech", "life", "any", [
    ["smash", "you drop your new phone", "The screen is in pieces."],
    ["watch", "you get a smart watch", "It keeps telling you to stand up."],
    ["console", "a new game console comes out", "Your teammates are all playing it late."],
    ["vr", "a teammate brings a VR headset to the hotel", "He walks into a wall."],
    ["hacked", "your social media gets hacked", "Someone posts strange things as you."],
    ["lost", "you lose every photo on your phone", "Years of them."],
  ], t => ({
    tease: "Gadgets.",
    title: "Gadgets",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["fix", "Get it sorted.", { spend: 1, prof: 1 }],
      ["fun", "Have fun with it.", { morale: 2, fatigue: 1 }],
      ["less", "Use your phone less from now on.", { prof: 1, morale: 1 }],
    ], calm: "fix",
  }));
  fam("contract", "agent", "pro", [
    ["extend", "the club wants to talk about a longer deal", "Same money, more years."],
    ["bonus", "your agent wants a goal bonus in your deal", "The club says no."],
    ["loyal", "a fan group asks you to promise you will stay", "In public."],
    ["release", "you hear about a release clause in your deal", "You did not know it was there."],
    ["image", "your agent wants a cut of your image rights", "A bigger cut."],
    ["wait", "the club keeps delaying contract talks", "For months."],
  ], t => ({
    tease: "Your deal.",
    title: "Your deal",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["trust", "Trust your agent to handle it.", { rel: { agent: 2 } }],
      ["club", "Show loyalty to the club.", { local: 3, rel: { coach: 1 } }],
      ["push", "Push hard for more.", { rel: { coach: -1, agent: 1 }, conf: 1 }],
    ], calm: "trust",
  }));
  fam("bosschange", "team", "pro", [
    ["pressure", "the manager is under pressure", "Three losses in a row."],
    ["new", "a new manager arrives", "He does not know your name."],
    ["assistant", "the assistant coach is now in charge for a while", "He likes you."],
    ["style", "the manager changes how the team plays", "It does not suit you."],
    ["leaving", "the manager tells you he is leaving", "Before he tells anyone else."],
    ["return", "an old manager of yours is back at the club", "As a scout."],
  ], t => ({
    tease: "Changes at the top.",
    title: "Changes at the top",
    text: x => "At " + x.team + " this week " + t[1] + ". " + t[2],
    choices: [
      ["prove", "Prove yourself all over again.", { prof: 2, form: 0.1, rel: { coach: 2 } }],
      ["back", "Back him in public.", { rel: { coach: 3 }, local: 1 }],
      ["worry", "Worry about your place.", { conf: -1 }],
    ], calm: "prove",
  }));

  // =====================================================================================================
  // THE PEOPLE AROUND TOWN
  // =====================================================================================================
  fam("locals", "life", "any", [
    ["barber", "your barber gives you a bad haircut", "Right before a big game."],
    ["taxi", "a taxi driver gives you advice on your game", "For forty minutes."],
    ["bin", "the bin men chant your name", "Every week at seven in the morning."],
    ["owner", "the owner of {cafe} puts your photo on the wall", "Next to the toilet."],
    ["post", "the postman is a big fan of your rivals", "He always has something to say."],
    ["cop", "a police officer stops you", "Just to talk about last Saturday."],
    ["nurse", "a nurse at the clinic says you saved her bad week", "With a goal."],
  ], t => ({
    tease: "People in town.",
    title: "Around town",
    text: x => "In " + x.city + " this week " + t[1] + ". " + t[2],
    choices: [
      ["kind", "Be kind and have a laugh.", { local: 2, morale: 1 }],
      ["thanks", "Say thanks and move on.", { local: 1 }],
      ["grumpy", "Be grumpy about it.", { local: -2 }],
    ], calm: "kind",
  }));
  fam("kids", "life", "any", [
    ["coach", "a kids' team asks you to coach them for a day", "They are six years old."],
    ["fan", "a little fan cries when he meets you", "His dad cries too."],
    ["street", "kids follow you down the street", "Shouting your name."],
    ["school", "a school class sends you drawings", "Thirty of them."],
    ["ball", "a kid kicks a ball over a fence and asks you to get it", "It is a big fence."],
    ["sick", "a sick kid's wish is to meet you", "His mum writes to the club."],
  ], t => ({
    tease: "The kids.",
    title: "The kids",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["time", "Give them your time.", { local: 3, morale: 3 }],
      ["sign", "Sign something for them.", { local: 2 }],
      ["busy", "You are too busy.", { local: -2 }],
    ], calm: "time",
  }));
  fam("oldteam", "team", "any", [
    ["visit", "your old youth club asks you to visit", "The kids want to see you."],
    ["coach", "your first coach is ill", "He always said you would make it."],
    ["kit", "your old club is selling its old kit", "Your first shirt is in the pile."],
    ["award", "your old club wants to name a pitch after you", "Or after your first coach."],
    ["game", "you play against your old club", "Your old friends are on the other side."],
    ["help", "your old club needs money for a minibus", "To get the kids to games."],
  ], t => ({
    tease: "Your old club.",
    title: "Your old club",
    text: x => "Back in " + x.home + " this week " + t[1] + ". " + t[2],
    choices: [
      ["go", "Go back and see them.", { local: 2, morale: 3, fatigue: 1 }],
      ["give", "Give something back.", { spend: 1, local: 2, morale: 2 }],
      ["move", "That is the past.", { prof: 1 }],
    ], calm: "go",
  }));
  fam("look", "life", "any", [
    ["tattoo", "you think about getting a tattoo", "Your mum would hate it."],
    ["hair", "you dye your hair bright blond", "The manager stares."],
    ["beard", "you try growing a beard", "It is patchy."],
    ["style", "a stylist offers to change your look", "For free."],
    ["glasses", "you start wearing glasses off the pitch", "People say you look clever."],
    ["teeth", "a dentist offers to whiten your teeth", "Very white."],
    ["clothes", "your teammates laugh at your clothes", "Every single day."],
  ], t => ({
    tease: "A new look.",
    title: "A new look",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["go", "Go for it.", { followers: 0.02, conf: 1, morale: 1 }],
      ["ask", "Ask your family what they think.", { rel: { mum: 1 } }],
      ["same", "Stay as you are.", { prof: 1 }],
    ], calm: "same",
  }));
  fam("culture", "team", "any", [
    ["language", "a new teammate does not speak the language", "He looks lost."],
    ["food", "a teammate brings food from his country", "It is very spicy."],
    ["prayer", "a teammate needs a quiet room to pray", "There is none at the ground."],
    ["fast", "a teammate is fasting this month", "He trains hard all day without food."],
    ["learn", "you start learning a teammate's language", "He teaches you rude words first."],
    ["holiday", "a teammate invites you home for a festival", "Across the world."],
  ], t => ({
    tease: "A teammate's world.",
    title: "A teammate's world",
    text: x => "At " + x.team + " this week " + t[1] + ". " + t[2],
    choices: [
      ["help", "Help him feel at home.", { rel: { team: 3 }, lead: 1, morale: 1 }],
      ["learn", "Learn something new.", { morale: 2, rel: { team: 1 } }],
      ["leave", "Leave it to the club.", { prof: 1 }],
    ], calm: "help",
  }));
  fam("mentor", "team", "any", [
    ["old", "an old pro offers to mentor you", "Once a week, over coffee."],
    ["young", "a younger player asks you to mentor him", "He is very shy."],
    ["coach", "a retired coach watches you and sends notes", "Pages of them."],
    ["keeper", "the goalkeeper says he can tell what you will do", "He shows you how."],
    ["legend", "a club legend watches you train", "He says one thing to you after."],
    ["mum", "your mum says something about your game", "She is right."],
  ], t => ({
    tease: "Advice.",
    title: "Advice",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["listen", "Listen and learn.", { prof: 2, form: 0.1 }],
      ["share", "Share what you know too.", { lead: 2, rel: { team: 1 } }],
      ["self", "You know your own game.", { conf: 1 }],
    ], calm: "listen",
  }));
  fam("weekend", "life", "any", [
    ["lie", "you get a rare lie in", "Nobody calls until noon."],
    ["market", "you go to a market and buy something silly", "A giant plant."],
    ["film", "you watch three films in a row", "On the sofa all day."],
    ["cook", "you try a new recipe", "It is great."],
    ["drive", "you go for a long drive", "No plan."],
    ["visit", "you visit a town you have never seen", "Two hours away."],
  ], t => ({
    tease: "A quiet weekend.",
    title: "A quiet weekend",
    text: x => "This weekend " + t[1] + ". " + t[2],
    choices: [
      ["enjoy", "Enjoy it.", { morale: 2, fatigue: -2 }],
      ["train", "Fit in some extra work.", { prof: 1, form: 0.1 }],
      ["family", "Spend it with family.", { rel: { mum: 2, dad: 1 }, morale: 1 }],
    ], calm: "enjoy",
  }));
  fam("luck2", "life", "any", [
    ["rain", "a bus splashes you head to toe", "On the way to a photo shoot."],
    ["boots", "you bring two left boots to a game", "The kit man finds a spare pair."],
    ["key", "your house key snaps in the lock", "At midnight."],
    ["sock", "you wear odd socks to a club dinner", "Someone takes a photo."],
    ["window", "your ball breaks a neighbour's window", "In your garden, practising."],
    ["shirt", "you put your shirt on inside out", "And play the first half like that."],
  ], t => ({
    tease: "A bad luck week.",
    title: "Bad luck",
    text: x => "This week " + t[1] + ". " + t[2],
    choices: [
      ["laugh", "Laugh it off.", { morale: 1 }],
      ["fix", "Fix it and say sorry.", { spend: 1, local: 1 }],
      ["moan", "Moan about your luck.", { morale: -2 }],
    ], calm: "laugh",
  }));

  return out;
};
