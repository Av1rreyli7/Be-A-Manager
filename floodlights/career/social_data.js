// Player Career: the people he meets. Names, personalities, what they are into, what they say when he walks up,
// what they text, and what a hang out looks like. Plain data; floodlights/career/social.js does the rest.

const GIRLS_IN = ["Aanya", "Diya", "Ishita", "Kavya", "Meera", "Riya", "Saanvi", "Tara", "Zara", "Aditi", "Ananya", "Anika", "Avni", "Bhavna", "Charvi", "Devika", "Esha", "Gauri", "Isha", "Jiya",
  "Kiara", "Lavanya", "Mahima", "Naina", "Nisha", "Pooja", "Priya", "Radhika", "Rhea", "Sana", "Shreya", "Simran", "Sneha", "Tanvi", "Trisha", "Vanya", "Yamini", "Zoya", "Aisha", "Alia",
  "Amrita", "Anushka", "Arya", "Dia", "Fatima", "Inaya", "Kriti", "Leela", "Malini", "Neha", "Nikita", "Pallavi", "Rashmi", "Ruhi", "Sakshi", "Shalini", "Tanya", "Uma", "Vidya", "Kashish"];
const GIRLS_W = ["Emma", "Olivia", "Sophie", "Chloe", "Grace", "Lucy", "Mia", "Ella", "Isla", "Amelia", "Ava", "Freya", "Lily", "Hannah", "Zoe", "Nina", "Lea", "Clara", "Sofia", "Lucia",
  "Elena", "Marta", "Ines", "Julia", "Alice", "Camille", "Manon", "Giulia", "Chiara", "Aurora", "Amara", "Nia", "Zainab", "Ama", "Adaeze", "Yasmin", "Leila", "Hana", "Yuki", "Mei",
  "Sakura", "Maya", "Ruby", "Poppy", "Daisy", "Evie", "Holly", "Jade", "Kayla", "Tia", "Bianca", "Valentina", "Camila", "Isabela", "Gabriela", "Luna", "Noor", "Selin", "Ingrid", "Freja"];
const BOYS_W = ["Sam", "Leo", "Kofi", "Mateo", "Jonah", "Theo", "Ibrahim", "Luca", "Jack", "Harry", "Oscar", "Charlie", "Alfie", "Noah", "Ethan", "Liam", "Lucas", "Max", "Felix", "Hugo",
  "Marco", "Rafael", "Diego", "Tomas", "Emre", "Yusuf", "Malik", "Tariq", "Kwame", "Chidi", "Jamal", "Kenji", "Ren", "Daniel", "Adam", "Ben", "Joe", "Ryan", "Nathan", "Elias"];
const LAST_W = ["Smith", "Jones", "Taylor", "Brown", "Wilson", "Evans", "Thomas", "Walker", "Wright", "Roberts", "Hughes", "Green", "Hall", "Wood", "Clarke", "Martin", "Garcia", "Martinez", "Lopez", "Rossi",
  "Bianchi", "Romano", "Muller", "Schmidt", "Dubois", "Moreau", "Laurent", "Silva", "Santos", "Costa", "Okafor", "Mensah", "Adeyemi", "Diallo", "Haddad", "Nasser", "Kaya", "Yilmaz", "Tanaka", "Sato",
  "Kim", "Park", "Chen", "Wang", "Novak", "Kowalski", "Jensen", "Larsen", "Murphy", "Kelly"];
const LAST_IN_F = ["Sharma", "Iyer", "Nair", "Menon", "Reddy", "Rao", "Kapoor", "Mehta", "Shah", "Desai", "Joshi", "Kulkarni", "Patil", "Bose", "Ghosh", "Banerjee", "Das", "Sen", "Fernandes", "D'Souza",
  "Pereira", "Rodrigues", "Pillai", "Varghese", "Thomas", "Khan", "Ali", "Qureshi", "Singh", "Kaur", "Gill", "Malhotra", "Chopra", "Verma", "Gupta", "Agarwal", "Saxena", "Mishra", "Pandey", "Tiwari",
  "Chatterjee", "Mukherjee", "Bhat", "Hegde", "Shetty", "Naidu", "Krishnan", "Subramaniam", "Lobo", "Dsilva"];

