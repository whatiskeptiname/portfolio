// How the car grips, slides and hits things. Pure functions on the car's
// state, so they can be tested without the 3D scene.
//
// Steering is positive to the left; yaw turns anticlockwise from above, and
// forward is (−sin yaw, −cos yaw). `travelYaw` is the way the car is actually
// moving, which lags the way it points (`yaw`) while the rear is sliding.

// The handbrake locks the rear wheels: they brake, and lose their sideways
// grip, so the tail steps out. This is a front-wheel-drive car (most are), so
// with the accelerator down too the front keeps pulling against the locked
// rear: the car holds its speed in a slide you steer with the throttle and
// counter-steer — a handbrake drift. Let go and the rear tyres bite again over
// about half a second, straightening it up.
export const HANDBRAKE = {
  decel: 9, // m/s² from the locked rear alone
  powered: 0.45, // share of the braking left while the front is driving
  drive: 0.6, // share of the engine's push that gets through while sliding
  grip: 0.1, // rear grip with the wheels locked (1 = full)
  lose: 8, // how fast the grip goes (per second)
  regain: 2.2, // and comes back
  oversteer: 0.9, // extra turn-in with no rear grip
};

const angleBetween = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/**
 * One step of grip, steering and slide. Updates the car's rear grip, steer,
 * yaw rate, yaw and travel direction; returns the slip angle (radians) —
 * how far it points from where it's going.
 * @param {object} c  the car: speed, yaw, and its own running state
 * @param {{ steer: number, handbrake?: boolean, handbrakeLevel?: number }} k  this frame's input
 * @param {number} delta  seconds
 * @param {number} steerRate  radians a second at full lock and speed
 */
export function slideCar(c, k, delta, steerRate) {
  // Rear grip: lost quickly when the wheels lock, regained over half a second.
  const rolling = Math.abs(c.speed) > 4;
  // (Pulled only part way, the handbrake takes only part of the grip.)
  const wantGrip = k.handbrake && rolling ? 1 - (1 - HANDBRAKE.grip) * (k.handbrakeLevel ?? 1) : 1;
  const g = c.rearGrip ?? 1;
  c.rearGrip = g + (wantGrip - g) * (1 - Math.exp(-(wantGrip < g ? HANDBRAKE.lose : HANDBRAKE.regain) * delta));
  const loose = 1 - c.rearGrip; // 0 gripping … 0.9 sliding

  // Steering scales with speed and flips in reverse, like a real car. With
  // the rear loose the car turns in harder, and keeps rotating once it has
  // started (you catch it with counter-steer); gripping, it follows the wheel.
  c.steer = (c.steer ?? 0) + (k.steer - (c.steer ?? 0)) * (1 - Math.exp(-10 * delta));
  const bite = Math.min(1, Math.abs(c.speed) / 6) * Math.sign(c.speed);
  const turn = c.steer * steerRate * bite * (1 + loose * HANDBRAKE.oversteer);
  const rate = c.yawRate ?? turn;
  c.yawRate = loose < 0.02 ? turn : rate + (turn - rate) * (1 - Math.exp(-(3 + 11 * c.rearGrip) * delta));
  c.yaw += c.yawRate * delta;

  // Where it's actually going lags where it points while the rear slides; the
  // tyres pull it back into line as they grip. (After a jump — "unstuck", a
  // transformation — or a spin it simply points the way it goes.)
  if (c.travelYaw == null || (c.rearGrip > 0.9 && Math.abs(angleBetween(c.yaw, c.travelYaw)) > 1.4)) c.travelYaw = c.yaw;
  const rejoin = 1.2 + 12.8 * c.rearGrip * c.rearGrip;
  c.travelYaw += angleBetween(c.yaw, c.travelYaw) * (1 - Math.exp(-rejoin * delta));
  const slip = angleBetween(c.yaw, c.travelYaw);
  c.slip = slip;
  c.drifting = rolling && Math.abs(slip) > 0.15;
  return slip;
}

