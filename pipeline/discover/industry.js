// Maps a gallery's free-text tags or categories to one of lib/taxonomy.js INDUSTRIES.
import { INDUSTRIES } from "../../lib/taxonomy.js";

// First matching entry wins, so more specific keywords come first.
const KEYWORDS = [
  ["AI", /\b(ai|artificial intelligence|machine learning|llm)\b/],
  ["Developer tools", /\b(developer|dev ?tools?|api|code|coding)\b/],
  ["Crypto", /\b(crypto|web3|blockchain|nft|defi)\b/],
  ["Finance", /\b(finance|fintech|bank(ing)?|payments?|invest(ing|ment)?|insurance)\b/],
  ["SaaS", /\b(saas|software|b2b|startup|tech(nology)?)\b/],
  ["Productivity", /\b(productivity|tools?|app|apps)\b/],
  ["Health", /\b(health|medical|wellness|fitness|beauty|healthcare)\b/],
  ["Education", /\b(education|learning|school|course|university)\b/],
  ["Fashion", /\b(fashion|clothing|apparel|jewel(le)?ry)\b/],
  ["E-commerce", /\b(e-?commerce|shop|store|retail|product)\b/],
  ["Food & Drink", /\b(food|drink|restaurant|wine|coffee|bar|beverage|bakery)\b/],
  ["Travel", /\b(travel|hotel|tourism|hospitality)\b/],
  ["Real estate", /\b(real estate|property|realty)\b/],
  ["Architecture & Interior", /\b(architecture|architects?|interior|furniture)\b/],
  ["Agency & Portfolio", /\b(agency|studio|portfolio|personal|freelance|design agency|photography)\b/],
  ["Media & Publishing", /\b(media|magazine|publishing|news|blog|editorial|podcast)\b/],
  ["Music", /\b(music|musician|band|record label|music related)\b/],
  ["Entertainment", /\b(entertainment|games?|gaming|film|movie|event|events|festival)\b/],
  ["Automotive", /\b(automotive|cars?|vehicles?|mobility)\b/],
  ["Nonprofit", /\b(non-?profit|charity|ngo|foundation)\b/],
];

// Returns an INDUSTRIES value, or null when nothing matches.
export function industryFromTags(tags) {
  const text = [].concat(tags).filter(Boolean).join(" ").toLowerCase();
  if (!text) return null;
  for (const [industry, re] of KEYWORDS) {
    if (re.test(text) && INDUSTRIES.includes(industry)) return industry;
  }
  return null;
}
