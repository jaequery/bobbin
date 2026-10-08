// Gallery adapters in the order discovery interleaves them. Each exports
// `name` and `listing({ limit })`, an async iterator of
// { url, name?, industryHint?, countryHint?, sourceRef }.
//
// Not yet adapted: Godly (now redirects to recent.design, a client-rendered app),
// The FWA (client-rendered), Land-book, Lapa Ninja, Web Design Inspiration,
// Saaspo and Maxibestof (403 behind a bot challenge), SiteInspire (403/429),
// CSS Reel (now a casino affiliate page), Unsection (lists sections, not sites;
// the site link is only on each section page),
// Framer's community gallery (?page= is ignored; later items load client-side),
// Supahero (hero sections, now folded into screensdesign.com), Made in Webflow and
// SaaSFrame (no outbound site links in the served HTML), CSSMania (links behind bit.ly),
// Web Guru Awards (winners page and site pages render client-side), bestcss.in
// (mostly agency and local-business submissions), Muzli (inspiration is articles and
// shots, not a site list), DesignMunk (no outbound site links), Pafolios (client-rendered),
// CSS Awards (cssawards.net, now a parked domain), UIJar (the domain now hosts an
// unrelated business), DesignRush and Web Design Museum (403 behind a bot challenge),
// Websitevice (small category pages of mixed quality, robots.txt asks a 10s crawl delay),
// Minimalissimo (product and interior design, not websites), Page Collective (app
// flows and screens, not sites), SaaS Websites (no outbound site links), GSAP showcase
// and Bento Grids (client-rendered), Call to Inspiration and Communication Arts
// Webpicks (client-rendered), Web Design Awards (webdesignawards.io, paid submissions
// from agencies and local businesses), Fonts In Use (robots.txt asks a 10s crawl
// delay), UI UX Showcase (mostly design resources and tools, not sites), Light Mode
// Design (now a shop), SaaS Interface (app screens), Super Creative (a studio site),
// Made on Tilda (no outbound site links), Portfolio Village (not a site gallery),
// Looks Like Good Design (creative work of every kind, not websites), Framer Websites
// (an agency site, not a gallery), One Page Mania (now redirects to an agency site),
// startups.gallery (a startup and jobs directory), Next.js showcase (a handful of sites),
// Gatsby showcase (only a handful of sites in the served HTML), Shopify examples
// (a handful of stores), Tailwind CSS showcase (client-rendered), Three.js showcase
// (mostly WebGL demos, games and experiments, not sites), Sanity's showcase (robots.txt
// disallows /showcase), Strapi showcases (mostly small local businesses), Craft CMS
// showcase (now redirects to the home page, whose few links are agency case studies),
// ProcessWire sites directory, Readymag examples and Remix showcase (no site links in
// the served HTML), Hugo, Payload, Storyblok, DatoCMS, Directus and Svelte showcases (404),
// Prismic showcase and Ghost Explore (only a handful of sites in the served HTML),
// Site Builder Report inspiration (mostly small businesses, many affiliate links),
// Codrops inspiration roundups (403 behind a bot challenge), Webby Awards winners
// (client-rendered), Made with Vue.js, React and Laravel (mostly apps and side
// projects), Klim's In Use (mostly print),
// Wagtail's own showcase (wagtail.org/showcase, a few case studies; Made with Wagtail is
// its site list), Design Inspiration (design-inspiration.net, product design, not websites).
import * as awwwards from "./awwwards.js";
import * as cssdesignawards from "./cssdesignawards.js";
import * as refero from "./refero.js";
import * as onepagelove from "./onepagelove.js";
import * as curated from "./curated.js";
import * as httpster from "./httpster.js";
import * as cssnectar from "./cssnectar.js";
import * as minimalGallery from "./minimal-gallery.js";
import * as darkmodedesign from "./darkmodedesign.js";
import * as siteofsites from "./siteofsites.js";
import * as admiretheweb from "./admiretheweb.js";
import * as bestwebsitegallery from "./bestwebsitegallery.js";
import * as typewolf from "./typewolf.js";
import * as hoverstates from "./hoverstates.js";
import * as siiimple from "./siiimple.js";
import * as landinglove from "./landinglove.js";
import * as ecommdesign from "./ecommdesign.js";
import * as brutalistwebsites from "./brutalistwebsites.js";
import * as footerdesign from "./footerdesign.js";
import * as mindsparklemag from "./mindsparklemag.js";
import * as deadsimplesites from "./deadsimplesites.js";
import * as landingfolio from "./landingfolio.js";
import * as csswinner from "./csswinner.js";
import * as navbargallery from "./navbargallery.js";
import * as designnominees from "./designnominees.js";
import * as semplice from "./semplice.js";
import * as webdesignclip from "./webdesignclip.js";
import * as csslight from "./csslight.js";
import * as details from "./details.js";
import * as saaspages from "./saaspages.js";
import * as saaslandingpage from "./saaslandingpage.js";
import * as sitesee from "./sitesee.js";
import * as landinggallery from "./landinggallery.js";
import * as cssline from "./cssline.js";
import * as orpetron from "./orpetron.js";
import * as unmatchedstyle from "./unmatchedstyle.js";
import * as a1gallery from "./a1gallery.js";
import * as seesaw from "./seesaw.js";
import * as landingsdev from "./landingsdev.js";
import * as pricingpages from "./pricingpages.js";
import * as typio from "./typio.js";
import * as fourohfours from "./fourohfours.js";
import * as killerportfolio from "./killerportfolio.js";
import * as webinspoo from "./webinspoo.js";
import * as astro from "./astro.js";
import * as nuxt from "./nuxt.js";
import * as lenis from "./lenis.js";
import * as kirby from "./kirby.js";
import * as wordpress from "./wordpress.js";
import * as statamic from "./statamic.js";
import * as muuuuu from "./muuuuu.js";
import * as awwwardshonorable from "./awwwardshonorable.js";
import * as wagtail from "./wagtail.js";

export const GALLERIES = [awwwards, cssdesignawards, refero, onepagelove, curated, httpster, cssnectar, minimalGallery, darkmodedesign, siteofsites, admiretheweb, bestwebsitegallery, typewolf, hoverstates, siiimple, landinglove, ecommdesign, brutalistwebsites, footerdesign, mindsparklemag, deadsimplesites, landingfolio, csswinner, navbargallery, designnominees, semplice, webdesignclip, csslight, details, saaspages, saaslandingpage, sitesee, landinggallery, cssline, orpetron, unmatchedstyle, a1gallery, seesaw, landingsdev, pricingpages, typio, fourohfours, killerportfolio, webinspoo, astro, nuxt, lenis, kirby, wordpress, statamic, muuuuu, awwwardshonorable, wagtail];
