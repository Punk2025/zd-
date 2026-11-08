/** Cheap pre-filter before spending Workers AI tokens. */
const PRIMARY = [
  "iran",
  "iranian",
  "tehran",
  "irgc",
  "qods",
  "quds",
  "persian gulf",
  "strait of hormuz",
  "dubai",
  "uae",
  "abu dhabi",
  "bahrain",
  "qatar",
  "centcom",
];

const SECONDARY = [
  "war",
  "strike",
  "missile",
  "drone",
  "attack",
  "bomb",
  "nuclear",
  "escalat",
  "military",
  "troop",
  "carrier",
  "naval",
  " pentagon",
  "white house",
  "state department",
  "blinken",
  "hegseth",
  "trump",
  "khamenei",
  "pezeshkian",
  "statement",
  "speech",
  "press conference",
  "sanction",
  "evacuation",
  "airspace",
  "houthi",
  "hezbollah",
  "israel",
  "idf",
];

export function passesKeywordFilter(title: string, summary = ""): boolean {
  const text = `${title}\n${summary}`.toLowerCase();
  const hasPrimary = PRIMARY.some((k) => text.includes(k));
  if (!hasPrimary) return false;
  return SECONDARY.some((k) => text.includes(k));
}