// who they are: a word for the People panel, and what goes down well with them
const TRAITS = {
  funny: { word: "Funny", likes: "joke" },
  ambitious: { word: "Driven", likes: "plans" },
  shy: { word: "Quiet", likes: "listen" },
  outgoing: { word: "Outgoing", likes: "plans" },
  creative: { word: "Creative", likes: "listen" },
  sporty: { word: "Sporty", likes: "football" },
  bookish: { word: "Bookish", likes: "listen" },
  kind: { word: "Kind", likes: "listen" }
};
const TRAIT_IDS = Object.keys(TRAITS);
const INTERESTS = ["music", "films", "books", "art", "food", "travel", "fashion", "football", "gaming", "fitness", "photography", "dance", "cooking", "nature", "cricket"];
const LIKE_WORD = { music: "music", films: "films", books: "books", art: "art", food: "food", travel: "travel", fashion: "fashion", football: "football", gaming: "gaming", fitness: "the gym", photography: "photography", dance: "dancing", cooking: "cooking", nature: "the outdoors", cricket: "cricket" };

// what they open with, by what they are into; and the reply that shows he was listening
const TOPICS = {
  music: { open: ["I have had the same album on repeat all week. Do you listen to much music?", "There is a gig in town on Saturday. Have you ever been to one?"], good: "Ask what they have on repeat" },
  films: { open: ["Did you see the new film everyone is on about? I cried twice.", "I watched three films back to back last night. No regrets."], good: "Ask them to pick you a film" },
  books: { open: ["I stayed up until two finishing a book. I am a wreck today.", "Have you read anything good lately? Apart from the team sheet."], good: "Ask what the book was about" },
  art: { open: ["I am painting a mural for the art room. It is taking forever.", "Have you been to the gallery in town? It is free on Sundays."], good: "Ask to see the mural" },
  food: { open: ["I have found the best street food place in the city. Honestly life changing.", "What do footballers even eat? Is it all chicken and rice?"], good: "Ask where the food place is" },
  travel: { open: ["I am saving up to go travelling. Anywhere but here for a month.", "You must go to loads of places for games. Where was the best?"], good: "Ask where they want to go" },
  fashion: { open: ["Be honest. Is this jacket too much?", "Your boots are always clean. Do you have someone for that?"], good: "Say the jacket works" },
  football: { open: ["Did you see the derby at the weekend? That last minute goal!", "Who is the best player you have ever played against?"], good: "Talk them through the derby" },
  gaming: { open: ["Are you any good at FC or do you just play the real thing?", "I was up all night on a new game. My eyes hurt."], good: "Challenge them to a game" },
  fitness: { open: ["I have started running before school. Day four. Send help.", "What is your gym routine? Mine is mostly the stretching bit."], good: "Offer to run with them" },
  photography: { open: ["I got a new camera. Can I take some shots of you training?", "The light at sunset by the water is unreal. Have you seen it?"], good: "Say yes to the photos" },
  dance: { open: ["I have a dance show next month and I am terrified.", "Do footballers dance? Celebrations do not count."], good: "Say you will come to the show" },
  cooking: { open: ["I made biryani for twelve people at the weekend. Nobody died.", "I am trying to learn to bake. It is going badly."], good: "Ask for the recipe" },
  nature: { open: ["We went hiking up the hills at the weekend. The view was worth the blisters.", "I found a quiet spot by the river. Nobody knows about it."], good: "Ask them to show you the spot" },
  cricket: { open: ["Did you watch the test match? I could not breathe at the end.", "Football is fine but have you tried cricket?"], good: "Talk about the last over" }
};
// the dressing room has its own talk
const SQUAD_TOPICS = [
  { t: "Coach had us doing sprints for an hour. My legs are gone.", good: "Say yours are too, and offer a stretch" },
  { t: "Big game this weekend. You nervous?", good: "Admit you are, a bit" },
  { t: "Who are you rooming with for the away trip?", good: "Ask if he wants to room together" },
  { t: "Did you see the new kit? I love it.", good: "Say it is the best one in years" },
  { t: "Physio says I am fine. My hamstring says otherwise.", good: "Tell him to get it looked at again" }
];
// what each kind of reply sounds like
const SAY = {
  joke: ["Make a joke of it", "Tease them a little"],
  listen: ["Just listen", "Ask how they are really doing"],
  plans: ["Suggest doing something about it", "Make a plan together"],
  football: ["Turn it round to football", "Tell them about your last game"]
};
const RESULT = {
  great: ["{first} lights up. You talk until someone drags you away.", "{first} laughs properly. That went well.", "You two could have talked all day."],
  good: ["A nice chat. {first} smiles as you go.", "{first} seems glad you came over."],
  meh: ["{first} nods along, a little polite.", "It was fine. Just fine."],
  bad: ["{first} checks their phone halfway through.", "That landed badly. {first} goes quiet."]
};

