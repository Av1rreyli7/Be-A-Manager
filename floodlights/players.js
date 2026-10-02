// Player database, 2025-26 season style squads.
// Format per club: league, transfer budget in millions (Prem clubs only), squad.
// Each player: [name, position, age, rating]. Market value is computed from rating and age.

const CLUBS = {
  // ---------------- PREMIER LEAGUE ----------------
  "Arsenal": { league: "Premier League", budget: 160, prem: true, squad: [
    ["Illan Meslier","GK",26,79],
    ["Christos Tzolis","FW",23,78],
    ["Piero Hincapie","DF",24,83],
    ["Ezri Konsa","DF",28,83],
    ["Bruno Guimaraes","MF",28,86],
    ["David Raya","GK",30,86],["Kepa Arrizabalaga","GK",31,80],
    ["William Saliba","DF",24,88],["Gabriel Magalhaes","DF",27,87],["Jurrien Timber","DF",24,84],
    ["Riccardo Calafiori","DF",23,82],["Myles Lewis-Skelly","DF",19,79],["Ben White","DF",28,83],["Cristhian Mosquera","DF",21,79],
    ["Declan Rice","MF",27,89],["Martin Odegaard","MF",27,88],["Martin Zubimendi","MF",26,86],["Mikel Merino","MF",29,83],
    ["Bukayo Saka","FW",24,89],["Viktor Gyokeres","FW",27,86],["Gabriel Martinelli","FW",24,84],["Eberechi Eze","FW",27,84],["Noni Madueke","FW",23,82],["Kai Havertz","FW",26,83]
  ]},
  "Aston Villa": { league: "Premier League", budget: 80, prem: true, squad: [
    ["Evann Guessand","FW",24,78],
    ["Aaron Wan-Bissaka","DF",28,79],
    ["Zion Suzuki","GK",23,79],
    ["Matteo Ruggeri","DF",24,79],
    ["Leon Goretzka","MF",30,79],
    ["Joao Gomes","MF",24,81],
    ["Alejandro Garnacho","FW",21,81],
    ["Nicolas Jackson","FW",24,79],
    ["Marco Bizot","GK",34,77],
    ["Pau Torres","DF",29,83],["Matty Cash","DF",28,80],["Tyrone Mings","DF",32,79],
    ["Boubacar Kamara","MF",26,83],["Amadou Onana","MF",24,81],["John McGinn","MF",31,81],["Emiliano Buendia","MF",29,78],
    ["Harvey Elliott","MF",22,79]
  ]},
  "Bournemouth": { league: "Premier League", budget: 60, prem: true, squad: [
    ["Alvaro Rodriguez","FW",21,74],
    ["Michele Di Gregorio","GK",28,82],
    ["Antonio Silva","DF",22,81],
    ["Djordje Petrovic","GK",26,81],
    ["Adrien Truffert","DF",24,79],["Bafode Diakite","DF",24,79],["Julian Araujo","DF",24,76],["James Hill","DF",23,74],
    ["Ryan Christie","MF",30,79],["Alex Scott","MF",22,77],["Tyler Adams","MF",26,78],["Marcus Tavernier","MF",26,78],
    ["Antoine Semenyo","FW",26,84],["Justin Kluivert","FW",26,81],["Evanilson","FW",26,80],["David Brooks","FW",28,76],["Amine Adli","FW",25,78],["Eli Junior Kroupi","FW",19,75]
  ]},
  "Brentford": { league: "Premier League", budget: 55, prem: true, squad: [
    ["Jaidon Anthony","FW",26,76],
    ["Callum Wilson","FW",33,75],
    ["El Hadji Malick Diouf","DF",21,77],
    ["Caoimhin Kelleher","GK",27,80],
    ["Nathan Collins","DF",24,80],["Ethan Pinnock","DF",32,78],["Sepp van den Berg","DF",24,78],["Michael Kayode","DF",21,77],["Rico Henry","DF",28,76],
    ["Mikkel Damsgaard","MF",25,80],["Vitaly Janelt","MF",27,77],["Mathias Jensen","MF",30,77],["Yehor Yarmoliuk","MF",21,76],
    ["Igor Thiago","FW",24,80],["Dango Ouattara","FW",23,79],["Kevin Schade","FW",24,79],["Fabio Carvalho","FW",23,75],["Reiss Nelson","FW",26,75]
  ]},
  "Brighton": { league: "Premier League", budget: 75, prem: true, squad: [
    ["Costinha","DF",25,71],
    ["Luka Vuskovic","DF",18,76],
    ["Pascal Struijk","DF",26,78],
    ["Bart Verbruggen","GK",23,82],
    ["Lewis Dunk","DF",34,78],["Maxim De Cuyper","DF",25,78],["Olivier Boscagli","DF",28,78],
    ["Jack Hinshelwood","MF",20,77],["Diego Gomez","MF",22,78],["Matt O'Riley","MF",25,79],
    ["Kaoru Mitoma","FW",28,83],["Georginio Rutter","FW",23,80],["Yankuba Minteh","FW",21,80],["Brajan Gruda","FW",21,77],["Stefanos Tzimas","FW",20,76]
  ]},
  "Burnley": { league: "Premier League", budget: 40, prem: true, squad: [
    ["Anel Ahmedhodzic","DF",26,78],
    ["Max Weiss","GK",21,73],
    ["Kyle Walker","DF",35,76],["Quilindschy Hartman","DF",24,76],["Axel Tuanzebe","DF",28,74],["Hjalmar Ekdal","DF",27,73],
    ["Josh Cullen","MF",29,76],["Lesley Ugochukwu","MF",21,76],["Josh Laurent","MF",30,73],["Hannibal Mejbri","MF",23,74],["Florentino Luis","MF",26,77],
    ["Lyle Foster","FW",25,75],["Zian Flemming","FW",27,75],["Loum Tchaouna","FW",22,74],["Marcus Edwards","FW",27,74]
  ]},
  "Chelsea": { league: "Premier League", budget: 170, prem: true, squad: [
    ["Geovany Quenda","FW",18,81],
    ["Jordan Henderson","MF",35,75],
    ["Danny Welbeck","FW",35,75],
    ["Emmanuel Emegha","FW",23,80],
    ["Maxence Lacroix","DF",25,81],
    ["Emiliano Martinez","GK",33,85],
    ["Morgan Rogers","FW",23,84],
    ["Filip Jorgensen","GK",23,77],
    ["Levi Colwill","DF",23,83],["Reece James","DF",26,84],["Malo Gusto","DF",22,80],["Jorrel Hato","DF",19,80],
    ["Moises Caicedo","MF",24,88],["Romeo Lavia","MF",22,80],
    ["Cole Palmer","FW",23,89],["Joao Pedro","FW",24,84],["Pedro Neto","FW",25,82],["Jamie Gittens","FW",21,80],["Estevao","FW",18,82],["Marc Guiu","FW",20,76]
  ]},
  "Crystal Palace": { league: "Premier League", budget: 60, prem: true, squad: [
    ["Axel Disasi","DF",28,78],
    ["Oscar Mingueza","DF",26,77],
    ["Dwight McNeil","FW",26,78],
    
    ["Dean Henderson","GK",28,80],
    ["Chris Richards","DF",25,79],["Daniel Munoz","DF",29,81],["Tyrick Mitchell","DF",26,79],["Chadi Riad","DF",22,76],
    ["Adam Wharton","MF",21,82],["Daichi Kamada","MF",29,78],["Will Hughes","MF",30,76],["Jefferson Lerma","MF",31,77],
    ["Jean-Philippe Mateta","FW",28,82],["Ismaila Sarr","FW",27,80],["Yeremy Pino","FW",23,79],["Eddie Nketiah","FW",26,77],["Christantus Uche","FW",22,76]
  ]},
  "Everton": { league: "Premier League", budget: 55, prem: true, squad: [
    ["Ainsley Maitland-Niles","DF",28,76],
    ["Brennan Johnson","FW",24,80],
    ["Christian Norgaard","MF",32,78],
    ["Tyrique George","FW",20,77],
    ["Merlin Rohl","MF",24,78],
    ["Hayden Hackney","MF",23,76],
    ["Jordan Pickford","GK",31,84],
    ["Jarrad Branthwaite","DF",23,83],["James Tarkowski","DF",33,79],["Vitalii Mykolenko","DF",26,78],["Jake O'Brien","DF",24,78],["Nathan Patterson","DF",24,74],["Michael Keane","DF",32,75],
    ["Idrissa Gueye","MF",36,76],["James Garner","MF",24,78],["Kiernan Dewsbury-Hall","MF",27,79],["Tim Iroegbunam","MF",22,74],["Carlos Alcaraz","MF",23,77],
    ["Jack Grealish","FW",30,81],["Thierno Barry","FW",23,76]
  ]},
  "Fulham": { league: "Premier League", budget: 50, prem: true, squad: [
    ["Oscar Bobb","FW",22,79],
    ["Gonzalo Garcia","FW",21,77],
    ["Bernd Leno","GK",33,80],
    ["Joachim Andersen","DF",29,80],["Calvin Bassey","DF",26,79],["Antonee Robinson","DF",28,81],["Kenny Tete","DF",30,77],["Jorge Cuenca","DF",26,75],
    ["Sander Berge","MF",27,78],["Andreas Pereira","MF",29,78],["Tom Cairney","MF",34,74],["Josh King","MF",19,75],
    ["Alex Iwobi","FW",29,79],["Samuel Chukwueze","FW",26,77],["Kevin","FW",22,77],["Rodrigo Muniz","FW",24,77]
  ]},
  "Leeds United": { league: "Premier League", budget: 50, prem: true, squad: [
    ["Michael Zetterer","GK",30,74],
    ["Nico Elvedi","DF",29,76],
    ["Harry Wilson","FW",28,77],
    ["James Trafford","GK",23,79],
    ["Lucas Perri","GK",28,79],["Karl Darlow","GK",35,73],
    ["Joe Rodon","DF",28,78],["Jaka Bijol","DF",26,77],["Gabriel Gudmundsson","DF",26,76],["Jayden Bogle","DF",25,76],["Sebastiaan Bornauw","DF",26,75],
    ["Ethan Ampadu","MF",25,78],["Ilia Gruev","MF",25,76],["Sean Longstaff","MF",28,76],["Anton Stach","MF",27,77],["Brenden Aaronson","MF",25,76],
    ["Daniel James","FW",28,77],["Wilfried Gnonto","FW",22,77],["Dominic Calvert-Lewin","FW",28,76],["Lukas Nmecha","FW",27,74],["Noah Okafor","FW",25,76]
  ]},
  "Liverpool": { league: "Premier League", budget: 130, prem: true, squad: [
    ["Jeremy Jacquet","DF",20,80],
    ["Victor Munoz","FW",22,74],
    ["Ronald Araujo","DF",26,83],
    ["Bradley Barcola","FW",23,84],
    ["Alisson","GK",33,88],["Giorgi Mamardashvili","GK",25,81],
    ["Virgil van Dijk","DF",34,88],["Milos Kerkez","DF",22,81],["Jeremie Frimpong","DF",25,82],["Conor Bradley","DF",22,79],["Joe Gomez","DF",28,78],["Giovanni Leoni","DF",19,77],
    ["Ryan Gravenberch","MF",23,86],["Alexis Mac Allister","MF",27,87],["Dominik Szoboszlai","MF",25,85],["Florian Wirtz","MF",22,89],["Wataru Endo","MF",32,76],
    ["Alexander Isak","FW",26,88],["Hugo Ekitike","FW",23,84],["Cody Gakpo","FW",26,84],["Federico Chiesa","FW",28,79],["Rio Ngumoha","FW",17,74]
  ]},
  "Man City": { league: "Premier League", budget: 180, prem: true, squad: [
    ["Marc Guehi","DF",25,85],
    ["Ayyoub Bouaddi","MF",18,81],
    ["Geronimo Rulli","GK",33,80],
    ["Jeremy Monga","FW",17,75],
    ["Iliman Ndiaye","FW",25,80],
    ["Elliot Anderson","MF",23,82],
    ["Enzo Fernandez","MF",25,86],
    ["Gianluigi Donnarumma","GK",26,89],
    ["Ruben Dias","DF",28,86],["Josko Gvardiol","DF",23,85],["Abdukodir Khusanov","DF",21,79],["Rayan Ait-Nouri","DF",24,81],["Matheus Nunes","DF",27,80],
    ["Phil Foden","MF",25,86],["Rayan Cherki","MF",22,82],["Mateo Kovacic","MF",31,80],
    ["Erling Haaland","FW",25,91],["Jeremy Doku","FW",23,84],
  ]},
  "Man United": { league: "Premier League", budget: 150, prem: true, squad: [
    ["JJ Gabriel","FW",15,70],
    ["Carlos Baleba","MF",22,84],
    ["Youri Tielemans","MF",28,84],
    ["Andrey Santos","MF",21,78],
    ["Senne Lammens","GK",23,79],["Altay Bayindir","GK",27,77],
    ["Lisandro Martinez","DF",27,83],["Matthijs de Ligt","DF",26,84],["Leny Yoro","DF",20,82],["Noussair Mazraoui","DF",28,81],["Luke Shaw","DF",30,79],["Diogo Dalot","DF",26,80],["Patrick Dorgu","DF",21,77],["Ayden Heaven","DF",19,75],
    ["Bruno Fernandes","MF",31,87],["Kobbie Mainoo","MF",20,80],["Manuel Ugarte","MF",24,79],["Mason Mount","MF",27,79],
    ["Bryan Mbeumo","FW",26,84],["Matheus Cunha","FW",26,84],["Benjamin Sesko","FW",22,83],["Amad Diallo","FW",23,82],["Joshua Zirkzee","FW",24,77],["Chido Obi","FW",18,73]
  ]},
  "Newcastle": { league: "Premier League", budget: 100, prem: true, squad: [
    ["Bazoumana Toure","FW",19,80],
    ["Ewen Jaouen","GK",20,76],
    ["Sean Steur","MF",18,77],
    ["Amar Dedic","DF",23,79],
    ["Aladji Bamba","MF",19,79],
    ["Nico Gonzalez","MF",24,81],
    ["Nick Pope","GK",33,82],["Aaron Ramsdale","GK",27,78],
    ["Sven Botman","DF",25,83],["Fabian Schar","DF",34,79],["Dan Burn","DF",33,78],["Tino Livramento","DF",23,81],["Lewis Hall","DF",21,79],["Malick Thiaw","DF",24,80],
    ["Joelinton","MF",29,82],["Joe Willock","MF",26,77],["Jacob Ramsey","MF",24,78],
    ["Nick Woltemade","FW",23,82],["Harvey Barnes","FW",28,80],["Yoane Wissa","FW",29,80],["Anthony Elanga","FW",23,81],["William Osula","FW",22,74]
  ]},
  "Nottingham Forest": { league: "Premier League", budget: 60, prem: true, squad: [
    ["Ousmane Diomande","DF",22,80],
    ["Xaver Schlager","MF",28,79],
    ["Liam Delap","FW",22,79],
    ["Matz Sels","GK",33,81],["John Victor","GK",29,75],
    ["Murillo","DF",23,83],["Nikola Milenkovic","DF",28,82],["Ola Aina","DF",29,79],["Neco Williams","DF",24,78],["Morato","DF",24,76],["Oleksandr Zinchenko","DF",29,78],
    ["Ibrahim Sangare","MF",28,77],["Douglas Luiz","MF",27,79],["Ryan Yates","MF",28,76],["James McAtee","MF",23,78],
    ["Chris Wood","FW",34,79],["Morgan Gibbs-White","FW",26,83],["Callum Hudson-Odoi","FW",25,79],["Dan Ndoye","FW",25,79],["Igor Jesus","FW",24,77],["Omari Hutchinson","FW",22,78]
  ]},
  "Sunderland": { league: "Premier League", budget: 45, prem: true, squad: [
    ["Robin Roefs","GK",22,77],["Anthony Patterson","GK",25,75],
    ["Omar Alderete","DF",28,78],["Dan Ballard","DF",26,77],["Jenson Seelt","DF",22,74],["Trai Hume","DF",23,77],["Reinildo Mandava","DF",31,76],["Lutsharel Geertruida","DF",25,78],["Nordi Mukiele","DF",28,78],
    ["Granit Xhaka","MF",33,81],["Habib Diarra","MF",22,79],["Noah Sadiki","MF",21,77],["Enzo Le Fee","MF",25,78],["Chris Rigg","MF",18,76],
    ["Wilson Isidor","FW",25,77],["Eliezer Mayenda","FW",20,76],["Simon Adingra","FW",24,77],["Bertrand Traore","FW",30,75],["Brian Brobbey","FW",23,77],["Chemsdine Talbi","FW",20,75]
  ]},
  "Tottenham": { league: "Premier League", budget: 110, prem: true, squad: [
    ["Mykhailo Mudryk","FW",25,78],
    ["Omar Marmoush","FW",26,83],
    ["Andy Robertson","DF",32,80],
    ["Martin Dubravka","GK",37,76],
    ["Marcos Senesi","DF",28,81],
    ["Jan Paul van Hecke","DF",25,81],
    ["Mateus Fernandes","MF",21,78],
    ["Sandro Tonali","MF",25,86],
    ["Savinho","FW",21,81],
    ["Guglielmo Vicario","GK",29,83],["Antonin Kinsky","GK",22,76],
    ["Micky van de Ven","DF",24,84],["Pedro Porro","DF",26,82],["Destiny Udogie","DF",23,80],["Kevin Danso","DF",27,78],["Ben Davies","DF",32,75],
    ["Xavi Simons","MF",22,83],["James Maddison","MF",29,82],["Rodrigo Bentancur","MF",28,80],["Joao Palhinha","MF",30,81],["Lucas Bergvall","MF",19,79],["Archie Gray","MF",19,77],
    ["Dominic Solanke","FW",28,80],["Richarlison","FW",28,79],["Mohammed Kudus","FW",25,82],["Wilson Odobert","FW",21,77]
  ]},
  "West Ham": { league: "Premier League", budget: 55, prem: true, squad: [
    ["Joel Veltman","DF",34,75],
    ["Joel Piroe","FW",26,76],
    ["Manor Solomon","FW",27,77],
    ["Arne Engels","MF",22,76],
    ["Alphonse Areola","GK",32,79],["Mads Hermansen","GK",25,77],
    ["Max Kilman","DF",28,79],["Jean-Clair Todibo","DF",26,79],["Konstantinos Mavropanos","DF",28,77],["Igor Julio","DF",27,76],
    ["Lucas Paqueta","MF",28,82],["Tomas Soucek","MF",30,78],["Freddie Potts","MF",22,74],
    ["Jarrod Bowen","FW",29,83],["Luis Guilherme","FW",19,75]
  ]},
  "Wolves": { league: "Premier League", budget: 45, prem: true, squad: [
    ["Raul Jimenez","FW",34,76],
    ["Kieran Trippier","DF",35,76],
    ["Jose Sa","GK",32,79],["Sam Johnstone","GK",32,76],
    ["Yerson Mosquera","DF",24,77],["Toti Gomes","DF",26,77],["Santiago Bueno","DF",27,76],["Matt Doherty","DF",34,74],["Hugo Bueno","DF",23,76],["Ki-Jana Hoever","DF",23,74],["Emmanuel Agbadou","DF",28,77],
    ["Andre","MF",24,79],["Jean-Ricner Bellegarde","MF",27,77],["Marshall Munetsi","MF",29,76],
    ["Jorgen Strand Larsen","FW",25,80],["Hwang Hee-chan","FW",29,77],["Rodrigo Gomes","FW",22,77],["Jhon Arias","FW",28,78],["Tolu Arokodare","FW",25,76]
  ]},

  // ---------------- LA LIGA ----------------
  "Real Madrid": { league: "La Liga", squad: [
    ["Carlos Espi","FW",20,73],
    ["Denzel Dumfries","DF",29,83],
    ["Yan Diomande","FW",19,84],
    ["Ibrahima Konate","DF",26,85],
    ["Marc Cucurella","DF",27,84],
    ["Bernardo Silva","MF",31,85],
    ["Thibaut Courtois","GK",33,89],
    ["Trent Alexander-Arnold","DF",27,85],["Dean Huijsen","DF",20,84],["Eder Militao","DF",27,84],["Antonio Rudiger","DF",32,82],["Ferland Mendy","DF",30,79],["Alvaro Carreras","DF",22,81],
    ["Jude Bellingham","MF",22,90],["Federico Valverde","MF",27,88],["Aurelien Tchouameni","MF",26,86],["Eduardo Camavinga","MF",23,84],["Arda Guler","MF",20,84],
    ["Kylian Mbappe","FW",27,91],["Vinicius Junior","FW",25,89],["Rodrygo","FW",25,85],["Franco Mastantuono","FW",18,80],["Brahim Diaz","FW",26,81]
  ]},
  "Barcelona": { league: "La Liga", squad: [
    ["Gabriel Jesus","FW",29,79],
    ["Anthony Gordon","FW",24,83],
    ["Rodri","MF",29,90],
    ["Joan Garcia","GK",24,84],["Wojciech Szczesny","GK",35,79],
    ["Pau Cubarsi","DF",19,85],["Jules Kounde","DF",27,85],["Alejandro Balde","DF",22,83],["Eric Garcia","DF",25,79],
    ["Pedri","MF",23,90],["Frenkie de Jong","MF",28,85],["Gavi","MF",21,83],["Fermin Lopez","MF",22,82],["Marc Casado","MF",22,80],["Dani Olmo","MF",27,84],
    ["Lamine Yamal","FW",18,90],["Raphinha","FW",29,88],["Robert Lewandowski","FW",37,84],["Marcus Rashford","FW",28,81],["Roony Bardghji","FW",20,77]
  ]},
  "Atletico Madrid": { league: "La Liga", squad: [
    ["Ademola Lookman","FW",28,83],
    ["Cristian Romero","DF",27,85],
    ["Jan Oblak","GK",33,86],
    ["Robin Le Normand","DF",29,83],["Jose Maria Gimenez","DF",31,81],["Clement Lenglet","DF",30,78],["Nahuel Molina","DF",27,80],["David Hancko","DF",28,81],["Marc Pubill","DF",22,77],
    ["Julian Alvarez","FW",25,88],["Antoine Griezmann","FW",34,81],["Alexander Sorloth","FW",30,80],["Giacomo Raspadori","FW",25,79],["Nicolas Gonzalez","FW",27,80],
    ["Pablo Barrios","MF",22,83],["Koke","MF",34,76],["Johnny Cardoso","MF",24,79],["Alex Baena","MF",24,83],["Giuliano Simeone","FW",23,81],["Thiago Almada","MF",24,81]
  ]},
  "Athletic Bilbao": { league: "La Liga", squad: [
    ["Unai Simon","GK",28,84],
    ["Dani Vivian","DF",26,81],["Aitor Paredes","DF",25,79],["Yuri Berchiche","DF",35,74],["Jesus Areso","DF",26,77],
    ["Nico Williams","FW",23,86],["Inaki Williams","FW",31,80],["Gorka Guruzeta","FW",29,78],["Alex Berenguer","FW",30,77],
    ["Oihan Sancet","MF",25,82],["Mikel Jauregizar","MF",21,79],["Inigo Ruiz de Galarreta","MF",32,76]
  ]},
  "Real Sociedad": { league: "La Liga", squad: [
    ["Mamadou Sarr","DF",20,76],
    ["Alex Remiro","GK",30,81],
    ["Igor Zubeldia","DF",28,79],["Aihen Munoz","DF",28,76],["Hamari Traore","DF",33,74],["Jon Martin","DF",21,77],
    ["Takefusa Kubo","FW",24,83],["Oyarzabal","FW",28,84],["Ander Barrenetxea","FW",24,79],["Orri Oskarsson","FW",21,77],
    ["Brais Mendez","MF",29,79],["Beñat Turrientes","MF",23,77],["Arsen Zakharyan","MF",22,77]
  ]},
  "Villarreal": { league: "La Liga", squad: [
    ["Luiz Junior","GK",24,79],
    ["Juan Foyth","DF",27,79],["Logan Costa","DF",24,79],["Sergi Cardona","DF",26,77],["Santiago Mourino","DF",23,76],
    ["Gerard Moreno","FW",33,77],["Ayoze Perez","FW",32,78],["Nicolas Pepe","FW",30,78],["Tajon Buchanan","FW",26,77],["Georges Mikautadze","FW",25,80],["Alberto Moleiro","MF",22,79],
    ["Dani Parejo","MF",36,75],["Santi Comesana","MF",29,77],["Pape Gueye","MF",26,77]
  ]},
  "Real Betis": { league: "La Liga", squad: [
    ["Alvaro Valles","GK",28,78],
    ["Natan","DF",24,77],["Marc Bartra","DF",34,74],["Hector Bellerin","DF",30,75],["Junior Firpo","DF",29,76],
    ["Giovani Lo Celso","MF",29,80],["Sergi Altimira","MF",24,77],["Marc Roca","MF",29,76],["Pablo Fornals","MF",29,77],
    ["Antony","FW",25,82],["Abde Ezzalzouli","FW",24,79],["Cucho Hernandez","FW",26,79],["Cedric Bakambu","FW",34,74]
  ]},
  "Sevilla": { league: "La Liga", squad: [
    ["Odysseas Vlachodimos","GK",31,77],
    ["Kike Salas","DF",23,76],["Marcao","DF",29,75],["Jose Angel Carmona","DF",23,76],["Gabriel Suazo","DF",28,76],
    ["Lucien Agoume","MF",23,77],["Nemanja Gudelj","MF",34,74],["Djibril Sow","MF",28,76],
    ["Isaac Romero","FW",25,76],["Dodi Lukebakio","FW",28,79],["Alexis Sanchez","FW",37,72],["Chidera Ejuke","FW",28,75]
  ]},

  // ---------------- SERIE A ----------------
  "Inter Milan": { league: "Serie A", squad: [
    ["Djed Spence","DF",25,78],
    ["Curtis Jones","MF",25,80],
    ["John Stones","DF",31,82],
    ["Yann Sommer","GK",37,82],["Josep Martinez","GK",27,78],
    ["Alessandro Bastoni","DF",26,87],["Benjamin Pavard","DF",29,82],["Francesco Acerbi","DF",37,76],["Federico Dimarco","DF",28,84],["Manuel Akanji","DF",30,82],
    ["Nicolo Barella","MF",28,87],["Hakan Calhanoglu","MF",31,85],["Piotr Zielinski","MF",31,78],["Davide Frattesi","MF",26,80],["Petar Sucic","MF",22,79],
    ["Lautaro Martinez","FW",28,88],["Marcus Thuram","FW",28,84],["Ange-Yoan Bonny","FW",22,78],["Francesco Pio Esposito","FW",20,78]
  ]},
  "AC Milan": { league: "Serie A", squad: [
    ["Diego Moreira","FW",22,78],
    ["Mario Gila","DF",25,78],
    ["Goncalo Ramos","FW",24,81],
    ["Mike Maignan","GK",30,86],
    ["Fikayo Tomori","DF",28,81],["Matteo Gabbia","DF",26,79],["Strahinja Pavlovic","DF",24,80],["Pervis Estupinan","DF",28,80],["Alexis Saelemaekers","DF",26,79],["Koni De Winter","DF",23,79],
    ["Luka Modric","MF",40,80],["Adrien Rabiot","MF",30,82],["Youssouf Fofana","MF",27,80],["Ruben Loftus-Cheek","MF",30,78],["Samuele Ricci","MF",24,80],
    ["Christopher Nkunku","FW",28,81],["Santiago Gimenez","FW",24,79],["Christian Pulisic","FW",27,84]
  ]},
  "Juventus": { league: "Serie A", squad: [
    ["Lois Openda","FW",26,82],
    ["Jhon Lucumi","DF",27,78],
    ["Randal Kolo Muani","FW",27,81],
    ["Pape Matar Sarr","MF",23,80],
    
    ["Gleison Bremer","DF",28,85],["Federico Gatti","DF",27,80],["Pierre Kalulu","DF",25,79],["Andrea Cambiaso","DF",25,81],["Lloyd Kelly","DF",27,77],["Juan Cabal","DF",24,77],
    ["Manuel Locatelli","MF",28,80],["Khephren Thuram","MF",24,82],["Teun Koopmeiners","MF",27,80],["Weston McKennie","MF",27,78],
    ["Kenan Yildiz","FW",20,85],["Jonathan David","FW",26,82],["Dusan Vlahovic","FW",26,82],["Francisco Conceicao","FW",23,80]
  ]},
  "Napoli": { league: "Serie A", squad: [
    ["Benoit Badiashile","DF",25,79],
    ["Rasmus Hojlund","FW",22,80],
    ["Alex Meret","GK",28,80],["Vanja Milinkovic-Savic","GK",28,79],
    ["Alessandro Buongiorno","DF",26,82],["Amir Rrahmani","DF",31,79],["Giovanni Di Lorenzo","DF",32,80],["Sam Beukema","DF",27,79],
    ["Kevin De Bruyne","MF",34,85],["Scott McTominay","MF",29,84],["Stanislav Lobotka","MF",31,82],["Frank Anguissa","MF",30,81],["Billy Gilmour","MF",24,77],
    ["Romelu Lukaku","FW",32,80],["David Neres","FW",28,80],["Matteo Politano","FW",32,78],["Noa Lang","FW",26,80]
  ]},
  "Atalanta": { league: "Serie A", squad: [
    ["Jonathan Rowe","FW",22,76],
    ["Marco Carnesecchi","GK",25,81],
    ["Isak Hien","DF",26,79],["Berat Djimsiti","DF",32,77],["Sead Kolasinac","DF",32,76],["Davide Zappacosta","DF",33,76],["Odilon Kossounou","DF",25,78],["Honest Ahanor","DF",17,74],
    ["Ederson","MF",26,82],["Marten de Roon","MF",34,76],["Mario Pasalic","MF",30,78],["Lazar Samardzic","MF",23,79],
    ["Charles De Ketelaere","FW",24,82],["Gianluca Scamacca","FW",27,79],["Nikola Krstovic","FW",25,78],["Kamaldeen Sulemana","FW",23,77]
  ]},
  "Roma": { league: "Serie A", squad: [
    ["Rodrigo Mora","FW",18,79],
    ["Santiago Castro","FW",21,78],
    ["Donyell Malen","FW",26,80],
    ["Mile Svilar","GK",26,82],
    ["Gianluca Mancini","DF",29,79],["Evan Ndicka","DF",26,80],["Zeki Celik","DF",28,76],["Angelino","DF",29,79],["Wesley","DF",22,77],
    ["Manu Kone","MF",24,82],["Bryan Cristante","MF",30,77],["Lorenzo Pellegrini","MF",29,78],["Neil El Aynaoui","MF",24,77],
    ["Paulo Dybala","FW",32,81],["Matias Soule","FW",22,80],["Artem Dovbyk","FW",28,78],["Evan Ferguson","FW",21,76],["Stephan El Shaarawy","FW",33,74]
  ]},

  // ---------------- BUNDESLIGA ----------------
  "Bayern Munich": { league: "Bundesliga", squad: [
    ["Nathaniel Brown","DF",22,78],
    ["Ismael Saibari","MF",24,79],
    ["Manuel Neuer","GK",39,82],["Jonas Urbig","GK",22,76],
    ["Dayot Upamecano","DF",27,84],["Minjae Kim","DF",29,81],["Jonathan Tah","DF",29,83],["Alphonso Davies","DF",25,84],["Josip Stanisic","DF",25,79],["Konrad Laimer","DF",28,80],["Sacha Boey","DF",25,77],
    ["Joshua Kimmich","MF",30,86],["Aleksandar Pavlovic","MF",21,82],["Tom Bischof","MF",20,77],
    ["Harry Kane","FW",32,90],["Michael Olise","FW",24,87],["Luis Diaz","FW",29,85],["Serge Gnabry","FW",30,79],["Lennart Karl","FW",17,75]
  ]},
  "Bayer Leverkusen": { league: "Bundesliga", squad: [
    ["Guela Doue","DF",23,76],
    ["Miguel Gutierrez","DF",24,79],
    ["Mark Flekken","GK",32,79],
    ["Edmond Tapsoba","DF",26,81],["Jarell Quansah","DF",23,79],["Alejandro Grimaldo","DF",30,83],["Arthur","DF",22,76],["Loic Bade","DF",25,78],
    ["Robert Andrich","MF",31,78],["Aleix Garcia","MF",28,80],["Eliesse Ben Seghir","MF",20,79],["Ibrahim Maza","MF",20,77],
    ["Patrik Schick","FW",29,81],["Malik Tillman","FW",23,80],["Ernest Poku","FW",21,76],["Christian Kofane","FW",19,75],["Claudio Echeverri","FW",20,79]
  ]},
  "Borussia Dortmund": { league: "Bundesliga", squad: [
    ["Ethan Nwaneri","MF",18,78],
    ["Gregor Kobel","GK",28,85],
    ["Nico Schlotterbeck","DF",26,83],["Waldemar Anton","DF",29,78],["Ramy Bensebaini","DF",30,78],["Julian Ryerson","DF",28,77],["Yan Couto","DF",23,77],["Daniel Svensson","DF",23,76],
    ["Felix Nmecha","MF",25,79],["Pascal Gross","MF",34,77],["Marcel Sabitzer","MF",31,77],["Jobe Bellingham","MF",20,78],["Carney Chukwuemeka","MF",22,78],
    ["Serhou Guirassy","FW",29,84],["Karim Adeyemi","FW",24,81],["Julian Brandt","FW",29,80],["Maximilian Beier","FW",23,79],["Fabio Silva","FW",23,77]
  ]},
  "RB Leipzig": { league: "Bundesliga", squad: [
    ["Maxime Esteve","DF",23,79],
    ["Peter Gulacsi","GK",35,78],
    ["Willi Orban","DF",33,78],["Castello Lukeba","DF",23,80],["David Raum","DF",27,80],["Benjamin Henrichs","DF",28,76],
    ["Nicolas Seiwald","MF",24,77],["Antonio Nusa","FW",20,79],["Xavi Simons gone","MF",22,60],
    ["Johan Bakayoko","FW",22,78],["Romulo","FW",23,78],["Christoph Baumgartner","MF",26,78]
  ]},
  "Eintracht Frankfurt": { league: "Bundesliga", squad: [
    ["Kaua Santos","GK",22,77],
    ["Robin Koch","DF",29,79],["Arthur Theate","DF",25,78],["Rasmus Kristensen","DF",28,77],
    ["Ellyes Skhiri","MF",30,77],["Hugo Larsson","MF",21,80],["Can Uzun","MF",20,79],["Mario Gotze","MF",33,75],
    ["Jonathan Burkardt","FW",25,79],["Ansgar Knauff","FW",23,77],["Ritsu Doan","FW",27,79],["Elye Wahi","FW",23,77]
  ]},
  "Stuttgart": { league: "Bundesliga", squad: [
    ["Alexander Nubel","GK",29,79],
    ["Jeff Chabot","DF",27,78],["Dan-Axel Zagadou","DF",26,76],["Maximilian Mittelstadt","DF",28,79],["Josha Vagnoman","DF",25,76],
    ["Angelo Stiller","MF",24,82],["Atakan Karazor","MF",29,76],["Chema Andres","MF",20,76],
    ["Deniz Undav","FW",29,79],["Ermedin Demirovic","FW",27,78],["Chris Fuhrich","FW",27,77],["Tiago Tomas","FW",23,77],["Badredine Bouanani","FW",21,76]
  ]},

  // ---------------- LIGUE 1 ----------------
  "PSG": { league: "Ligue 1", squad: [
    ["Ferran Torres","FW",26,83],
    ["Lucas Digne","DF",32,78],
    ["Lucas Chevalier","GK",24,83],
    ["Marquinhos","DF",31,84],["Willian Pacho","DF",24,85],["Achraf Hakimi","DF",27,88],["Nuno Mendes","DF",23,86],["Lucas Beraldo","DF",22,79],["Illia Zabarnyi","DF",23,81],
    ["Vitinha","MF",25,89],["Joao Neves","MF",21,86],["Fabian Ruiz","MF",29,84],["Warren Zaire-Emery","MF",19,81],["Senny Mayulu","MF",19,77],
    ["Ousmane Dembele","FW",28,90],["Khvicha Kvaratskhelia","FW",24,87],["Desire Doue","FW",20,85],["Ibrahim Mbaye","FW",17,75]
  ]},
  "Marseille": { league: "Ligue 1", squad: [
    
    ["Leonardo Balerdi","DF",26,80],["Nayef Aguerd","DF",29,79],["Benjamin Pavard OM","DF",29,81],["Emerson Palmieri","DF",31,76],["Timothy Weah","DF",25,78],
    ["Pierre-Emile Hojbjerg","MF",30,80],["Geoffrey Kondogbia","MF",32,76],["Angel Gomes","MF",25,78],["Matt O'Riley OM","MF",25,78],["Arthur Vermeeren","MF",20,78],
    ["Mason Greenwood","FW",24,84],["Pierre-Emerick Aubameyang","FW",36,77],["Amine Gouiri","FW",25,79],["Igor Paixao","FW",25,80]
  ]},
  "Monaco": { league: "Ligue 1", squad: [
    ["Philipp Kohn","GK",27,77],
    ["Thilo Kehrer","DF",29,77],["Christian Mawissa","DF",20,77],["Vanderson","DF",24,79],["Caio Henrique","DF",28,79],["Eric Dier","DF",31,76],
    ["Denis Zakaria","MF",29,80],["Lamine Camara","MF",22,79],["Paul Pogba","MF",32,76],["Aleksandr Golovin","MF",29,79],
    ["Maghnes Akliouche","FW",23,82],["Folarin Balogun","FW",24,79],["Takumi Minamino","FW",30,77],["Ansu Fati","FW",23,77],["Mika Biereth","FW",22,78]
  ]},
  "Lyon": { league: "Ligue 1", squad: [
    ["Remy Descamps","GK",29,74],
    ["Moussa Niakhate","DF",29,78],["Clinton Mata","DF",33,75],["Nicolas Tagliafico","DF",33,76],
    ["Corentin Tolisso","MF",31,78],["Tanner Tessmann","MF",24,77],["Tyler Morton","MF",23,76],
    ["Malick Fofana","FW",20,81],["Georges Mikautadze gone","FW",25,60],["Pavel Sulc","MF",25,77],["Afonso Moreira","FW",20,75],["Martin Satriano","FW",24,75]
  ]},
  "Lille": { league: "Ligue 1", squad: [
    ["Berke Ozer","GK",25,78],
    ["Alexsandro","DF",26,79],["Chancel Mbemba","DF",31,77],["Thomas Meunier","DF",34,75],["Romain Perraud","DF",28,76],
    ["Benjamin Andre","MF",35,75],["Nabil Bentaleb","MF",31,76],["Hakon Haraldsson","MF",22,78],
    ["Olivier Giroud","FW",39,74],["Hamza Igamane","FW",23,77],["Osame Sahraoui","FW",24,78],["Felix Correia","FW",24,76]
  ]},

  // ---------------- OTHER LEAGUES ----------------
  "Ajax": { league: "Eredivisie", squad: [
    ["Vitezslav Jaros","GK",24,76],
    ["Josip Sutalo","DF",25,78],["Youri Baas","DF",22,77],["Owen Wijndal","DF",26,75],
    ["Kenneth Taylor","MF",23,79],["Davy Klaassen","MF",32,75],["Oscar Gloukh","MF",21,79],
    ["Kasper Dolberg","FW",28,78],["Mika Godts","FW",20,77],["Wout Weghorst","FW",33,75],["Raul Moro","FW",23,75]
  ]},
  "PSV": { league: "Eredivisie", squad: [
    ["Matej Kovar","GK",25,77],
    ["Ryan Flamingo","DF",23,78],["Alexander Pluim","DF",21,73],["Sergino Dest","DF",25,78],["Anass Salah-Eddine","DF",23,76],
    ["Jerdy Schouten","MF",29,79],["Joey Veerman","MF",27,80],["Guus Til","MF",28,77],["Paul Wanner","MF",20,78],
    ["Ivan Perisic","FW",36,76],["Ricardo Pepi","FW",23,78],["Myron Boadu","FW",25,76],["Dennis Man","FW",27,77]
  ]},
  "Feyenoord": { league: "Eredivisie", squad: [
    ["Timon Wellenreuther","GK",30,76],
    ["Gijs Smal","DF",28,75],["Givairo Read","DF",19,77],
    ["Quinten Timber","MF",24,79],["In-beom Hwang","MF",29,76],["Sem Steijn","MF",24,78],
    ["Ayase Ueda","FW",27,78],["Anis Hadj Moussa","FW",23,77],["Casper Tengstedt","FW",25,75]
  ]},
  "Benfica": { league: "Primeira Liga", squad: [
    ["Anatoliy Trubin","GK",24,82],
    ["Nicolas Otamendi","DF",37,76],["Alvaro Fernandez Carreras gone","DF",22,60],["Samuel Dahl","DF",22,76],["Dodi","DF",21,76],
    ["Orkun Kokcu","MF",25,81],["Fredrik Aursnes","MF",30,78],["Richard Rios","MF",25,79],["Leandro Barreiro","MF",25,77],
    ["Vangelis Pavlidis","FW",27,81],["Kerem Akturkoglu","FW",27,79],["Franjo Ivanovic","FW",22,78]
  ]},
  "Porto": { league: "Primeira Liga", squad: [
    ["Diogo Costa","GK",26,84],
    ["Nehuen Perez","DF",25,78],["Jakub Kiwior","DF",25,79],["Francisco Moura","DF",26,77],["Alberto Costa","DF",22,76],
    ["Alan Varela","MF",24,80],["Victor Froholdt","MF",19,78],["Gabri Veiga","MF",23,79],
    ["Samu Aghehowa","FW",21,82],["Pepe","FW",28,78],["William Gomes","FW",19,76],["Borja Sainz","FW",24,77]
  ]},
  "Sporting CP": { league: "Primeira Liga", squad: [
    ["Rui Silva","GK",31,79],
    ["Goncalo Inacio","DF",24,81],["Maxi Araujo","DF",25,78],["Ivan Fresneda","DF",21,76],
    ["Morten Hjulmand","MF",26,80],["Joao Simoes","MF",19,76],["Pedro Goncalves","MF",27,82],
    ["Luis Javier Suarez","FW",28,79],["Francisco Trincao","FW",26,79],["Geny Catamo","FW",24,76],["Fotis Ioannidis","FW",25,78]
  ]},
  "Galatasaray": { league: "Super Lig", squad: [
    ["Rafael Leao","FW",26,86],
    ["Ugurcan Cakir","GK",29,79],
    ["Davinson Sanchez","DF",29,79],["Abdulkerim Bardakci","DF",31,76],["Wilfried Singo","DF",25,79],["Ismail Jakobs","DF",26,76],
    ["Lucas Torreira","MF",29,78],["Gabriel Sara","MF",26,79],["Ilkay Gundogan","MF",35,78],
    ["Victor Osimhen","FW",27,86],["Leroy Sane","FW",30,81],["Mauro Icardi","FW",32,77],["Baris Alper Yilmaz","FW",25,78]
  ]},
  "Al-Hilal": { league: "Saudi Pro League", squad: [
    ["Crysencio Summerville","FW",24,79],
    ["Ollie Watkins","FW",30,83],
    ["Yassine Bounou","GK",34,81],
    ["Kalidou Koulibaly","DF",34,77],["Joao Cancelo","DF",31,81],["Theo Hernandez","DF",28,82],
    ["Ruben Neves","MF",28,81],["Sergej Milinkovic-Savic","MF",30,79],
    ["Darwin Nunez","FW",26,81],["Malcom","FW",28,79],["Salem Al-Dawsari","FW",34,77],["Marcos Leonardo","FW",22,79]
  ]},
  "Al-Nassr": { league: "Saudi Pro League", squad: [
    ["Bento","GK",26,79],
    ["Inigo Martinez","DF",34,78],["Aymeric Laporte gone","DF",31,60],["Nawaf Boushal","DF",28,73],
    ["Marcelo Brozovic","MF",33,78],["Angelo Gabriel","FW",21,77],
    ["Cristiano Ronaldo","FW",41,82],["Sadio Mane","FW",33,78],["Joao Felix","FW",26,80],["Kingsley Coman","FW",29,80]
  ]},
  "Inter Miami": { league: "MLS", squad: [
    ["Casemiro","MF",33,80],
    ["Oscar Ustari","GK",39,72],
    ["Jordi Alba","DF",36,74],["Maximiliano Falcon","DF",28,73],["Ian Fray","DF",23,72],
    ["Sergio Busquets","MF",37,74],["Rodrigo De Paul","MF",31,80],["Yannick Bright","MF",23,72],
    ["Lionel Messi","FW",38,85],["Luis Suarez","FW",38,74],["Tadeo Allende","FW",26,74]
  ]},
  "LAFC": { league: "MLS", squad: [
    ["Hugo Lloris","GK",39,75],
    ["Aaron Long","DF",33,72],["Ryan Hollingshead","DF",34,71],
    ["Timothy Tillman","MF",26,74],["Mark Delgado","MF",30,72],
    ["Son Heung-min","FW",33,83],["Denis Bouanga","FW",31,78],["Nathan Ordaz","FW",22,72]
  ]},
  "Celtic": { league: "Scottish Premiership", squad: [
    ["Kasper Schmeichel","GK",39,75],
    ["Cameron Carter-Vickers","DF",28,77],["Liam Scales","DF",27,74],["Alistair Johnston","DF",27,76],["Kieran Tierney","DF",28,76],
    ["Callum McGregor","MF",32,77],["Reo Hatate","MF",28,77],
    ["Kelechi Iheanacho","FW",29,74],["Benjamin Nygren","FW",24,75]
  ]},
  "Rangers": { league: "Scottish Premiership", squad: [
    ["Jack Butland","GK",32,74],
    ["John Souttar","DF",29,74],["Nasser Djiga","DF",23,75],["James Tavernier","DF",34,74],
    ["Nicolas Raskin","MF",24,77],["Joe Rothwell","MF",31,73],["Mohamed Diomande","MF",24,75],
    ["Danilo","FW",26,74],["Bojan Miovski","FW",26,75],["Oliver Antman","FW",24,74]
  ]},
  "Leicester": { league: "Championship", squad: [
    ["Jakub Stolarczyk","GK",25,73],
    ["Wout Faes","DF",27,76],["Caleb Okoli","DF",24,75],["Victor Kristiansen","DF",23,75],["Ricardo Pereira","DF",32,74],
    ["Wilfred Ndidi","MF",29,77],["Harry Winks","MF",29,75],["Bilal El Khannouss gone","MF",21,60],["Oliver Skipp","MF",25,74],
    ["Jamie Vardy gone","FW",38,60],["Stephy Mavididi","FW",27,76],["Jordan Ayew","FW",34,73]
  ]},
  "Southampton": { league: "Championship", squad: [
    ["James Ward-Prowse","MF",31,77],
    ["Gavin Bazunu","GK",23,75],
    ["Taylor Harwood-Bellis","DF",23,76],["Jan Bednarek gone","DF",29,60],["Ryan Manning","DF",29,73],
    ["Flynn Downes","MF",26,75],["Shea Charles","MF",22,75],["Adam Armstrong","FW",28,75],
    ["Tyler Dibling","FW",19,78],["Ross Stewart","FW",29,72],["Ryan Fraser","FW",31,72]
  ]},
  "Boca Juniors": { league: "Argentina", squad: [
    ["Agustin Marchesin","GK",37,74],
    ["Ayrton Costa","DF",26,74],["Lautaro Di Lollo","DF",21,74],
    ["Leandro Paredes","MF",31,78],["Carlos Palacios","MF",25,75],
    ["Edinson Cavani","FW",38,72],["Miguel Merentiel","FW",29,75],["Kevin Zenon","FW",24,75]
  ]},
  "River Plate": { league: "Argentina", squad: [
    ["Franco Armani","GK",39,74],
    ["Lucas Martinez Quarta","DF",29,75],["Marcos Acuna","DF",34,74],
    ["Juan Fernando Quintero","MF",32,75],["Ignacio Fernandez","MF",35,72],["Franco Mastantuono gone","FW",18,60],
    ["Sebastian Driussi","FW",29,75],["Maximiliano Salas","FW",28,74],["Ian Subiabre","FW",18,73]
  ]},
  "Flamengo": { league: "Brazil", squad: [
    ["Agustin Rossi","GK",30,76],
    ["Leo Ortiz","DF",29,76],["Alex Sandro","DF",34,74],
    ["Gerson gone","MF",28,60],["Jorginho","MF",34,76],["Erick Pulgar","MF",31,74],["Nicolas De La Cruz","MF",28,77],
    ["Pedro","FW",28,79],["Giorgian De Arrascaeta","FW",31,78],["Samuel Lino","FW",26,77]
  ]},
  "Palmeiras": { league: "Brazil", squad: [
    ["Weverton","GK",38,74],
    ["Gustavo Gomez","DF",32,76],["Murilo","DF",28,75],["Piquerez","DF",27,76],
    ["Andreas Pereira PAL","MF",29,77],["Lucas Evangelista","MF",30,74],
    ["Vitor Roque","FW",20,78],["Estevao gone","FW",18,60],["Jose Manuel Lopez","FW",25,76],["Paulinho","FW",25,75]
  ]}
};

