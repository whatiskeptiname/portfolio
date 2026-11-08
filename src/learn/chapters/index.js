// Every chapter with its lessons, in the catalogue's order.
import { CATALOG } from "../catalog";
import { REELS } from "../reels";
import bayes from "./bayes";
import time from "./time";
import trees from "./trees";
import vision from "./vision";

const CONTENT = { trees, bayes, time, vision };

// Each lesson's walkthrough lives in reels/index.js, keyed "chapter/lesson".
export const CHAPTERS = CATALOG.filter((c) => CONTENT[c.id]).map((c) => ({
  ...c,
  ...CONTENT[c.id],
  lessons: CONTENT[c.id].lessons.map((l) => (REELS[`${c.id}/${l.id}`] ? { ...l, reel: REELS[`${c.id}/${l.id}`] } : l)),
}));
