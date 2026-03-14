export type IndianSeason = "Kharif" | "Rabi" | "Zaid";

export function detectIndianSeason(month: number): IndianSeason {
  if (month >= 6 && month <= 9) return "Kharif";
  if (month >= 10 || month <= 2) return "Rabi";
  return "Zaid";
}

export function detectIndianSeasonFromDate(date = new Date()): IndianSeason {
  return detectIndianSeason(date.getMonth() + 1);
}
