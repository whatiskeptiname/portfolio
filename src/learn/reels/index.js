// The walkthroughs at the top of lessons: a list of scenes per lesson. Each
// scene is a component drawn at time t (0 to 1) and how long it plays (ms). A
// scene's caption defaults to the lesson's matching "what to remember" point.
import { Plateau, Resample, Vote } from "./trees";

export const FOREST_REEL = [
  { Scene: Resample, duration: 9000 },
  { Scene: Vote, duration: 13000 },
  { Scene: Plateau, duration: 8000 },
];
