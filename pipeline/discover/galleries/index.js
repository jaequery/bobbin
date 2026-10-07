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
// (mostly agency and local-business submissions).
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

export const GALLERIES = [awwwards, cssdesignawards, refero, onepagelove, curated, httpster, cssnectar, minimalGallery, darkmodedesign, siteofsites, admiretheweb, bestwebsitegallery, typewolf, hoverstates, siiimple, landinglove, ecommdesign, brutalistwebsites, footerdesign, mindsparklemag, deadsimplesites, landingfolio, csswinner, navbargallery, designnominees, semplice, webdesignclip, csslight, details, saaspages, saaslandingpage, sitesee, landinggallery];
