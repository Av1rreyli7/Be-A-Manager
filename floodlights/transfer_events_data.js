// Floodlights transfer window events. Only clubs a person manages get them, only in a week the transfer window
// is open, and only one per club per season. Each one points at a real player the club could use: a position
// the squad is thin in, a rating that fits the club and a price the budget can take. It raises that player's
// interest in joining (one or two levels, until the end of the next window) and the server adds a line that
// says so ("Name is keener on joining Club now. Interest: High."). The player also shows in the tipped list in the state.
//
// h: the popup headline. t: the news line. need: an extra condition for the template to be used
//   intl: a squad player shares the target's national team ({mate}, {nat})
//   home: the target's country is the club's country ({nat})
//   young: the target is 23 or younger. vet: the target is 29 or older.
//   bench: the target is not getting games at his club. league: the target plays in the same league.
// Fill ins: {t} the player, {c} his club, {pos} his position ("centre back"), {apos} the same with a or an,
// {fee} roughly his price, {cap} the club captain (the best player in the squad), {pl} another squad player,
// {you} the club, {age} his age, {lg} his league.
const TRANSFER_EVENTS = [
  // ---------- the captain has a word ----------
  { h: "Captain's tip", t: "{cap} knocked on your office door after training. He thinks the squad is {apos} short and says {t} at {c} is the answer. He has played against him and rates him. {c} want about {fee}." },
  { h: "A word from the skipper", t: "{cap} pulled you aside in the car park. \"Boss, get {t} in. He is the best {pos} I have faced this year.\" {c} would take around {fee}." },
  { h: "Captain on the phone", t: "{cap} rang you on his day off, which he never does. He has been talking to {t} of {c} and the {pos} would love to come. The fee would be about {fee}." },
  { h: "Skipper's shortlist", t: "{cap} handed you a scrap of paper with one name on it: {t}, {apos} at {c}. \"He fixes our problem,\" he said. Expect to pay about {fee}." },
  { h: "Captain vouches for him", t: "{cap} says he will personally look after {t} if you sign him. The {c} {pos} is a good lad, and around {fee} would do it." },
  { h: "Words at the bus", t: "On the team bus {cap} showed you clips of {t} on his phone for an hour. The {c} {pos} is exactly what we lack, he says. Around {fee}." },
  { h: "Captain's old mate", t: "{cap} and {t} came through together as kids. {cap} says the {c} {pos} is ready for a bigger stage and would jump at it. Price is about {fee}." },
  { h: "The armband speaks", t: "{cap} told the press the squad needs {apos}, then told you privately the man is {t} at {c}. He reckons {fee} gets it done." },
  { h: "Dinner with the captain", t: "Over dinner {cap} said the dressing room keeps talking about {t}. The {c} {pos} has been texting the lads. About {fee} would bring him in." },
  { h: "Captain's honest view", t: "{cap} was blunt: \"We will not win much without a proper {pos}.\" He named {t} of {c}, who has told him he wants the move. Around {fee}." },
  { h: "Skipper did the homework", t: "{cap} has watched every game {t} played this season. The {c} {pos} fits how we play, he says, and the price is about {fee}." },
  { h: "Captain's golf buddy", t: "{cap} played golf with {t} on the day off. The {c} {pos} lost badly and spent the back nine asking about life at {you}. He would cost about {fee}." },
  { h: "Captain wants backup", t: "{cap} says he is tired of carrying the load and wants {t} next to him. The {c} {pos} is keen and costs about {fee}." },
  { h: "Leader's request", t: "{cap} asked for one thing this window: {t}. The {c} {pos} has heard the captain wants him and is flattered. Think {fee}." },
  { h: "Captain heard a whisper", t: "{cap} heard in the players' lounge that {t} is restless at {c}. The {pos} would pick {you} over anyone. Around {fee}." },
  { h: "Skipper's final word", t: "{cap} finished the team meeting by saying one more {pos} wins us games. His pick is {t} at {c}, priced at about {fee}." },

  // ---------- a team mate from the national side ----------
  { h: "Back from duty", need: "intl", t: "{mate} is back from international duty with {nat} and says {t} would love to join. The {c} {pos} spent the whole camp asking about {you}. Around {fee}." },
  { h: "National team chat", need: "intl", t: "{mate} says the {nat} squad chat has gone wild since {t} said he fancies {you}. The {c} {pos} would cost about {fee}." },
  { h: "Room mates on duty", need: "intl", t: "{mate} roomed with {t} on {nat} duty. The {c} {pos} asked him a hundred questions about the club. He wants in, and about {fee} would do it." },
  { h: "A word from camp", need: "intl", t: "{mate} rang from the {nat} camp. {t} of {c} told him straight that he wants to play with him at club level too. The {pos} costs about {fee}." },
  { h: "International friends", need: "intl", t: "{mate} and {t} have been friends since their first {nat} cap. {mate} says the {c} {pos} is ready to move and would cost around {fee}." },
  { h: "Card games on duty", need: "intl", t: "{mate} beat {t} at cards every night of the {nat} trip, and every night {t} asked about {you}. The {c} {pos} is keen. Price is about {fee}." },
  { h: "Flight home talk", need: "intl", t: "On the flight home from {nat} duty, {t} told {mate} he is tired of {c}. The {pos} wants a new club, and about {fee} would get him." },
  { h: "Shared a pitch", need: "intl", t: "{mate} lined up with {t} for {nat} this week and says they click. The {c} {pos} would love the move. They want about {fee}." },
  { h: "Camp gossip", need: "intl", t: "The talk of the {nat} camp was {t} saying he would walk to {you}. {mate} confirms it. The {c} {pos} is priced at about {fee}." },
  { h: "A team mate vouches", need: "intl", t: "{mate} says {t} is the hardest worker in the {nat} squad. The {c} {pos} has asked him to put in a good word. Around {fee}." },
  { h: "Breakfast on duty", need: "intl", t: "{mate} shared breakfast with {t} every morning on {nat} duty. The {c} {pos} watches all our games and wants in. About {fee}." },
  { h: "Two caps, one club", need: "intl", t: "{mate} wants {t} as a club team mate too. The {c} {pos} told him at {nat} training he would sign tomorrow. They want around {fee}." },
  { h: "Anthem buddies", need: "intl", t: "{mate} and {t} stand side by side for the {nat} anthem. {t} says he would love to do it in our shirt too. The {c} {pos} costs about {fee}." },
  { h: "Text from the camp", need: "intl", t: "{mate} sent you a text from the {nat} hotel: \"{t} wants to come. Make it happen.\" The {c} {pos} is valued at about {fee}." },

  // ---------- agents on the line ----------
  { h: "Agent calling", t: "An agent rang this morning. His client {t} has always dreamed of playing for {you}. The {c} {pos} would cost about {fee}." },
  { h: "Dream move pitch", t: "The agent of {t} called to say the {c} {pos} grew up with a {you} poster on his wall. He wants the move, and about {fee} would do it." },
  { h: "Agent at the gate", t: "An agent turned up at the training ground uninvited, with a folder on {t}. The {c} {pos} is keen, he says, and costs about {fee}." },
  { h: "Late night call", t: "An agent rang at eleven at night. {t} is ready to leave {c} and wants {you} above everyone else. The {pos} would cost around {fee}." },
  { h: "Agent's video reel", t: "An agent emailed a ten minute video of {t}. The {c} {pos} looks sharp, and the note says he would sign for {you} in a heartbeat. About {fee}." },
  { h: "Persistent agent", t: "The same agent has called three days running. His man {t} at {c} only wants {you}. The {pos} is priced at about {fee}." },
  { h: "Agent over coffee", t: "Over coffee near the stadium, an agent laid it out: {t} wants out of {c}, and {you} is the club he picks. The {pos} costs about {fee}." },
  { h: "The agent's promise", t: "An agent promised his client {t} will not listen to anyone else if {you} call. The {c} {pos} would cost around {fee}." },
  { h: "Agent with a gift", t: "An agent sent a signed {c} shirt of {t} with a note: \"He would rather wear yours.\" The {pos} is valued at about {fee}." },
  { h: "Calm agent, clear message", t: "A very calm agent called to say {t} has turned down two clubs already. The {c} {pos} is waiting for {you}. About {fee}." },
  { h: "Agent's hint", t: "An agent dropped a hint at a charity event: {t} would love a move to {you}. The {c} {pos} costs about {fee}." },
  { h: "Agent named a price", t: "An agent rang and named a number straight away: about {fee} for {t}. The {c} {pos} wants the move and wants it this window." },
  { h: "Old school agent", t: "An agent who still uses a fax sent a page about {t}. The {c} {pos} has a {you} tattoo, the fax says. Price about {fee}." },
  { h: "Agent's long list", t: "An agent read out a list of clubs keen on {t}, then said the {c} {pos} only cares about one: {you}. About {fee}." },
  { h: "Agent at the hotel", t: "An agent found you at the team hotel and said {t} is desperate to join. The {c} {pos} would cost around {fee}." },
  { h: "A call from abroad", t: "An agent rang from the airport. {t} has asked to leave {c}, and the {pos} wants {you}. The fee would be about {fee}." },

  // ---------- old boys of the club ----------
  { h: "Club legend calls", t: "A club legend rang the office. He coaches {t} in the summer and says the {c} {pos} would be perfect here. Around {fee}." },
  { h: "Former striker's view", t: "Our former striker, now on TV, said on air that {t} belongs at {you}. The {c} {pos} liked the clip and wants to come. About {fee}." },
  { h: "Old captain's advice", t: "A former captain of the club came to watch training and told you to sign {t}. The {c} {pos} is a friend of his and keen. Around {fee}." },
  { h: "Ex player turned scout", t: "A former player who now scouts for fun sent you a report on {t}. The {c} {pos} is the real deal, he says, and costs about {fee}." },
  { h: "Former keeper's tip", t: "Our old keeper says {t} is the toughest {pos} he has coached at his academy. The {c} man wants the move. About {fee}." },
  { h: "Alumni dinner", t: "At the former players' dinner everyone was talking about {t}. The {c} {pos} was there as a guest and loved the place. Around {fee}." },
  { h: "Old boy's nephew", t: "A former player says his nephew plays with {t} and the {c} {pos} talks about {you} nonstop. He would cost about {fee}." },
  { h: "Legend in the stands", t: "A club legend sat with {t} at a match last weekend. The {c} {pos} asked him all about the club. He wants in, around {fee}." },
  { h: "Former coach knows him", t: "A former {you} player coaches at {c} now. He says {t} is the {pos} you need and that the lad is ready to go. About {fee}." },
  { h: "Testimonial talk", t: "At a testimonial game an old boy of the club played next to {t}. The {c} {pos} told him he would love to come here. Around {fee}." },
  { h: "Pundit's push", t: "A former {you} defender on the radio keeps naming {t} as our missing piece. The {c} {pos} heard it and messaged the club. About {fee}." },
  { h: "Hall of fame tip", t: "A hall of fame player for the club wrote you a letter about {t}. The {c} {pos} has the right attitude, he says. Around {fee}." },

  // ---------- scouts and reserves ----------
  { h: "Scout's hidden gem", need: "bench", t: "Your scout went to watch a reserve game and came back raving about {t}. The {c} {pos} barely plays there and wants out. About {fee}." },
  { h: "Rival's reserves", need: "bench", t: "Our scout spotted {t} in the {c} reserves. A {pos} that good should not be on the bench, and he knows it. Price is around {fee}." },
  { h: "Wasted on the bench", need: "bench", t: "Our scout counted the minutes: {t} has hardly played for {c}. The {pos} is fed up and would jump at {you}. About {fee}." },
  { h: "Under 23s standout", need: "bench", t: "A scout at an under 23 game says {t} was the best player there by a mile. The {c} {pos} is stuck behind others. Around {fee}." },
  { h: "Scout's report", t: "The scouting report on {t} landed on your desk: quick, clever and a fit for our system. The {c} {pos} is open to a move. About {fee}." },
  { h: "Scout in the rain", t: "Your scout stood in the rain for ninety minutes watching {t} and came back soaked and smiling. The {c} {pos} is the one. Around {fee}." },
  { h: "Numbers man's pick", t: "The club data analyst flagged {t} as the best value {pos} around. {c} would take about {fee}, and the player is keen." },
  { h: "Scout's second look", t: "Your scout went back to see {t} a second time and liked him even more. The {c} {pos} has heard of the interest and wants it. About {fee}." },
  { h: "Training ground spy", need: "league", t: "A scout watched {c} train from a public footpath. {t} looked like the best {pos} on the grass. He is open to {you}, about {fee}." },
  { h: "Scout's gut feeling", t: "Your chief scout says he has a gut feeling about {t}. The {c} {pos} is the sort who grows at a bigger club. Around {fee}." },
  { h: "Cup tie standout", t: "Our scout watched {t} in a cup tie and saw him run the show. The {c} {pos} wants to test himself at {you}. About {fee}." },
  { h: "Scout's phone call", t: "Your scout rang from a motorway services: \"Sign {t}.\" The {c} {pos} is available, keen and would cost about {fee}." },

  // ---------- family close by ----------
  { h: "Family nearby", t: "{t} has family living ten minutes from our ground. The {c} {pos} wants to be closer to them and would love the move. About {fee}." },
  { h: "Grandma lives here", t: "The grandma of {t} lives on the street behind our stadium. The {c} {pos} wants to be near her. Price is about {fee}." },
  { h: "Wife's home town", t: "The wife of {t} grew up in our city and wants to come home. The {c} {pos} is happy to follow. Around {fee}." },
  { h: "Kids at school here", t: "The children of {t} go to school near our training ground already. The {c} {pos} is tired of the long drives. About {fee}." },
  { h: "Brother in the city", t: "{t}'s brother just opened a cafe in our city. The {c} {pos} visits every week and would love to live here. Around {fee}." },
  { h: "Parents moved here", t: "The parents of {t} moved to our area last year. The {c} {pos} wants to be close to them. They want about {fee} for him." },
  { h: "Cousin on the staff", t: "One of our groundsmen is a cousin of {t}. The {c} {pos} has asked him to pass a message: he would love to sign. About {fee}." },
  { h: "New baby, new start", t: "{t} and his partner have a new baby and want to be near her family in our city. The {c} {pos} costs about {fee}." },
  { h: "Family business", t: "The family of {t} runs a restaurant five minutes from our ground. The {c} {pos} eats there every visit and wants to stay. Around {fee}." },
  { h: "Partner's new job", t: "The partner of {t} just got a job in our city. The {c} {pos} would love to move with her. The fee is about {fee}." },
  { h: "Old school nearby", t: "{t} went to school near our stadium before his family moved. The {c} {pos} wants to come back. About {fee}." },
  { h: "Uncle's season ticket", t: "{t}'s uncle has held a season ticket here for thirty years. The {c} {pos} says the family would never forgive him for saying no. Around {fee}." },

  // ---------- grew up a fan ----------
  { h: "Boyhood fan", t: "{t} grew up supporting {you}. The {c} {pos} still has his first kit. He would love to wear it for real. About {fee}." },
  { h: "Old photo surfaces", t: "A photo went round online of a young {t} in our shirt in the stands. The {c} {pos} says it is all true and he wants to come. Around {fee}." },
  { h: "He sang our songs", t: "{t} was filmed singing our songs at a wedding. The {c} {pos} laughed it off but admits he is a fan. About {fee}." },
  { h: "Season ticket kid", t: "{t} had a season ticket here as a boy. The {c} {pos} says playing for {you} is the dream. They want around {fee}." },
  { h: "Fan in the camp", t: "{t} watches every {you} game, even when {c} play the same day. The {pos} is a fan and wants to sign. About {fee}." },
  { h: "Shirt under the shirt", t: "{t} once wore our shirt under his {c} kit for luck, a team mate says. The {pos} would love the move. Around {fee}." },
  { h: "Childhood hero", t: "{t} says his childhood hero was a {you} player. The {c} {pos} wants to follow in his footsteps. Price is about {fee}." },
  { h: "Fan podcast guest", t: "{t} went on a {you} fan podcast and could not hide it: he is one of us. The {c} {pos} costs about {fee}." },
  { h: "Old ball boy", t: "{t} was a ball boy at our ground as a kid. The {c} {pos} wants to come back as a player. Around {fee}." },
  { h: "Stadium tour regular", t: "{t} has done our stadium tour three times, the guide says. The {c} {pos} is a fan and wants in. About {fee}." },
  { h: "His dad's club", t: "{t}'s dad took him to our games every week. The {c} {pos} wants to make his old man proud. They would want around {fee}." },
  { h: "Wallpaper in our colours", t: "{t} admits his childhood bedroom was painted in our colours. The {c} {pos} would sign tomorrow. About {fee}." },

  // ---------- the coach's old pupil ----------
  { h: "Coach's old pupil", t: "Your assistant coached {t} as a teenager. He says the {c} {pos} is a top professional who would follow him anywhere. About {fee}." },
  { h: "Fitness coach knows him", t: "Our fitness coach worked with {t} for two years and says he is a machine. The {c} {pos} wants to work with him again. Around {fee}." },
  { h: "Keeper coach's tip", t: "Our goalkeeping coach worked at {c} and says {t} is the best {pos} he saw there. The lad is open to a move. About {fee}." },
  { h: "Youth coach's favourite", t: "Our youth coach trained {t} as a boy. The {c} {pos} still calls him on his birthday and wants to join him here. Around {fee}." },
  { h: "Assistant's former star", t: "Your assistant had {t} at his old club and calls him the most coachable {pos} he ever had. He would leave {c} to work with him again. About {fee}." },
  { h: "Coach can unlock him", t: "Your coaching staff think {t} is wasted at {c}. The {pos} believes our coaches can make him better. Around {fee}." },
  { h: "Set piece coach's eye", t: "Our set piece coach says {t} is the best {pos} he has seen in the air in years. The {c} man is keen. About {fee}." },
  { h: "Old pupil reaches out", t: "{t} sent a message to your assistant saying he misses working with him. The {c} {pos} wants a reunion. Around {fee}." },
  { h: "Analyst's old player", t: "Our match analyst coached {t} at a summer camp years ago. The {c} {pos} remembers him fondly and wants in. About {fee}." },
  { h: "Coaching badge course", t: "Your assistant met {t} on a coaching badge course. The {c} {pos} said he wants to learn from our staff. Around {fee}." },
  { h: "Physio's old patient", t: "Our head physio fixed {t}'s knee years ago at another club. The {c} {pos} trusts him and wants to come. About {fee}." },
  { h: "Former mentor calls", t: "A coach on our staff was {t}'s mentor in the academy. The {c} {pos} still asks him for advice and wants to join him. Around {fee}." },

  // ---------- unhappy where he is ----------
  { h: "Fell out with his boss", t: "{t} has fallen out with the {c} manager and wants out. The {pos} likes the way {you} play. About {fee}." },
  { h: "Dropped for no reason", need: "bench", t: "{t} was dropped by {c} without a word of explanation. The {pos} is furious and wants a club that trusts him. Around {fee}." },
  { h: "Training ground row", t: "{t} had a row with his coach at {c} this week. The {pos} has told friends he wants a fresh start at {you}. About {fee}." },
  { h: "Played out of position", t: "{c} keep playing {t} out of position and he hates it. The natural {pos} wants a club that uses him right. Around {fee}." },
  { h: "Contract talks stalled", t: "Contract talks between {t} and {c} have gone nowhere. The {pos} is ready to move and likes {you}. About {fee}." },
  { h: "Fined and fed up", t: "{t} was fined by {c} for a late arrival he says was not his fault. The {pos} is done there. Around {fee}." },
  { h: "Not in the plans", need: "bench", t: "{c} have told {t} he is not in their plans. The {pos} wants to prove them wrong at {you}. About {fee}." },
  { h: "Wants a new voice", t: "{t} says he needs a new manager's voice after years at {c}. The {pos} has {you} at the top of his list. Around {fee}." },
  { h: "Public criticism", t: "The {c} manager criticised {t} in front of the press. The {pos} has not forgotten it and wants out. About {fee}." },
  { h: "Stuck in a rut", t: "{t} says he has gone stale at {c}. The {pos} wants a new challenge and would love {you}. Around {fee}." },
  { h: "Left out of the tour", need: "bench", t: "{t} was left behind when {c} went on their trip. The {pos} took it as a sign and wants to go. About {fee}." },
  { h: "Tactics do not suit", t: "{c} changed their system and {t} no longer fits. The {pos} thinks our style is made for him. Around {fee}." },

  // ---------- a friend in our dressing room ----------
  { h: "Best man's request", t: "{pl} was best man at {t}'s wedding. He says the {c} {pos} would love to play with him again. About {fee}." },
  { h: "Old team mates", t: "{pl} played with {t} for three seasons and calls him the best {pos} he has shared a pitch with. The {c} man is keen. Around {fee}." },
  { h: "Same agent, same idea", t: "{pl} and {t} share an agent, and the agent says {t} has been asking about {you}. The {c} {pos} would cost about {fee}." },
  { h: "Holiday together", t: "{pl} went on holiday with {t} this summer. The {c} {pos} talked about joining {you} all week. Around {fee}." },
  { h: "Childhood friends", t: "{pl} and {t} grew up on the same street. {pl} says the {c} {pos} is ready to come. About {fee}." },
  { h: "Gaming partners", t: "{pl} plays online games with {t} most nights. Between rounds, the {c} {pos} keeps asking about the club. Around {fee}." },
  { h: "Neighbours already", t: "{pl} lives next door to {t}, who drives past our training ground every day. The {c} {pos} wants to stop driving past. About {fee}." },
  { h: "Shared a flat once", t: "{pl} shared a flat with {t} when they were young. He says the {c} {pos} is the most driven player he knows. Around {fee}." },
  { h: "Wedding guest list", t: "{pl} saw {t} at a wedding and the {c} {pos} pulled him aside to ask how to get to {you}. About {fee}." },
  { h: "Group chat leak", t: "{pl} showed you a message from {t}: \"Get me there.\" The {c} {pos} is keen and costs around {fee}." },
  { h: "Sons in the same team", t: "{pl}'s son plays in the same kids team as the son of {t}. On the touchline the {c} {pos} said he wants the move. About {fee}." },
  { h: "Rehab partners", t: "{pl} did his injury rehab with {t} at the same clinic. The {c} {pos} says he wants to be team mates for real. Around {fee}." },

  // ---------- staff and backroom ----------
  { h: "Kit man's whisper", t: "The kit man heard from his friend at {c} that {t} wants out and has asked about {you}. The {pos} would cost about {fee}." },
  { h: "Chef's connection", t: "Our club chef used to cook at {c}. He says {t} is the nicest lad there and would love to come. The {pos} costs about {fee}." },
  { h: "Groundsman's tip", t: "Our head groundsman chatted to {t} at a pitch care event. The {c} {pos} loves our grass and wants to play on it. Around {fee}." },
  { h: "Doctor's report", t: "Our club doctor knows {t} from a medical conference. He says the {c} {pos} is fit as a fiddle and keen on {you}. About {fee}." },
  { h: "Bus driver knows best", t: "Our bus driver used to drive the {c} team. He says {t} always asked about our club. The {pos} costs around {fee}." },
  { h: "Receptionist's call", t: "The receptionist took a call from {t} himself, asking if anyone would talk to him. The {c} {pos} wants in. About {fee}." },
  { h: "Masseur's message", t: "Our masseur used to work with {t} and says the {c} {pos} asked him to pass on a message: he wants to join. Around {fee}." },
  { h: "Press officer heard", t: "Our press officer heard from a journalist that {t} has asked {c} to let him talk to {you}. The {pos} costs about {fee}." },
  { h: "Security guard's story", t: "One of our security guards worked at {c} and says {t} wore a {you} cap to training once. The {pos} costs around {fee}." },

  // ---------- media and the internet ----------
  { h: "Interview slip", t: "In an interview {t} called {you} his dream club. The {c} {pos} tried to walk it back, but the fans heard it. About {fee}." },
  { h: "A like on social media", t: "{t} liked a post saying he should join {you}. The {c} {pos} has not deleted it. Around {fee}." },
  { h: "Podcast confession", t: "On a podcast {t} admitted he would love to play for {you} one day. The {c} {pos} costs about {fee}." },
  { h: "Paper says yes", t: "A newspaper says {t} has told {c} he wants to move to {you}. Our sources say it is true. The {pos} would cost around {fee}." },
  { h: "Journalist's tip off", t: "A trusted journalist rang to say {t} is pushing for a move and wants {you}. The {c} {pos} is priced at about {fee}." },
  { h: "Video goes viral", t: "A video of {t} doing our goal celebration in training went viral. The {c} {pos} says it was a joke. It was not. About {fee}." },
  { h: "Fan forum buzz", t: "Our fan forum found out {t} follows a {you} fan account. The {c} {pos} is keen, his camp confirms. Around {fee}." },
  { h: "TV studio slip", t: "On a TV show {t} was asked which club he would join next and said {you} before he could stop himself. The {c} {pos} costs about {fee}." },
  { h: "Old tweet found", t: "Fans dug up an old post from {t}: \"One day I will play for {you}.\" The {c} {pos} says he still means it. Around {fee}." },
  { h: "Magazine interview", t: "In a magazine interview {t} named {you} as the club he admires most. The {c} {pos} would cost about {fee}." },
  { h: "Live stream comment", t: "On a live stream {t} told fans he would love to play in our stadium. The {c} {pos} costs around {fee}." },
  { h: "Radio phone in", t: "{t} rang into a radio show as a joke and ended up saying he wants to join {you}. The {c} {pos} is about {fee}." },

  // ---------- partners and life ----------
  { h: "Partner loves the city", t: "The partner of {t} visited our city on holiday and fell in love with it. The {c} {pos} is happy to follow. About {fee}." },
  { h: "Fresh start for the family", t: "{t} wants a fresh start for his family and has picked our city. The {c} {pos} would cost around {fee}." },
  { h: "Language school", t: "{t} has started lessons in our local language already. The {c} {pos} is serious about the move. About {fee}." },
  { h: "House hunting", t: "An estate agent let slip that {t} has been looking at houses near our training ground. The {c} {pos} costs around {fee}." },
  { h: "Weather matters", t: "{t} says he is tired of the weather where {c} play and likes ours. Odd reason, but the {pos} means it. About {fee}." },
  { h: "Dog park meeting", t: "You met {t} at a dog park on a scouting trip. The {c} {pos} asked you about the club before you could ask him. Around {fee}." },
  { h: "Sister at university", t: "{t}'s sister is at university in our city. The {c} {pos} wants to be close to her. About {fee}." },
  { h: "Charity work here", t: "{t} runs a charity with a project in our city. The {c} {pos} would love to live where his work is. Around {fee}." },
  { h: "Wants a quieter life", t: "{t} wants out of the noise around {c} and thinks {you} is the right home. The {pos} would cost about {fee}." },
  { h: "Restaurant chat", t: "Your chairman sat next to {t} in a restaurant. The {c} {pos} spent the meal asking about {you}. About {fee}." },

  // ---------- coming home ----------
  { h: "Coming home", need: "home", t: "{t} wants to come home to {nat}. The {c} {pos} has been away for years and {you} is the club he wants. About {fee}." },
  { h: "Homesick abroad", need: "home", t: "{t} is homesick at {c} and wants to play in {nat} again. The {pos} would love {you}. Around {fee}." },
  { h: "Mum wants him home", need: "home", t: "{t}'s mum told a local paper she wants her son home in {nat}. The {c} {pos} agrees. About {fee}." },
  { h: "Back to his roots", need: "home", t: "{t} says it is time to go back to his roots in {nat}. The {c} {pos} named {you} as his pick. Around {fee}." },
  { h: "Home league calling", need: "home", t: "After years abroad at {c}, {t} misses football in {nat}. The {pos} wants to finish his best years with {you}. About {fee}." },
  { h: "National boss approves", need: "home", t: "The {nat} coach has told {t} that playing at home would help his place. The {c} {pos} wants {you}. Around {fee}." },
  { h: "Missing home food", need: "home", t: "{t} says he misses the food back in {nat} more than anything. The {c} {pos} wants to come home to {you}. About {fee}." },
  { h: "Home crowd hero", need: "home", t: "{t} wants to play in front of a {nat} crowd every week. The {c} {pos} would sign for {you} tomorrow. Around {fee}." },

  // ---------- young players wanting a step up ----------
  { h: "Young and hungry", need: "young", t: "{t} is only {age} and wants a bigger stage. The {c} {pos} sees {you} as the next step. About {fee}." },
  { h: "Ready for the next level", need: "young", t: "The people around {t} say the {age} year old has outgrown {c}. The {pos} wants to test himself here. Around {fee}." },
  { h: "Youngster's big dream", need: "young", t: "{t}, {age}, told his youth coach he wants to play for {you}. The {c} {pos} costs about {fee}." },
  { h: "Wants to learn", need: "young", t: "{t} says he wants to learn from our senior players. The {age} year old {pos} at {c} would cost around {fee}." },
  { h: "Rising star's choice", need: "young", t: "{t} has big clubs watching, but the {age} year old {c} {pos} wants a club that will play him. That is {you}. About {fee}." },
  { h: "Academy graduate", need: "young", t: "{t} came through the {c} academy and wants his first big move. The {age} year old {pos} picks {you}. Around {fee}." },
  { h: "Under 21 standout", need: "young", t: "{t} was the best player at the under 21 tournament this summer. The {c} {pos} wants {you} next. About {fee}." },
  { h: "Wants minutes, now", need: "young", t: "{t} is {age} and says he needs games, not promises. The {c} {pos} likes how {you} trust young players. Around {fee}." },
  { h: "Teen with a plan", need: "young", t: "{t} has a plan for his career and {you} is step two. The {age} year old {c} {pos} costs about {fee}." },
  { h: "Breakthrough season", need: "young", t: "After a breakthrough year, {t} wants to keep climbing. The {age} year old {pos} at {c} wants {you}. Around {fee}." },

  // ---------- older players wanting one last challenge ----------
  { h: "One last big move", need: "vet", t: "{t} is {age} and wants one last big move before he slows down. The {c} {pos} likes {you}. About {fee}." },
  { h: "Wants to win something", need: "vet", t: "{t} has never won a trophy and thinks {you} can change that. The {c} {pos} costs around {fee}." },
  { h: "Experience on offer", need: "vet", t: "At {age}, {t} says he can teach our young players a thing or two. The {c} {pos} would cost about {fee}." },
  { h: "Veteran's last dance", need: "vet", t: "{t} wants his last good years at a club with a real crowd. The {c} {pos} named {you}. Around {fee}." },
  { h: "Still has the legs", need: "vet", t: "{t} says the numbers show he is as quick as ever at {age}. The {c} {pos} wants to prove it at {you}. About {fee}." },
  { h: "Old pro's pitch", need: "vet", t: "{t} rang you himself. The {age} year old {c} {pos} promised to lead by example. He costs about {fee}." },
  { h: "Wise head wanted", need: "vet", t: "Our young squad could use a wise head, and {t} wants to be it. The {c} {pos} is {age} and keen. Around {fee}." },
  { h: "Unfinished business", need: "vet", t: "{t} says he has unfinished business in this league and wants {you}. The {age} year old {c} {pos} costs about {fee}." },

  // ---------- chance meetings and odd angles ----------
  { h: "Airport encounter", t: "You bumped into {t} at the airport. The {c} {pos} recognised you and asked straight out if you wanted him. About {fee}." },
  { h: "Charity match chat", t: "At a charity match {t} played on your side and asked what it is like at {you}. The {c} {pos} is keen. Around {fee}." },
  { h: "Rival's reserve buzz", need: "league", t: "{t} is stuck in the {c} squad and our players say he is the best {pos} they faced this year. He wants to cross over. About {fee}." },
  { h: "Same league, new shirt", need: "league", t: "{t} has played against us twice and liked what he saw. The {c} {pos} would swap shirts for good. Around {fee}." },
  { h: "Handshake after the game", need: "league", t: "After our last game with {c}, {t} shook your hand and said \"call me\". The {pos} meant it. About {fee}." },
  { h: "Spotted at our game", t: "{t} was spotted in the stands at our last home game. The {c} {pos} says he came to see the place. Around {fee}." },
  { h: "Barber shop news", t: "Your barber also cuts {t}'s hair, and the {c} {pos} told him he wants to join {you}. About {fee}." },
  { h: "Taxi driver's tale", t: "A taxi driver who drove {t} last week says the {c} {pos} talked about {you} the whole way. Around {fee}." },
  { h: "Gym encounter", t: "{t} trains at the same gym as your fitness coach. The {c} {pos} asked him to pass on that he is keen. About {fee}." },
  { h: "Summer camp friends", t: "{t} helped at our summer kids camp as a favour to a friend. The {c} {pos} loved the club. Around {fee}." },
  { h: "Award night chat", t: "At an awards night {t} was seated at our table. The {c} {pos} spent the evening asking about {you}. Around {fee}." },
  { h: "Tennis partner", t: "Your chairman plays tennis with {t}'s father. The {c} {pos} wants the move, the father says. About {fee}." },
  { h: "Fan letter answered", t: "A young fan wrote to {t} asking him to join {you}. The {c} {pos} wrote back: \"I would love to.\" Around {fee}." }
];

if (typeof module !== "undefined" && module.exports) module.exports = { TRANSFER_EVENTS };
