// Floodlights world pack: fills out all 15 playable leagues, adds AI second divisions,
// national team squads, league settings and academy name pools.

const WORLD_CLUBS = {
  // ---- Serie A up to 20 ----
  "Pisa": { league: "Serie A", squad: [
    ["Adrian Semper","GK",27,70],["Simone Canestrelli","DF",25,71],["Antonio Caracciolo","DF",35,67],["Arturo Calabresi","DF",29,69],["Samuele Angori","DF",22,70],["Idrissa Toure","MF",27,71],["Marius Marin","MF",27,71],["Michel Aebischer","MF",28,72],["Matteo Tramoni","MF",25,72],["Juan Cuadrado","FW",37,70],["M'Bala Nzola","FW",29,72],["Henrik Meister","FW",22,70],["Stefano Moreo","FW",32,69],["Gabriele Piccinini","MF",20,66]
  ]},
  "Lecce": { league: "Serie A", squad: [
    ["Wladimiro Falcone","GK",30,72],["Jamil Siebert","DF",23,69],["Kialonda Gaspar","DF",27,71],["Antonino Gallo","DF",25,71],["Danilo Veiga","DF",25,69],["Ylber Ramadani","MF",29,72],["Lassana Coulibaly","MF",29,71],["Balthazar Pierret","MF",25,70],["Lameck Banda","FW",24,71],["Konan N'Dri","FW",25,70],["Santiago Pierotti","FW",24,71],["Tete Morente","FW",29,70],["Nicola Sansone","FW",34,67],["Francesco Camarda","FW",17,72]
  ]},
  "Verona": { league: "Serie A", squad: [
    ["Lorenzo Montipo","GK",29,71],["Pawel Dawidowicz","DF",30,70],["Unai Nunez","DF",28,70],["Domagoj Bradaric","DF",26,70],["Jackson Tchatchoua","DF",24,71],["Victor Nelsson","DF",27,72],["Ondrej Duda","MF",31,70],["Suat Serdar","MF",28,71],["Tomas Suslov","MF",23,72],["Antoine Bernede","MF",26,69],["Gift Orban","FW",23,72],["Grigoris Kastanos","MF",27,69],["Daniel Mosquera","FW",26,70],["Amin Sarr","FW",24,69]
  ]},
  // ---- Bundesliga to 18 ----
  "Heidenheim": { league: "Bundesliga", squad: [
    ["Kevin Muller","GK",34,70],["Patrick Mainka","DF",30,71],["Benedikt Gimber","DF",28,69],["Marnon Busch","DF",30,69],["Jonas Fohrenbach","DF",29,69],["Omar Traore","DF",27,68],["Niklas Dorsch","MF",27,71],["Adrian Beck","MF",28,70],["Julian Niehues","MF",24,70],["Sirlord Conteh","FW",29,69],["Mathias Honsak","FW",29,69],["Marvin Pieringer","FW",26,70],["Stefan Schimmer","FW",31,67],["Budu Zivzivadze","FW",31,70]
  ]},
  // ---- Eredivisie to 10 ----
  "Go Ahead Eagles": { league: "Eredivisie", squad: [
    ["Jari De Busser","GK",25,70],["Joris Kramer","DF",29,69],["Gerrit Nauber","DF",33,67],["Mats Deijl","DF",28,70],["Melle Meulensteen","DF",26,68],["Joost van Aken","DF",31,66],["Evert Linthorst","MF",25,70],["Mathis Suray","MF",24,70],["Sylla Sow","FW",29,67],["Milan Smit","FW",25,70],["Victor Edvardsen","FW",29,70],["Jakob Breum","MF",22,71],["Calvin Twigt","MF",22,68],["Aske Adelgaard","DF",23,68]
  ]},
  "Sparta Rotterdam": { league: "Eredivisie", squad: [
    ["Yanick van Osch","GK",28,68],["Tim Coremans","GK",34,65],["Bart Vriends","DF",34,67],["Mike Eerdhuijzen","DF",25,69],["Marvin Young","DF",22,68],["Tobias Lauritsen","FW",28,71],["Joshua Kitolano","MF",24,70],["Arno Verschueren","MF",28,68],["Pelle Clement","MF",29,69],["Metinho","MF",22,69],["Jeremy van Mullem","DF",22,68],["Nils Ropke","GK",24,67],["Charles-Andreas Brym","FW",27,69],["Danilo Pereira da Silva","FW",26,70]
  ]},
  "Heerenveen": { league: "Eredivisie", squad: [
    ["Andries Noppert","GK",31,70],["Sven van Beek","DF",31,68],["Pawel Bochniewicz","DF",29,69],["Hussein Ali","DF",23,68],["Espen van Ee","MF",23,68],["Luuk Brouwers","MF",27,69],["Oliver Braude","MF",23,69],["Levi Smans","MF",21,68],["Jacob Trenskow","FW",25,69],["Dylan Vente","FW",26,70],["Ion Nicolaescu","FW",27,70],["Sam Kersten","DF",26,68],["Jan Bekkema","GK",23,66],["Tim Siersleben","DF",25,68]
  ]},
  "NEC": { league: "Eredivisie", squad: [
    ["Norbert Alblas","GK",30,65],["Jasper Cillessen","GK",36,69],["Ivan Marquez","DF",31,69],["Philippe Sandler","DF",28,68],["Kento Shiogai","DF",23,69],["Brayann Pierre","DF",22,68],["Dirk Proper","MF",23,71],["Mees Hoedemakers","MF",27,70],["Kodai Sano","MF",23,71],["Sontje Hansen","FW",23,71],["Vito van Crooij","FW",29,69],["Koki Ogawa","FW",28,71],["Bryan Linssen","FW",34,67],["Anas Ouahim","MF",27,68]
  ]},
  // ---- Primeira Liga to 10 ----
  "Vitoria Guimaraes": { league: "Primeira Liga", squad: [
    ["Bruno Varela","GK",30,71],["Toni Borevkovic","DF",28,71],["Mikel Villanueva","DF",32,68],["Bruno Gaspar","DF",32,68],["Miguel Maga","DF",22,68],["Tiago Silva","MF",32,71],["Tomas Handel","MF",24,71],["Samu","MF",26,70],["Gustavo Silva","FW",26,70],["Nelson Oliveira","FW",34,68],["Bica","FW",22,70],["Kaio Cesar","FW",24,70],["Joao Mendes","DF",24,69],["Charles","GK",29,68]
  ]},
  "Famalicao": { league: "Primeira Liga", squad: [
    ["Vana Alves","GK",34,66],["Carlos Bleck","GK",23,67],["Penetra","DF",24,70],["Riccieli","DF",28,68],["Justin de Haas","DF",25,69],["Rodrigo Pinheiro","DF",22,68],["Gustavo Sa","MF",21,72],["Sorriso","MF",25,70],["Oscar Aranda","MF",24,69],["Gil Dias","FW",29,70],["Simon Elisor","FW",26,70],["Ivo Rodrigues","FW",30,67],["Mathias De Amorim","MF",22,68],["Diogo Queiros","DF",26,69]
  ]},
  "Rio Ave": { league: "Primeira Liga", squad: [
    ["Cezary Miszta","GK",24,68],["Patrick William","DF",26,69],["Renato Pantalon","DF",23,69],["Anderson Correia","DF",24,68],["Athanasios Androutsos","DF",28,67],["Vitor Gomes","MF",34,67],["Amine Oudrhiri","MF",25,69],["Guga","MF",27,69],["Andre Luiz","MF",23,69],["Clayton","FW",26,71],["Ze Manuel","FW",26,69],["Andriy Kravchuk","FW",22,68],["Brandon Aguilera","MF",22,69],["Jonatan Braut Brunes","FW",25,69]
  ]},
  "Estoril": { league: "Primeira Liga", squad: [
    ["Marcelo Carne","GK",29,67],["Sandro Cruz","GK",24,67],["Pedro Alvaro","DF",25,69],["Bernardo Vital","DF",26,68],["Carles Soria","DF",26,68],["Furtado","DF",23,68],["Mateus Quaresma","DF",23,68],["Holsgrove","MF",25,70],["Michel Costa","MF",24,68],["Yanis Begraoui","FW",24,69],["Alejandro Marques","FW",25,70],["Heriberto Tavares","FW",28,68],["Joao Carvalho","MF",28,69],["Erison","FW",26,69]
  ]},
  "Casa Pia": { league: "Primeira Liga", squad: [
    ["Patrick Sequeira","GK",26,69],["Ricardo Batista","GK",34,66],["Fernando Varela","DF",38,65],["Nermin Zolotic","DF",32,67],["Metehan Altunbas","DF",24,68],["Nuno Borges","DF",25,68],["Beni Nkololo","MF",27,69],["Samuel Justo","MF",25,68],["Levi Faustino","MF",22,68],["Renato","FW",25,69],["Duplexe Tchamba","DF",27,68],["Felippe Cardoso","FW",27,69],["Gaizka Larrazabal","FW",27,68],["Vasco Fernandes","MF",23,67]
  ]},
  "Gil Vicente": { league: "Primeira Liga", squad: [
    ["Andrew","GK",26,69],["Brian Araujo","GK",24,67],["Buatu","DF",27,69],["Rodrigo Abascal","DF",26,69],["Luis Esteves","MF",25,69],["Pedro Tiba","MF",36,66],["Ze Carlos","MF",27,68],["Miullen","MF",23,69],["Fujimoto","MF",26,70],["Pablo Felipe","FW",22,69],["Felicio Milson","FW",25,68],["Max Svensson","FW",24,68],["Santi Garcia","DF",24,68],["Depu","FW",28,68]
  ]},
  // ---- Belgian Pro League to 10 ----
  "Antwerp": { league: "Belgian Pro League", squad: [
    ["Thomas Kaminski","GK",33,71],["Davor Matijas","GK",24,68],["Toby Alderweireld","DF",36,69],["Zeno Van Den Bosch","DF",22,70],["Jelle Bataille","DF",26,69],["Tjaronn Chery","MF",37,65],["Mauricio Benitez","MF",23,69],["Birger Verstraete","MF",31,68],["Mahamadou Doumbia","MF",21,70],["Dieumerci Mbokani","FW",39,64],["Vincent Janssen","FW",31,71],["Gyrano Kerk","FW",29,69],["Anthony Valencia","FW",23,69],["Christopher Scott","MF",23,69]
  ]},
  "Gent": { league: "Belgian Pro League", squad: [
    ["Davy Roef","GK",31,69],["Tom Vandenberghe","GK",30,65],["Noah Fadiga","DF",25,68],["Siebe Van der Heyden","DF",27,68],["Matisse Samoise","DF",23,70],["Ismael Kandouss","DF",27,68],["Sven Kums","MF",37,67],["Julien De Sart","MF",30,70],["Stefan Mitrovic","DF",35,66],["Hyllarion Goore","MF",22,68],["Andri Gudjohnsen","FW",23,70],["Max Dean","FW",21,70],["Momodou Sonko","FW",20,70],["Wilfried Kanga","FW",27,69]
  ]},
  "Standard Liege": { league: "Belgian Pro League", squad: [
    ["Matthieu Epolo","GK",20,70],["Lucas Pirard","GK",30,67],["Josue Homawoo","DF",27,69],["Daan Dierckx","DF",22,68],["Marlon Fossey","DF",26,70],["Ibe Hautekiet","DF",23,69],["Marco Ilaimaharitra","MF",30,70],["Hakim Sahabo","MF",21,70],["Casper Nielsen","MF",31,69],["Adnane Abid","FW",23,69],["Dennis Ayensa","FW",29,70],["Thomas Henry","FW",30,69],["Souleyman Doumbia","DF",28,68],["Timothe Nkada","FW",26,68]
  ]},
  "Charleroi": { league: "Belgian Pro League", squad: [
    ["Bingourou Kamara","GK",29,66],["Martin Delavallee","GK",24,68],["Jonas Bager","DF",29,69],["Vetle Dragsnes","DF",30,68],["Antoine Bernier","MF",28,69],["Etienne Camara","MF",22,68],["Mehdi Boukamir","DF",23,68],["Yacine Titraoui","MF",22,69],["Damien Marcq","MF",36,65],["Parfait Guiagon","FW",24,70],["Yassine Khalifi","MF",24,68],["Aiham Ousou","DF",25,69],["Oday Dabbagh","FW",26,69],["Antoine Colassin","FW",24,68]
  ]},
  "Westerlo": { league: "Belgian Pro League", squad: [
    ["Kristof Van Hout","GK",38,64],["Koen Vanlangendonck","GK",26,67],["Emin Bayram","DF",22,69],["Jan Bornauw","DF",23,68],["Thomas Van den Keybus","MF",24,69],["Arthur Piedfort","MF",22,69],["Bryan Reynolds","DF",24,70],["Nacho Ferri","FW",21,69],["Griffin Yow","FW",23,69],["Isa Sakamoto","FW",22,70],["Jan Gorenc","DF",26,68],["Matija Frigan","FW",22,70],["Josimar Alcocer","MF",21,69],["Tuur Rommens","DF",22,67]
  ]},
  "Mechelen": { league: "Belgian Pro League", squad: [
    ["Ortwin De Wolf","GK",28,68],["Lucas Noubi","DF",21,69],["Daam Foulon","DF",26,68],["Bas Van den Eynden","DF",22,67],["Alec Van Hoorenbeeck","DF",26,68],["Rob Schoofs","MF",31,70],["Nikola Storm","MF",30,70],["Bilal Bafdili","MF",20,69],["Lion Lauberbach","FW",27,69],["Myron van Brederode","FW",22,69],["Benito Raman","FW",30,69],["Kerim Mrabti","MF",31,68],["Redouane Halhal","MF",22,68],["Jules Van Cleemput","DF",28,67]
  ]},
  // ---- Super Lig to 10 ----
  "Trabzonspor": { league: "Super Lig", squad: [
    ["Andre Onana","GK",30,80],
    ["Mohamed Salah","FW",33,89],
    ["Onuralp Cevikkan","GK",25,69],["Stefan Savic","DF",34,71],["Arseniy Batagov","DF",23,71],["Mustafa Eskihellac","DF",28,68],["Wagner Pina","DF",23,69],["Okay Yokuslu","MF",31,71],["Tim Jabol-Folcarelli","MF",25,70],["Ozan Tufan","MF",30,70],["Edin Visca","FW",35,69],["Anthony Nwakaeme","FW",36,67],["Simon Banza","FW",29,72],["Paul Onuachu","FW",31,72],["Kazeem Olaigbe","FW",22,69],["Batista Mendy","MF",25,70]
  ]},
  "Basaksehir": { league: "Super Lig", squad: [
    ["Muhammed Sengezer","GK",28,71],["Leo Duarte","DF",29,70],["Christopher Operi","DF",28,69],["Jerome Opoku","DF",26,70],["Onur Bulut","DF",31,68],["Berat Ozdemir","MF",27,69],["Miguel Crespo","MF",29,70],["Olivier Kemen","MF",29,69],["Deniz Turuc","MF",32,68],["Yusuf Sari","FW",26,69],["Eldor Shomurodov","FW",30,71],["Davie Selke","FW",30,70],["Ivan Brnic","FW",24,69],["Festy Ebosele","DF",23,70]
  ]},
  "Samsunspor": { league: "Super Lig", squad: [
    ["Okan Kocuk","GK",30,70],["Zeki Yavru","DF",34,66],["Rick van Drongelen","DF",26,69],["Lubomir Satka","DF",29,69],["Soner Gonul","DF",23,68],["Antoine Makoumbou","MF",27,70],["Celil Yuksel","MF",24,69],["Olivier Ntcham","MF",29,70],["Afonso Sousa","MF",25,71],["Emre Kilinc","FW",31,68],["Anthony Musaba","FW",24,71],["Marius Mouandilmadji","FW",27,70],["Carlo Holse","FW",26,70],["Logi Tomasson","DF",25,69]
  ]},
  "Goztepe": { league: "Super Lig", squad: [
    ["Mateusz Lis","GK",28,70],["Malcom Bokele","DF",26,70],["Heliton","DF",28,69],["Furkan Bayir","DF",24,68],["Allan Godoi","DF",26,68],["Amin Cherni","MF",26,69],["Rhaldney","MF",25,69],["Junior Olaitan","MF",23,70],["Efkan Bekiroglu","MF",30,69],["Furkan Bayram","FW",24,67],["Janderson","FW",26,70],["Ogun Bayrak","FW",23,67],["Ruan","DF",26,68],["Arda Okan Kurtulan","FW",22,68]
  ]},
  "Kasimpasa": { league: "Super Lig", squad: [
    ["Andreas Gianniotis","GK",32,69],["Gideon Jung","DF",30,68],["Attila Szalai","DF",27,70],["Stefano Denswil","DF",32,67],["Cafu","MF",32,68],["Haris Hajradinovic","MF",31,69],["Aytac Kara","MF",32,67],["Claudio Winck","DF",31,67],["Mamadou Fall","FW",27,69],["Ali Yavuz Kol","FW",24,68],["Mortadha Ben Ouanes","DF",30,68],["Fousseni Diabate","FW",29,68],["Pape Habib Gueye","FW",26,69],["Yusuf Barasi","FW",22,68]
  ]},
  "Antalyaspor": { league: "Super Lig", squad: [
    ["Julian Cuesta","GK",34,68],["Veysel Sari","DF",37,64],["Bahadir Ozturk","DF",25,67],["Georgiy Dzhikiya","DF",31,69],["Huseyin Turkmen","DF",28,68],["Jesper Ceesay","MF",23,69],["Sander van de Streek","MF",32,68],["Jakub Kaluzinski","MF",23,69],["Erdogan Yesilyurt","FW",30,67],["Soner Dikmen","MF",31,67],["Samuel Ballet","FW",24,69],["Tomas Cvancara","FW",25,70],["Yohan Boli","FW",31,67],["Bunyamin Balci","DF",25,67]
  ]},
  "Alanyaspor": { league: "Super Lig", squad: [
    ["Ertugrul Taskiran","GK",35,67],["Fidan Aliti","DF",31,67],["Bruno Viana","DF",30,68],["Yusuf Ozdemir","DF",24,67],["Baran Moglica","DF",23,67],["Gaius Makouta","MF",27,70],["Nicolas Janvier","MF",26,69],["Izzet Celik","MF",21,68],["Yusuf Sertkaya","FW",21,68],["Hwang Ui-jo","FW",32,70],["Steve Mounie","FW",30,70],["Ibrahim Kaya","FW",22,68],["Enes Keskin","DF",23,67],["Meschack Elia","FW",28,69]
  ]},
  // ---- Scottish Premiership to 10 ----
  "Hearts": { league: "Scottish Premiership", squad: [
    ["Craig Gordon","GK",42,66],["Zander Clark","GK",33,68],["Frankie Kent","DF",29,69],["Craig Halkett","DF",30,68],["Stephen Kingsley","DF",31,68],["Christian Borchgrevink","DF",26,69],["Cameron Devlin","MF",27,70],["Beni Baningime","MF",27,70],["Blair Spittal","MF",29,69],["Alan Forrest","FW",29,68],["Lawrence Shankland","FW",30,72],["Elton Kabangu","FW",27,69],["Claudio Braga","FW",26,69],["Harry Milne","DF",28,67]
  ]},
  "Hibernian": { league: "Scottish Premiership", squad: [
    ["David Marshall","GK",40,65],["Jordan Smith","GK",30,67],["Rocky Bushiri","DF",26,69],["Warren O'Hora","DF",26,68],["Lewis Miller","DF",25,68],["Jordan Obita","DF",31,68],["Joe Newell","MF",32,69],["Nectarios Triantis","MF",22,70],["Chris Cadden","MF",29,68],["Junior Hoilett","FW",35,66],["Martin Boyle","FW",32,70],["Kieron Bowie","FW",23,69],["Elie Youan","FW",26,70],["Josh Mulligan","MF",22,68]
  ]},
  "Aberdeen": { league: "Scottish Premiership", squad: [
    ["Dimitar Mitov","GK",28,70],["Ross Doohan","GK",27,67],["Jack MacKenzie","DF",25,68],["Slobodan Rubezic","DF",25,69],["Gavin Molloy","DF",23,68],["Nicky Devlin","DF",31,68],["Graeme Shinnie","MF",34,68],["Sivert Heltne Nilsen","MF",33,68],["Dante Polvara","MF",25,68],["Leighton Clarkson","MF",23,70],["Topi Keskinen","FW",22,69],["Kevin Nisbet","FW",28,70],["Ester Sokler","FW",26,68],["Adil Aouchiche","MF",23,69]
  ]},
  "Dundee United": { league: "Scottish Premiership", squad: [
    ["Yevhenii Kucherenko","GK",26,68],["Jack Walton","GK",27,67],["Emmanuel Adegboyega","DF",21,68],["Ross Graham","DF",24,68],["Kevin Holt","DF",32,67],["Will Ferry","DF",24,68],["Craig Sibbald","MF",30,68],["Vicko Sevelj","MF",25,68],["Iurie Iovu","DF",23,67],["Panutche Camara","MF",28,68],["Sam Dalby","FW",25,69],["Zac Sapsford","FW",22,68],["Amar Fatah","FW",24,68],["Owen Stirton","FW",20,67]
  ]},
  "Motherwell": { league: "Scottish Premiership", squad: [
    ["Calum Ward","GK",25,67],["Aston Oxborough","GK",27,66],["Stephen O'Donnell","DF",33,66],["Kofi Balmer","DF",24,67],["Paul McGinn","DF",34,65],["Luke Armstrong","FW",26,68],["Tom Sparrow","MF",25,67],["Callum Slattery","MF",26,69],["Ewan Wilson","DF",21,67],["Elijah Just","FW",25,68],["Apostolos Stamatelopoulos","FW",26,69],["Tawanda Maswanhise","FW",22,68],["Lennard Maloney","MF",25,68],["Johnny Koutroumbis","DF",26,66]
  ]},
  "Kilmarnock": { league: "Scottish Premiership", squad: [
    ["Robby McCrorie","GK",27,68],["Kieran O'Hara","GK",29,66],["Joe Wright","DF",30,67],["Lewis Mayo","DF",25,68],["Corrie Ndaba","DF",25,67],["Robbie Deas","DF",25,67],["Brad Lyons","MF",28,67],["Liam Polworth","MF",30,66],["Rory McKenzie","MF",31,66],["Fraser Murray","MF",26,67],["Marley Watkins","FW",34,65],["Bobby Wales","FW",21,67],["David Watson","MF",21,68],["Innes Cameron","FW",25,68]
  ]},
  "St Mirren": { league: "Scottish Premiership", squad: [
    ["Zach Hemming","GK",25,68],["Peter Urminsky","GK",26,65],["Marcus Fraser","DF",31,66],["Richard Taylor","DF",25,67],["Alex Gogic","DF",31,67],["Charles Dunne","DF",32,65],["Mark O'Hara","MF",29,68],["Killian Phillips","MF",23,68],["Keanu Baccus","MF",27,68],["Caolan Boyd-Munce","MF",25,67],["Jonah Ayunga","FW",28,68],["Mikael Mandron","FW",30,67],["Toyosi Olusanya","FW",27,67],["Roland Idowu","FW",23,67]
  ]},
  "Dundee": { league: "Scottish Premiership", squad: [
    ["Jon McCracken","GK",25,67],["Trevor Carson","GK",37,65],["Joe Shaughnessy","DF",33,66],["Clark Robertson","DF",31,66],["Billy Koumetio","DF",22,68],["Ryan Astley","DF",23,67],["Ziyad Larkeche","DF",24,67],["Cesar Garza","MF",24,67],["Fin Robertson","MF",22,67],["Scott Tiffoney","FW",27,67],["Simon Murray","FW",33,67],["Curtis Main","FW",33,66],["Seb Palmer-Houlden","FW",21,67],["Imari Samuels","DF",22,66]
  ]},
  // ---- Saudi Pro League to 10 ----
  "Al-Shabab": { league: "Saudi Pro League", squad: [
    ["Marcelo Grohe","GK",38,68],["Iago Santos","DF",28,69],["Fabio Martinez","DF",28,69],["Abdullah Yousef","DF",27,68],["Moataz Hawsawi","DF",33,66],["Yannick Carrasco","FW",32,75],["Fahad Al-Muwallad","FW",31,67],["Guanca","MF",31,69],["Nawaf Al-Sadi","MF",23,68],["Abdulrahman Ghareeb","FW",28,70],["Hamad Al-Ghamdi","MF",25,68],["Ahmed Sharahili","DF",26,67],["Saud Zidan","GK",25,66],["Marwan Al-Sahafi","FW",22,69]
  ]},
  "Al-Ettifaq": { league: "Saudi Pro League", squad: [
    ["Paulo Victor","GK",34,68],["Marcel Tisserand","DF",32,69],["Naif Almas","DF",26,67],["Ali Hazazi","DF",29,66],["Ali Al-Zubaidi","DF",27,67],["Georginio Wijnaldum","MF",35,73],["Jack Hendry","DF",30,70],["Haitham Asiri","FW",24,68],["Mohammed Al-Kuwaykibi","MF",25,68],["Fahad Al-Rashidi","FW",24,67],["Moussa Dembele","FW",29,72],["Karl Toko Ekambi","FW",33,70],["Haidar Al-Aryani","MF",24,67],["Saleh Al-Amri","GK",27,66]
  ]},
  "Al-Taawoun": { league: "Saudi Pro League", squad: [
    ["Mailson","GK",29,69],["Andrei Girotto","DF",33,69],["Waleed Bakshween","DF",29,66],["Madallah Al-Olayan","DF",30,66],["Abdulmajeed Al-Sulaiheem","MF",26,68],["Roger Martinez","FW",31,71],["Musa Barrow","FW",27,72],["Flavio Medeiros","MF",26,69],["Waleed Al-Ahmed","MF",25,67],["Mohammed Fouzair","MF",29,68],["Abdullah Haif","DF",25,67],["Sultan Mandash","FW",24,68],["Faris Abdi","FW",23,67],["Khalid Al-Ghamdi","GK",26,65]
  ]},
  "Al-Fateh": { league: "Saudi Pro League", squad: [
    ["Sofiane Alakouch","DF",27,67],["Yousef Al-Sunaydih","GK",26,66],["Petros","MF",36,66],["Sofiane Bendebka","MF",32,69],["Mourad Batna","FW",33,68],["Jason Denayer","DF",30,70],["Ali Hazzazi","FW",26,67],["Majed Kanabah","MF",26,66],["Salman Al-Muwashar","FW",27,67],["Zakaria Al-Sudani","MF",25,67],["Hassan Al-Salis","GK",28,65],["Talal Haji","FW",21,67],["Fahad Al-Hamad","DF",26,66],["Bandar Al-Ahbabi","DF",31,66]
  ]},
  "Al-Khaleej": { league: "Saudi Pro League", squad: [
    ["Antonio Adan","GK",38,68],["Fawaz Al-Sqoor","DF",29,66],["Odion Ighalo","FW",36,68],["Murad Al-Hawsawi","FW",26,67],["Pedro Rebocho","DF",30,68],["Fabio Martins","MF",32,69],["Ahmed Al-Zain","MF",26,67],["Mohammed Al-Kunaydiri","FW",25,67],["Saad Bguir","MF",31,68],["Abdullah Al-Shamekh","FW",24,67],["Majed Hazazi","DF",27,66],["Naif Sharahili","GK",26,65],["Talal Absi","MF",24,67],["Omar Al-Yami","DF",25,66]
  ]},
  // ---- MLS to 10 ----
  "Seattle Sounders": { league: "MLS", squad: [
    ["Stefan Frei","GK",39,69],["Andrew Thomas","GK",26,67],["Yeimar Gomez","DF",33,70],["Jackson Ragen","DF",26,70],["Alex Roldan","DF",29,69],["Nouhou Tolo","DF",28,69],["Cristian Roldan","MF",30,70],["Obed Vargas","MF",20,72],["Albert Rusnak","MF",31,71],["Pedro de la Vega","FW",24,71],["Jordan Morris","FW",31,70],["Danny Musovski","FW",29,68],["Paul Rothrock","FW",26,69],["Kim Kee-hee","DF",36,66]
  ]},
  "Columbus Crew": { league: "MLS", squad: [
    ["Patrick Schulte","GK",24,71],["Nicholas Hagen","GK",29,67],["Steven Moreira","DF",31,70],["Rudy Camacho","DF",34,67],["Malte Amundsen","DF",27,68],["Mohamed Farsi","DF",25,69],["Darlington Nagbe","MF",35,69],["Dylan Chambost","MF",28,69],["Sean Zawadzki","MF",25,68],["Diego Rossi","FW",27,73],["Daniel Gazdag","MF",29,71],["Jacen Russell-Rowe","FW",23,69],["Max Arfsten","FW",24,70],["AZ Jackson","MF",23,68]
  ]},
  "FC Cincinnati": { league: "MLS", squad: [
    ["Roman Celentano","GK",25,71],["Evan Louro","GK",29,66],["Matt Miazga","DF",30,70],["Nick Hagglund","DF",33,67],["Alvas Powell","DF",31,67],["Lukas Engel","DF",27,68],["Obinna Nwobodo","MF",28,71],["Pavel Bucha","MF",27,70],["Luca Orellano","FW",25,71],["Evander","MF",27,74],["Kevin Denkey","FW",25,73],["Sergio Santos","FW",31,68],["Gerardo Valenzuela","MF",21,68],["DeAndre Yedlin","DF",32,67]
  ]},
  "Portland Timbers": { league: "MLS", squad: [
    ["Maxime Crepeau","GK",31,70],["James Pantemis","GK",28,67],["Dario Zuparic","DF",33,68],["Kamal Miller","DF",28,69],["Juan Mosquera","DF",23,69],["Jimer Fory","DF",25,68],["Diego Chara","MF",39,66],["David Ayala","MF",23,70],["Cristhian Paredes","MF",27,69],["David Da Costa","MF",24,71],["Santiago Moreno","FW",25,71],["Felipe Mora","FW",32,69],["Kevin Kelsy","FW",21,70],["Ariel Lassiter","FW",30,67]
  ]},
  "Austin FC": { league: "MLS", squad: [
    ["Brad Stuver","GK",34,69],["Stefan Cleveland","GK",31,66],["Brendan Hines-Ike","DF",31,68],["Julio Cascante","DF",32,67],["Jon Gallagher","DF",29,68],["Guilherme Biro","DF",21,69],["Daniel Pereira","MF",25,70],["Ilie Sanchez","MF",34,67],["Owen Wolff","MF",20,70],["Jader Obrian","FW",30,68],["Myrto Uzuni","FW",30,71],["Brandon Vazquez","FW",26,71],["Osman Bukari","FW",26,71],["Robert Taylor","MF",30,68]
  ]},
  // ---- Liga MX to 10 ----
  "Chivas": { league: "Liga MX", squad: [
    ["Raul Rangel","GK",25,72],["Luis Olivas","DF",26,68],["Gilberto Sepulveda","DF",26,69],["Diego Campillo","DF",24,68],["Miguel Tapias","DF",27,68],["Bryan Gonzalez","DF",22,69],["Fernando Beltran","MF",27,71],["Erick Gutierrez","MF",30,70],["Omar Govea","MF",29,68],["Roberto Alvarado","FW",27,72],["Efrain Alvarez","MF",23,70],["Armando Gonzalez","FW",22,71],["Javier Hernandez","FW",37,67],["Cade Cowell","FW",22,70]
  ]},
  "Cruz Azul": { league: "Liga MX", squad: [
    ["Kevin Mier","GK",25,72],["Willer Ditta","DF",28,70],["Gonzalo Piovi","DF",30,70],["Jesus Orozco","DF",23,70],["Jorge Sanchez","DF",27,69],["Erik Lira","MF",25,71],["Lorenzo Faravelli","MF",32,69],["Carlos Rodriguez","MF",28,70],["Carlos Rotondi","FW",28,70],["Ignacio Rivero","MF",33,68],["Angel Sepulveda","FW",34,69],["Gabriel Fernandez","FW",31,70],["Mateusz Bogusz","MF",24,72],["Amaury Morales","MF",20,69]
  ]},
  "Pumas": { league: "Liga MX", squad: [
    ["Keylor Navas","GK",38,72],["Alan Bautista","GK",24,66],["Nathan Silva","DF",27,70],["Lisandro Magallan","DF",32,68],["Alvaro Angulo","DF",28,68],["Pablo Bennevendo","DF",23,68],["Jorge Ruvalcaba","MF",24,69],["Ulises Rivas","MF",24,68],["Piero Quispe","MF",24,70],["Ignacio Pussetto","FW",29,68],["Guillermo Martinez","FW",30,70],["Ruben Duarte","DF",30,68],["Adalberto Carrasquilla","MF",26,71],["Santiago Trigos","MF",23,68]
  ]},
  "Toluca": { league: "Liga MX", squad: [
    ["Hugo Gonzalez","GK",35,68],["Luis Garcia","GK",26,68],["Federico Pereira","DF",25,69],["Antonio Briseno","DF",31,68],["Jesus Gallardo","DF",31,69],["Everardo Lopez","DF",24,68],["Marcel Ruiz","MF",25,71],["Franco Romero","MF",25,69],["Alexis Vega","FW",27,72],["Helinho","FW",25,71],["Paulinho","FW",30,73],["Bruno Mendez","DF",25,69],["Robert Morales","FW",26,69],["Nicolas Castro","MF",24,69]
  ]},
  "Pachuca": { league: "Liga MX", squad: [
    ["Carlos Moreno","GK",28,69],["Eduardo Bauermann","DF",29,68],["Gustavo Cabral","DF",39,64],["Alexei Dominguez","MF",24,68],["Sergio Barreto","DF",26,68],["Andres Micolta","DF",25,68],["Elias Montiel","MF",20,70],["Pedro Pedraza","MF",25,68],["Agustin Palavecino","MF",28,70],["Kenedy","FW",29,70],["John Kennedy","FW",23,70],["Enner Valencia","FW",35,69],["Eduardo Garcia","GK",24,66],["Alonso Aceves","DF",23,68]
  ]},
  "Santos Laguna": { league: "Liga MX", squad: [
    ["Carlos Acevedo","GK",29,71],["Hector Holguin","DF",26,67],["Kevin Balanta","MF",28,68],["Anderson Santamaria","DF",33,67],["Ismael Govea","DF",28,67],["Pedro Aquino","MF",30,69],["Jose Lozano","MF",23,67],["Aldo Lopez","MF",22,67],["Cristian Dajome","FW",31,68],["Jordan Carrillo","FW",23,68],["Bruno Barticciotto","FW",24,69],["Ramiro Sordo","FW",23,68],["Diego Medina","DF",22,67],["Angel Flores","MF",23,67]
  ]},
  "Leon": { league: "Liga MX", squad: [
    ["Oscar Garcia","GK",26,68],["Stiven Barreiro","DF",26,68],["Jaine Barreiro","MF",26,68],["Salvador Reyes","DF",27,68],["Ivan Moreno","MF",24,68],["Nicolas Fonseca","MF",27,69],["Jose Alvarado","MF",24,68],["Elias Hernandez","MF",37,64],["James Rodriguez","MF",34,74],["Ismael Diaz","FW",28,69],["Rogelio Funes Mori","FW",34,67],["Emiliano Rodriguez","FW",24,68],["Daniel Arcila","DF",24,67],["Sebastian Santos","GK",23,65]
  ]},
  // ---- Brasileirao to 10 ----
  "Sao Paulo": { league: "Brasileirao", squad: [
    ["Rafael","GK",35,72],["Jandrei","GK",32,68],["Arboleda","DF",34,70],["Alan Franco","DF",29,71],["Sabino","DF",28,69],["Cedric Soares","DF",34,68],["Pablo Maia","MF",23,73],["Alisson","MF",32,70],["Oscar","MF",34,73],["Lucas Moura","FW",33,74],["Luciano","FW",32,72],["Andre Silva","FW",28,71],["Ferreirinha","FW",27,71],["Rodriguinho","MF",22,70]
  ]},
  "Gremio": { league: "Brasileirao", squad: [
    ["Tiago Volpi","GK",34,70],["Gustavo Martins","DF",22,70],["Kannemann","DF",34,69],["Cristian Pavon","FW",29,70],["Marlon","DF",30,69],["Joao Lucas","DF",27,68],["Villasanti","MF",28,72],["Cuellar","MF",33,69],["Edenilson","MF",35,68],["Cristaldo","MF",29,71],["Braithwaite","FW",34,71],["Gabriel Mec","FW",18,70],["Aravena","FW",23,70],["Amuzu","FW",26,70]
  ]},
  "Fluminense": { league: "Brasileirao", squad: [
    ["Fabio","GK",45,68],["Thiago Silva","DF",41,72],["Freytes","DF",25,70],["Samuel Xavier","DF",35,67],["Rene","DF",33,68],["Facundo Bernal","MF",22,70],["Hercules","MF",25,71],["Nonato","MF",27,70],["Lima","MF",29,70],["Ganso","MF",36,69],["German Cano","FW",37,70],["Everaldo","FW",31,69],["Kevin Serna","FW",27,70],["Agustin Canobbio","FW",27,71]
  ]},
  "Internacional": { league: "Brasileirao", squad: [
    ["Sergio Rochet","GK",32,72],["Anthoni","GK",23,67],["Vitao","DF",25,71],["Victor Gabriel","DF",21,69],["Bernabei","DF",25,70],["Braian Aguirre","DF",25,69],["Fernando","MF",38,67],["Thiago Maia","MF",28,70],["Alan Patrick","MF",34,72],["Bruno Tabata","MF",28,70],["Ricardo Mathias","FW",19,70],["Rafael Borre","FW",30,71],["Gustavo Prado","FW",20,69],["Carbonero","FW",26,70]
  ]},
  // ---- Argentina to 10 ----
  "Independiente": { league: "Argentina", squad: [
    ["Rodrigo Rey","GK",34,70],["Kevin Lomonaco","DF",23,71],["Sebastian Valdez","DF",27,69],["Franco Paredes","DF",25,68],["Federico Vera","DF",25,68],["Felipe Loyola","MF",24,72],["Ivan Marcone","MF",35,68],["Luciano Cabral","MF",30,70],["Pablo Galdames","MF",29,68],["Santiago Montiel","FW",25,69],["Gabriel Avalos","FW",35,68],["Matias Abaldo","FW",21,69],["Diego Tarzia","FW",22,68],["Nicolas Freire","DF",31,67]
  ]},
  "San Lorenzo": { league: "Argentina", squad: [
    ["Orlando Gill","GK",27,69],["Gaston Hernandez","DF",28,69],["Jhohan Romana","DF",26,69],["Daniel Herrera","DF",23,67],["Nicolas Tripichio","MF",27,68],["Ezequiel Cerutti","FW",33,67],["Ignacio Perruzzi","DF",23,67],["Alexis Cuello","FW",28,69],["Andres Vombergar","FW",30,69],["Facundo Gulli","MF",25,68],["Ivan Leguizamon","FW",23,68],["Matias Reali","FW",25,68],["Juan Rattalino","MF",22,67],["Agustin Ladstatter","MF",21,67]
  ]},
  "Velez": { league: "Argentina", squad: [
    ["Tomas Marchiori","GK",30,70],["Aaron Quiros","DF",24,69],["Emanuel Mammana","DF",29,68],["Damian Fernandez","DF",25,68],["Elias Gomez","DF",31,68],["Agustin Bouzat","MF",31,69],["Claudio Baeza","MF",31,68],["Tomas Galvan","MF",25,70],["Maher Carrizo","FW",19,71],["Imanol Machuca","FW",25,70],["Braian Romero","FW",34,69],["Michael Santos","FW",32,69],["Rodrigo Aliendro","MF",34,68],["Joaquin Garcia","DF",22,68]
  ]},
  "Estudiantes": { league: "Argentina", squad: [
    ["Fernando Muslera","GK",39,69],["Leandro Gonzalez Pirez","DF",33,69],["Facundo Rodriguez","DF",25,69],["Ramiro Funes Mori","DF",34,67],["Eric Meza","DF",25,68],["Santiago Ascacibar","MF",28,71],["Mikel Amondarain","MF",23,69],["Cristian Medina","MF",23,71],["Tiago Palacios","FW",24,70],["Edwuin Cetre","FW",27,71],["Guido Carrillo","FW",34,68],["Lucas Alario","FW",33,68],["Alexis Castro","MF",30,68],["Gaston Benedetti","DF",24,69]
  ]},
  "Rosario Central": { league: "Argentina", squad: [
    ["Jorge Broun","GK",39,68],["Facundo Mallo","DF",30,68],["Carlos Quintana","DF",37,65],["Juan Gimenez","DF",22,69],["Emanuel Coronel","DF",29,67],["Federico Navarro","MF",25,69],["Ignacio Malcorra","MF",38,68],["Franco Ibarra","MF",24,69],["Angel Di Maria","FW",37,76],["Gaspar Duarte","FW",25,69],["Alejo Veliz","FW",22,71],["Enzo Copetti","FW",29,69],["Jaminton Campaz","FW",25,71],["Agustin Sandez","DF",24,68]
  ]},
  "Talleres": { league: "Argentina", squad: [
    ["Guido Herrera","GK",33,69],["Juan Portilla","MF",26,69],["Matias Catalan","DF",32,68],["Gaston Benavidez","DF",28,68],["Blas Riveros","DF",27,67],["Ulises Ortegoza","MF",26,69],["Marcos Portillo","MF",23,68],["Matias Galarza","MF",23,69],["Miguel Navarro","DF",26,68],["Nahuel Bustos","FW",27,70],["Federico Girotti","FW",26,69],["Ruben Botta","MF",35,67],["Augusto Schott","DF",23,67],["Valentin Depietri","FW",25,68]
  ]},
  "Lanus": { league: "Argentina", squad: [
    ["Nahuel Losada","GK",32,69],["Carlos Izquierdoz","DF",36,67],["Jose Canale","DF",25,68],["Yonatan Cabral","DF",32,66],["Sasha Marcich","DF",25,68],["Agustin Cardozo","MF",25,68],["Agustin Medina","MF",26,68],["Marcelino Moreno","MF",30,70],["Eduardo Salvio","FW",35,69],["Walter Bou","FW",32,69],["Rodrigo Castillo","FW",26,69],["Alexis Segovia","FW",22,68],["Franco Watson","MF",22,67],["Luciano Boggio","MF",25,68]
  ]}
};


