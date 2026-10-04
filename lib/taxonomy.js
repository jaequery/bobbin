// Jethro's fixed vocabularies. Every other module imports these lists instead of
// hard-coding the values. Safe to import from server and client code.

const freeze = (list) => Object.freeze(list.map((v) => (typeof v === "object" ? Object.freeze(v) : v)));

export const PLATFORMS = freeze([
  { id: "desktop", label: "Desktop" },
  { id: "mobile", label: "Mobile" },
]);

export const PAGE_PATTERNS = freeze([
  "Home", "Pricing", "Sign up", "Log in", "About", "Product", "Features", "Blog",
  "Article", "Contact", "Careers", "Product detail", "Cart", "Checkout", "Docs",
  "Changelog", "404", "Other",
]);

export const SECTION_TYPES = freeze([
  "Navigation", "Hero", "Logo cloud", "Features", "Testimonials", "Pricing table",
  "FAQ", "CTA", "Stats", "Team", "Gallery", "Newsletter", "Footer", "Other",
]);

export const INDUSTRIES = freeze([
  "SaaS", "AI", "Developer tools", "Finance", "Crypto", "Health", "Education",
  "E-commerce", "Fashion", "Food & Drink", "Travel", "Real estate",
  "Architecture & Interior", "Agency & Portfolio", "Media & Publishing", "Music",
  "Entertainment", "Automotive", "Nonprofit", "Productivity", "Other",
]);

// Lifecycle: discovered → queued → captured → approved | rejected.
// failed and optout can happen at any point; capturing and judging are optional
// transient states while a worker holds the site.
export const SITE_STATUS = freeze([
  "discovered", "queued", "capturing", "captured", "judging", "approved", "rejected", "failed", "optout",
]);

// Color buckets a screen's dominant color falls into (lib/color.js decides
// which). `swatch` is the bucket's representative color, shown as data in the
// Color filter.
export const COLOR_BUCKETS = freeze([
  { id: "red", label: "Red", swatch: "#E5484D" },
  { id: "orange", label: "Orange", swatch: "#F76B15" },
  { id: "yellow", label: "Yellow", swatch: "#FFC53D" },
  { id: "green", label: "Green", swatch: "#30A46C" },
  { id: "teal", label: "Teal", swatch: "#12A594" },
  { id: "blue", label: "Blue", swatch: "#0090FF" },
  { id: "purple", label: "Purple", swatch: "#8E4EC6" },
  { id: "pink", label: "Pink", swatch: "#D6409F" },
  { id: "brown", label: "Brown", swatch: "#8D5B3A" },
  { id: "black", label: "Black", swatch: "#111111" },
  { id: "white", label: "White", swatch: "#FFFFFF" },
  { id: "gray", label: "Gray", swatch: "#8B8D98" },
]);

// Whether a screen's background reads light or dark.
export const THEMES = freeze([
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
]);