// texts from friends with numbers, by where they know him from, and the replies he can send (how much it means)
const TEXTS = {
  classmate: [
    { t: "Did you finish the homework? 😩", r: [["Send me yours 😂", 2], ["Done it, want help?", 5], ["What homework", -1]] },
    { t: "Kick about after school?", r: [["I am in ⚽", 5], ["Cannot, resting", 1], ["Not today", -2]] },
    { t: "Who is coming to the canteen tomorrow? Save me a seat", r: [["Saved 🙌", 4], ["I will be late", 1]] },
    { t: "Saw your goal on someone's story 🔥", r: [["Thanks! Lucky one", 4], ["Wait till you see the next one", 3], ["👍", 0]] },
    { t: "Are you going to the party on Friday?", r: [["Only if you are", 5], ["Early training, sorry", 1], ["Parties are not my thing", -2]] }
  ],
  teammate: [
    { t: "Gym at 7 tomorrow?", r: [["See you there 💪", 5], ["Make it 8", 2], ["Rest day for me", 0]] },
    { t: "Coach is in a mood. Heads up for tomorrow", r: [["Thanks for the warning 😅", 4], ["He is always in a mood", 2]] },
    { t: "FC online tonight?", r: [["You are going down 🎮", 5], ["Early night for me", 1]] },
    { t: "Good shift today. We go again", r: [["Always 🙌", 4], ["Could have been better", 2]] }
  ],
  oldfriend: [
    { t: "Long time. Still remember us now you are famous?", r: [["Always. Call you tonight", 6], ["Busy week, sorry", -1]] },
    { t: "We all watched your game at mine. Mad scenes", r: [["Love that 🙏", 5], ["Wish I was there with you", 4]] }
  ]
};
// hanging out: what they do, by where he is in life
const HANGS = {
  school: ["A kick about in the park until the street lights come on.", "Gaming at yours. You lost every game and blamed the controller.", "Chips on the wall outside the shop, talking rubbish for two hours."],
  college: ["Food in town and a long walk back. You talked about everything.", "A five a side with their mates. You played in goal to keep it fair.", "A film night in the halls. Someone fell asleep in the first ten minutes."],
  pro: ["Dinner at a quiet place where nobody asks for a photo. Well, nearly nobody.", "A round of golf. Nobody in the squad can play golf.", "Padel after training. Very competitive, very loud."]
};

module.exports = { GIRLS_IN, GIRLS_W, BOYS_W, LAST_W, LAST_IN_F, TRAITS, TRAIT_IDS, INTERESTS, LIKE_WORD, TOPICS, SQUAD_TOPICS, SAY, RESULT, TEXTS, HANGS };