// Merge in the big expansion pack of extra clubs and players.
const { EXTRA_CLUBS, EXTRA_DEPTH } = require("./extra_clubs");
Object.assign(CLUBS, EXTRA_CLUBS);
for (const [club, extras] of Object.entries(EXTRA_DEPTH)) {
  if (CLUBS[club]) CLUBS[club].squad.push(...extras);
}

// Merge in the world pack: full playable leagues everywhere plus AI second divisions.
const { WORLD_CLUBS, SECOND_DIV_CLUBS, LEAGUES } = require("./world_pack");
Object.assign(CLUBS, WORLD_CLUBS, SECOND_DIV_CLUBS);
const { buildFillClubs } = require("./league_fill");
{
  const existingNames = [];
  for (const info of Object.values(CLUBS)) for (const row of info.squad) existingNames.push(row[0]);
  Object.assign(CLUBS, buildFillClubs(existingNames));
}
// Unify the Brazilian league name.
for (const c of Object.values(CLUBS)) if (c.league === "Brazil") c.league = "Brasileirao";

// Compute market value in millions from rating and age, with a small position tweak.
const VALUE_CAP = 400;
function marketValue(rating, age, pos) {
  if (rating <= 62) return 1; // placeholder entries for departed players
  let base = 2.5 * Math.exp(0.19 * (rating - 70));
  // Superstar bump so the very best sit near £300m, with a soft ceiling so
  // grown regens and peaked wonderkids climb season by season instead of
  // jumping straight to silly money.
  if (rating >= 88) base *= Math.min(2.6, 1 + 0.24 * (rating - 87));
  let ageF;
  if (age <= 20) ageF = 1.35;
  else if (age <= 23) ageF = 1.25;
  else if (age <= 26) ageF = 1.1;
  else if (age <= 28) ageF = 1.0;
  else if (age <= 30) ageF = 0.75;
  else if (age <= 32) ageF = 0.5;
  else if (age <= 34) ageF = 0.3;
  else ageF = 0.15;
  let posF = pos === "GK" ? 0.65 : pos === "DF" ? 0.9 : 1.0;
  let v = base * ageF * posF;
  return Math.min(VALUE_CAP, Math.max(0.5, Math.round(v * 10) / 10));
}

