// Awwwards Honorable Mentions (/websites/honorable/), sites the Awwwards jury
// scored well that did not win Site of the Day: thousands of them, 32 a page,
// newest first, in the same card markup as Sites of the Day.
import { paged } from "./paged.js";
import { parseCards } from "./awwwards.js";

const BASE = "https://www.awwwards.com";

export const name = "awwwards-honorable";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    maxPages: 100,
    pageUrl: (n) => `${BASE}/websites/honorable/${n > 1 ? `?page=${n}` : ""}`,
    parse: parseCards,
  });
}
