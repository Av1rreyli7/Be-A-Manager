// Extra clubs and players, 2025-26 season style squads.
// Same format as players.js: each player is [name, position, age, rating].
// Market value is computed by the same formula, so these slot straight into the game.

const EXTRA_CLUBS = {
  // ---------------- LA LIGA (more) ----------------
  "Valencia": { league: "La Liga", squad: [
    ["Julen Agirrezabala","GK",25,78],
    ["Cesar Tarrega","DF",24,76],["Mouctar Diakhaby","DF",29,76],["Jose Gaya","DF",30,78],["Thierry Correia","DF",26,74],["Dimitri Foulquier","DF",33,72],
    ["Javi Guerra","MF",22,80],["Pepelu","MF",27,77],["Andre Almeida","MF",25,75],["Luis Rioja","MF",32,73],
    ["Hugo Duro","FW",26,76],["Diego Lopez","FW",24,76],["Arnaut Danjuma","FW",28,75],["Dani Raba","FW",30,72]
  ]},
  "Celta Vigo": { league: "La Liga", squad: [
    ["Ionut Radu","GK",28,75],
    ["Carl Starfelt","DF",30,75],["Marcos Alonso","DF",35,71],["Javi Rodriguez","DF",23,73],
    ["Fran Beltran","MF",27,76],["Ilaix Moriba","MF",23,76],["Hugo Sotelo","MF",21,74],
    ["Iago Aspas","FW",38,74],["Borja Iglesias","FW",32,76],["Bryan Zaragoza","FW",24,77],["Pablo Duran","FW",24,75],["Williot Swedberg","FW",22,76]
  ]},
  "Girona": { league: "La Liga", squad: [
    ["Paulo Gazzaniga","GK",33,76],
    ["Arnau Martinez","DF",22,77],["Daley Blind","DF",35,72],["David Lopez","DF",36,70],["Alejandro Frances","DF",23,74],
    ["Axel Witsel","MF",37,72],["Ivan Martin","MF",26,75],["Oriol Romeu","MF",34,70],
    ["Viktor Tsyhankov","FW",28,79],["Vladyslav Vanat","FW",23,78],["Bryan Gil","FW",24,77],["Cristhian Stuani","FW",39,70],["Portu","FW",33,71]
  ]},
  "Osasuna": { league: "La Liga", squad: [
    ["Sergio Herrera","GK",32,74],
    ["Alejandro Catena","DF",31,74],["Juan Cruz","DF",25,74],["Valentin Rosier","DF",29,73],
    ["Lucas Torro","MF",31,72],["Jon Moncayola","MF",27,76],["Aimar Oroz","MF",24,77],
    ["Ante Budimir","FW",34,77],["Ruben Garcia","FW",32,72],["Sheraldo Becker","FW",30,73]
  ]},
  "Getafe": { league: "La Liga", squad: [
    ["David Soria","GK",32,76],
    ["Domingos Duarte","DF",30,73],["Djene","DF",34,72],["Kiko Femenia","DF",34,71],["Diego Rico","DF",32,71],
    ["Mauro Arambarri","MF",30,77],["Luis Milla","MF",31,74],["Mario Martin","MF",21,73],
    ["Borja Mayoral","FW",28,78],["Adrian Liso","FW",20,75],["Coba da Costa","FW",20,73]
  ]},
  "Mallorca": { league: "La Liga", squad: [
    ["Leo Roman","GK",25,75],
    ["Antonio Raillo","DF",34,72],["Martin Valjent","DF",30,74],["Mateu Morey","DF",25,73],["Johan Mojica","DF",33,72],
    ["Sergi Darder","MF",32,76],["Samu Costa","MF",25,76],["Manu Morlanes","MF",26,74],
    ["Vedat Muriqi","FW",31,77],["Pablo Torre","FW",22,77],["Takuma Asano","FW",31,73],["Mateo Joseph","FW",22,75]
  ]},
  "Rayo Vallecano": { league: "La Liga", squad: [
    ["Augusto Batalla","GK",29,75],
    ["Florian Lejeune","DF",34,73],["Ivan Balliu","DF",34,71],["Pep Chavarria","DF",27,73],["Aridane Hernandez","DF",36,69],
    ["Isi Palazon","MF",31,77],["Unai Lopez","MF",30,74],["Pathe Ciss","MF",31,73],["Oscar Valentin","MF",31,72],
    ["Jorge de Frutos","FW",28,76],["Alvaro Garcia","FW",33,74],["Fran Perez","FW",23,74],["Randy Nteka","FW",28,72]
  ]},
  "Espanyol": { league: "La Liga", squad: [
    ["Marko Dmitrovic","GK",34,74],
    ["Leandro Cabrera","DF",34,71],["Fernando Calero","DF",30,73],["Omar El Hilali","DF",22,75],["Carlos Romero","DF",24,74],
    ["Pol Lozano","MF",26,73],["Edu Exposito","MF",29,74],["Urko Gonzalez","MF",24,73],
    ["Javi Puado","FW",27,76],["Roberto Fernandez","FW",23,74],["Kike Garcia","FW",36,70],["Pere Milla","FW",33,70]
  ]},
  "Alaves": { league: "La Liga", squad: [
    ["Antonio Sivera","GK",29,74],
    ["Facundo Garces","DF",26,73],["Nahuel Tenaglia","DF",29,72],["Moussa Diarra","DF",25,73],
    ["Antonio Blanco","MF",25,75],["Ander Guevara","MF",28,73],["Carlos Vicente","MF",26,75],
    ["Lucas Boye","FW",30,74],["Toni Martinez","FW",28,73],["Carles Alena","MF",28,74]
  ]},
  "Elche": { league: "La Liga", squad: [
    ["Matias Dituro","GK",38,70],
    ["David Affengruber","DF",24,74],["Victor Chust","DF",25,73],["Alvaro Nunez","DF",25,72],
    ["Marc Aguado","MF",24,73],["Aleix Febas","MF",29,72],["Grady Diangana","MF",27,73],
    ["Rafa Mir","FW",28,75],["Andre Silva","FW",30,75],["Alvaro Rodriguez Elche","FW",21,74]
  ]},
  "Levante": { league: "La Liga", squad: [
    ["Mathew Ryan","GK",33,73],
    ["Unai Elgezabal","DF",32,70],["Adrian de la Fuente","DF",24,71],["Manu Sanchez","DF",25,73],
    ["Pablo Martinez","MF",31,71],["Oriol Rey","MF",28,71],["Carlos Alvarez","MF",22,76],
    ["Karl Etta Eyong","FW",22,77],["Ivan Romero","FW",25,73],["Roger Brugue","FW",29,72]
  ]},
  "Real Oviedo": { league: "La Liga", squad: [
    ["Aaron Escandell","GK",30,72],
    ["David Costas","DF",30,71],["Nacho Vidal","DF",30,70],["Rahim Alhassane","DF",24,70],
    ["Santi Cazorla","MF",41,68],["Alberto Reina","MF",29,71],["Kwasi Sibo","MF",27,72],
    ["Salomon Rondon","FW",36,71],["Fede Vinas","FW",27,72],["Haissem Hassan","FW",24,71]
  ]},

  // ---------------- SERIE A (more) ----------------
  "Fiorentina": { league: "Serie A", squad: [
    ["Beto","FW",27,77],
    ["David de Gea","GK",35,80],
    ["Pietro Comuzzo","DF",20,78],["Marin Pongracic","DF",28,76],["Robin Gosens","DF",31,77],["Dodo","DF",27,79],
    ["Rolando Mandragora","MF",28,76],["Nicolo Fagioli","MF",24,77],["Simon Sohm","MF",24,76],["Hans Nicolussi Caviglia","MF",25,74],
    ["Albert Gudmundsson","FW",28,79],["Roberto Piccoli","FW",24,76],["Jacopo Fazzini","MF",22,76],["Edin Dzeko","FW",39,71]
  ]},
  "Lazio": { league: "Serie A", squad: [
    ["Ivan Provedel","GK",31,78],
    ["Alessio Romagnoli","DF",31,78],["Nuno Tavares","DF",26,77],["Adam Marusic","DF",33,74],["Manuel Lazzari","DF",32,73],
    ["Nicolo Rovella","MF",24,79],["Matteo Guendouzi","MF",26,78],["Danilo Cataldi","MF",31,74],["Fisayo Dele-Bashiru","MF",24,75],
    ["Mattia Zaccagni","FW",30,79],["Taty Castellanos","FW",27,78],["Boulaye Dia","FW",29,76],["Gustav Isaksen","FW",24,76],["Pedro","FW",38,72]
  ]},
  "Bologna": { league: "Serie A", squad: [
    
    ["Nicolo Cambiaghi","FW",25,74],
    ["Tommaso Pobega","MF",27,74],
    ["Lukasz Skorupski","GK",34,76],
    ["Torbjorn Heggem","DF",26,75],["Emil Holm","DF",25,75],["Juan Miranda","DF",26,74],
    ["Lewis Ferguson","MF",26,79],["Remo Freuler","MF",33,76],["Giovanni Fabbian","MF",22,75],
    ["Riccardo Orsolini","FW",28,80],["Ciro Immobile","FW",35,74],["Federico Bernardeschi","FW",31,74]
  ]},
  "Como": { league: "Serie A", squad: [
    ["Robert Sanchez","GK",28,81],
    ["Moise Kean","FW",25,82],
    ["Trevoh Chalobah","DF",26,80],
    ["Jean Butez","GK",30,74],
    ["Marc-Oliver Kempf","DF",30,74],["Jacobo Ramon","DF",20,75],["Alex Valle","DF",21,75],["Alberto Moreno","DF",33,71],
    ["Nico Paz","MF",21,84],["Maximo Perrone","MF",23,76],["Lucas Da Cunha","MF",24,74],["Sergi Roberto","MF",33,72],
    ["Alvaro Morata","FW",33,77],["Assane Diao","FW",20,78],["Tasos Douvikas","FW",26,76],["Jesus Rodriguez","FW",20,76]
  ]},
  "Torino": { league: "Serie A", squad: [
    ["Franco Israel","GK",25,74],
    ["Guillermo Maripan","DF",31,75],["Saul Coco","DF",26,75],["Adam Masina","DF",31,71],
    ["Cesare Casadei","MF",23,77],["Kristjan Asllani","MF",23,77],["Ivan Ilic","MF",24,75],
    ["Giovanni Simeone","FW",30,76],["Che Adams","FW",29,76],["Nikola Vlasic","FW",28,76],["Duvan Zapata","FW",34,72],["Cyril Ngonge","FW",25,75]
  ]},
  "Udinese": { league: "Serie A", squad: [
    ["Maduka Okoye","GK",26,74],
    ["Thomas Kristensen","DF",23,75],["Christian Kabasele","DF",34,70],["Kingsley Ehizibue","DF",30,71],["Hassane Kamara","DF",31,72],
    ["Sandi Lovric","MF",27,75],["Jesper Karlstrom","MF",30,74],["Arthur Atta","MF",22,75],
    ["Keinan Davis","FW",27,74],["Iker Bravo","FW",20,76],["Adam Buksa","FW",29,74],["Nicolo Zaniolo","FW",26,75]
  ]},
  "Genoa": { league: "Serie A", squad: [
    ["Nicola Leali","GK",32,73],
    ["Johan Vasquez","DF",27,76],["Alessandro Marcandalli","DF",23,73],["Brooke Norton-Cuffy","DF",21,75],["Aaron Martin","DF",28,73],
    ["Morten Frendrup","MF",24,77],["Ruslan Malinovskyi","MF",32,74],["Patrizio Masini","MF",24,73],
    ["Vitinha Genoa","FW",25,74],["Albert Gronbaek","FW",24,74],["Lorenzo Colombo","FW",23,74],["Jeff Ekhator","FW",19,74]
  ]},
  "Cagliari": { league: "Serie A", squad: [
    ["Elia Caprile","GK",24,77],
    ["Yerry Mina","DF",31,74],["Sebastiano Luperto","DF",29,73],["Gabriele Zappa","DF",26,73],
    ["Michel Adopo","MF",25,73],["Matteo Prati","MF",22,74],["Alessandro Deiola","MF",30,72],
    ["Sebastiano Esposito","FW",23,76],["Andrea Belotti","FW",32,73],["Gianluca Gaetano","FW",25,74],["Leonardo Pavoletti","FW",37,68]
  ]},
  "Parma": { league: "Serie A", squad: [
    
    ["Botond Balogh","DF",23,73],["Enrico Delprato","DF",26,73],["Emanuele Valeri","DF",27,73],["Mathias Lovik","DF",24,72],
    ["Adrian Bernabe","MF",24,76],["Mandela Keita","MF",23,74],["Nahuel Estevez","MF",30,72],
    ["Mateo Pellegrino","FW",24,75],["Patrick Cutrone","FW",28,73],["Jacob Ondrejka","FW",23,74],["Pontus Almqvist","FW",26,72]
  ]},
  "Sassuolo": { league: "Serie A", squad: [
    ["Arijanet Muric","GK",27,74],
    ["Tarik Muharemovic","DF",22,74],["Josh Doig","DF",23,75],["Filippo Romagna","DF",28,71],
    ["Daniel Boloca","MF",27,75],["Kristian Thorstvedt","MF",26,75],["Nemanja Matic","MF",37,70],
    ["Domenico Berardi","FW",31,79],["Armand Lauriente","FW",26,77],["Andrea Pinamonti","FW",26,75],["Alieu Fadera","FW",24,73]
  ]},
  "Cremonese": { league: "Serie A", squad: [
    ["Emil Audero","GK",28,74],
    ["Federico Baschirotto","DF",29,74],["Matteo Bianchetti","DF",32,70],["Giuseppe Pezzella","DF",28,71],
    ["Jari Vandeputte","MF",29,74],["Franco Vazquez","MF",36,70],["Michele Collocolo","MF",26,72],
    ["Jamie Vardy","FW",39,73],["Federico Bonazzoli","FW",28,73],["Antonio Sanabria","FW",29,74]
  ]},

  // ---------------- BUNDESLIGA (more) ----------------
  "Wolfsburg": { league: "Bundesliga", squad: [
    ["Kamil Grabara","GK",27,76],
    ["Konstantinos Koulierakis","DF",22,77],["Moritz Jenz","DF",26,75],["Denis Vavro","DF",29,74],["Kilian Fischer","DF",25,73],
    ["Maximilian Arnold","MF",31,76],["Mattias Svanberg","MF",26,75],["Vinicius Souza","MF",26,75],
    ["Mohamed Amoura","FW",25,79],["Jonas Wind","FW",26,77],["Lovro Majer","MF",28,76],["Adam Daghim","FW",20,75]
  ]},
  "Borussia Monchengladbach": { league: "Bundesliga", squad: [
    ["Moritz Nicolas","GK",28,74],
    ["Marvin Friedrich","DF",30,73],["Joe Scally","DF",23,75],["Lukas Ullrich","DF",21,73],
    ["Rocco Reitz","MF",23,76],["Philipp Sander","MF",27,73],["Jens Castrop","MF",22,74],
    ["Tim Kleindienst","FW",30,77],["Franck Honorat","FW",29,75],["Haris Tabakovic","FW",31,73],["Shuto Machino","FW",26,75]
  ]},
  "Freiburg": { league: "Bundesliga", squad: [
    ["Noah Atubolu","GK",23,78],
    ["Matthias Ginter","DF",32,76],["Philipp Lienhart","DF",29,75],["Kiliann Sildillia","DF",23,74],["Christian Gunter","DF",32,72],
    ["Vincenzo Grifo","MF",32,76],["Johan Manzambi","MF",20,76],["Maximilian Eggestein","MF",29,74],["Patrick Osterhage","MF",25,74],
    ["Lucas Holer","FW",31,74],["Igor Matanovic","FW",22,75],["Junior Adamu","FW",24,74]
  ]},
  "Hoffenheim": { league: "Bundesliga", squad: [
    ["Oliver Baumann","GK",35,76],
    ["Albian Hajdari","DF",22,74],["Kevin Akpoguma","DF",30,72],["Vladimir Coufal","DF",33,72],
    ["Grischa Promel","MF",30,73],["Leon Avdullahu","MF",21,75],["Wouter Burger","MF",24,75],
    ["Andrej Kramaric","FW",34,76],["Fisnik Asllani","FW",23,76],["Tim Lemperle","FW",23,74]
  ]},
  "Mainz": { league: "Bundesliga", squad: [
    ["Robin Zentner","GK",31,75],
    ["Dominik Kohr","DF",31,73],["Anthony Caci","DF",28,73],["Stefan Bell","DF",34,69],["Danny da Costa","DF",32,70],
    ["Nadiem Amiri","MF",29,76],["Kaishu Sano","MF",25,76],["Paul Nebel","MF",23,76],
    ["Nelson Weiper","FW",20,75],["Armindo Sieb","FW",22,73],["Jae-sung Lee","MF",33,72]
  ]},
  "Werder Bremen": { league: "Bundesliga", squad: [
    ["Niclas Fullkrug","FW",32,77],
    ["Mio Backhaus","GK",21,74],
    ["Marco Friedl","DF",27,74],["Niklas Stark","DF",30,72],["Amos Pieper","DF",27,72],["Felix Agu","DF",26,72],
    ["Romano Schmid","MF",25,76],["Jens Stage","MF",29,74],["Senne Lynen","MF",26,73],
    ["Samuel Mbangula","FW",21,75],["Justin Njinmah","FW",25,74],["Marco Grull","FW",27,73],["Keke Topp","FW",21,73]
  ]},
  "Augsburg": { league: "Bundesliga", squad: [
    ["Finn Dahmen","GK",27,74],
    ["Jeffrey Gouweleeuw","DF",34,71],["Keven Schlotterbeck","DF",28,73],["Chrislain Matsima","DF",23,74],
    ["Kristijan Jakic","MF",28,73],["Elvis Rexhbecaj","MF",28,72],["Robin Fellhauer","MF",27,72],
    ["Fabian Rieder","MF",23,75],["Phillip Tietz","FW",28,73],["Samuel Essende","FW",27,74],["Anton Kade","FW",21,74]
  ]},
  "Union Berlin": { league: "Bundesliga", squad: [
    ["Frederik Ronnow","GK",33,75],
    ["Diogo Leite","DF",26,75],["Danilho Doekhi","DF",27,75],["Leopold Querfeld","DF",22,75],["Christopher Trimmel","DF",38,68],
    ["Rani Khedira","MF",31,73],["Janik Haberer","MF",31,72],["Aljoscha Kemlein","MF",21,73],
    ["Andrej Ilic","FW",25,74],["Ilyas Ansah","FW",21,75],["Oliver Burke","FW",28,73],["Tim Skarke","FW",29,70]
  ]},
  "FC Koln": { league: "Bundesliga", squad: [
    ["Marvin Schwabe","GK",30,73],
    ["Timo Hubers","DF",29,73],["Rav van den Berg","DF",21,75],["Joel Schmied","DF",27,72],
    ["Eric Martel","MF",23,75],["Denis Huseinbasic","MF",24,74],["Isak Johannesson","MF",22,75],
    ["Said El Mala","FW",19,77],["Jakub Kaminski","FW",23,75],["Ragnar Ache","FW",27,74],["Marius Bulter","FW",32,71]
  ]},
  "Hamburg": { league: "Bundesliga", squad: [
    ["Daniel Heuer Fernandes","GK",33,73],
    ["Jordan Torunarigha","DF",28,73],["Miro Muheim","DF",27,74],
    ["Jonas Meffert","MF",31,72],["Nicolai Remberg","MF",25,72],["Fabio Vieira","MF",25,77],
    ["Rayan Philippe","FW",25,73],["Robert Glatzel","FW",32,72],["Jean-Luc Dompe","FW",30,72]
  ]},
  "St Pauli": { league: "Bundesliga", squad: [
    ["Nikola Vasilj","GK",30,74],
    ["Hauke Wahl","DF",31,72],["Karol Mets","DF",32,70],["Manolis Saliakas","DF",29,72],
    ["Jackson Irvine","MF",32,74],["Connor Metcalfe","MF",26,72],["Joel Fujita","MF",23,73],
    ["Andreas Hountondji","FW",23,73],["Danel Sinani","FW",28,72],["Mathias Pereira Lage","FW",29,71],["Martijn Kaars","FW",26,72]
  ]},

  // ---------------- LIGUE 1 (more) ----------------
  "Nice": { league: "Ligue 1", squad: [
    ["Yehvann Diouf","GK",26,75],
    ["Melvin Bard","DF",25,75],["Dante","DF",42,68],["Jordan Lotomba","DF",27,73],["Antoine Mendy","DF",21,74],
    ["Hicham Boudaoui","MF",26,75],["Morgan Sanson","MF",31,72],["Salis Abdul Samed","MF",25,73],
    ["Terem Moffi","FW",26,77],["Sofiane Diop","FW",25,76],["Jeremie Boga","FW",29,75],["Isak Jansson","FW",23,74]
  ]},
  "Lens": { league: "Ligue 1", squad: [
    ["Robin Risser","GK",21,75],
    ["Jonathan Gradit","DF",33,73],["Malang Sarr","DF",26,73],["Ruben Aguilar","DF",32,71],["Matthieu Udol","DF",29,73],
    ["Adrien Thomasson","MF",32,73],["Mamadou Sangare","MF",23,74],["Fode Sylla","MF",21,72],
    ["Florian Thauvin","FW",33,76],["Odsonne Edouard","FW",27,74],["Wesley Said","FW",30,72],["Rayan Fofana","FW",20,73]
  ]},
  "Rennes": { league: "Ligue 1", squad: [
    ["Brice Samba","GK",31,78],
    ["Anthony Rouault","DF",24,75],["Christopher Wooh","DF",24,74],["Lilian Brassier","DF",26,74],["Hans Hateboer","DF",31,71],
    ["Valentin Rongier","MF",31,76],["Seko Fofana","MF",30,76],["Djaoui Cisse","MF",21,74],
    ["Breel Embolo","FW",28,76],["Ludovic Blas","FW",28,76],["Esteban Lepaul","FW",25,76],["Mousa Al-Tamari","FW",28,74]
  ]},
  "Strasbourg": { league: "Ligue 1", squad: [
    ["Mike Penders","GK",20,77],
    ["Julien Barre","DF",21,71],["Ben Chilwell","DF",29,76],["Ismael Doukoure","DF",22,74],
    ["Valentin Barco","MF",21,76],["Kendry Paez","MF",18,76],["Samir Caetano","DF",26,72],
    ["Emanuel Emegha","FW",23,79],["Dilane Bakwa","FW",23,78],["Joaquin Panichelli","FW",23,77],["Abdoul Ouattara","FW",20,74]
  ]},
  "Toulouse": { league: "Ligue 1", squad: [
    ["Guillaume Restes","GK",20,77],
    ["Mark McKenzie","DF",26,74],["Charlie Cresswell","DF",23,75],["Rasmus Nicolaisen","DF",28,73],
    ["Cristian Casseres","MF",26,73],["Aron Donnum","MF",27,74],["Dayann Methalie","MF",20,71],
    ["Frank Magri","FW",26,73],["Yann Gboho","FW",24,75],["Emersonn","FW",21,73],["Santiago Hidalgo","FW",21,73]
  ]},
  "Nantes": { league: "Ligue 1", squad: [
    ["Anthony Lopes","GK",35,73],
    ["Nicolas Cozza","DF",26,72],["Chidozie Awaziem","DF",28,72],["Fabien Centonze","DF",29,70],
    ["Pedro Chirivella","MF",28,73],["Louis Leroux","MF",21,74],["Johann Lepenant","MF",23,74],
    ["Matthis Abline","FW",22,76],["Mostafa Mohamed","FW",28,73],["Herba Guirassy","FW",20,72]
  ]},
  "Brest": { league: "Ligue 1", squad: [
    ["Radoslaw Majecki","GK",26,74],
    ["Brendan Chardonnet","DF",31,72],["Bradley Locko","DF",23,74],["Kenny Lala","DF",34,70],
    ["Pierre Lees-Melou","MF",32,74],["Hugo Magnetti","MF",27,72],["Kamory Doumbia","MF",22,74],
    ["Ludovic Ajorque","FW",31,73],["Romain Del Castillo","FW",29,74],["Mama Balde","FW",30,72],["Pathe Mboup","FW",20,73]
  ]},
  "Auxerre": { league: "Ligue 1", squad: [
    ["Donovan Leon","GK",33,71],
    ["Clement Akpa","DF",23,73],["Sinaly Diomande","DF",24,72],["Marcelo Frantzdy","DF",26,70],
    ["Elisha Owusu","MF",28,72],["Kevin Danois","MF",21,72],
    ["Gaetan Perrin","FW",29,73],["Lassine Sinayoko","FW",26,73],["Danny Namaso","FW",25,72]
  ]},
  "Angers": { league: "Ligue 1", squad: [
    ["Herve Koffi","GK",29,72],
    ["Ousmane Camara","DF",22,72],["Cedric Hountondji","DF",31,70],["Jordan Lefort","DF",32,69],
    ["Himad Abdelli","MF",26,74],["Louis Mouton","MF",22,71],["Yassin Belkhdim","MF",23,71],
    ["Sidiki Cherif","FW",19,73],["Prosper Peter","FW",20,72],["Farid El Melali","FW",28,71]
  ]},
  "Lorient": { league: "Ligue 1", squad: [
    ["Yvon Mvogo","GK",31,73],
    ["Montassar Talbi","DF",27,73],["Panos Katseris","DF",24,72],["Igor Silva","DF",29,70],
    ["Laurent Abergel","MF",32,71],["Arsene Kouassi","MF",21,72],["Dermane Karim","MF",22,71],
    ["Mohamed Bamba","FW",24,73],["Tosin Aiyegun","FW",27,72],["Pablo Pagis","FW",22,72]
  ]},
  "Le Havre": { league: "Ligue 1", squad: [
    ["Mory Diaw","GK",32,71],
    ["Arouna Sangante","DF",23,73],["Gautier Lloris","DF",30,70],["Etienne Youte","DF",27,71],
    ["Abdoulaye Toure","MF",32,73],["Rassoul Ndiaye","MF",24,72],
    ["Yassine Kechta","FW",23,73],["Issa Soumare","FW",25,72],["Andre Ayew","FW",36,69]
  ]},
  "Metz": { league: "Ligue 1", squad: [
    ["Jonathan Fischer","GK",27,70],
    ["Koffi Kouao","DF",27,71],["Sadibou Sane","DF",24,71],["Maxime Colin","DF",34,68],
    ["Boubacar Traore","MF",24,72],["Kevin Van Den Kerkhof","MF",29,70],
    ["Habib Diallo","FW",30,73],["Gauthier Hein","FW",29,72],["Brian Madjo","FW",20,72]
  ]},
  "Paris FC": { league: "Ligue 1", squad: [
    ["Obed Nkambadio","GK",22,73],
    ["Thibault De Smet","DF",27,71],["Samir Chergui","DF",25,71],["Nhoa Sangui","DF",20,73],
    ["Maxime Lopez","MF",28,74],["Ilan Kebbal","MF",27,75],["Adama Camara","MF",22,72],
    ["Jean-Philippe Krasso","FW",28,73],["Moses Simon","FW",30,74],["Willem Geubbels","FW",24,73]
  ]},

  // ---------------- CHAMPIONSHIP (more English clubs) ----------------
  "Ipswich": { league: "Championship", squad: [
    ["Abdul Fatawu","FW",21,77],
    ["Daizen Maeda","FW",28,78],
    ["Sasa Lukic","MF",30,77],
    ["Julio Enciso","MF",21,76],
    ["Exequiel Palacios","MF",27,82],
    ["Alex Palmer","GK",29,74],
    ["Dara O'Shea","DF",26,76],["Jacob Greaves","DF",25,75],["Leif Davis","DF",26,75],
    ["Jens Cajuste","MF",26,75],["Sam Morsy","MF",34,71],["Azor Matusiwa","MF",27,74],["Marcelino Nunez","MF",26,75],
    ["Jaden Philogene","FW",23,76],["George Hirst","FW",26,74],["Sammie Szmodics","FW",30,75],["Chiedozie Ogbene","FW",28,73]
  ]},
  "Sheffield United": { league: "Championship", squad: [
    ["Michael Cooper","GK",26,75],
    ["Japhet Tanganga","DF",26,74],["Mark McGuinness","DF",24,73],["Sam McCallum","DF",25,72],
    ["Callum O'Hare","MF",27,74],["Sydie Peck","MF",21,73],
    ["Tyrese Campbell","FW",26,74],["Louie Barry","FW",22,73],["Andre Brooks","FW",22,72]
  ]},
  "West Brom": { league: "Championship", squad: [
    ["Josh Griffiths","GK",24,72],
    ["Darnell Furlong","DF",30,72],["Mason Holgate","DF",29,72],["Torbjorn Kallman","DF",26,70],
    ["Jayson Molumby","MF",26,73],["Alex Mowatt","MF",30,72],["Isaac Price","MF",22,74],
    ["Josh Maja","FW",27,74],["Karlan Grant","FW",28,72],["Aune Heggebo","FW",24,72]
  ]},
  "Middlesbrough": { league: "Championship", squad: [
    ["Sol Brynn","GK",25,72],
    ["Darragh Lenihan","DF",31,72],["George Edmundson","DF",28,71],["Neto Borges","DF",29,72],
    ["Dan Barlaser","MF",28,72],["Aidan Morris","MF",24,73],
    ["Morgan Whittaker","FW",24,75],["Tommy Conway","FW",23,74],["David Strelec","FW",24,75]
  ]},
  "Norwich": { league: "Championship", squad: [
    ["Vladan Kovacevic","GK",27,72],
    ["Callum Doyle","DF",22,74],["Jose Cordoba","DF",24,73],["Jack Stacey","DF",29,70],
    ["Kenny McLean","MF",33,72],["Mathias Kvistgaarden","MF",23,74],["Emiliano Marcondes","MF",30,70],
    ["Josh Sargent","FW",25,76],["Ante Crnac","FW",21,73],["Oscar Schwartau","FW",21,72]
  ]},
  "Watford": { league: "Championship", squad: [
    ["Egil Selvik","GK",27,71],
    ["Ryan Porteous","DF",26,72],["Francisco Sierralta","DF",28,72],["James Abankwah","DF",21,72],
    ["Imran Louza","MF",26,73],["Giorgi Chakvetadze","MF",26,73],["Hector Kyprianou","MF",24,72],
    ["Vakoun Bayo","FW",28,72],["Kwadwo Baah","FW",22,73],["Rocco Vata","FW",20,72],["Moussa Sissoko","MF",36,68]
  ]},
  "Coventry": { league: "Championship", squad: [
    ["Gustavo Hamer","MF",28,77],
    ["Caleb Yirenkyi","MF",20,77],
    ["Carl Rushworth","GK",24,73],
    ["Milan van Ewijk","DF",25,74],["Luis Binks","DF",24,72],["Jay Dasilva","DF",27,71],
    ["Jack Rudoni","MF",24,75],["Victor Torp","MF",25,74],["Josh Eccles","MF",25,72],
    ["Haji Wright","FW",27,74],["Ellis Simms","FW",24,74],["Brandon Thomas-Asante","FW",26,73],["Tatsuhiro Sakamoto","FW",29,73]
  ]},
  "Stoke": { league: "Championship", squad: [
    ["Viktor Johansson","GK",27,74],
    ["Ben Gibson","DF",32,70],["Ashley Phillips","DF",20,73],["Eric Bocat","DF",26,70],
    ["Jordan Thompson","MF",28,71],["Bosun Lawal","MF",22,73],["Lewis Baker","MF",30,71],
    ["Divin Mubama","FW",21,73],["Million Manhoef","FW",23,74],["Tom Cannon","FW",23,73]
  ]},
  "Birmingham": { league: "Championship", squad: [
    ["Ryan Allsop","GK",33,71],
    ["Christoph Klarer","DF",25,73],["Ethan Laird","DF",24,73],["Alex Cochrane","DF",25,72],
    ["Paik Seung-ho","MF",28,73],["Tommy Doyle","MF",24,73],["Kieran Dowell","MF",28,71],
    ["Jay Stansfield","FW",23,75],["Kyogo Furuhashi","FW",30,75],["Marvin Ducksch","FW",31,74],["Demarai Gray","FW",29,74]
  ]},
  "Wrexham": { league: "Championship", squad: [
    ["Danny Ward","GK",32,72],
    ["Max Cleworth","DF",23,72],["Lewis Brunt","DF",25,70],["Ryan Longman","DF",25,70],
    ["George Dobson","MF",27,71],["Josh Windass","MF",31,73],["George Thomason","MF",24,71],["Matty James","MF",34,68],
    ["Kieffer Moore","FW",33,73],["Nathan Broadhead","FW",27,73],["Sam Smith","FW",27,71],["Ryan Hardie","FW",28,71]
  ]},
  "Blackburn": { league: "Championship", squad: [
    ["Balazs Toth","GK",28,71],
    ["Dominic Hyam","DF",30,71],["Owen Beck","DF",23,73],["Sean McLoughlin","DF",28,70],
    ["Lewis Travis","MF",28,72],["Todd Cantwell","MF",27,73],["Sondre Tronstad","MF",30,71],
    ["Yuki Ohashi","FW",29,72],["Igor Tyjon","FW",20,71],["Emmanuel Dennis","FW",28,72]
  ]},
  "Hull": { league: "Championship", squad: [
    ["Mohamed-Ali Cho","FW",21,75],
    ["Ivor Pandur","GK",25,72],
    ["Lewie Coyle","DF",30,70],["Alfie Jones","DF",28,71],["John Egan","DF",33,69],
    ["Regan Slater","MF",26,71],["Kasey Palmer","MF",29,71],["Amir Hadziahmetovic","MF",28,71],
    ["Oli McBurnie","FW",29,73],["Joel Ndala","FW",20,72],["Kyle Joseph","FW",24,71]
  ]},
  "Millwall": { league: "Championship", squad: [
    ["Lukas Jensen","GK",26,71],
    ["Jake Cooper","DF",31,72],["Murray Wallace","DF",32,69],["Danny McNamara","DF",27,70],
    ["George Saville","MF",32,70],["Camiel Neghli","MF",24,72],["Billy Mitchell","MF",24,71],
    ["Mihailo Ivanovic","FW",21,74],["Femi Azeez","FW",26,71],["Macaulay Langstaff","FW",28,71]
  ]},
  "Preston": { league: "Championship", squad: [
    ["Daniel Iversen","GK",28,72],
    ["Jordan Storey","DF",28,71],["Andrew Hughes","DF",33,68],["Liam Lindsay","DF",30,70],
    ["Ben Whiteman","MF",29,71],["Ali McCann","MF",26,72],["Ryan Ledson","MF",28,70],
    ["Milutin Osmajic","FW",26,73],["Emil Riis","FW",27,72],["Daniel Jebbison","FW",22,72]
  ]},
  "Portsmouth": { league: "Championship", squad: [
    ["Nicolas Schmid","GK",26,71],
    ["Conor Shaughnessy","DF",29,70],["Regan Poole","DF",27,70],["Connor Ogilvie","DF",29,69],
    ["Marlon Pack","MF",34,68],["Andre Dozzell","MF",26,71],["Freddie Potts POR","MF",22,72],
    ["Colby Bishop","FW",29,72],["Josh Murphy","FW",30,71],["John Swift","FW",30,71]
  ]},
  "QPR": { league: "Championship", squad: [
    ["Paul Nardi","GK",31,70],
    ["Steve Cook","DF",34,68],["Jimmy Dunne","DF",28,70],["Kenneth Paal","DF",28,70],
    ["Sam Field","MF",27,72],["Jonathan Varane","MF",24,71],["Harvey Vale","MF",22,72],
    ["Ilias Chair","FW",28,74],["Michael Frey","FW",31,70],["Rumarn Burrell","FW",25,70]
  ]},

  // ---------------- EREDIVISIE (more) ----------------
  "AZ Alkmaar": { league: "Eredivisie", squad: [
    ["Rome-Jayden Owusu-Oduro","GK",21,75],
    ["Wouter Goes","DF",21,76],["Alexandre Penetra","DF",24,73],["Denso Kasius","DF",23,73],
    ["Sven Mijnans","MF",25,76],["Peer Koopmeiners","MF",25,74],["Kees Smit","MF",19,76],["Jordy Clasie","MF",34,70],
    ["Troy Parrott","FW",23,77],["Mexx Meerdink","FW",22,75],["Ibrahim Sadiq","FW",25,74]
  ]},
  "Twente": { league: "Eredivisie", squad: [
    ["Lars Unnerstall","GK",35,73],
    ["Max Bruns","DF",23,72],["Bas Kuipers","DF",31,70],["Anass Salah","DF",24,70],
    ["Michel Vlap","MF",28,73],["Mathias Kjolo","MF",24,71],["Sayf Ltaief","FW",26,72],
    ["Ricky van Wolfswinkel","FW",36,68],["Daan Rots","FW",24,72],["Kristian Hlynsson","MF",21,73]
  ]},
  "Utrecht": { league: "Eredivisie", squad: [
    ["Vasilis Barkas","GK",31,72],
    ["Mike van der Hoorn","DF",33,69],["Souffian El Karouani","DF",25,74],["Nick Viergever","DF",36,67],
    ["Oscar Fraulo","MF",22,73],["Can Bozdogan","MF",24,72],["Yoann Cathline","FW",23,73],
    ["Sebastien Haller","FW",31,74],["David Min","FW",26,72],["Victor Jensen","MF",25,72],["Miguel Rodriguez","FW",22,72]
  ]},

  // ---------------- PORTUGAL (more) ----------------
  "Braga": { league: "Primeira Liga", squad: [
    ["Lukas Hornicek","GK",23,74],
    ["Sikou Niakate","DF",26,74],["Robson Bambu","DF",28,72],["Victor Gomez","DF",25,73],
    ["Vitor Carvalho","MF",28,74],["Joao Moutinho","MF",39,70],["Gabri Martinez","MF",24,76],
    ["Ricardo Horta","FW",31,78],["Pau Victor","FW",24,75],["Fran Navarro","FW",27,74],["Amine El Ouazzani","FW",24,73]
  ]},

  // ---------------- BELGIUM ----------------
  "Club Brugge": { league: "Belgian Pro League", squad: [
    ["Simon Mignolet","GK",37,74],["Nordin Jackers","GK",28,72],
    ["Joel Ordonez","DF",21,78],["Brandon Mechele","DF",32,73],["Bjorn Meijer","DF",22,74],["Kyriani Sabbe","DF",20,74],
    ["Hans Vanaken","MF",33,77],["Raphael Onyedika","MF",24,76],["Aleksandar Stankovic","MF",20,75],
    ["Carlos Forbs","FW",21,75],["Romeo Vermant","FW",21,74],["Hugo Vetlesen","MF",25,74]
  ]},
  "Union SG": { league: "Belgian Pro League", squad: [
    ["Kjell Scherpen","GK",25,74],
    ["Fedde Leysen","DF",22,73],["Christian Burgess","DF",34,69],["Ross Sykes","DF",26,72],
    ["Adem Zorgane","MF",25,74],["Anan Khalaili","MF",21,73],["Kamiel Van de Perre","MF",20,72],
    ["Promise David","FW",24,76],["Anouar Ait El Hadj","FW",23,74],["Kevin Rodriguez","FW",25,73]
  ]},
  "Genk": { league: "Belgian Pro League", squad: [
    ["Hendrik Van Crombrugge","GK",32,72],
    ["Matte Smets","DF",21,74],["Mujaid Sadick","DF",25,72],["Zakaria El Ouahdi","DF",24,74],
    ["Bryan Heynen","MF",28,74],["Jarne Steuckers","MF",23,74],["Patrik Hrosovsky","MF",33,70],
    ["Konstantinos Karetsas","FW",18,77],["Oh Hyeon-gyu","FW",24,75],["Yira Sor","FW",25,73]
  ]},
  "Anderlecht": { league: "Belgian Pro League", squad: [
    ["Colin Coosemans","GK",33,72],
    ["Lucas Hey","DF",22,73],["Killian Sardella","DF",23,73],["Ludwig Augustinsson","DF",31,70],
    ["Yari Verschaeren","MF",24,74],["Nathan De Cat","MF",17,74],["Theo Leoni","MF",25,72],
    ["Thorgan Hazard","FW",32,73],["Luis Vazquez","FW",24,72],["Adriano Bertaccini","FW",25,73]
  ]},

  // ---------------- TURKEY (more) ----------------
  "Fenerbahce": { league: "Super Lig", squad: [
    ["Nathan Ake","DF",30,81],
    ["Ederson","GK",32,84],
    ["Milan Skriniar","DF",30,79],["Caglar Soyuncu","DF",29,74],["Archie Brown","DF",23,75],["Nelson Semedo","DF",32,75],
    ["Marco Asensio","MF",30,78],["Sebastian Szymanski","MF",26,77],["Fred","MF",32,76],["Ismail Yuksek","MF",26,74],
    ["Jhon Duran","FW",22,79],["Youssef En-Nesyri","FW",28,77],["Anderson Talisca","FW",31,75],["Dorgeles Nene","FW",22,75]
  ]},
  "Besiktas": { league: "Super Lig", squad: [
    ["Leandro Trossard","FW",31,81],
    ["Mert Gunok","GK",36,73],
    ["Gabriel Paulista","DF",35,70],["Emirhan Topcu","DF",25,73],["David Jurasek","DF",25,72],["Jonas Svensson","DF",32,70],
    ["Salih Ucan","MF",31,72],["Demir Ege Tiknaz","MF",20,73],["Kartal Yilmaz","MF",22,71],
    ["Tammy Abraham","FW",28,78],["Rafa Silva","FW",32,78],["Jota Silva","FW",26,74],["El Bilal Toure","FW",24,75]
  ]},

  // ---------------- SAUDI (more) ----------------
  "Al-Ittihad": { league: "Saudi Pro League", squad: [
    ["Predrag Rajkovic","GK",30,75],
    ["Danilo Pereira","DF",34,74],["Ahmed Al-Julaydan","DF",24,70],["Saad Al-Mousa","DF",23,70],
    ["N'Golo Kante","MF",34,80],["Fabinho","MF",32,76],["Houssem Aouar","MF",27,76],
    ["Karim Benzema","FW",38,80],["Moussa Diaby","FW",26,82],["Steven Bergwijn","FW",28,77]
  ]},
  "Al-Ahli": { league: "Saudi Pro League", squad: [
    ["Edouard Mendy","GK",33,77],
    ["Roger Ibanez","DF",27,78],["Merih Demiral","DF",27,76],["Ali Majrashi","DF",25,70],
    ["Franck Kessie","MF",29,77],["Enzo Millot","MF",23,78],["Ziyad Al-Johani","MF",21,71],
    ["Ivan Toney","FW",29,81],["Riyad Mahrez","FW",35,79],["Galeno","FW",28,77],["Firas Al-Buraikan","FW",25,74]
  ]},
  "Al-Qadsiah": { league: "Saudi Pro League", squad: [
    ["Tijjani Reijnders","MF",27,84],
    ["Koen Casteels","GK",33,76],
    ["Nacho Fernandez","DF",36,73],["Ezequiel Fernandez","MF",23,76],["Ali Lajami","DF",29,70],
    ["Nahitan Nandez","MF",30,74],["Cameron Puertas","MF",27,75],
    ["Mateo Retegui","FW",26,82],["Julian Quinones","FW",28,75],["Christopher Bonsu Baah","FW",21,74]
  ]},

  // ---------------- MLS (more) ----------------
  "LA Galaxy": { league: "MLS", squad: [
    ["Novak Micovic","GK",25,71],
    ["Maya Yoshida","DF",37,68],["John Nelson","DF",27,70],["Zanka","DF",35,67],
    ["Riqui Puig","MF",26,77],["Marco Reus","MF",36,75],["Gaston Brugman","MF",33,70],
    ["Joseph Paintsil","FW",28,75],["Matheus Nascimento","FW",21,72],["Christian Ramirez","FW",34,68]
  ]},
  "San Diego FC": { league: "MLS", squad: [
    ["CJ Dos Santos","GK",25,70],
    ["Andres Reyes","DF",26,72],["Christopher McVey","DF",30,69],
    ["Luca de la Torre","MF",27,72],["Anibal Godoy","MF",35,68],
    ["Hirving Lozano","FW",30,76],["Anders Dreyer","FW",27,75],["Onni Valakari","MF",26,72],["Marcus Ingvartsen","FW",30,71]
  ]},
  "Atlanta United": { league: "MLS", squad: [
    ["Brad Guzan","GK",41,66],
    ["Stian Gregersen","DF",30,71],["Brooks Lennon","DF",28,71],
    ["Alexey Miranchuk","MF",30,75],["Bartosz Slisz","MF",26,72],
    ["Emmanuel Latte Lath","FW",26,74],["Miguel Almiron","FW",31,74],["Jamal Thiare","FW",32,68]
  ]}
};

