// Drift scoring. A drift is a slide at speed: the car pointing well away from
// where it's going (the slip angle) while it's moving quickly. While it lasts,
// points pile up with the angle and the speed, so a long, deep, fast slide
// scores far more than a twitch. Straighten up for a moment and the drift is
// banked and shown; hit something mid-drift and it's lost.

export const DRIFT = {
  minSpeed: 6, // m/s (~24 km/h): slower than this isn't a drift
  minAngle: 0.25, // rad (~14°) of slip to count
  grace: 0.6, // s straight before a drift ends (a flick from one side to the other keeps it going)
  show: 2.5, // s the banked score stays on screen
  crash: 0.3, // an impact this hard ends the drift with nothing
};

/** A fresh drift tracker. */
export function driftState() {
  return { active: false, score: 0, angle: 0, calm: 0, last: null, lastFor: 0, best: 0 };
}

/**
 * One step. `slip` (rad) and `speed` (m/s) from the car, `impact` how hard it
 * just hit something, `dt` seconds. Returns the same state object, updated:
 * `active` and `score` while drifting; `last` ({ score, lost }) for a moment
 * after one ends; `best` across the visit.
 */
export function stepDrift(d, { slip = 0, speed = 0, impact = 0, dt }) {
  const angle = Math.abs(slip);
  const sliding = angle > DRIFT.minAngle && Math.abs(speed) > DRIFT.minSpeed;
  d.lastFor = Math.max(0, d.lastFor - dt);
  if (d.lastFor === 0) d.last = null;

  if (d.active && impact > DRIFT.crash) {
    d.last = { score: Math.round(d.score), lost: true };
    d.lastFor = DRIFT.show;
    Object.assign(d, { active: false, score: 0, angle: 0, calm: 0 });
    return d;
  }
  if (sliding) {
    if (!d.active) Object.assign(d, { active: true, score: 0, calm: 0 });
    d.calm = 0;
    d.angle = angle;
    // Degrees of slide × km/h, scaled to friendly numbers.
    d.score += ((angle * 180) / Math.PI) * Math.abs(speed) * 3.6 * dt * 0.05;
  } else if (d.active) {
    d.calm += dt;
    d.angle = angle;
    if (d.calm > DRIFT.grace) {
      const score = Math.round(d.score);
      d.last = { score, lost: false };
      d.lastFor = DRIFT.show;
      d.best = Math.max(d.best, score);
      Object.assign(d, { active: false, score: 0, angle: 0, calm: 0 });
    }
  }
  return d;
}