// ---- AI second divisions: real clubs, playable as opponents and transfer markets, run by AI ----
const SECOND_DIV_CLUBS = {
  "Almeria": { league: "La Liga 2", squad: [["Fernando Martinez","GK",35,68],["Aitor Bunuel","DF",27,66],["Nelson Monte","DF",30,67],["Alejandro Pozo","DF",26,68],["Dion Lopy","MF",23,70],["Iddrisu Baba","MF",29,68],["Sergio Arribas","MF",24,72],["Adrian Embarba","FW",33,69],["Luka Romero","FW",21,70],["Leo Baptistao","FW",33,68],["Thalys","FW",20,69],["Marcos Luna","DF",21,68],["Nico Melamed","MF",24,68],["Arnau Puigmal","MF",24,67]]},
  "Deportivo La Coruna": { league: "La Liga 2", squad: [["Daniel Bachmann","GK",31,68],["Dani Barcia","DF",22,68],["Pablo Vazquez","DF",31,67],["Ximo Navarro","DF",35,64],["Sergio Escudero","DF",36,64],["Diego Villares","MF",29,68],["Jose Gragera","MF",25,68],["Yeremay Hernandez","FW",23,73],["David Mella","FW",20,71],["Lucas Perez","FW",37,67],["Zakaria Eddahchouri","FW",25,69],["Mario Soriano","MF",23,69],["Miguel Loureiro","DF",29,66],["Germán Parreño","GK",32,64]]},
  "Las Palmas": { league: "La Liga 2", squad: [["Adri Suarez","GK",24,65],["Dinko Horkas","GK",26,67],["Mika Marmol","DF",24,70],["Alex Suarez","DF",32,66],["Viti Rozada","DF",25,67],["Enzo Loiodice","MF",25,69],["Kirian Rodriguez","MF",29,69],["Ale Garcia","MF",22,68],["Manu Fuster","MF",28,68],["Sandro Ramirez","FW",30,68],["Marc Cardona","FW",30,67],["Jaime Mata","FW",36,65],["Milos Lukovic","FW",20,68],["Juanma Herzog","DF",24,67]]},
  "Leganes": { league: "La Liga 2", squad: [["Juan Soriano","GK",28,67],["Jorge Saenz","DF",28,66],["Matija Nastasic","DF",32,67],["Javi Hernandez","DF",27,67],["Adria Altimira","DF",24,67],["Ruben Pena","DF",34,65],["Seydouba Cisse","MF",25,68],["Renato Tapia","MF",30,69],["Munir","FW",30,67],["Oscar Rodriguez","MF",27,68],["Duk","FW",25,67],["Miguel de la Fuente","FW",26,67],["Diego Garcia","FW",25,67],["Enric Franquesa","DF",27,66]]},
  "Real Valladolid": { league: "La Liga 2", squad: [["Guilherme Fernandes","GK",26,66],["Andre Ferreira","GK",29,67],["David Torres","DF",23,67],["Javi Sanchez","DF",28,67],["Luis Perez","DF",30,66],["Guille Bueno","DF",22,67],["Stanko Juric","MF",29,67],["Mathis Lachuer","MF",25,68],["Ivan Alejo","FW",30,66],["Chuki","MF",22,68],["Marcos Andre","FW",28,67],["Juanmi Latasa","FW",24,68],["Amath Ndiaye","FW",29,66],["Victor Meseguer","MF",26,67]]},
  "Sporting Gijon": { league: "La Liga 2", squad: [["Ruben Yanez","GK",31,67],["Pablo Insua","DF",31,66],["Kevin Vazquez","DF",32,65],["Diego Sanchez","DF",24,66],["Nacho Martin","MF",22,67],["Roque Mesa","MF",36,64],["Nacho Mendez","MF",27,68],["Cesar Gelabert","MF",24,68],["Gaspar Campos","FW",25,68],["Dubasin","FW",26,68],["Otero","FW",29,67],["Guille Rosas","DF",25,66],["Oscar Cortes","FW",21,68],["Enol Coto","DF",23,66]]},
  "Real Zaragoza": { league: "La Liga 2", squad: [["Esteban Andrada","GK",34,68],["Insua","DF",32,66],["Tachi","DF",28,66],["Fran Gamez","DF",33,64],["Aguirregabiria","DF",29,66],["Francho Serrano","MF",23,68],["Raul Guti","MF",28,68],["Toni Moya","MF",27,67],["Valery Fernandez","FW",27,67],["Paulino","FW",24,68],["Mario Soberon","FW",27,67],["Sebas Moyano","FW",28,66],["Keidi Bare","MF",28,67],["Andres Borge","MF",22,66]]},
  "Racing Santander": { league: "La Liga 2", squad: [["Jokin Ezkieta","GK",29,68],["Javi Castro","DF",25,67],["Manu Hernando","DF",26,67],["Saul Garcia","DF",30,66],["Alvaro Mantilla","DF",23,66],["Sory Kaba","FW",30,67],["Aritz Aldasoro","MF",26,67],["Inigo Sainz-Maza","MF",25,67],["Andres Martin","FW",26,70],["Inigo Vicente","FW",27,70],["Juan Carlos Arana","FW",26,68],["Jeremy","FW",23,67],["Marco Sangalli","FW",33,64],["Pablo Rodriguez","MF",24,68]]},
  "Palermo": { league: "Serie B", squad: [["Alfred Gomis","GK",32,67],["Ionut Nedelcearu","DF",29,67],["Pietro Ceccaroni","DF",29,67],["Salim Diakite","DF",25,67],["Kristoffer Lund","DF",23,68],["Claudio Gomes","MF",25,68],["Jacopo Segre","MF",28,68],["Filippo Ranocchia","MF",24,68],["Roberto Insigne","FW",31,67],["Matteo Brunori","FW",31,69],["Joel Pohjanpalo","FW",31,70],["Federico Di Francesco","FW",31,67],["Valerio Verre","MF",31,66],["Niccolo Pierozzi","DF",24,67]]},
  "Sampdoria": { league: "Serie B", squad: [["Paolo Vismara","GK",22,65],["Simone Ghidotti","GK",25,66],["Alex Ferrari","DF",31,66],["Giorgio Altare","DF",27,67],["Bartosz Bereszynski","DF",33,65],["Antonio Barreca","DF",30,65],["Ronaldo Vieira","MF",27,67],["Liam Henderson","MF",29,67],["Simone Pafundi","MF",19,70],["Fabio Depaoli","MF",28,67],["Gennaro Tutino","FW",29,68],["Massimo Coda","FW",37,66],["Estanis Pedrola","FW",22,69],["Marvin Cuni","FW",24,67]]},
  "Bari": { league: "Serie B", squad: [["Boris Radunovic","GK",29,67],["Valerio Di Cesare","DF",42,60],["Mehdi Dorval","DF",24,68],["Raffaele Pucino","DF",34,64],["Giacomo Manzari","FW",25,66],["Mattia Maita","MF",30,67],["Giacomo Faticanti","MF",21,67],["Ahmad Benali","MF",33,65],["Kevin Lasagna","FW",33,67],["Jeremy Menez","FW",38,64],["Cesar Falletti","MF",32,66],["Gaston Pereiro","MF",30,67],["Andrija Novakovich","FW",29,66],["Nicola Bellomo","MF",34,64]]},
  "Spezia": { league: "Serie B", squad: [["Stefano Gori","GK",29,66],["Petko Hristov","DF",26,67],["Przemyslaw Wisniewski","DF",27,68],["Dimitrios Nikolaou","DF",27,67],["Arkadiusz Reca","DF",30,66],["Salvatore Esposito","MF",25,69],["Szymon Zurkowski","MF",28,68],["Simone Bandinelli","MF",26,66],["Daniele Verde","FW",29,68],["Albin Ekdal","MF",36,64],["Luca Moro","FW",24,66],["Marco Bertini","MF",23,66],["Rachid Kouda","MF",23,67],["Giovanni Bandini","MF",22,65]]},
  "Venezia": { league: "Serie B", squad: [["Jesse Joronen","GK",32,67],["Gianluca Busio","MF",23,69],["Marin Sverko","DF",27,66],["Antonio Candela","DF",25,67],["Ridgeciano Haps","DF",32,65],["Michael Svoboda","DF",27,66],["Antonio Vergara","MF",22,66],["Issa Doumbia","MF",24,67],["Francesco Zampano","DF",31,65],["Christian Gytkjaer","FW",35,65],["Daniel Fila","FW",23,67],["Alfred Duncan","MF",32,66],["Mikael Egill Ellertsson","MF",23,67],["John Yeboah","FW",25,67]]},
  "Empoli": { league: "Serie B", squad: [["Devis Vasquez","GK",27,67],["Lorenzo Tonelli","DF",35,63],["Mattia Viti","DF",23,68],["Tyronne Ebuehi","DF",29,66],["Saba Goglichidze","DF",21,68],["Leonardo Mancuso","FW",33,65],["Marco Olivieri","FW",26,66],["Gerard Yepes","MF",23,66],["Luca Belardinelli","MF",26,66],["Emmanuel Gyasi","FW",31,66],["Stiven Shpendi","FW",22,67],["Gabriele Guarino","DF",21,66],["Salvatore Elia","FW",26,67],["Duccio Degli Innocenti","MF",22,67]]},
  "Monza": { league: "Serie B", squad: [["Semuel Pizzignacco","GK",24,66],["Alessio Cragno","GK",31,66],["Pablo Mari","DF",32,68],["Armando Izzo","DF",33,66],["Samuele Birindelli","DF",26,67],["Georgios Kyriakopoulos","DF",29,67],["Matteo Pessina","MF",28,69],["Alessandro Bianco","MF",23,67],["Omari Forson","FW",21,68],["Dany Mota","FW",27,69],["Mirko Maric","FW",30,66],["Jean-Daniel Akpa Akpro","MF",32,65],["Gianluca Caprari","FW",32,67],["Samuele Vignato","MF",21,68]]},
  "Modena": { league: "Serie B", squad: [["Riccardo Gagno","GK",28,66],["Edoardo Pieragnolo","DF",23,66],["Antonio Pergreffi","DF",34,64],["Luca Caldirola","DF",34,65],["Fabio Ponsi","DF",24,66],["Jacopo Sersanti","MF",23,67],["Fabio Gerli","MF",29,67],["Giuseppe Palumbo","MF",28,68],["Ettore Gliozzi","FW",30,66],["Pedro Mendes","FW",26,68],["Andrea Cistana","DF",28,66],["Kleis Bozhanaj","MF",25,66],["Thomas Battistella","MF",25,66],["Nicholas Bonfanti","FW",23,67]]},
  "Schalke": { league: "2. Bundesliga", squad: [["Loris Karius","GK",32,67],["Marcin Kaminski","DF",33,66],["Tomas Kalas","DF",32,67],["Derry John Murkin","DF",26,67],["Mehmet Aydin","DF",23,67],["Ron Schallenberg","MF",26,68],["Paul Seguin","MF",30,68],["Amin Younes","MF",32,67],["Kenan Karaman","FW",31,69],["Moussa Sylla","FW",25,69],["Bryan Lasme","FW",26,67],["Christopher Antwi-Adjei","FW",31,67],["Timo Becker","DF",28,67],["Peter Remmert","GK",24,64]]},
  "Hertha Berlin": { league: "2. Bundesliga", squad: [["Tjark Ernst","GK",22,68],["Marton Dardai","DF",23,69],["Toni Leistner","DF",35,65],["Deyovaisio Zeefuik","DF",27,66],["Michal Karbownik","DF",24,67],["Diego Demme","MF",33,67],["Kevin Sessa","MF",25,67],["Fabian Reese","FW",27,71],["Michael Cuisance","MF",26,68],["Florian Niederlechner","FW",34,66],["Marten Winkler","FW",23,67],["Luca Schuler","FW",26,67],["Palko Dardai","MF",26,66],["Jon Dagur Thorsteinsson","FW",26,67]]},
  "Kaiserslautern": { league: "2. Bundesliga", squad: [["Julian Krahl","GK",25,67],["Kevin Kraus","DF",33,65],["Boris Tomiak","DF",26,67],["Jan Elvedi","DF",28,67],["Erik Wekesser","DF",28,66],["Frank Ronstadt","DF",27,66],["Marlon Ritter","MF",30,68],["Tobias Raschl","MF",25,67],["Filip Kaloc","MF",25,67],["Kenny Prince Redondo","FW",30,67],["Daisuke Yokota","MF",25,67],["Daniel Hanslik","FW",28,66],["Naatan Skytta","MF",23,67],["Jannik Mause","FW",26,66]]},
  "Fortuna Dusseldorf": { league: "2. Bundesliga", squad: [["Florian Kastenmeier","GK",28,68],["Andre Hoffmann","DF",32,66],["Nicolas Gavory","DF",30,65],["Matthias Zimmermann","DF",33,65],["Tim Oberdorf","DF",28,66],["Marcel Sobottka","MF",31,67],["Jona Niemiec","FW",24,66],["Dzenan Pejcinovic","FW",20,68],["Shinta Appelkamp","MF",24,68],["Florent Muslija","MF",27,68],["Cedric Itten","FW",28,67],["Vincent Vermeij","FW",30,67],["Danny Schmidt","FW",23,66],["Anouar El Azzouzi","MF",24,66]]},
  "Hannover": { league: "2. Bundesliga", squad: [["Toni Stahl","GK",24,64],["Leo Weinkauf","GK",29,66],["Julian Borner","DF",34,63],["Josh Knight","DF",28,67],["Marcel Halstenberg","DF",33,66],["Fabian Kunze","MF",27,66],["Enzo Leopold","MF",25,67],["Max Christiansen","MF",29,66],["Noel Aseko","MF",21,68],["Jannik Rochelt","FW",27,67],["Havard Nielsen","FW",32,66],["Sei Muroya","DF",31,65],["Benjamin Kanuric","MF",22,67],["Hyun-ju Lee","MF",22,68]]},
  "Nurnberg": { league: "2. Bundesliga", squad: [["Jan Reichert","GK",24,66],["Robin Knoche","DF",33,66],["Henri Koudossou","DF",26,66],["Tim Janisch","DF",21,67],["Oliver Villadsen","DF",23,66],["Danilo Soares","DF",34,64],["Taylan Duman","MF",28,66],["Julian Justvan","MF",27,68],["Mahir Emreli","FW",28,67],["Semir Telalovic","FW",25,66],["Rafael Lubach","MF",21,66],["Julian Kania","FW",23,67],["Berkay Yilmaz","DF",21,66],["Nathan Kabasele","DF",24,65]]},
  "Karlsruhe": { league: "2. Bundesliga", squad: [["Hans Christian Bernat","GK",25,65],["Marcel Franke","DF",32,66],["Christoph Kobald","DF",27,66],["Sebastian Jung","DF",35,63],["David Herold","DF",22,66],["Leon Jensen","MF",28,66],["Marcel Beifus","MF",23,66],["Jerome Gondorf","MF",37,63],["Fabian Schleusener","FW",33,66],["Lilian Egloff","MF",23,66],["Louey Ben Farhat","FW",21,66],["Dzenis Burnic","MF",27,66],["Ensar Aksakal","MF",21,65],["Noah Rupp","MF",21,65]]},
  "Paderborn": { league: "2. Bundesliga", squad: [["Pelle Boevink","GK",27,66],["Felix Gotze","DF",27,66],["Visar Musliu","DF",30,66],["Tjark Scheller","DF",24,66],["Laurin Curda","DF",23,66],["Marcel Hoffmeier","MF",26,67],["Raphael Obermair","MF",29,67],["David Kinsombi","MF",29,66],["Filip Bilbija","FW",25,68],["Sven Michel","FW",35,65],["Adriano Grimaldi","FW",34,63],["Stefano Marino","MF",21,66],["Santiago Castaneda","MF",23,66],["Sebastian Klaas","FW",26,66]]},
  "Saint-Etienne": { league: "Ligue 2", squad: [["Gautier Larsonneur","GK",28,69],["Mickael Nade","DF",26,68],["Maxime Bernauer","DF",27,66],["Yvann Macon","DF",27,67],["Leo Petrot","DF",28,66],["Pierre Ekwah","MF",23,69],["Florian Tardieu","MF",33,66],["Aimen Moueffek","MF",24,68],["Zuriko Davitashvili","FW",24,71],["Lucas Stassin","FW",21,71],["Irvin Cardona","FW",28,68],["Augustine Boakye","FW",25,68],["Joshua Duffus","FW",21,67],["Igor Miladinovic","MF",22,67]]},
  "Montpellier": { league: "Ligue 2", squad: [["Benjamin Lecomte","GK",34,67],["Christopher Jullien","DF",32,67],["Kiki Kouyate","DF",28,67],["Enzo Tchato","DF",23,67],["Theo Sainte-Luce","DF",27,66],["Wahbi Khazri","FW",34,66],["Jordan Ferri","MF",33,66],["Yanis Issoufou","MF",21,67],["Teji Savanier","MF",33,70],["Khalil Fayad","MF",21,68],["Andy Delort","FW",34,68],["Tanguy Coulibaly","FW",24,67],["Modibo Sagnan","DF",26,66],["Junior Ndiaye","FW",22,67]]},
  "Reims": { league: "Ligue 2", squad: [["Nicolas Penneteau","GK",44,58],["Alexandre Olliero","GK",29,66],["Maxime Busi","DF",26,66],["Joseph Okumu","DF",28,68],["Cedric Kipre","DF",28,67],["Sergio Akieme","DF",28,67],["Valentin Atangana","MF",20,69],["Amadou Kone","MF",21,68],["Teddy Teuma","MF",32,68],["Cheick Keita","FW",21,67],["Amine Salama","FW",25,67],["Oumar Diakite","FW",22,69],["Mamadou Diakhon","FW",20,68],["Gabriel Moscardo","MF",20,70]]},
  "Bordeaux": { league: "Ligue 2", squad: [["Lassana Diabate","MF",22,66],["Rafal Strączek","GK",25,65],["Yoan Barbet","DF",32,64],["Jean Grillot","DF",24,66],["Emeric Depussay","DF",22,65],["Malcom Viltard","DF",23,65],["Danylo Ignatenko","MF",28,66],["Franck Maurice-Belay","MF",21,66],["Seydina Toure","FW",23,66],["Andy Carroll","FW",36,65],["Alan Dzabana","FW",27,66],["Yanis Merdji","FW",26,65],["Riad Nouri","FW",30,64],["Mathis Lartigue","MF",21,65]]},
  "Caen": { league: "Ligue 2", squad: [["Anthony Mandrea","GK",28,66],["Ilyes Housni","FW",20,67],["Emmanuel Ntim","DF",29,66],["Ilyes Najim","MF",23,66],["Noe Lebreton","MF",21,66],["Brahim Traore","DF",24,66],["Bilal Brahimi","FW",25,67],["Tidiam Gomis","FW",21,67],["Alexandre Mendy","FW",31,68],["Mathias Autret","MF",34,63],["Yann M'Vila","MF",35,65],["Kelian Nsona","FW",23,66],["Anthony Gomez Mancini","MF",24,65],["Quentin Lecoeuche","DF",29,64]]},
  "Bastia": { league: "Ligue 2", squad: [["Johnny Placide","GK",37,64],["Dominique Guidi","DF",29,66],["Anthony Roncaglia","DF",26,65],["Tom Ducrocq","MF",25,66],["Christophe Vincent","MF",31,65],["Lisandru Tramoni","MF",22,67],["Migouel Alfarela","FW",27,67],["Christ Inao Oulai","MF",19,68],["Florian Bianchini","FW",24,66],["Sebastien Salles-Lamonge","MF",28,66],["Amine Meddah","DF",22,65],["Axel Kouame","FW",23,66],["Jim Etienne","DF",24,65],["Noah Vidal","MF",21,65]]},
  "Grenoble": { league: "Ligue 2", squad: [["Esteban Salles","GK",30,65],["Adrien Monfray","DF",32,64],["Theo Guivarch","GK",26,64],["Manuel Perez","MF",26,66],["Amine Sbai","FW",23,66],["Jessy Benet","MF",29,67],["Enzo Bonal","DF",22,65],["Yohan Demoncy","MF",29,65],["Enzo Camara","FW",22,66],["Djena Tsiakanyo","MF",22,65],["Loick Ayina","DF",22,66],["Mathis Bruns","DF",23,65],["Adama Sidibeh","FW",25,66],["Rida Belkhiter","DF",23,64]]},
  "Amiens": { league: "Ligue 2", squad: [["Thomas Callens","GK",28,65],["Louis Fontaine","GK",24,64],["Ismael Boura","DF",25,66],["Mamadou Fofana","DF",27,66],["Kilian Corredor","MF",26,66],["Owen Gene","MF",22,67],["Antoine Leautey","FW",29,67],["Louis Mafouta","FW",27,67],["Jeremy Gelin","DF",28,65],["Sekou Sanogo","MF",23,66],["Yohan Bocognano","DF",33,63],["Gael Kakuta","MF",34,66],["Fode Doucoure","DF",22,66],["Steve Solvet","FW",24,65]]}
};

