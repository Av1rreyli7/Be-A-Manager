/**
 * 2026-27 CBA figures. Every number the engine uses lives in data/cba.json, generated from here.
 * `verified: true` = confirmed against a 2026 publication (see `sources`).
 * `verified: false` = CBA rule reproduced from the 2023 CBA text as commonly summarized; flagged in DATA_REPORT.md.
 */

const S = {
  nbaCap: "https://www.nba.com/news/nba-salary-cap-2026-27-season (NBA.com, 2026-06-30)",
  hrCap: "https://www.hoopsrumors.com/2026/06/salary-cap-tax-line-set-for-2026-27-nba-season.html",
  hrMle: "https://www.hoopsrumors.com/2026/07/values-of-2026-27-mid-level-bi-annual-exceptions.html",
  hrMin: "https://www.hoopsrumors.com/2026/07/nba-minimum-salaries-for-2026-27.html",
  hrRookie: "https://www.hoopsrumors.com/2026/07/rookie-scale-salaries-for-2026-nba-first-round-picks.html",
  hrTax: "https://www.hoopsrumors.com/2026/08/hoops-rumors-glossary-luxury-tax-penalties-5.html",
  hrTpe: "https://www.hoopsrumors.com/2024/06/hoops-rumors-glossary-traded-player-exception-5.html",
};

// 120% rookie-scale amounts as published (pick -> [y1, y2, y3 (TO), y4 (TO)])
const ROOKIE_SCALE_120: number[][] = [
  [14748000, 15485760, 16223040, 20457253], [13195320, 13855320, 14515320, 18318334],
  [11849760, 12441840, 13034880, 16476088], [10683720, 11217960, 11752320, 14866685],
  [9674760, 10158240, 10641960, 13483363], [8787000, 9226440, 9666000, 12256488],
  [8021640, 8422920, 8823600, 11205972], [7348680, 7716120, 8083680, 10282441],
  [6754800, 7093080, 7430640, 9466635], [6417360, 6738000, 7058520, 8999613],
  [6096240, 6401280, 6706200, 8899127], [5791680, 6081480, 6371160, 8779458],
  [5502000, 5777280, 6052200, 8648594], [5227200, 5488560, 5750160, 8515987],
  [4965480, 5213760, 5461920, 8373123], [4717320, 4953240, 5189400, 7960540],
  [4481280, 4705440, 4929360, 7571497], [4257480, 4470000, 4683120, 7202639],
  [4065720, 4268880, 4472640, 6887866], [3902760, 4097880, 4292880, 6619621],
  [3746760, 3934320, 4121760, 6565964], [3597120, 3776760, 3956760, 6508870],
  [3453360, 3626160, 3798360, 6445817], [3315360, 3481080, 3646800, 6378253],
  [3182280, 3341280, 3500880, 6305085], [3076920, 3230520, 3384480, 6102217],
  [2988120, 3137640, 3287400, 5930470], [2969520, 3118560, 3266880, 5896718],
  [2948280, 3095640, 3243120, 5853832], [2926800, 3073080, 3219840, 5811811],
];

