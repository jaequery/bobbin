// Small helpers shared by the route handlers in app/api/**. Server only.

const FILTERS = ["q", "platform", "pattern", "section", "industry", "color", "theme", "country"];

// Filters and paging options from a request's query string.
export function listArgs(request) {
  const sp = new URL(request.url).searchParams;
  const filters = Object.fromEntries(FILTERS.map((k) => [k, sp.get(k) || ""]));
  if (!filters.section && sp.get("type")) filters.section = sp.get("type");
  return [filters, { cursor: sp.get("cursor") || null, limit: sp.get("limit") }];
}

// Runs `fn` and wraps its result as `{ data }`, or a 500 `{ error }`.
export function respond(fn) {
  try {
    const data = fn();
    if (data == null) return Response.json({ error: { message: "Not found" } }, { status: 404 });
    return Response.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error(err);
    return Response.json({ error: { message: "Could not read the library" } }, { status: 500 });
  }
}