// ---- National team squads: names must match players in the database, unresolved names are skipped ----
const NATIONS = {
  "England": ["Jordan Pickford","John Stones","Marc Guehi","Reece James","Myles Lewis-Skelly","Declan Rice","Jude Bellingham","Cole Palmer","Phil Foden","Bukayo Saka","Harry Kane","Ollie Watkins","Anthony Gordon","Morgan Rogers","Trent Alexander-Arnold","Ezri Konsa"],
  "France": ["Mike Maignan","Kylian Mbappe","Ousmane Dembele","Aurelien Tchouameni","Eduardo Camavinga","William Saliba","Ibrahima Konate","Theo Hernandez","Jules Kounde","Antoine Griezmann","Michael Olise","Bradley Barcola","Marcus Thuram","Hugo Ekitike","Manu Kone","Desire Doue"],
  "Spain": ["Unai Simon","Pedri","Gavi","Lamine Yamal","Nico Williams","Dani Olmo","Fabian Ruiz","Rodri","Robin Le Normand","Pau Cubarsi","Dean Huijsen","Mikel Oyarzabal","Ferran Torres","Dani Carvajal","Alejandro Grimaldo","Martin Zubimendi"],
  "Germany": ["Marc-Andre ter Stegen","Joshua Kimmich","Jamal Musiala","Florian Wirtz","Kai Havertz","Leroy Sane","Antonio Rudiger","Jonathan Tah","Nico Schlotterbeck","Leon Goretzka","Serge Gnabry","Niclas Fullkrug","Karim Adeyemi","Aleksandar Pavlovic","Angelo Stiller","Nick Woltemade"],
  "Portugal": ["Diogo Costa","Ruben Dias","Nuno Mendes","Joao Cancelo","Bruno Fernandes","Bernardo Silva","Vitinha","Joao Neves","Rafael Leao","Cristiano Ronaldo","Joao Felix","Pedro Neto","Goncalo Ramos","Ruben Neves","Goncalo Inacio","Francisco Conceicao"],
  "Netherlands": ["Bart Verbruggen","Virgil van Dijk","Matthijs de Ligt","Nathan Ake","Denzel Dumfries","Frenkie de Jong","Tijjani Reijnders","Ryan Gravenberch","Xavi Simons","Cody Gakpo","Memphis Depay","Jeremie Frimpong","Micky van de Ven","Brian Brobbey","Jurrien Timber","Justin Kluivert"],
  "Belgium": ["Thibaut Courtois","Koen Casteels","Arthur Theate","Timothy Castagne","Kevin De Bruyne","Youri Tielemans","Amadou Onana","Charles De Ketelaere","Jeremy Doku","Leandro Trossard","Romelu Lukaku","Lois Openda","Zeno Debast","Malick Fofana","Wout Faes","Orel Mangala"],
  "Italy": ["Gianluigi Donnarumma","Alessandro Bastoni","Riccardo Calafiori","Giovanni Di Lorenzo","Federico Dimarco","Nicolo Barella","Sandro Tonali","Davide Frattesi","Federico Chiesa","Moise Kean","Mateo Retegui","Giacomo Raspadori","Alessandro Buongiorno","Samuele Ricci","Destiny Udogie","Pietro Comuzzo"],
  "Argentina": ["Emiliano Martinez","Cristian Romero","Lisandro Martinez","Nahuel Molina","Enzo Fernandez","Alexis Mac Allister","Rodrigo De Paul","Lionel Messi","Lautaro Martinez","Julian Alvarez","Nico Paz","Thiago Almada","Alejandro Garnacho","Valentin Barco","Franco Mastantuono","Claudio Echeverri"],
  "Brazil": ["Alisson","Marquinhos","Gabriel Magalhaes","Eder Militao","Casemiro","Bruno Guimaraes","Lucas Paqueta","Raphinha","Vinicius Junior","Rodrygo","Neymar","Gabriel Martinelli","Matheus Cunha","Endrick","Savinho","Joao Pedro"],
  "Uruguay": ["Sergio Rochet","Ronald Araujo","Jose Maria Gimenez","Mathias Olivera","Federico Valverde","Manuel Ugarte","Rodrigo Bentancur","Darwin Nunez","Giorgian De Arrascaeta","Luis Suarez","Facundo Pellistri","Maximiliano Araujo","Agustin Canobbio","Nahitan Nandez","Emiliano Rodriguez","Santiago Bueno"],
  "Croatia": ["Luka Modric","Josko Gvardiol","Mateo Kovacic","Marcelo Brozovic","Andrej Kramaric","Ivan Perisic","Dominik Livakovic","Josip Misic","Luka Stojkovic","Sandro Kulenovic","Dion Drena Beljo","Martin Baturina","Duje Caleta-Car","Petar Sucic","Luka Sucic","Franjo Ivanovic"],
  "USA": ["Matt Turner","Christian Pulisic","Weston McKennie","Tyler Adams","Sergino Dest","Antonee Robinson","Chris Richards","Tim Weah","Folarin Balogun","Ricardo Pepi","Yunus Musah","Josh Sargent","Malik Tillman","Alejandro Zendejas","Obed Vargas","Patrick Schulte"],
  "Mexico": ["Luis Malagon","Edson Alvarez","Johan Vasquez","Santiago Gimenez","Raul Jimenez","Hirving Lozano","Erick Sanchez","Kevin Alvarez","Henry Martin","German Berterame","Fidel Ambriz","Roberto Alvarado","Alexis Vega","Marcel Ruiz","Cesar Montes","Jorge Sanchez"],
  "Turkey": ["Altay Bayindir","Hakan Calhanoglu","Arda Guler","Kenan Yildiz","Ferdi Kadioglu","Orkun Kokcu","Baris Alper Yilmaz","Yunus Akgun","Semih Kilicsoy","Ersin Destanoglu","Ugurcan Cakir","Merih Demiral","Ozan Tufan","Can Uzun","Kerem Akturkoglu","Ismail Yuksek"],
  "Scotland": ["Scott McTominay","John McGinn","Billy Gilmour","Andy Robertson","Kieran Tierney","Craig Gordon","Lewis Ferguson","Che Adams","Lyndon Dykes","Connor Barron","Lennon Miller","Findlay Curtis","Ryan Christie","Angus Gunn","Lawrence Shankland","Ben Doak"]
};

