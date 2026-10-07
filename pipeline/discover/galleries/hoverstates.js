// Hover States (hoverstat.es). The archive's Gatsby page data holds every
// feature with its website URL in one file, read newest first.
import { fetchHtml } from "../http.js";

const BASE = "https://www.hoverstat.es";

export const name = "hoverstates";

export async function* listing({ limit }) {
  const data = JSON.parse(await fetchHtml(`${BASE}/page-data/archive/page-data.json`));
  const store = data.result?.data?.allLocalSearchFeatures?.nodes?.[0]?.store ?? {};
  const features = Object.values(store)
    .filter((f) => f?.slug && /^https?:\/\//.test(f.websiteUrl || ""))
    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
  if (!features.length) console.warn(`[${name}] no features in the archive data; its format may have changed`);
  for (const f of features.slice(0, limit)) {
    yield { url: f.websiteUrl, name: f.title?.trim() || null, sourceRef: `${BASE}/features/${f.slug}/` };
  }
}