// Round two of the expansion: more of South America, Mexico and Europe's best of the rest.
Object.assign(EXTRA_CLUBS, {
  "Santos": { league: "Brasileirao", squad: [
    ["Gabriel Brazao","GK",25,73],["JP Chermont","DF",19,72],["Ze Ivaldo","DF",28,71],["Luan Peres","DF",31,71],["Alexis Duarte","DF",25,71],["Escobar","DF",24,70],["Ze Rafael","MF",32,72],["Victor Hugo","MF",21,72],["Bontempo","MF",21,70],["Benjamin Rollheiser","FW",25,74],["Neymar","FW",33,82],["Guilherme","FW",30,74],["Tiquinho Soares","FW",34,72]
  ]},
  "Botafogo": { league: "Brasileirao", squad: [
    ["Leo Linck","GK",24,70],["Alexander Barboza","DF",30,73],["Vitinho","DF",26,71],["Cuiabano","DF",22,72],["Mateo Ponte","DF",22,71],["Marlon Freitas","MF",30,73],["Allan","MF",29,72],["Newton","MF",24,71],["Savarino","MF",28,74],["Artur","FW",27,73],["Arthur Cabral","FW",27,74],["Jeffinho","FW",26,72]
  ]},
  "Corinthians": { league: "Brasileirao", squad: [
    ["Hugo Souza","GK",26,74],["Felipe Longo","GK",20,68],["Matheuzinho","DF",25,72],["Gustavo Henrique","DF",32,71],["Fabrizio Angileri","DF",31,70],["Andre Ramalho","DF",33,70],["Raniele","MF",28,71],["Rodrigo Garro","MF",27,75],["Breno Bidon","MF",20,72],["Andre Carrillo","MF",34,71],["Memphis Depay","FW",31,77],["Yuri Alberto","FW",24,75],["Angel Romero","FW",33,71]
  ]},
  "Cruzeiro": { league: "Brasileirao", squad: [
    ["Cassio","GK",38,72],["Fabricio Bruno","DF",29,74],["Villalba","DF",26,71],["William","DF",30,70],["Kaiki","DF",22,71],["Jonathan Jesus","DF",24,70],["Lucas Romero","MF",31,71],["Matheus Henrique","MF",27,73],["Christian","MF",24,72],["Matheus Pereira","MF",29,76],["Kaio Jorge","FW",23,76],["Gabigol","FW",29,74],["Luis Sinisterra","FW",26,73]
  ]},
  "Racing Club": { league: "Argentina", squad: [
    ["Facundo Cambeses","GK",28,72],["Gabriel Arias","GK",38,70],["Marcos Rojo","DF",35,70],["Nazareno Colombo","DF",25,70],["Gaston Martirena","DF",25,71],["Franco Pardo","DF",25,70],["Santiago Sosa","MF",26,73],["Agustin Almendra","MF",25,72],["Juan Nardoni","MF",23,73],["Luciano Vietto","FW",31,72],["Adrian Martinez","FW",33,74],["Santiago Solari","FW",26,71],["Tomas Conechny","FW",27,70],["Duvan Vergara","FW",29,72]
  ]},
  "Club America": { league: "Liga MX", squad: [
    ["Luis Malagon","GK",28,74],["Kevin Alvarez","DF",26,71],["Sebastian Caceres","DF",26,73],["Israel Reyes","DF",25,71],["Cristian Borja","DF",32,70],["Ramon Juarez","DF",24,71],["Alvaro Fidalgo","MF",28,75],["Erick Sanchez","MF",26,72],["Alexis Gutierrez","MF",25,70],["Brian Rodriguez","FW",25,73],["Alejandro Zendejas","FW",27,74],["Henry Martin","FW",33,73],["Rodrigo Aguirre","FW",31,71],["Victor Davila","FW",27,72]
  ]},
  "Monterrey": { league: "Liga MX", squad: [
    ["Luis Cardenas","GK",30,70],["Sergio Ramos","DF",39,76],["Victor Guzman","DF",30,71],["Gerardo Arteaga","DF",27,72],["Stefan Medina","DF",33,70],["Jorge Rodriguez","MF",27,71],["Fidel Ambriz","MF",22,72],["Oliver Torres","MF",31,73],["Sergio Canales","MF",34,77],["Jesus Corona","FW",32,72],["German Berterame","FW",26,74],["Roberto de la Rosa","FW",25,70],["Lucas Ocampos","FW",31,74]
  ]},
  "Tigres": { league: "Liga MX", squad: [
    ["Nahuel Guzman","GK",39,72],["Javier Aquino","DF",35,70],["Joaquim","DF",26,72],["Jesus Angulo","DF",27,71],["Jesus Garza","DF",24,70],["Marco Farfan","DF",26,70],["Rafael Carioca","MF",36,70],["Fernando Gorriaran","MF",31,73],["Juan Brunetta","MF",28,75],["Diego Lainez","FW",25,72],["Andre-Pierre Gignac","FW",40,73],["Nicolas Ibanez","FW",30,72],["Ozziel Herrera","FW",24,71]
  ]},
  "Olympiacos": { league: "Greece", squad: [
    ["Konstantinos Tzolakis","GK",23,75],["Panagiotis Retsos","DF",27,72],["Lorenzo Pirola","DF",23,73],["Rodinei","DF",33,70],["Santiago Hezze","MF",24,74],["Chiquinho","MF",30,72],["Dani Garcia","MF",34,70],["Daniel Podence","FW",30,74],["Ayoub El Kaabi","FW",32,75],["Gelson Martins","FW",30,72],["Mehdi Taremi","FW",33,76]
  ]},
  "RB Salzburg": { league: "Austria", squad: [
    ["Alexander Schlager","GK",29,73],["Jacob Rasmussen","DF",28,71],["Joane Gadou","DF",18,72],["Frans Kratzig","DF",22,71],["Aleksa Terzic","DF",26,70],["Mads Bidstrup","MF",24,73],["Maurits Kjaergaard","MF",22,74],["Soumaila Diabate","MF",20,71],["Petar Ratkov","FW",22,72],["Edmund Baidoo","FW",20,71],["Yorbe Vertessen","FW",24,73],["Karim Konate","FW",21,74]
  ]},
  "Copenhagen": { league: "Denmark", squad: [
    ["Dominik Kotarski","GK",25,73],["Pantelis Hatzidiakos","DF",28,71],["Gabriel Pereira","DF",24,71],["Marcos Lopez","DF",26,72],["Birger Meling","DF",31,70],["Magnus Mattsson","MF",26,72],["William Clem","MF",21,71],["Jordan Larsson","FW",28,72],["Viktor Claesson","FW",33,72],["Youssoufa Moukoko","FW",21,73],["Andreas Cornelius","FW",32,71],["Mohamed Elyounoussi","FW",31,72]
  ]},
  "Dinamo Zagreb": { league: "Croatia", squad: [
    ["Ivan Nevistic","GK",27,71],["Raul Torrente","DF",24,70],["Sergi Dominguez","DF",20,71],["Moris Valincic","DF",24,70],["Niko Galesic","DF",24,70],["Mauro Perkovic","DF",21,69],["Josip Misic","MF",32,73],["Luka Stojkovic","MF",21,72],["Miha Zajc","MF",31,71],["Sandro Kulenovic","FW",26,72],["Dion Drena Beljo","FW",23,72],["Monsef Bakrar","FW",24,70],["Arber Hoxha","FW",26,71]
  ]}
});

