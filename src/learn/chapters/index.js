// Every chapter with its lessons, in the catalogue's order.
import { CATALOG } from "../catalog";
import bayes from "./bayes";
import time from "./time";
import trees from "./trees";
import vision from "./vision";

const CONTENT = { trees, bayes, time, vision };

export const CHAPTERS = CATALOG.filter((c) => CONTENT[c.id]).map((c) => ({ ...c, ...CONTENT[c.id] }));