// ---------- dating (college onwards, 18 and over) ----------
// what she says when he walks up, by where they are; and the reply that fits
const MEET = {
  cafe: [{ t: "Is this seat taken? Every other table is full.", good: "Pull the chair out for her" }, { t: "They spelled my name wrong on the cup again. Third time this week.", good: "Ask what they wrote this time" }],
  mall: [{ t: "Be honest. Does this colour suit me?", good: "Tell her honestly, it does" }, { t: "I think I am lost. Where is the food court?", good: "Offer to walk her there" }],
  club: [{ t: "It is so loud in here I cannot hear myself think.", good: "Suggest the quieter bar at the back" }, { t: "My friends just left me for the dance floor. Typical.", good: "Keep her company" }],
  restaurant: [{ t: "The waiter swears the sea bass is the best thing here. Do you trust him?", good: "Say you would trust him with your life" }, { t: "I am waiting for a friend who is always late. Always.", good: "Keep her company until they come" }],
  gym: [{ t: "Are you using this bench? Oh. You are the footballer, aren't you?", good: "Say yes, and offer her the bench" }, { t: "How do you make it look so easy? I am dying here.", good: "Tell her it took years" }],
  college: [{ t: "Are you in the sports science lecture? I have seen you at the back.", good: "Say she should sit at the back too" }, { t: "Did you understand any of that last lecture?", good: "Offer to go through the notes together" }]
};
// a first try at her number, and how she says no
const NUMBER = {
  yes: ["She types her number into your phone and adds a 🙂.", "\"Go on then.\" She saves her number as just her name and a star."],
  no: ["She smiles. \"Maybe next time.\"", "\"I do not give my number to footballers. Yet.\""]
};
// her texts, with replies he can pick (how much each one means to her)
const HER_TEXTS = {
  talking: [
    { t: "So are you always this charming or was that a good day? 😄", r: [["Only around you", 5], ["Mostly good days", 3], ["Charming? Me?", 2]] },
    { t: "What are you up to tonight?", r: [["Thinking about asking you out", 6], ["Ice bath, then sleep 🥶", 2], ["Nothing much", 0]] },
    { t: "I told my friend about you. She says hi.", r: [["Tell her hi back 👋", 3], ["What did you tell her?", 5]] }
  ],
  dating: [
    { t: "Thinking about you 😊", r: [["Same here ❤️", 6], ["Good thoughts I hope", 3], ["👍", -2]] },
    { t: "Good luck this weekend! I will be watching", r: [["That means a lot", 6], ["No pressure then 😅", 3]] },
    { t: "Are we still on for this week?", r: [["Can't wait", 5], ["Busy week, I will let you know", -1]] },
    { t: "Saw your post. Who was the girl in the background? 🤨", r: [["My cousin! I promise 😂", 3], ["Jealous?", -2], ["Nobody, you are the only one", 5]] }
  ],
  neglect: [
    { t: "You have gone very quiet.", r: [["Sorry, it has been crazy. Dinner this week?", 6], ["Football is busy right now", -3]] },
    { t: "Do you even want this?", r: [["Yes. I am sorry, I will do better", 6], ["I do not know", -8]] }
  ]
};
// where a date can be, and what it costs (her plate too)
const DATE_VENUES = {
  restaurant: { label: "Dinner at the restaurant", cost: 0 },
  cafe: { label: "Coffee at the cafe", cost: 14 },
  mall: { label: "An afternoon at the mall", cost: 30 },
  walk: { label: "A walk round the city", cost: 0 },
  drive: { label: "A drive", cost: 0 },
  club: { label: "A night at the club", cost: 160 }
};
// the scenes: her line and three things he can say (a style, how much it costs)
const BEATS = {
  arriveLate: { t: "You are late. I nearly left.", c: [["sorry", "I am sorry. It will not happen again.", 5], ["excuse", "Traffic was a nightmare, honestly", 1], ["joke", "Footballers run on match time 😅", 0]] },
  arrive: { t: "Hi. I was not sure what to wear tonight.", c: [["compliment", "You look lovely", 5], ["joke", "Did you dress up for me?", 0], ["plain", "Let us get a seat", 2]] },
  restaurant: { t: "Everything looks good. What are you having?", c: [["order:130", "The sea bass for both of us", 4], ["order:520", "The tasting menu. It is a special night", 4], ["order:150", "Let her choose for both of you", 5]] },
  cafe: { t: "Coffee or tea person? This decides everything.", c: [["joke", "Whatever stops me falling asleep in team talks", 0], ["listen", "Ask what she likes and order the same", 4], ["plain", "Coffee, black, no sugar", 2]] },
  mall: { t: "Help me pick a jacket. These two. Go.", c: [["buy:80", "Buy her the one she keeps looking at", 5], ["honest", "Tell her honestly which one suits her", 4], ["phone", "Check the football scores while she decides", -5]] },
  club: { t: "Do you dance, or do footballers just do celebrations?", c: [["dance", "Dance like nobody is watching", 0], ["quiet", "Find a quiet corner to talk", 0], ["fans", "Stop to chat with the fans who know you", -4]] },
  walk: { t: "This view. Do you ever just stop and look at the city?", c: [["listen", "Stop, and ask what she sees", 5], ["football", "Point out the stadium lights", 0], ["joke", "Only when I am lost", 0]] },
  drive: { t: "Put your music on. I want to know what you listen to.", c: [["music", "Play the song you play before games", 4], ["ask", "Let her pick the music", 5], ["quiet", "Drive in silence, it is nice", 0]] },
  middle: { t: "So tell me something nobody knows about you.", c: [["home", "Tell her about home and your family", 0], ["football", "Tell her about the game last week", 0], ["ask", "Turn it round and ask about her", 5]] },
  close: { t: "This was really nice.", c: [["again", "Ask to see her again", 5], ["home", "Offer to take her home", 4], ["hug", "Say goodnight with a hug", 3]] }
};
const DATE_RESULT = {
  great: ["Neither of you wanted it to end.", "She was still smiling when you said goodnight.", "The best night you have had in a long time."],
  good: ["A good night. She says she had fun.", "Easy and nice. You would do it again."],
  bad: ["It never quite clicked tonight.", "Awkward silences. She checked the time twice."]
};
const STAGE_WORD = { talking: "Talking", dating: "Dating", serious: "Serious", engaged: "Engaged", married: "Married", ex: "Ex" };