export const CBA_2026_27 = {
  season: "2026-27",
  status: "official", // announced 2026-06-30; UI shows "projected" for any figure with verified:false
  fetchedFrom: S,

  salaryCap: { value: 164_961_000, verified: true, source: S.nbaCap },
  minimumTeamSalary: { value: 148_465_000, verified: true, source: S.hrCap },
  luxuryTax: { value: 200_428_000, verified: true, source: S.hrCap },
  firstApron: { value: 209_015_000, verified: true, source: S.hrCap },
  secondApron: { value: 221_686_000, verified: true, source: S.hrCap },
  averageSalaryEstimate: { value: 15_163_000, verified: true, source: S.hrCap },
  capGrowthProjection: { value: 0.07, verified: false, source: "assumption: ~7%/yr (CBA max annual increase is 10%)" },

  exceptions: {
    nonTaxpayerMLE: { value: 15_044_000, maxYears: 4, raisePct: 0.05, hardCap: "firstApron", verified: true, source: S.hrMle },
    taxpayerMLE: { value: 6_064_000, maxYears: 2, raisePct: 0.05, hardCap: "secondApron", verified: true, source: S.hrMle },
    roomMLE: { value: 9_366_000, maxYears: 3, raisePct: 0.05, hardCap: null, verified: true, source: S.hrMle },
    biAnnual: { value: 5_477_000, maxYears: 2, raisePct: 0.05, hardCap: "firstApron", everyOtherYear: true, verified: true, source: S.hrMle },
    earlyBirdMaxStart: { value: 15_235_500, verified: true, source: S.hrCap },
    expandedTpeAllowance: { value: 9_096_000, verified: true, source: S.hrCap },
    tradeCashLimit: { value: 8_495_000, verified: true, source: S.hrCap },
    exhibit10MaxBonus: { value: 91_000, verified: true, source: S.hrCap },
    twoWaySalary: { value: 678_882, verified: true, source: S.hrCap },
    disabledPlayerExceptionPct: { value: 0.5, capAt: "nonTaxpayerMLE", verified: false, source: "2023 CBA: lesser of 50% of injured player's salary or NT-MLE" },
    tpeDurationDays: { value: 365, verified: true, source: S.hrTpe },
  },

  tax: {
    bracketSize: 6_064_000,
    standardRates: [1.0, 1.25, 3.5, 4.75],
    repeaterRates: [3.0, 3.25, 5.5, 6.75],
    incrementPerBracket: 0.5,
    repeaterRule: "paid tax in 3 of previous 4 seasons",
    repeaterTeams2026_27: ["DEN", "GS", "LAL", "PHX"],
    verified: true,
    source: S.hrTax,
  },

  maxSalary: {
    byService: [
      { minYears: 0, maxYears: 6, pct: 0.25, value: 41_240_250 },
      { minYears: 7, maxYears: 9, pct: 0.3, value: 49_488_300 },
      { minYears: 10, maxYears: 99, pct: 0.35, value: 57_736_350 },
    ],
    designatedRookiePct: 0.3,
    designatedVeteranPct: 0.35,
    verified: true,
    source: S.hrCap,
  },

  raises: { birdPct: 0.08, nonBirdPct: 0.05, verified: false, source: "2023 CBA" },
  maxContractYears: { bird: 5, other: 4, verified: false, source: "2023 CBA" },
  extensions: {
    veteranFirstYearPctOfCurrent: 1.4,
    veteranMinMonthsAfterSigning: 24,
    rookieScaleWindow: "offseason before 4th season through day before regular season",
    verified: false,
    source: "2023 CBA",
  },

  minimumSalary: {
    byService: [1_357_763, 2_185_116, 2_449_421, 2_537_526, 2_625_627, 2_845_883, 3_066_143, 3_286_399, 3_506_659, 3_524_115, 3_876_529],
    oneYearVetCapHit: 2_449_421,
    verified: true,
    source: S.hrMin,
  },

  rookieScale: {
    pct120: ROOKIE_SCALE_120,
    pct100: ROOKIE_SCALE_120.map((r) => r.map((v) => Math.round(v / 1.2))),
    allowedRange: [0.8, 1.2],
    note: "100% values derived from published 120% figures (÷1.2)",
    verified: true,
    source: S.hrRookie,
  },

  capHolds: {
    // % of previous salary, capped at the player's max
    birdBelowAvg: 1.9,
    birdAboveAvg: 1.5,
    earlyBird: 1.3,
    nonBird: 1.2,
    rookieScaleBelowAvg: 3.0,
    rookieScaleAboveAvg: 2.5,
    verified: false,
    source: "2023 CBA cap-hold schedule",
  },

  trade: {
    nonApron: { lowPct: 2.0, highPct: 1.25, cushion: 250_000, allowance: 9_096_000 },
    firstApronPct: 1.0,
    secondApronCanAggregate: false,
    underCapCushion: 250_000,
    aggregationBanDays: 60,
    newlySignedFreeAgentBanUntil: "Dec 15 (or 3 months after signing, whichever later)",
    newlySignedFreeAgentMonths: 3,
    pickTradeWindowYears: 7,
    secondApronFrozenPickYearsOut: 7,
    stepien: "cannot be without a 1st-round pick in consecutive future drafts",
    verified: true,
    source: S.hrTpe,
  },

  apronRestrictions: {
    firstApron: [
      "cannot take back more than 100% of outgoing salary in a trade",
      "cannot use the non-taxpayer MLE or bi-annual exception",
      "cannot acquire a player via sign-and-trade",
      "cannot use a TPE created in a prior season",
      "cannot sign a player waived during the season whose prior salary exceeded the NT-MLE",
    ],
    secondApron: [
      "cannot aggregate salaries in a trade",
      "cannot send out cash in a trade",
      "cannot use the taxpayer MLE",
      "cannot use a TPE created via sign-and-trade",
      "1st-round pick 7 years out is frozen (becomes untradable) while over the 2nd apron",
    ],
    verified: false,
    source: "2023 CBA apron rules as summarized by Hoops Rumors glossary",
  },

  roster: {
    maxStandard: 15,
    maxTwoWay: 3,
    minStandard: 14,
    minStandardGraceDays: 14,
    twoWayGameLimit: 50,
    offseasonMax: 21,
    tenDayContractsPerPlayerPerTeam: 2,
    verified: false,
    source: "2023 CBA",
  },

  qualifyingOffer: {
    // simplified: the 2023 CBA sets rookie-scale QOs by draft slot and "starter criteria"
    rookieScalePctOfLastSalary: 1.3,
    veteranPctOfLastSalary: 1.25,
    minimumPlus: 200_000,
    rfaMatchDays: 2,
    maxYearsOfServiceForRfa: 3,
    verified: false,
    source: "approximation of 2023 CBA qualifying-offer schedule",
  },

  awards: { minGamesForEligibility: 65, verified: true, source: "2023 CBA 65-game rule" },

  draftLottery: {
    // chance of #1 pick by pre-lottery slot (1 = worst record)
    top1Odds: [14.0, 14.0, 14.0, 12.5, 10.5, 9.0, 7.5, 6.0, 4.5, 3.0, 2.0, 1.5, 1.0, 0.5],
    // lottery combinations out of 1000 per slot (ties split); used for weighted draws of picks 1-4
    combinations: [140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15, 10, 5],
    picksDrawn: 4,
    verified: true,
    source: "NBA lottery format since 2019",
  },
} as const;

export type CbaConfig = typeof CBA_2026_27;