// ---- League settings: which leagues are playable, money scale, academy name region, linked second division ----
const LEAGUES = {
  "Premier League":       { playable: true,  prize: 1.0,  budgetMult: 3.0, region: "england",   second: "Championship", euro: true },
  "La Liga":              { playable: true,  prize: 0.85, budgetMult: 3.0, region: "spain",     second: "La Liga 2", euro: true },
  "Serie A":              { playable: true,  prize: 0.75, budgetMult: 2.6, region: "italy",     second: "Serie B", euro: true },
  "Bundesliga":           { playable: true,  prize: 0.75, budgetMult: 2.6, region: "germany",   second: "2. Bundesliga", euro: true },
  "Ligue 1":              { playable: true,  prize: 0.65, budgetMult: 2.4, region: "france",    second: "Ligue 2", euro: true },
  "Eredivisie":           { playable: true,  prize: 0.3,  budgetMult: 2.0, region: "netherlands", euro: true },
  "Primeira Liga":        { playable: true,  prize: 0.3,  budgetMult: 2.0, region: "portugal",  euro: true },
  "Belgian Pro League":   { playable: true,  prize: 0.25, budgetMult: 1.8, region: "belgium",   euro: true },
  "Super Lig":            { playable: true,  prize: 0.3,  budgetMult: 2.0, region: "turkey",    euro: true },
  "Scottish Premiership": { playable: true,  prize: 0.2,  budgetMult: 1.6, region: "scotland",  euro: true },
  "Saudi Pro League":     { playable: true,  prize: 0.5,  budgetMult: 6.0, region: "saudi" },
  "MLS":                  { playable: true,  prize: 0.35, budgetMult: 2.0, region: "usa" },
  "Liga MX":              { playable: true,  prize: 0.3,  budgetMult: 2.0, region: "mexico" },
  "Brasileirao":          { playable: true,  prize: 0.35, budgetMult: 1.6, region: "brazil" },
  "Argentina":            { playable: true,  prize: 0.25, budgetMult: 1.5, region: "argentina" },
  "Championship":         { playable: false, prize: 0.15, budgetMult: 1.2, region: "england" },
  "La Liga 2":            { playable: false, prize: 0.1,  budgetMult: 1.1, region: "spain" },
  "Serie B":              { playable: false, prize: 0.1,  budgetMult: 1.1, region: "italy" },
  "2. Bundesliga":        { playable: false, prize: 0.1,  budgetMult: 1.1, region: "germany" },
  "Ligue 2":              { playable: false, prize: 0.1,  budgetMult: 1.1, region: "france" },
  "Greece":               { playable: false, prize: 0.1,  budgetMult: 1.5, region: "italy" },
  "Austria":              { playable: false, prize: 0.1,  budgetMult: 1.5, region: "germany" },
  "Denmark":              { playable: false, prize: 0.1,  budgetMult: 1.5, region: "netherlands" },
  "Croatia":              { playable: false, prize: 0.1,  budgetMult: 1.5, region: "italy" }
};

