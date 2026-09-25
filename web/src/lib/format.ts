const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export function countryName(cc?: string | null): string {
  if (!cc || !/^[A-Z]{2}$/i.test(cc) || cc.toUpperCase() === "XX" || cc.toUpperCase() === "T1") return cc || "Unknown";
  try { return regionNames.of(cc.toUpperCase()) ?? cc; } catch { return cc; }
}

// Cloudflare data centers are named after the nearest IATA airport code.
const COLOS: Record<string, [string, string]> = {
  SIN: ["Singapore", "SG"], BKK: ["Bangkok", "TH"], HKG: ["Hong Kong", "HK"], NRT: ["Tokyo", "JP"], KIX: ["Osaka", "JP"],
  ICN: ["Seoul", "KR"], TPE: ["Taipei", "TW"], MNL: ["Manila", "PH"], CGK: ["Jakarta", "ID"], KUL: ["Kuala Lumpur", "MY"],
  SGN: ["Ho Chi Minh City", "VN"], HAN: ["Hanoi", "VN"], BOM: ["Mumbai", "IN"], DEL: ["New Delhi", "IN"], MAA: ["Chennai", "IN"],
  BLR: ["Bengaluru", "IN"], SYD: ["Sydney", "AU"], MEL: ["Melbourne", "AU"], BNE: ["Brisbane", "AU"], PER: ["Perth", "AU"],
  AKL: ["Auckland", "NZ"], DXB: ["Dubai", "AE"], FRA: ["Frankfurt", "DE"], LHR: ["London", "GB"], AMS: ["Amsterdam", "NL"],
  CDG: ["Paris", "FR"], MAD: ["Madrid", "ES"], MXP: ["Milan", "IT"], ARN: ["Stockholm", "SE"], WAW: ["Warsaw", "PL"],
  JNB: ["Johannesburg", "ZA"], IAD: ["Ashburn", "US"], EWR: ["Newark", "US"], ORD: ["Chicago", "US"], DFW: ["Dallas", "US"],
  ATL: ["Atlanta", "US"], MIA: ["Miami", "US"], LAX: ["Los Angeles", "US"], SJC: ["San Jose", "US"], SEA: ["Seattle", "US"],
  DEN: ["Denver", "US"], YYZ: ["Toronto", "CA"], YVR: ["Vancouver", "CA"], GRU: ["São Paulo", "BR"], EZE: ["Buenos Aires", "AR"],
  SCL: ["Santiago", "CL"], BOG: ["Bogotá", "CO"], MEX: ["Mexico City", "MX"],
};
export const coloCity = (colo?: string | null) => (colo && COLOS[colo]?.[0]) || colo || "—";
export const coloCountry = (colo?: string | null) => (colo && COLOS[colo]?.[1]) || null;

export const flagUrl = (cc?: string | null) =>
  cc && /^[A-Za-z]{2}$/.test(cc) && !["XX", "T1"].includes(cc.toUpperCase()) ? `/flags/${cc.toLowerCase()}.svg` : null;

export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export const fmtMs = (ms?: number | null) =>
  ms == null || Number.isNaN(ms) ? "—" : ms < 10 ? `${ms.toFixed(1)} ms` : `${Math.round(ms)} ms`;

export const tlsLabel = (v?: string | null) => (v ? v.replace(/^TLSv/i, "TLS ") : "—");
export const httpLabel = (v?: string | null) => (v ? v.toUpperCase().replace("HTTP/", "HTTP/") : "—");

export const isPostQuantum = (kex?: string | null) => !!kex && /MLKEM|Kyber/i.test(kex);

export const timeOf = (iso: string) => new Date(iso).toISOString().slice(11, 19);