// How the car meets something solid (a wall, a tree, another car). What
// matters is the angle: it finds the wall's line by trying the move turned
// further and further aside, and the first way that's free is the way along
// it. A glancing touch scrapes along, keeping most of the speed and turning
// the car parallel to the wall; a steeper one loses more, and swings it round
// further; head on, the crumple zone takes nearly all of it and it rebounds
// a little. The hit's strength (the speed lost into the wall) drives the
// thud, the camera jolt and the body's shudder.
export const HIT = { angles: [0.3, 0.6, 0.9, 1.2], scrape: 0.94, rebound: 0.12, swing: 0.35 };

/**
 * The car tried to move `distance` along `heading` and hit something.
 * @param {object} s  the car (x, z, speed, yaw, travelYaw, yawRate)
 * @param {number} distance  how far it tried to go this frame (negative backwards)
 * @param {number} heading  the direction of that move
 * @param {number} stretch  east–west scale of the plane at this latitude
 * @param {(x: number, z: number) => boolean} blocked  is the car blocked there?
 */
export function hitCar(s, distance, heading, stretch, blocked) {
  const speed = Math.abs(s.speed);
  let along = null;
  for (const a of HIT.angles) {
    for (const side of [1, -1]) {
      const turn = a * side;
      const h = heading + turn;
      const d = distance * Math.cos(a);
      const ddx = -Math.sin(h) * d * stretch;
      const ddz = -Math.cos(h) * d;
      if (!blocked(s.x + ddx, s.z + ddz)) {
        along = { turn, ddx, ddz };
        break;
      }
    }
    if (along) break;
  }
  let lost;
  if (along) {
    // Into the wall at about this angle: the part of the speed across it is
    // lost, the rest carries on along it, less a little for the scrape.
    const a = Math.abs(along.turn);
    s.x += along.ddx;
    s.z += along.ddz;
    lost = speed * Math.sin(a);
    s.speed *= Math.cos(a) * HIT.scrape;
    // The car is pushed round to run along the wall; where it's going follows.
    s.yaw += along.turn * HIT.swing;
    if (s.travelYaw != null) s.travelYaw = heading + along.turn;
    if (s.yawRate != null) s.yawRate *= 0.5;
  } else {
    // Head on: it stops dead and rebounds a little.
    lost = speed * (1 + HIT.rebound);
    s.speed *= -HIT.rebound;
    if (s.yawRate != null) s.yawRate = 0;
    if (s.travelYaw != null) s.travelYaw = s.yaw;
  }
  const strength = lost / 12;
  s.impact = Math.min(1.5, Math.max(s.impact ?? 0, strength));
  if (strength > 0.04) {
    s.bump = (s.bump ?? 0) + 1;
    s.bumpStrength = strength;
  }
  return strength;
}

// Car meets car: momentum is shared. Each car's velocity is its speed along
// where it's going plus any shove it's still sliding with. Along the line
// between them, what counts is how fast they're closing — both speeds
// together, so a head-on at 60 + 60 km/h is far harder than a nudge at a
// light. That closing speed is shared out by mass, with a little bounce: the
// car that was hit is shoved on, the one that hit it slows. A blow off the
// car's centre line also spins it. Whatever doesn't fit the way a car points
// becomes a sideways shove that its tyres scrub away.
export const CAR_BODY = { halfLength: 2.3, halfWidth: 0.95, mass: 1 };
const INERTIA = (4 * CAR_BODY.halfLength ** 2 + 4 * CAR_BODY.halfWidth ** 2) / 12; // per unit mass
const REBOUND = 0.15;
const SCRUB = 8; // m/s² the tyres take off a sideways shove
const SPIN_DAMP = 3; // per second

const headingOf = (c) => c.travelYaw ?? c.yaw;

/** A car's velocity in the plane (x, z), shove included. */
export function velocityOf(c) {
  const h = headingOf(c);
  return { x: -Math.sin(h) * c.speed + (c.pushX ?? 0), z: -Math.cos(h) * c.speed + (c.pushZ ?? 0) };
}

