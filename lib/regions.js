// Countries (ISO 3166-1 alpha-2, as the judge stores them in sites.country)
// grouped into the regions of the Country filter. Static, so it is safe to
// import from server and client code. A code missing here falls under "Other".

const GROUPS = {
  "North America": "US CA MX",
  "Latin America": "AR BO BR CL CO CR CU DO EC GT HN JM NI PA PE PR PY SV TT UY VE",
  Europe: "AD AL AM AT AZ BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GE GI GR HR HU IE IS IT LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM UA VA XK",
  "Middle East": "AE BH IL IQ IR JO KW LB OM PS QA SA SY TR YE",
  Asia: "AF BD BN BT CN HK ID IN JP KG KH KR KZ LA LK MM MN MO MV MY NP PH PK SG TH TJ TM TW UZ VN",
  Oceania: "AU FJ NZ PG WS",
  Africa: "AO BF BJ BW CD CI CM DZ EG ET GH KE MA MG MU MW MZ NA NG RW SD SN TN TZ UG ZA ZM ZW",
};

export const REGIONS = Object.freeze([...Object.keys(GROUPS), "Other"]);

const REGION_OF = new Map(Object.entries(GROUPS).flatMap(([region, codes]) => codes.split(" ").map((c) => [c, region])));

export const isCountryCode = (code) => /^[A-Z]{2}$/.test(code || "");

export const regionOf = (code) => REGION_OF.get(code) || "Other";

let names;
// "JP" -> "Japan", falling back to the code itself.
export function countryName(code) {
  try {
    names ??= new Intl.DisplayNames(["en"], { type: "region" });
    return names.of(code) || code;
  } catch {
    return code;
  }
}
