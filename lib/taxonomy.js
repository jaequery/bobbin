// Bobbin's fixed vocabularies. Every other module imports these lists instead of
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