// ---- Domestic cup names per playable league (England gets FA Cup and EFL Cup separately) ----
const DOMESTIC_CUPS = {
  "La Liga": "Copa del Rey",
  "Serie A": "Coppa Italia",
  "Bundesliga": "DFB Pokal",
  "Ligue 1": "Coupe de France",
  "Eredivisie": "KNVB Cup",
  "Primeira Liga": "Taca de Portugal",
  "Belgian Pro League": "Belgian Cup",
  "Super Lig": "Turkish Cup",
  "Scottish Premiership": "Scottish Cup",
  "Saudi Pro League": "King's Cup",
  "MLS": "US Open Cup",
  "Liga MX": "Copa MX",
  "Brasileirao": "Copa do Brasil",
  "Argentina": "Copa Argentina"
};

// ---- Academy name pools by region for generated youth players ----
const ACADEMY_NAMES = {
  england: { first: ["Archie","Harry","Charlie","Alfie","Freddie","Ollie","George","Jacob","Louie","Theo","Reuben","Kai"], last: ["Whitmore","Sedgley","Hartley","Boswell","Cranfield","Ashworth","Peckham","Dunmore","Kettering","Ollerton","Braithwaite","Fenwick"] },
  spain: { first: ["Iker","Pablo","Alvaro","Marc","Hugo","Dani","Izan","Mateo","Adrian","Nico","Sergio","Unai"], last: ["Cabrera","Sarmiento","Villalonga","Requena","Zubiri","Palomares","Oyanguren","Bermejo","Castellanos","Ferrando","Lozano","Ibarrola"] },
  italy: { first: ["Matteo","Lorenzo","Alessio","Tommaso","Riccardo","Gabriele","Federico","Nicolo","Samuele","Diego","Pietro","Elia"], last: ["Sartorelli","Baldacci","Vignola","Ferrucci","Montanari","Crippa","Del Vecchio","Lanzafame","Buscemi","Tavella","Ronchetti","Miceli"] },
  germany: { first: ["Finn","Luca","Jonas","Elias","Noah","Lennard","Maxim","Til","Jannik","Emil","Moritz","Bastian"], last: ["Kirchhoff","Steinbach","Wallner","Hobbing","Reusch","Dallmann","Kranefeld","Ottmar","Seewald","Brunkhorst","Ziegler","Hemmerling"] },
  france: { first: ["Ilan","Mathis","Rayan","Enzo","Noa","Aksel","Timeo","Sofiane","Malo","Ibrahim","Kylian","Eliott"], last: ["Delacroix","Mbemba","Cazenave","Rousselet","Diakhaby","Vercruysse","Lemoine","Sagnol","Traore-Bel","Ondoua","Perrichon","Kavelashvili"] },
  netherlands: { first: ["Sem","Daan","Luuk","Thijs","Jesse","Milan","Sven","Gijs","Ruben","Teun","Bram","Kees"], last: ["Van der Zande","Bloemendaal","Bakhuis","Terpstra","Vlietstra","Roozendaal","Griffioen","Van Dokkum","Hazelaar","Wubben","Nijhuis","Dekkinga"] },
  portugal: { first: ["Tiago","Goncalo","Afonso","Duarte","Martim","Rodrigo","Vasco","Salvador","Tomas","Henrique","Lourenco","Dinis"], last: ["Camacho","Estevao","Sobral","Varandas","Padeiro","Malheiro","Meireles","Baixinho","Tavares do Sul","Quintela","Aguiar","Fontoura"] },
  belgium: { first: ["Milan","Arthur","Noah","Lucas","Victor","Matteo","Kobe","Senne","Jules","Lars","Wout","Stan"], last: ["Vandenbroucke","Peeters","Claesen","De Ridder","Maertens","Vervoort","Bogaerts","Lemmens","Van Acker","Dhondt","Goossens","Verlinden"] },
  turkey: { first: ["Emir","Yusuf","Kerem","Arda","Mert","Berkay","Efe","Kaan","Baran","Umut","Cem","Halil"], last: ["Yildirim","Aksoy","Demirtas","Karahan","Ozkan","Sahiner","Bulut","Erdinc","Tokgoz","Aydogdu","Celikkol","Basaran"] },
  scotland: { first: ["Callum","Lewis","Finlay","Rory","Ewan","Angus","Fraser","Kyle","Blair","Cameron","Hamish","Struan"], last: ["McAllister","Buchanan","Lamont","Kirkwood","Docherty","MacPhail","Renwick","Galloway","Muirhead","Tulloch","Cargill","Brodie"] },
  saudi: { first: ["Abdullah","Mohammed","Fahad","Salem","Nawaf","Turki","Saad","Rayan","Khalid","Faisal","Ziyad","Hamad"], last: ["Al-Harthi","Al-Dossari","Al-Qahtani","Al-Mutairi","Al-Otaibi","Al-Zahrani","Al-Shehri","Al-Bishi","Al-Subaie","Al-Anazi","Al-Juhani","Al-Rashid"] },
  usa: { first: ["Brayden","Tyler","Jaylen","Carson","Diego","Marcus","Austin","Cade","Malik","Trevor","Landon","Zion"], last: ["Whitfield","Castellano","Okafor-Jones","Brennan","Delgado","Hutchins","Marbury","Callahan","Reyes-Smith","Tolliver","Vandermeer","Bostic"] },
  mexico: { first: ["Santiago","Emiliano","Diego","Leonardo","Matias","Sebastian","Alan","Uriel","Angel","Cesar","Ivan","Raul"], last: ["Zepeda","Palomo","Bustamante","Olivares","Puentes","Renteria","Salcido","Vergara","Madrigal","Cisneros","Arellano","Quintanilla"] },
  brazil: { first: ["Joao","Kaue","Vitor","Ryan","Cauã","Enzo","Miguel","Davi","Luan","Erick","Cassio","Yago"], last: ["dos Anjos","Ferrao","Bandeira","Camargo","Sales","do Carmo","Peixoto","Pires","Sampaio","Carvalho","Serrano","Teles"] },
  argentina: { first: ["Thiago","Bautista","Benjamin","Valentino","Joaquin","Lautaro","Bruno","Felipe","Ignacio","Ramiro","Genaro","Facundo"], last: ["Aguirrezabal","Arancibia","Ledesma","Quintero","Baldini","Ocampo","Sarachaga","Villafane","Zalazar","Maidana","Peralta","Bustos"] }
};

module.exports = { WORLD_CLUBS, SECOND_DIV_CLUBS, NATIONS, LEAGUES, DOMESTIC_CUPS, ACADEMY_NAMES };

