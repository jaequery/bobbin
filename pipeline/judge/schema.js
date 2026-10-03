// JSON schemas for the judge's and tagger's structured output, with enums taken
// from lib/taxonomy.js, plus validators that check again in JS (the API cannot
// enforce numeric ranges or string lengths).
import { INDUSTRIES, PAGE_PATTERNS, SECTION_TYPES } from "../../lib/taxonomy.js";

export const SCORE_KEYS = ["typography", "layout", "color", "imagery", "originality", "polish"];
export const TAGLINE_MAX = 60;
export const DESCRIPTION_MAX = 200;

const obj = (properties) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const nullable = (schema) => ({ anyOf: [schema, { type: "null" }] });

export const JUDGE_SCHEMA = obj({
  capture_ok: { type: "boolean" },
  capture_problem: nullable({ type: "string" }),
  quality: { type: "integer", description: "1 to 10" },
  scores: obj(Object.fromEntries(SCORE_KEYS.map((k) => [k, { type: "integer", description: "1 to 10" }]))),
  verdict_reasons: { type: "array", items: { type: "string" }, description: "at most 3" },
  name: { type: "string" },
  tagline: { type: "string", description: `at most ${TAGLINE_MAX} characters, original wording` },
  description: { type: "string", description: `at most ${DESCRIPTION_MAX} characters, original wording` },
  industry: { type: "string", enum: [...INDUSTRIES] },
  country: nullable({ type: "string", description: "ISO 3166-1 alpha-2" }),
  language: { type: "string", description: "BCP-47" },
});

export const TAG_SCHEMA = obj({
  pattern: { type: "string", enum: [...PAGE_PATTERNS] },
  sections: { type: "array", items: obj({ id: { type: "string" }, type: { type: "string", enum: [...SECTION_TYPES] } }) },
});

export class SchemaError extends Error {}

const isScore = (n) => Number.isInteger(n) && n >= 1 && n <= 10;
const clip = (s, max) => {
  const t = String(s).trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(" ") > max / 2 ? cut.lastIndexOf(" ") : cut.length).replace(/[\s,;:.-]+$/, "") + "…";
};

// Returns a cleaned judgement or throws SchemaError. Over-long text is shortened
// rather than rejected; anything outside the taxonomy or score range is rejected.
export function validateJudgement(j) {
  if (!j || typeof j !== "object") throw new SchemaError("not an object");
  if (typeof j.capture_ok !== "boolean") throw new SchemaError("capture_ok missing");
  if (!isScore(j.quality)) throw new SchemaError(`quality out of range: ${j.quality}`);
  for (const k of SCORE_KEYS) if (!isScore(j.scores?.[k])) throw new SchemaError(`scores.${k} out of range`);
  if (!INDUSTRIES.includes(j.industry)) throw new SchemaError(`unknown industry: ${j.industry}`);
  for (const k of ["name", "tagline", "description", "language"]) {
    if (typeof j[k] !== "string" || !j[k].trim()) throw new SchemaError(`${k} missing`);
  }
  const country = typeof j.country === "string" && /^[A-Za-z]{2}$/.test(j.country.trim()) ? j.country.trim().toUpperCase() : null;
  const language = j.language.trim();
  if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(language)) throw new SchemaError(`bad language tag: ${language}`);
  return {
    capture_ok: j.capture_ok,
    capture_problem: j.capture_ok ? null : String(j.capture_problem || "unusable capture").slice(0, 300),
    quality: j.quality,
    scores: Object.fromEntries(SCORE_KEYS.map((k) => [k, j.scores[k]])),
    verdict_reasons: (Array.isArray(j.verdict_reasons) ? j.verdict_reasons : []).map(String).filter(Boolean).slice(0, 3),
    name: clip(j.name, 80),
    tagline: clip(j.tagline, TAGLINE_MAX),
    description: clip(j.description, DESCRIPTION_MAX),
    industry: j.industry,
    country,
    language,
  };
}

// `sectionIds` are the ids shown in the call; every one must come back typed.
export function validateTags(t, sectionIds) {
  if (!t || !PAGE_PATTERNS.includes(t.pattern)) throw new SchemaError(`unknown pattern: ${t?.pattern}`);
  const types = new Map();
  for (const s of Array.isArray(t.sections) ? t.sections : []) {
    if (SECTION_TYPES.includes(s?.type) && sectionIds.includes(s.id)) types.set(s.id, s.type);
  }
  const missing = sectionIds.filter((id) => !types.has(id));
  if (missing.length) throw new SchemaError(`${missing.length} sections untagged`);
  return { pattern: t.pattern, sections: sectionIds.map((id) => ({ id, type: types.get(id) })) };
}
