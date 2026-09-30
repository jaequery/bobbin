// Bobbin sample library. Every app, name and tagline here is an original
// placeholder — no real product, brand or screenshot is referenced.
const BOBBIN_DATA = (() => {
  const PLATFORMS = ["Web", "iOS", "Android"];
  const PATTERNS = ["Onboarding", "Sign up", "Home", "Search", "Checkout", "Settings", "Profile", "Empty state"];
  const INDUSTRIES = ["Finance", "Health", "Travel", "Food & Drink", "Productivity", "Music", "E-commerce", "Education"];

  // c / c2: brand + tint used inside the drawn screens.
  // tone: the two stops of the card backdrop gradient.
  const apps = [
    { id: "plotter", name: "Plotter", tagline: "Roadmaps without the drama", industry: "Productivity", platform: "Web", c: "#7C3AED", c2: "#EEE5FF", tone: ["#B8A9D9", "#5E5480"] },
    { id: "parcelry", name: "Parcelry", tagline: "Small-batch goods, shipped", industry: "E-commerce", platform: "Web", c: "#0F766E", c2: "#D5F3EE", tone: ["#E9E4D8", "#8E8A62"] },
    { id: "fieldnote", name: "Fieldnote", tagline: "Courses for curious minds", industry: "Education", platform: "Web", c: "#C2410C", c2: "#FBEBD5", tone: ["#F4D9CF", "#C98B86"] },
    { id: "ledgerly", name: "Ledgerly", tagline: "Books balanced before lunch", industry: "Finance", platform: "Web", c: "#111111", c2: "#ECECEC", tone: ["#F2F2F2", "#6B6B6B"] },
    { id: "tidewell", name: "Tidewell", tagline: "Savings that flow with you", industry: "Finance", platform: "iOS", c: "#2F6FEB", c2: "#DCE8FF", tone: ["#C9D8F2", "#4A5C86"] },
    { id: "loopa", name: "Loopa", tagline: "Practice music in loops", industry: "Music", platform: "iOS", c: "#E11D48", c2: "#FFE1E7", tone: ["#F6CFD6", "#9A4A5B"] },
    { id: "nookstay", name: "Nookstay", tagline: "Tiny cabins, big views", industry: "Travel", platform: "iOS", c: "#15803D", c2: "#DCF5E3", tone: ["#D6E4CF", "#5C7353"] },
    { id: "orbitfit", name: "Orbit Fit", tagline: "Workouts that orbit your day", industry: "Health", platform: "iOS", c: "#EA580C", c2: "#FFE6D6", tone: ["#F7DCC8", "#A86A45"] },
    { id: "grainy", name: "Grainy", tagline: "Neighbourhood bakery orders", industry: "Food & Drink", platform: "Android", c: "#D97706", c2: "#FDEFD8", tone: ["#EFE2C4", "#9C8452"] },
    { id: "sprout", name: "Sprout Health", tagline: "Gentle daily check-ins", industry: "Health", platform: "Android", c: "#059669", c2: "#D6F5EA", tone: ["#CFE8DD", "#4F7D6C"] },
    { id: "quillpay", name: "Quillpay", tagline: "Invoices in two taps", industry: "Finance", platform: "Android", c: "#1D4ED8", c2: "#DDE6FF", tone: ["#D3D9EE", "#4B5578"] },
    { id: "wayfarer", name: "Wayfarer", tagline: "Trips planned together", industry: "Travel", platform: "Android", c: "#0E7490", c2: "#D4F1F7", tone: ["#CFE6EA", "#4A7178"] },
  ];

  const screens = [];
  apps.forEach((app, i) => {
    PATTERNS.forEach((pattern, j) => {
      if ((i + j) % 5 === 4) return; // vary which patterns each app has
      screens.push({ id: `${app.id}-${j}`, app, pattern });
    });
  });
  // Interleave apps so the screen feed mixes platforms: group by pattern, then app.
  screens.sort((a, b) => PATTERNS.indexOf(a.pattern) - PATTERNS.indexOf(b.pattern) || apps.indexOf(a.app) - apps.indexOf(b.app));
  apps.forEach((app) => { app.screens = screens.filter((s) => s.app === app); });

  return { PLATFORMS, PATTERNS, INDUSTRIES, apps, screens };
})();

export const { PLATFORMS, PATTERNS, INDUSTRIES, apps, screens } = BOBBIN_DATA;