function buildDatabase() {
  const players = [];
  const clubs = {};
  let id = 1;
  for (const [clubName, info] of Object.entries(CLUBS)) {
    const squadIds = [];
    for (const [name, pos, age, rating] of info.squad) {
      // Skip placeholder "gone" entries used to keep me honest while writing squads
      if (name.includes("gone")) continue;
      const p = {
        id: id++,
        name, pos, age, rating,
        value: marketValue(rating, age, pos),
        club: clubName,
        league: info.league
      };
      players.push(p);
      squadIds.push(p.id);
    }
    clubs[clubName] = {
      name: clubName,
      league: info.league,
      prem: !!info.prem,
      budget: info.budget || 0,
      squad: squadIds
    };
  }
  // Every club gets a budget so every league is a living market.
  // Clubs with a hand set budget (the Prem) keep it, everyone else gets one
  // scaled from squad strength and how rich their league is.
  const byId = {};
  players.forEach(p => byId[p.id] = p);
  for (const club of Object.values(clubs)) {
    if (club.budget > 0) continue;
    const ratings = club.squad.map(sid => byId[sid].rating).sort((a, b) => b - a).slice(0, 14);
    const avg = ratings.reduce((s, r) => s + r, 0) / (ratings.length || 1);
    const mult = (LEAGUES[club.league] || {}).budgetMult || 1.5;
    club.budget = Math.max(2, Math.round(Math.exp((avg - 60) / 6.5) * mult * 10) / 10);
  }
  // Every club needs at least two keepers so selling or resting one never
  // leaves a squad with no goalkeeper to pick. Clubs short on keepers get a
  // generated reserve keeper with a name from that league's region.
  const { ACADEMY_NAMES } = require("./world_pack");
  const usedNames = new Set(players.map(p => p.name));
  let seed = 7;
  const nextRand = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  for (const club of Object.values(clubs)) {
    const gks = club.squad.filter(sid => byId[sid].pos === "GK").length;
    if (gks >= 2) continue;
    const region = (LEAGUES[club.league] || {}).region || "england";
    const pool = ACADEMY_NAMES[region] || ACADEMY_NAMES.england;
    let name = "";
    for (let tries = 0; tries < 200; tries++) {
      const cand = pool.first[Math.floor(nextRand() * pool.first.length)] + " " +
                   pool.last[Math.floor(nextRand() * pool.last.length)];
      if (!usedNames.has(cand)) { name = cand; break; }
    }
    if (!name) name = "Reserve Keeper " + club.name;
    usedNames.add(name);
    const ratings = club.squad.map(sid => byId[sid].rating).sort((a, b) => b - a).slice(0, 14);
    const avg = ratings.reduce((s, r) => s + r, 0) / (ratings.length || 1);
    const rating = Math.max(52, Math.min(68, Math.round(avg - 8)));
    const age = 23 + Math.floor(nextRand() * 9);
    const p = {
      id: id++,
      name, pos: "GK", age, rating,
      value: marketValue(rating, age, "GK"),
      club: club.name,
      league: club.league
    };
    players.push(p);
    byId[p.id] = p;
    club.squad.push(p.id);
  }
  // hand tuned budgets for the giants
  const bigMoney = {
    "PSG": 280, "Man City": 230, "Real Madrid": 200, "Barcelona": 180,
    "Liverpool": 180, "Arsenal": 175, "Chelsea": 170, "Man United": 160,
    "Newcastle": 155, "Tottenham": 150,
    "Bayern Munich": 160, "Al-Hilal": 160, "Al-Nassr": 150,
    "Atletico Madrid": 145, "Juventus": 140, "Inter Milan": 140,
    "Al-Ittihad": 140, "AC Milan": 135, "Napoli": 130
  };
  for (const [name, money] of Object.entries(bigMoney)) if (clubs[name]) clubs[name].budget = money;
  const yamal = players.find(p => p.name === "Lamine Yamal");
  if (yamal) yamal.value = 230;
  return { players, clubs };
}

module.exports = { buildDatabase, marketValue };
