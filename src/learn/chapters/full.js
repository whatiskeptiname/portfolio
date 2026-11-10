// Every chapter with its lessons in full, loaded at once. Only the tests use this:
// the site itself loads one chapter at a time (see index.js).
import { REELS } from "../reels";
import bayes from "./bayes";
import foundations from "./foundations";
import { CHAPTERS, fullLessons } from "./index";
import language from "./language";
import neural from "./neural";
import time from "./time";
import trees from "./trees";
import vision from "./vision";
import wild from "./wild";

export const CONTENT = { foundations, neural, trees, bayes, time, vision, language, wild };

export const FULL_CHAPTERS = CHAPTERS.map((c) => ({ ...c, lessons: fullLessons(c, CONTENT[c.id], REELS) }));
