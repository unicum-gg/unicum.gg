// Display labels for the raw WoT encyclopedia `nation` and `type` codes. Kept
// in one place so the index, the detail page, and the JSON-LD all read the
// same human strings. Unknown codes fall back to a title-cased version of the
// raw value rather than throwing, since WG occasionally ships a new nation.

const NATION_LABEL: Record<string, string> = {
  ussr: "U.S.S.R.",
  germany: "Germany",
  usa: "U.S.A.",
  china: "China",
  france: "France",
  uk: "U.K.",
  japan: "Japan",
  czech: "Czechoslovakia",
  sweden: "Sweden",
  poland: "Poland",
  italy: "Italy",
};

const TYPE_LABEL: Record<string, string> = {
  heavyTank: "Heavy Tank",
  mediumTank: "Medium Tank",
  lightTank: "Light Tank",
  "AT-SPG": "Tank Destroyer",
  SPG: "Self-Propelled Gun",
};

const TYPE_ABBR: Record<string, string> = {
  heavyTank: "HT",
  mediumTank: "MT",
  lightTank: "LT",
  "AT-SPG": "TD",
  SPG: "SPG",
};

function titleCase(raw: string): string {
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function nationLabel(nation: string): string {
  return NATION_LABEL[nation] ?? titleCase(nation);
}

export function typeLabel(type: string): string {
  return TYPE_LABEL[type] ?? titleCase(type);
}

export function typeAbbr(type: string): string {
  return TYPE_ABBR[type] ?? type;
}
