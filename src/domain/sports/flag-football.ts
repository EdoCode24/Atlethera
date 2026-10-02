import type { SportModule } from "./types";

/**
 * IFAF 5v5 rules, the format played at the World Championships and chosen for LA28.
 * NFL FLAG leagues often use a 30-yard-wide field; that is a league setting, not a new module.
 */
export const flagFootball: SportModule = {
  id: "flag-football",
  name: { tr: "Flag Football", en: "Flag Football" },
  playersPerSide: 5,
  field: {
    lengthYd: 70,
    widthYd: 25,
    endZoneYd: 10,
    midfieldYd: 35,
    noRunZones: [
      [10, 15],
      [30, 35],
      [35, 40],
      [55, 60],
    ],
    rushLineYd: 7,
    conversionsYd: { one: 5, two: 10 },
  },
  positionGroups: [
    { id: "qb", abbr: "QB", name: { tr: "Quarterback", en: "Quarterback" }, side: "offense", positions: ["QB"], statGroups: ["passing", "rushing"] },
    { id: "c", abbr: "C", name: { tr: "Center", en: "Center" }, side: "offense", positions: ["C"], statGroups: ["receiving"] },
    { id: "wr", abbr: "WR", name: { tr: "Wide receiver", en: "Wide receiver" }, side: "offense", positions: ["WR"], statGroups: ["receiving", "rushing"] },
    { id: "rb", abbr: "RB", name: { tr: "Running back", en: "Running back" }, side: "offense", positions: ["RB"], statGroups: ["rushing", "receiving"] },
    { id: "rsh", abbr: "RSH", name: { tr: "Rusher", en: "Rusher" }, side: "defense", positions: ["Rusher"], statGroups: ["flagDefense"] },
    { id: "lb", abbr: "LB", name: { tr: "Linebacker", en: "Linebacker" }, side: "defense", positions: ["LB"], statGroups: ["flagDefense"] },
    { id: "cb", abbr: "CB", name: { tr: "Cornerback", en: "Cornerback" }, side: "defense", positions: ["CB"], statGroups: ["flagDefense"] },
    { id: "s", abbr: "S", name: { tr: "Safety", en: "Safety" }, side: "defense", positions: ["S"], statGroups: ["flagDefense"] },
  ],
  statGroups: [
    {
      id: "passing",
      label: { tr: "Pas", en: "Passing" },
      stats: [
        { key: "cmp", abbr: "CMP", label: { tr: "Tamamlanan pas", en: "Completions" } },
        { key: "att", abbr: "ATT", label: { tr: "Pas denemesi", en: "Attempts" } },
        { key: "cmpPct", abbr: "CMP%", label: { tr: "Tamamlama yüzdesi", en: "Completion %" } },
        { key: "yds", abbr: "YDS", label: { tr: "Pas yardı", en: "Passing yards" } },
        { key: "td", abbr: "TD", label: { tr: "Touchdown pası", en: "Touchdown passes" } },
        { key: "int", abbr: "INT", label: { tr: "Interception", en: "Interceptions" } },
        { key: "sck", abbr: "SCK", label: { tr: "Yenilen sack", en: "Sacks taken" } },
      ],
    },
    {
      id: "receiving",
      label: { tr: "Pas alma", en: "Receiving" },
      stats: [
        { key: "tgt", abbr: "TGT", label: { tr: "Hedef", en: "Targets" } },
        { key: "rec", abbr: "REC", label: { tr: "Yakalama", en: "Receptions" } },
        { key: "yds", abbr: "YDS", label: { tr: "Yard", en: "Receiving yards" } },
        { key: "td", abbr: "TD", label: { tr: "Touchdown", en: "Touchdowns" } },
        { key: "drop", abbr: "DROP", label: { tr: "Düşürülen pas", en: "Drops" } },
      ],
    },
    {
      id: "rushing",
      label: { tr: "Koşu", en: "Rushing" },
      stats: [
        { key: "car", abbr: "ATT", label: { tr: "Taşıma", en: "Carries" } },
        { key: "yds", abbr: "YDS", label: { tr: "Koşu yardı", en: "Rushing yards" } },
        { key: "td", abbr: "TD", label: { tr: "Koşu touchdown'ı", en: "Rushing touchdowns" } },
      ],
    },
    {
      id: "conversions",
      label: { tr: "Dönüşüm", en: "Conversions" },
      stats: [
        { key: "xp1", abbr: "XP1", label: { tr: "1 sayılık dönüşüm", en: "1-point conversions" } },
        { key: "xp2", abbr: "XP2", label: { tr: "2 sayılık dönüşüm", en: "2-point conversions" } },
      ],
    },
    {
      id: "flagDefense",
      label: { tr: "Savunma", en: "Defense" },
      stats: [
        { key: "fp", abbr: "FP", label: { tr: "Bayrak çekme", en: "Flag pulls" } },
        { key: "mfp", abbr: "MFP", label: { tr: "Kaçan bayrak", en: "Missed flag pulls" } },
        { key: "sck", abbr: "SCK", label: { tr: "Sack", en: "Sacks" } },
        { key: "prs", abbr: "PRS", label: { tr: "QB baskısı", en: "Pressures" } },
        { key: "pd", abbr: "PD", label: { tr: "Engellenen pas", en: "Passes defended" } },
        { key: "int", abbr: "INT", label: { tr: "Interception", en: "Interceptions" } },
        { key: "pick6", abbr: "PICK-6", label: { tr: "Interception touchdown'ı", en: "Pick-sixes" } },
        { key: "sfty", abbr: "SFTY", label: { tr: "Safety", en: "Safeties" } },
      ],
    },
  ],
  combine: ["forty", "split10", "vertical", "broad", "proAgility", "threeCone"],
  kpis: ["forty", "proAgility", "threeCone", "vertical"],
  rules: [
    { tr: "Sahada her takımdan 5 oyuncu, temas yok", en: "5 players a side, no contact" },
    { tr: "70 × 25 yard saha, iki 10 yardlık end zone dahil", en: "70 × 25 yd field, including two 10-yard end zones" },
    { tr: "Top taşıyıcı, bayrağı çekilince durur", en: "The ball carrier is down when a flag is pulled" },
    { tr: "Orta çizginin ve end zone'ların önündeki 5 yardda koşu oyunu yasak", en: "No running plays in the 5 yards before midfield and each end zone" },
    { tr: "Rusher, snap anında en az 7 yard geriden başlar", en: "Rushers start at least 7 yards off the line" },
    { tr: "Touchdown sonrası 5 yarddan 1, 10 yarddan 2 sayılık dönüşüm", en: "After a touchdown: 1 point from the 5, 2 points from the 10" },
  ],
  formation: {
    name: { tr: "Spread diziliş, tek rusher'a karşı", en: "Spread formation vs a single rusher" },
    losX: 20,
    players: [
      { id: "c", group: "c", label: "C", side: "offense", x: 19.5, y: 12.5, labelAt: "top" },
      { id: "qb", group: "qb", label: "QB", side: "offense", x: 15, y: 12.5, labelAt: "left" },
      { id: "rb", group: "rb", label: "RB", side: "offense", x: 15, y: 14.8, labelAt: "left" },
      { id: "x", group: "wr", label: "WR", side: "offense", x: 19.5, y: 2.5, labelAt: "left" },
      { id: "z", group: "wr", label: "WR", side: "offense", x: 19.5, y: 22.5, labelAt: "left" },
      { id: "rsh", group: "rsh", label: "RSH", side: "defense", x: 27, y: 12.5, labelAt: "top" },
      { id: "lb", group: "lb", label: "LB", side: "defense", x: 24, y: 15.5, labelAt: "bottom" },
      { id: "cb1", group: "cb", label: "CB", side: "defense", x: 25, y: 2.5, labelAt: "right" },
      { id: "cb2", group: "cb", label: "CB", side: "defense", x: 25, y: 22.5, labelAt: "right" },
      { id: "s", group: "s", label: "S", side: "defense", x: 31, y: 12.5, labelAt: "right" },
    ],
  },
};
