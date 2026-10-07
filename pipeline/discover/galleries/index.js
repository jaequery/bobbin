// Gallery adapters in the order discovery interleaves them. Each exports
// `name` and `listing({ limit })`, an async iterator of
// { url, name?, industryHint?, countryHint?, sourceRef }.
//
// Not yet adapted: Godly (now redirects to recent.design, a client-rendered app),
// The FWA (client-rendered), Land-book, Lapa Ninja, Web Design Inspiration,
// Saaspo and Maxibestof (403 behind a bot challenge), SiteInspire (403/429), SaaS Landing Page (the
// site link is only on each detail page).
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

export const GALLERIES = [awwwards, cssdesignawards, refero, onepagelove, curated, httpster, cssnectar, minimalGallery, darkmodedesign, siteofsites, admiretheweb, bestwebsitegallery, typewolf];