module.exports.MEET = MEET;
module.exports.NUMBER = NUMBER;
module.exports.HER_TEXTS = HER_TEXTS;
module.exports.DATE_VENUES = DATE_VENUES;
module.exports.BEATS = BEATS;
module.exports.DATE_RESULT = DATE_RESULT;
module.exports.STAGE_WORD = STAGE_WORD;

// ---------- the ring, the proposal, the wedding, married life ----------
const RINGS = [
  { id: "solitaire", brand: "Tiffany & Co.", label: "Solitaire diamond ring", price: 6500, note: "Classic. One stone, done right." },
  { id: "halo", brand: "Cartier", label: "Halo diamond ring", price: 18000, note: "A ring of small diamonds round a big one." },
  { id: "graff", brand: "Graff", label: "Three stone platinum ring", price: 65000, note: "The kind of ring that gets its own photo in the papers." }
];
// how good a spot is for the question
const PROPOSE_AT = { restaurant: 10, walk: 7, drive: 3, cafe: 0, mall: -6, club: -10 };
const PROPOSAL = {
  yes: ["She covers her mouth with both hands, nods, and cannot say a word. Then: \"Yes. Yes!\"", "\"Are you serious?\" You are. \"Yes. Of course yes.\""],
  no: ["She looks at the ring for a long time. \"Not yet. I love you, but not yet.\"", "\"I need more time,\" she says, and closes your hand round the box."]
};
// the wedding: how big, what it costs, who comes
const WEDDINGS = {
  small: { label: "Small: family and the closest friends", cost: 20000, guests: 10, buzz: 0.02 },
  big: { label: "Big: friends, family and the squad", cost: 90000, guests: 24, buzz: 0.06 },
  huge: { label: "Huge: a destination wedding, magazine cover and all", cost: 400000, guests: 40, buzz: 0.15 }
};
const WED_BEATS = [
  { t: "The music starts. Everyone turns to the back.", c: [["watch", "Watch her walk down the aisle"]] },
  { t: "\"Do you have your own vows?\"", c: [["own", "Say the vows you wrote yourself"], ["simple", "Keep it short and simple"], ["laugh", "Make the whole room laugh, then mean every word"]] },
  { t: "The first dance. Everyone is watching.", c: [["slow", "A slow dance, just the two of you"], ["show", "The routine you practised in secret"], ["all", "Pull everyone onto the floor"]] }
];
const MARRIED_TEXTS = [
  { t: "Dinner is in the oven. Do not be late 😘", r: [["On my way ❤️", 5], ["Training ran over, sorry", -1]] },
  { t: "Your mum called. Twice. Call her back please 😂", r: [["Calling her now", 4], ["Later", 0]] },
  { t: "I miss you. Come home soon", r: [["Counting the hours ❤️", 6], ["Away game, back Sunday", 2]] },
  { t: "Can we do something this weekend? Just us", r: [["Anything you want", 6], ["Let me check the schedule", 1]] }
];
const WIFE_TALK = [
  { t: "How was training? You look tired.", good: "Tell her about your day properly" },
  { t: "We should paint this room. Something warmer.", good: "Ask which colour she has in mind" },
  { t: "My sister wants to visit next month. Is that okay?", good: "Say she is welcome any time" },
  { t: "I booked us a table for Friday. No arguments.", good: "Say it is the best idea all week" }
];

module.exports.RINGS = RINGS;
module.exports.PROPOSE_AT = PROPOSE_AT;
module.exports.PROPOSAL = PROPOSAL;
module.exports.WEDDINGS = WEDDINGS;
module.exports.WED_BEATS = WED_BEATS;
module.exports.MARRIED_TEXTS = MARRIED_TEXTS;
module.exports.WIFE_TALK = WIFE_TALK;
