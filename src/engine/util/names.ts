/** Fictional name generator for draft prospects, coaches and generated free agents. */
import { Rng } from "./rng";

const FIRST = [
  "Aaron", "Adrian", "Aiden", "Alec", "Amari", "Andre", "Anthony", "Ari", "Armand", "Ashton", "Austin", "Bennett", "Blake", "Brandon", "Brayden", "Brooks",
  "Caleb", "Cameron", "Carter", "Cedric", "Chase", "Christian", "Cole", "Colin", "Cyrus", "Dante", "Darius", "David", "Dawson", "Deion", "Derrick", "Desmond",
  "Devin", "Dominic", "Donovan", "Drew", "Dylan", "Elijah", "Elias", "Emeka", "Emmanuel", "Eric", "Ethan", "Evan", "Felix", "Gabriel", "Gavin", "Grant",
  "Hassan", "Hayden", "Hugo", "Ibrahim", "Isaac", "Isaiah", "Ivan", "Jabari", "Jace", "Jalen", "Jamal", "Jamison", "Jared", "Jaylen", "Jaxon", "Jerome",
  "Joaquin", "Jonah", "Jordan", "Josiah", "Julian", "Justin", "Kai", "Kaleb", "Kareem", "Keegan", "Kendall", "Khalil", "Kofi", "Lamar", "Landon", "Leo",
  "Levi", "Liam", "Lorenzo", "Lucas", "Luca", "Malachi", "Malik", "Marco", "Marcus", "Mateo", "Micah", "Miles", "Mohamed", "Nathan", "Nico", "Noah",
  "Obi", "Omar", "Oscar", "Owen", "Parker", "Quentin", "Rafael", "Reed", "Rico", "Roman", "Ryan", "Samir", "Sebastian", "Silas", "Simon", "Tariq",
  "Terrence", "Theo", "Tobias", "Trent", "Tristan", "Tyson", "Victor", "Vince", "Wesley", "Xavier", "Yusuf", "Zach", "Zion", "Nikolas", "Luka", "Mikael",
  "Pau", "Tomas", "Rui", "Kenji", "Dario", "Emil", "Aleksa", "Bogdan", "Filip", "Matas", "Ousmane", "Moussa", "Sekou", "Tidjane", "Yanic", "Thiago",
];
const LAST = [
  "Abbott", "Adeyemi", "Alvarez", "Anderson", "Armstrong", "Bailey", "Baker", "Banks", "Barnes", "Bell", "Bennett", "Bishop", "Blackwell", "Boateng", "Bowman", "Bradley",
  "Brennan", "Brooks", "Burke", "Caldwell", "Campbell", "Carr", "Carrington", "Castillo", "Chambers", "Chandler", "Clarke", "Coleman", "Collins", "Cooper", "Crawford", "Cruz",
  "Dalton", "Daniels", "Delgado", "Dixon", "Donovan", "Douglas", "Dunn", "Edwards", "Ellis", "Emerson", "Evans", "Fields", "Fleming", "Fletcher", "Ford", "Foster",
  "Francis", "Freeman", "Garrett", "Gibson", "Gordon", "Graham", "Grant", "Graves", "Greene", "Griffin", "Hale", "Hamilton", "Harper", "Hart", "Hawkins", "Hayes",
  "Henderson", "Hendricks", "Holloway", "Hopkins", "Howell", "Hudson", "Ingram", "Jacobs", "Jefferson", "Jennings", "Keller", "Kendrick", "Kimura", "Knight", "Lambert", "Lawson",
  "Lindqvist", "Lowry", "Lyons", "Maddox", "Malone", "Manning", "Marsh", "Mason", "McBride", "McCoy", "Mendez", "Merritt", "Mitchell", "Montgomery", "Moreno", "Morrison",
  "Nash", "Newman", "Nkemdiche", "Norris", "Novak", "Nwosu", "Okafor", "Oliver", "Ortega", "Owens", "Palmer", "Pearson", "Perkins", "Petrovic", "Pierce", "Porter",
  "Quinn", "Ramsey", "Reeves", "Reyes", "Rhodes", "Richards", "Riley", "Rivers", "Robbins", "Rowe", "Russo", "Salazar", "Sanders", "Santos", "Sawyer", "Shelton",
  "Simmons", "Sinclair", "Slater", "Sparks", "Stanton", "Stokes", "Sullivan", "Sutton", "Tate", "Thornton", "Torres", "Townsend", "Tucker", "Turner", "Vance", "Vasquez",
  "Vaughn", "Wade", "Walsh", "Warren", "Watkins", "Webb", "Wheeler", "Whitaker", "Wilder", "Winters", "Wolfe", "Wright", "Yates", "Young", "Zeller", "Diallo",
  "Kovac", "Horvat", "Jankovic", "Lindgren", "Moreau", "Dubois", "Rossi", "Ferreira", "Sato", "Mensah", "Traore", "Kone", "Achterberg", "Van Dijk", "Silva", "Kowalski",
];
const COLLEGES = [
  "Duke", "Kentucky", "Kansas", "North Carolina", "UCLA", "Gonzaga", "Arizona", "Baylor", "Villanova", "Michigan", "Michigan State", "UConn", "Houston", "Auburn", "Alabama",
  "Tennessee", "Texas", "Purdue", "Indiana", "Arkansas", "Florida", "Illinois", "Iowa State", "Creighton", "Marquette", "USC", "Oregon", "Virginia", "Louisville", "Syracuse",
  "Ohio State", "Texas Tech", "Memphis", "Wake Forest", "Stanford", "LSU", "Georgetown", "Xavier", "St. John's", "Maryland", "BYU", "San Diego State", "Colorado", "Miami",
];
const INTERNATIONAL = [
  ["Real Madrid", "Spain"], ["Barcelona", "Spain"], ["Partizan", "Serbia"], ["Crvena Zvezda", "Serbia"], ["Mega Basket", "Serbia"], ["ASVEL", "France"], ["Paris Basketball", "France"],
  ["Metropolitans 92", "France"], ["Olimpia Milano", "Italy"], ["Fenerbahce", "Turkey"], ["Anadolu Efes", "Turkey"], ["Zalgiris", "Lithuania"], ["Bayern Munich", "Germany"],
  ["Ratiopharm Ulm", "Germany"], ["Perth Wildcats", "Australia"], ["NZ Breakers", "New Zealand"], ["Joventut", "Spain"], ["Cedevita Olimpija", "Slovenia"],
] as const;

export function randomName(rng: Rng): { first: string; last: string } {
  return { first: rng.pick(FIRST), last: rng.pick(LAST) };
}

export function randomOrigin(rng: Rng): { college: string | null; country: string } {
  if (rng.chance(0.24)) {
    const [club, country] = rng.pick(INTERNATIONAL);
    return { college: club, country };
  }
  return { college: rng.pick(COLLEGES), country: "USA" };
}
