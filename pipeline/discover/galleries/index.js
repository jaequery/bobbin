// Gallery adapters in the order discovery interleaves them. Each exports
// `name` and `listing({ limit })`, an async iterator of
// { url, name?, industryHint?, countryHint?, sourceRef }.
//
// Not yet adapted: Godly (now redirects to recent.design, a client-rendered app),
// Land-book and Lapa Ninja (403 behind a bot challenge), SiteInspire (429).
import * as awwwards from "./awwwards.js";
import * as onepagelove from "./onepagelove.js";
import * as httpster from "./httpster.js";
import * as minimalGallery from "./minimal-gallery.js";

export const GALLERIES = [awwwards, onepagelove, httpster, minimalGallery];