/** Gives car `c` a change of velocity (dvx, dvz) and of spin; records the knock. */
function kick(c, dvx, dvz, spin) {
  const v = velocityOf(c);
  v.x += dvx;
  v.z += dvz;
  const fx = -Math.sin(c.yaw);
  const fz = -Math.cos(c.yaw);
  const along = v.x * fx + v.z * fz;
  c.speed = along;
  c.pushX = v.x - along * fx;
  c.pushZ = v.z - along * fz;
  if (c.travelYaw != null) c.travelYaw = c.yaw;
  c.spin = (c.spin ?? 0) + spin;
  const strength = Math.hypot(dvx, dvz) / 12;
  c.impact = Math.min(1.5, Math.max(c.impact ?? 0, strength));
  if (strength > 0.04) {
    c.bump = (c.bump ?? 0) + 1;
    c.bumpStrength = strength;
  }
}

/** Where on `c`'s body it touches something in direction (dx, dz): the point of its outline that way. */
function contactOn(c, dx, dz) {
  const fx = -Math.sin(c.yaw);
  const fz = -Math.cos(c.yaw);
  const rx = Math.cos(c.yaw); // its right
  const rz = -Math.sin(c.yaw);
  const along = Math.max(-CAR_BODY.halfLength, Math.min(CAR_BODY.halfLength, dx * fx + dz * fz));
  const side = Math.max(-CAR_BODY.halfWidth, Math.min(CAR_BODY.halfWidth, dx * rx + dz * rz));
  return { x: along * fx + side * rx, z: along * fz + side * rz };
}

/**
 * Two cars collide: shares their momentum along the line between them.
 * Does nothing if they're already moving apart.
 * @param {object} a  a car (x, z, yaw, speed; travelYaw, pushX/Z, spin optional)
 * @param {object} b  the car it hit
 * @param {{ width?: number, massA?: number, massB?: number }} [opts]  width wraps x round the planet
 * @returns {number} the closing speed (m/s), 0 if they weren't closing
 */
export function collideCars(a, b, { width = Infinity, massA = CAR_BODY.mass, massB = CAR_BODY.mass } = {}) {
  let dx = b.x - a.x;
  if (Number.isFinite(width)) dx -= width * Math.round(dx / width);
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1e-6;
  const nx = dx / len;
  const nz = dz / len;
  const va = velocityOf(a);
  const vb = velocityOf(b);
  const closing = (va.x - vb.x) * nx + (va.z - vb.z) * nz;
  if (closing <= 0) return 0;
  const j = ((1 + REBOUND) * closing) / (1 / massA + 1 / massB); // the impulse
  // Turning effect (about the vertical) of the impulse at each car's contact point.
  const torque = (r, ix, iz) => r.z * ix - r.x * iz;
  const ra = contactOn(a, dx, dz);
  const rb = contactOn(b, -dx, -dz);
  kick(a, (-j * nx) / massA, (-j * nz) / massA, torque(ra, -j * nx, -j * nz) / (massA * INERTIA));
  kick(b, (j * nx) / massB, (j * nz) / massB, torque(rb, j * nx, j * nz) / (massB * INERTIA));
  return closing;
}

/**
 * One step of a shoved car sliding: its sideways shove scrubs away at the
 * tyres' grip, and any spin dies down. Returns how far the shove moves it
 * this step (dx, dz) — the caller moves it if nothing's in the way.
 */
export function settleShove(c, dt) {
  const px = c.pushX ?? 0;
  const pz = c.pushZ ?? 0;
  const p = Math.hypot(px, pz);
  let move = { dx: 0, dz: 0 };
  if (p > 0) {
    move = { dx: px * dt, dz: pz * dt };
    const left = Math.max(0, p - SCRUB * dt);
    c.pushX = left > 0.05 ? (px / p) * left : 0;
    c.pushZ = left > 0.05 ? (pz / p) * left : 0;
  }
  if (c.spin) {
    c.yaw += c.spin * dt;
    if (c.travelYaw != null) c.travelYaw += c.spin * dt;
    c.spin *= Math.exp(-SPIN_DAMP * dt);
    if (Math.abs(c.spin) < 0.01) c.spin = 0;
  }
  return move;
}
