// Every chapter with its lessons, in the catalogue's order.
import { CATALOG } from "../catalog";
import { REELS } from "../reels";
import { LESSON_TOPICS } from "../topics";
import bayes from "./bayes";
import foundations from "./foundations";
import language from "./language";
import neural from "./neural";
import time from "./time";
import trees from "./trees";
import vision from "./vision";
import wild from "./wild";

const CONTENT = { foundations, neural, trees, bayes, time, vision, language, wild };

// Each lesson's walkthrough lives in reels/index.js, keyed "chapter/lesson".
export const CHAPTERS = CATALOG.filter((c) => CONTENT[c.id]).map((c) => ({
  ...c,
  ...CONTENT[c.id],
  // (Each lesson also gets its plain textbook name, from topics.js.)
  lessons: CONTENT[c.id].lessons.map((l) => ({ ...l, topic: LESSON_TOPICS[`${c.id}/${l.id}`], ...(REELS[`${c.id}/${l.id}`] ? { reel: REELS[`${c.id}/${l.id}`] } : {}) })),
}));