// and can actually sell under the "no selling below 13 players" rule.
const EXTRA_DEPTH = {
  // Prem fringe and academy depth
  "Arsenal": [["Tommy Setford","GK",19,68],["Maldini Kacurri","DF",20,69],["Josh Nichols","DF",19,68],["Andre Harriman-Annous","FW",18,67]],
  "Man City": [["Marcus Bettinelli","GK",33,68],["Stephen Mfuni","DF",18,68],["Jacob Wright","MF",20,69],["Reigan Heskey","FW",17,67]],
  "Liverpool": [["Armin Pecsi","GK",20,69],["Calum Scanlon","DF",20,68],["Trey Nyoni","MF",18,71],["Kieran Morrison","MF",18,68]],
  "Chelsea": [["Ted Curd","GK",19,67],["Ishe Samuels-Smith","DF",19,69],["Reggie Walsh","MF",17,68],["Shim Mheuka","FW",18,69]],
  "Man United": [["Tom Heaton","GK",39,66],["Tyler Fredricson","DF",20,69],["Jack Fletcher","MF",18,68],["Ethan Wheatley","FW",19,68]],
  "Tottenham": [["Brandon Austin","GK",26,68],["Tosin Adarabioyo","DF",28,79],["Conor Gallagher","MF",25,80],["Will Lankshear","FW",20,70]],
  "Newcastle": [["Mark Gillespie","GK",33,65],["Alex Murphy","DF",21,70],["Joe White","MF",22,68],["Sean Neave","FW",18,68]],
  "Aston Villa": [["Sam Proctor","GK",18,66],["Lamare Bogarde","DF",21,70],["Ben Broggio","MF",18,67]],
  "Brighton": [["Tom McGill","GK",25,67],["Odel Offiah","DF",22,69],["Harry Howell","MF",18,68],["Tommy Watson","FW",19,71]],
  "West Ham": [["Wes Foderingham","GK",34,67],["Kaelan Casey","DF",20,68],["Lewis Orford","MF",19,68],["Callum Marshall","FW",20,70]],
  "Everton": [["Mark Travers","GK",26,71],["Roman Dixon","DF",20,68],["Harrison Armstrong","MF",18,70]],
  "Fulham": [["Steven Benda","GK",27,69],["Luc de Fougerolles","DF",20,69]],
  "Crystal Palace": [["Remi Matthews","GK",31,66],["Caleb Kporha","DF",19,68],["Justin Devenny","MF",22,70]],
  "Bournemouth": [["Will Dennis","GK",25,66],["Veljko Milosavljevic","DF",18,71],["Ben Winterburn","MF",19,67],["Zain Silcott-Duberry","FW",18,68]],
  "Brentford": [["Matthew Cox","GK",22,69],["Benjamin Fredrick","DF",20,69],["Yunus Konak","MF",19,70],["Iwan Morgan","FW",19,68]],
  "Nottingham Forest": [["Aaron Bott","GK",20,65],["Zach Abbott","DF",19,69],["Ben Perry","MF",19,67]],
  "Wolves": [["Tom King","GK",30,66],["Alfie Pond","DF",20,68],["Luke Rawlings","MF",19,66]],
  "Burnley": [["Vaclav Hladky","GK",34,68],["Hannes Delcroix","DF",26,71],["Oliver Sonne","DF",25,70]],
  "Leeds United": [["Alex Cairns","GK",32,65],["James Debayo","DF",20,68],["Sam Chambers","MF",18,68]],
  "Sunderland": [["Simon Moore","GK",35,65],["Zak Johnson","DF",20,67],["Harrison Jones","MF",20,68]],
  // round two club top ups
  "Santos": [["Joao Schmidt","MF",32,70]],
  "Botafogo": [["Kaio Pantaleao","DF",29,70],["Joaquin Correa","FW",31,73]],
  "Corinthians": [["Jose Martinez","MF",31,70]],
  "Cruzeiro": [["Leo Aragao","GK",24,68]],
  "Monterrey": [["Iker Fimbres","MF",20,72]],
  "Tigres": [["Juan Pablo Vigon","MF",34,69]],
  "Olympiacos": [["Francisco Ortega","DF",26,72],["Christos Mouzakitis","MF",18,74]],
  "RB Salzburg": [["Stefan Lainer","DF",33,70],["Kerim Alajbegovic","FW",18,72]],
  "Copenhagen": [["Lukas Lerager","MF",32,71],["Rodrigo Huescas","DF",22,73]],
  "Dinamo Zagreb": [["Gonzalo Villar","MF",27,72]],
  // originals
  "Athletic Bilbao": [["Alex Padilla","GK",22,73],["Aymeric Laporte","DF",31,79],["Inigo Lekue","DF",32,71],["Unai Gomez","MF",22,74],["Maroan Sannadi","FW",24,74]],
  "Real Sociedad": [["Jon Ander Olasagasti","MF",25,73],["Sergio Gomez","DF",25,76],["Duje Caleta-Car","DF",29,74],["Carlos Soler","MF",29,77],["Umar Sadiq","FW",28,74]],
  "Real Betis": [["Pau Lopez","GK",31,75],["Aitor Ruibal","DF",29,73],["Sofyan Amrabat","MF",29,76],["Rodrigo Riquelme","FW",25,76]],
  "Sevilla": [["Orjan Nyland","GK",35,72],["Cesar Azpilicueta","DF",36,71],["Tanguy Nianzou","DF",23,74],["Peque Fernandez","MF",25,73],["Akor Adams","FW",25,74]],
  "RB Leipzig": [["Maarten Vandevoordt","GK",23,76],["El Chadaille Bitshiabu","DF",20,75],["Ridle Baku","DF",27,74],["Assan Ouedraogo","MF",19,78],["Conrad Harder","FW",20,76]],
  "Eintracht Frankfurt": [["Aurele Amenda","DF",22,74],["Oscar Hojlund","MF",21,73],["Michy Batshuayi","FW",32,72]],
  "Stuttgart": [["Fabian Bredlow","GK",30,72],["Luca Jaquez","DF",22,74],["Nikolas Nartey","MF",25,71],["Bilal El Khannouss","MF",21,79]],
  "Lyon": [["Dominik Greif","GK",28,74],["Ruben Kluivert","DF",24,73],["Abner","DF",25,74],["Orel Mangala","MF",27,75],["Adam Karabec","MF",22,74]],
  "Lille": [["Arnaud Bodart","GK",27,73],["Aissa Mandi","DF",34,71],["Nathan Ngoy","DF",22,74],["Andre Gomes","MF",32,73]],
  "Ajax": [["Remko Pasveer","GK",42,68],["Ko Itakura","DF",28,76],["Lucas Rosa","DF",25,71],["Steven Berghuis","FW",34,73],["Oliver Edvardsen","FW",26,72]],
  "PSV": [["Nick Olij","GK",30,73],["Armando Obispo","DF",26,73],["Mauro Junior","DF",26,73],["Esmir Bajraktarevic","FW",20,73]],
  "Feyenoord": [["Justin Bijlow","GK",28,74],["Jordan Bos","DF",23,75],["Tsuyoshi Watanabe","DF",28,74],["Jakub Moder","MF",26,74],["Oussama Targhalline","MF",23,73],["Leo Sauer","FW",19,74]],
  "Benfica": [["Samuel Soares","GK",23,72],["Tomas Araujo","DF",23,77],["Enzo Barrenechea","MF",24,75],["Andreas Schjelderup","FW",21,76],["Gianluca Prestianni","FW",19,74]],
  "Porto": [["Claudio Ramos","GK",34,71],["Zaid Romero","DF",25,73],["Dominik Prpic","DF",21,73],["Stephen Eustaquio","MF",29,76],["Deniz Gul","FW",21,73]],
  "Sporting CP": [["Eduardo Quaresma","DF",23,75],["Matheus Reis","DF",30,74],["Hidemasa Morita","MF",30,76]],
  "Galatasaray": [["Gunay Guvenc","GK",34,70],["Kazimcan Karatas","DF",23,72],["Roland Sallai","FW",28,76],["Mario Lemina","MF",32,75],["Yunus Akgun","FW",25,75]],
  "Al-Hilal": [["Ali Al-Bulaihi","DF",36,70],["Hassan Al-Tambakti","DF",26,73],["Mohamed Kanno","MF",31,72],["Nasser Al-Dawsari","MF",27,72],["Abdullah Al-Hamdan","FW",26,71]],
  "Al-Nassr": [["Nawaf Al-Aqidi","GK",25,71],["Mohammed Simakan","DF",25,78],["Sultan Al-Ghannam","DF",31,71],["Ayman Yahya","DF",23,71],["Abdullah Al-Khaibari","MF",29,71],["Mohammed Maran","FW",24,70]],
  "Inter Miami": [["Rocco Rios Novo","GK",23,69],["Noah Allen","DF",21,71],["Tomas Aviles","DF",22,72],["Telasco Segovia","MF",22,73],["Allen Obando","FW",19,70]],
  "LAFC": [["Thomas Hasal","GK",26,68],["Eddie Segura","DF",28,71],["Sergi Palencia","DF",29,70],["Eduard Atuesta","MF",28,72],["Jeremy Ebobisse","FW",28,71],["David Martinez","FW",19,73]],
  "Celtic": [["Viljami Sinisalo","GK",24,72],["Auston Trusty","DF",27,73],["Paulo Bernardo","MF",23,74],["Michel-Ange Balikwisha","FW",24,74],["Johnny Kenny","FW",22,71]],
  "Rangers": [["Liam Kelly","GK",30,70],["Derek Cornelius","DF",28,72],["Jefte","DF",22,73],["Connor Barron","MF",23,72],["Findlay Curtis","FW",19,71]],
  "Leicester": [["Ben Nelson","DF",21,72],["Luke Thomas","DF",26,71],["Boubakary Soumare","MF",26,74],["Patson Daka","FW",27,74],["Bobby De Cordova-Reid","FW",32,71]],
  "Southampton": [["Alex McCarthy","GK",36,70],["Ronnie Edwards","DF",22,73],["Armel Bella-Kotchap","DF",24,73],["Joe Aribo","MF",29,73],["Will Smallbone","MF",25,72],["Leo Scienza","FW",27,73],["Damion Downs","FW",21,73]],
  "Boca Juniors": [["Leandro Brey","GK",23,71],["Nicolas Figal","DF",31,71],["Lautaro Blanco","DF",26,71],["Milton Delgado","MF",20,74],["Tomas Belmonte","MF",27,72],["Exequiel Zeballos","FW",23,73],["Milton Gimenez","FW",29,72]],
  "River Plate": [["Jeremias Ledesma","GK",32,71],["Paulo Diaz","DF",31,73],["Gonzalo Montiel","DF",28,74],["Kevin Castano","MF",25,73],["Giuliano Galoppo","MF",26,72],["Facundo Colidio","FW",25,74],["Bautista Dadin","FW",19,71]],
  "Flamengo": [["Danilo","DF",34,74],["Emerson Royal","DF",26,74],["Evertton Araujo","MF",22,72],["Bruno Henrique","FW",35,73],["Luiz Araujo","FW",29,74],["Everton Cebolinha","FW",29,73]],
  "Palmeiras": [["Carlos Miguel","GK",27,74],["Bruno Fuchs","DF",26,72],["Khellven","DF",24,72],["Anibal Moreno","MF",26,74],["Ramon Sosa","FW",26,74]],
  // new La Liga
  "Celta Vigo": [["Vicente Guaita","GK",39,70],["Carlos Dominguez","DF",24,72],["Damian Rodriguez","MF",21,72]],
  "Girona": [["Dominik Livakovic","GK",30,74],["Hugo Rincon","DF",22,72],["Azzedine Ounahi","MF",25,75]],
  "Osasuna": [["Aitor Fernandez","GK",34,71],["Enzo Boyomo","DF",24,74],["Abel Bretones","DF",25,72],["Moi Gomez","MF",31,72]],
  "Getafe": [["Jiri Letacek","GK",26,71],["Juan Iglesias","DF",27,72],["Yvan Neyou","MF",28,72]],
  "Mallorca": [["Lucas Bergstrom","GK",23,71],["Pablo Maffeo","DF",28,73],["Omar Mascarell","MF",32,71]],
  "Rayo Vallecano": [["Dani Cardenas","GK",28,71],["Abdul Mumin","DF",27,72],["Sergio Camello","FW",24,74]],
  "Espanyol": [["Angel Fortuno","GK",21,70],["Ramon Terrats","MF",25,72],["Tyrhys Dolan","FW",24,73]],
  "Alaves": [["Jesus Owono","GK",24,71],["Jonny Otto","DF",31,71],["Victor Parada","DF",22,71],["Jon Guridi","MF",30,72],["Mariano Diaz","FW",32,71]],
  "Elche": [["Inaki Pena","GK",26,75],["Adria Pedrosa","DF",27,73],["Federico Redondo","MF",22,74],["German Valera","FW",23,72]],
  "Levante": [["Pablo Campos","GK",24,69],["Jeremy Toljan","DF",31,71],["Matias Moreno","DF",22,72],["Unai Vencedor","MF",25,71],["Goduine Koyalipou","FW",25,72]],
  "Real Oviedo": [["Horatiu Moldovan","GK",27,72],["Eric Bailly","DF",31,71],["Leander Dendoncker","MF",30,73],["Ilyas Chaira","FW",25,71]],
  // new Serie A
  "Bologna": [["Federico Ravaglia","GK",26,71],["Martin Vitik","DF",22,74],["Nikola Moro","MF",27,73]],
  "Como": [["Edo Goldaniga","DF",32,71],["Martin Baturina","MF",22,77],["Nikolas Kuhn","FW",25,74]],
  "Torino": [["Alberto Paleari","GK",33,70],["Marcus Pedersen","DF",25,72],["Tino Anjorin","MF",24,73],["Zakaria Aboukhlal","FW",25,74]],
  "Udinese": [["Razvan Sava","GK",23,72],["Oumar Solet","DF",25,76],["Lennon Miller","MF",19,74]],
  "Genoa": [["Benjamin Siegrist","GK",33,69],["Stefano Sabelli","DF",32,70],["Nicolae Stanciu","MF",32,72],["Caleb Ekuban","FW",31,71]],
  "Cagliari": [["Alen Sherri","GK",27,69],["Adam Obert","DF",23,72],["Marco Palestra","MF",20,74],["Semih Kilicsoy","FW",20,74]],
  "Parma": [["Edoardo Corvi","GK",21,70],["Sascha Britschgi","DF",21,72],["Christian Ordonez","MF",21,73],["Milan Djuric","FW",35,71]],
  "Sassuolo": [["Stefano Turati","GK",24,72],["Sebastian Walukiewicz","DF",25,73],["Ismael Kone","MF",23,74],["Walid Cheddira","FW",27,72]],
  "Cremonese": [["Marco Silvestri","GK",34,70],["Filippo Terracciano","DF",22,72],["Alberto Grassi","MF",30,71],["Martin Payero","MF",27,72]],
  // new Bundesliga
  "Wolfsburg": [["Marius Muller","GK",32,71],["Joakim Maehle","DF",28,74],["Yannick Gerhardt","MF",31,72]],
  "Borussia Monchengladbach": [["Jonas Omlin","GK",31,73],["Kevin Diks","DF",29,74],["Florian Neuhaus","MF",28,72],["Grant-Leon Ranos","FW",21,71]],
  "Freiburg": [["Florian Muller","GK",28,71],["Jordy Makengo","DF",23,72],["Yuito Suzuki","MF",24,75],["Cyriaque Irie","FW",20,74]],
  "Hoffenheim": [["Luca Philipp","GK",25,69],["Arthur Chaves","DF",24,72],["Bernardo","DF",30,71],["Muhammed Damar","MF",21,72]],
  "Mainz": [["Lasse Riess","GK",24,69],["Andreas Hanche-Olsen","DF",28,73],["Sota Kawasaki","MF",24,73],["Benedict Hollerbach","FW",24,75]],
  "Werder Bremen": [["Karl Hein","GK",23,72],["Julian Malatini","DF",24,71],["Victor Boniface","FW",25,78]],
  "Augsburg": [["Nediljko Labrovic","GK",26,72],["Marius Wolf","DF",30,72],["Han-Noah Massengo","MF",24,72],["Mert Komur","FW",20,74]],
  "Union Berlin": [["Carl Klaus","GK",31,68],["Tom Rothe","DF",21,74],["Andras Schafer","MF",26,73]],
  "FC Koln": [["Ron-Robert Zieler","GK",36,68],["Sebastian Sebulonsen","DF",25,71],["Tom Krauss","MF",24,73],["Florian Kainz","MF",33,72]],
  "Hamburg": [["Matheo Raab","GK",27,70],["Warmed Omari","DF",25,72],["Giorgi Gocholeishvili","DF",24,71],["Albert Sambi Lokonga","MF",26,73],["Yussuf Poulsen","FW",31,73]],
  "St Pauli": [["Ben Voll","GK",24,69],["Arkadiusz Pyrka","DF",22,71],["Eric Smith","MF",28,73],["Abdoulie Ceesay","FW",21,72]],
  // new Ligue 1
  "Nice": [["Teddy Boulhendi","GK",24,69],["Ali Abdi","DF",31,72],["Tom Louchet","MF",21,72]],
  "Lens": [["Regis Gurtner","GK",38,68],["Samson Baidoo","DF",21,73],["Hamzat Ojediran","MF",23,72],["Morgan Guilavogui","FW",27,72]],
  "Rennes": [["Gauthier Gallon","GK",32,68],["Mahamadou Nagida","DF",21,72],["Glen Kamara","MF",30,73]],
  "Strasbourg": [["Karl Johan Johnsson","GK",35,68],["Lucas Hogsberg","DF",19,73],["Martial Godo","FW",22,74]],
  "Toulouse": [["Kjetil Haug","GK",27,70],["Warren Kamanzi","DF",24,72],["Alexis Vossah","MF",24,71],["Shavy Babicka","FW",25,72]],
  "Nantes": [["Patrik Carlgren","GK",33,68],["Tylel Tati","DF",17,72],["Junior Mwanga","DF",22,72],["Dehmaine Tabibou","MF",20,71],["Yassine Benhattab","FW",21,70]],
  "Brest": [["Gregoire Coudert","GK",26,69],["Joris Chotard","MF",24,74],["Jordan Amavi","DF",31,70]],
  "Auxerre": [["Theo De Percin","GK",24,68],["Gideon Mensah","DF",27,71],["Assane Diousse","MF",28,70],["Rayan Raveloson","MF",28,71],["Theo Bair","FW",26,72]],
  "Angers": [["Melvin Zinga","GK",24,68],["Harold Moukoudi","DF",28,71],["Zinedine Ould Khaled","MF",25,71],["Jim Allevinah","FW",30,70]],
  "Lorient": [["Teddy Bartouche","GK",28,68],["Nathaniel Adjei","DF",23,72],["Theo Le Bris","MF",22,73],["Sambou Soumano","FW",24,71]],
  "Le Havre": [["Arthur Desmas","GK",31,68],["Loic Nego","DF",34,70],["Terence Kongolo","DF",31,69],["Simon Ebonog","MF",23,70],["Godson Kyeremeh","FW",25,71]],
  "Metz": [["Alexandre Oukidja","GK",37,67],["Fali Cande","DF",27,70],["Jessy Deminguet","MF",27,71],["Cheikh Sabaly","FW",26,71],["Ibou Sane","FW",25,71]],
  "Paris FC": [["Kevin Trapp","GK",35,74],["Otavio","DF",23,74],["Vincent Marchetti","MF",28,70],["Pierre-Yves Hamel","FW",31,70]],
  // new Championship
  "Ipswich": [["Christian Walton","GK",30,70],["Harry Clarke","DF",24,71],["Jack Taylor","MF",27,72]],
  "Sheffield United": [["Adam Davies","GK",33,68],["Rhys Norrington-Davies","DF",26,70],["Femi Seriki","DF",23,70],["Tom Davies","MF",27,72],["Danny Ings","FW",33,72]],
  "West Brom": [["Ted Cann","GK",24,67],["Nat Phillips","DF",28,72],["Adam Reach","MF",32,69],["Devante Cole","FW",30,70],["Tammer Bany","FW",21,70]],
  "Middlesbrough": [["Tom Glover","GK",27,69],["Callum Brittain","DF",27,71],["Jonny Howson","MF",37,68],["Delano Burgzorg","FW",26,71],["Sam Greenwood","MF",23,72]],
  "Norwich": [["George Long","GK",32,68],["Ben Chrisene","DF",21,70],["Liam Gibbs","MF",22,71],["Kaide Gordon","FW",21,72]],
  "Watford": [["Jonathan Bond","GK",32,68],["Mattie Pollock","DF",24,71],["Othmane Maamma","MF",20,73],["Mamadou Doumbia","FW",21,71]],
  "Coventry": [["Bradley Collins","GK",28,68],["Bobby Thomas","DF",24,72],["Ephron Mason-Clark","FW",26,73],["Norman Bassette","FW",21,71]],
  "Stoke": [["Jack Bonham","GK",32,68],["Enda Stevens","DF",35,67],["Junior Tchamadeu","DF",21,71],["Sorba Thomas","MF",26,73],["Emre Tezgel","FW",20,71]],
  "Birmingham": [["Bailey Peacock-Farrell","GK",29,70],["Phil Neumann","DF",28,70],["Marc Leonard","MF",23,71],["Lyndon Dykes","FW",30,72]],
  "Wrexham": [["Callum Burton","GK",29,66],["Liberato Cacace","DF",25,72],["Tom O'Connor","MF",26,70],["Jack Marriott","FW",31,69]],
  "Blackburn": [["Aynsley Pears","GK",27,69],["Danny Batth","DF",35,67],["Augustus Kargbo","MF",26,71],["Ryan Hedges","MF",30,70]],
  "Hull": [["David Robson","GK",24,66],["Matty Jacob","DF",24,69],["Semi Ajayi","DF",32,70],["Liam Millar","FW",26,72]],
  "Millwall": [["Wes Harding","DF",28,68],["Tristan Crama","DF",24,71],["Ryan Leonard","MF",33,68],["Josh Coburn","FW",23,71]],
  "Preston": [["Freddie Woodman","GK",28,71],["Pol Valentin","DF",28,69],["Stefan Thordarson","MF",27,71],["Michael Smith","FW",34,68]],
  "Portsmouth": [["Jordan Archer","GK",32,66],["Hayden Matthews","DF",21,71],["Owen Moxon","MF",27,70],["Callum Lang","FW",27,72]],
  "QPR": [["Joe Walsh","GK",23,66],["Liam Morrison","DF",22,71],["Nicolas Madsen","MF",25,72],["Zan Celar","FW",26,71],["Kwame Poku","FW",24,74]],
  // new Eredivisie
  "AZ Alkmaar": [["Jeroen Zoet","GK",34,69],["Maxim Dekker","DF",21,73],["Zico Buurmeester","MF",20,72]],
  "Twente": [["Issam El Maach","GK",24,68],["Mees Hilgers","DF",24,75],["Naci Unuvar","MF",22,73],["Kaj de Rooij","FW",24,71]],
  "Utrecht": [["Michael Brouwer","GK",27,68],["Siebe Horemans","DF",27,70],["Gjivai Zechiel","MF",20,71]],
  // Portugal
  "Braga": [["Tiago Sa","GK",30,70],["Paulo Oliveira","DF",33,69],["Joao Marques","MF",21,71]],
  // Belgium
  "Club Brugge": [["Dani van den Heuvel","GK",22,68],["Jorne Spileers","DF",20,72]],
  "Union SG": [["Vic Chambaere","GK",20,69],["Kevin Mac Allister","DF",27,72],["Marc Giger","FW",21,72],["Raul Florucz","FW",24,74]],
  "Genk": [["Tobias Lawal","GK",25,71],["Ken Nkuba","DF",23,71],["Nikolas Sattlberger","MF",21,71],["Daan Heymans","MF",26,72]],
  "Anderlecht": [["Timon Vanhoutte","GK",23,68],["Jan-Carlo Simic","DF",20,74],["Enric Llansana","MF",24,72],["Mihajlo Cvetkovic","FW",18,72]],
  // Turkey
  "Fenerbahce": [["Jayden Oosterwolde","DF",24,75],["Edson Alvarez","MF",28,78]],
  "Besiktas": [["Ersin Destanoglu","GK",24,73],["Necip Uysal","MF",34,67],["Milot Rashica","FW",29,73]],
  // Saudi
  "Al-Ittihad": [["Mario Mitaj","DF",22,73],["Muhannad Al-Shanqiti","DF",22,71],["Ahmed Al-Ghamdi","MF",23,71],["Abdulrahman Al-Aboud","FW",30,71]],
  "Al-Ahli": [["Abdulrahman Al-Sanbi","GK",22,68],["Hassan Kadesh","DF",33,69],["Saleh Abu Al-Shamat","FW",24,71]],
  "Al-Qadsiah": [["Awn Al-Saluli","DF",25,70],["Bassam Al-Harbi","DF",21,69],["Musab Al-Juwayr","MF",22,74],["Meshal Al-Sebyani","FW",20,71],["Gaston Alvarez","DF",25,72]],
  // MLS
  "LA Galaxy": [["JT Marcinkowski","GK",28,68],["Miki Yamane","DF",32,69],["Edwin Cerrillo","MF",25,70],["Diego Fagundez","MF",30,70]],
  "San Diego FC": [["Pablo Sisniega","GK",30,68],["Paddy McNair","DF",30,71],["Willy Kumado","DF",23,69],["Jeppe Tverskov","MF",32,70],["Corey Baird","FW",29,69]],
  "Atlanta United": [["Josh Cohen","GK",33,67],["Derrick Williams","DF",32,68],["Ronald Hernandez","DF",28,69],["Tristan Muyumba","MF",28,70],["Saba Lobzhanidze","FW",31,72],["Leo Afonso","FW",25,69]]
};

module.exports = { EXTRA_CLUBS, EXTRA_DEPTH };
