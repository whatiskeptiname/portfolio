// How a car's lights behave, shared by your car and the traffic:
//  - headlights: dim running lights by day, full at night;
//  - tail lights: off by day, dim red at night;
//  - brake lights: bright red while braking or holding at a stop;
//  - reverse lights: white while going backwards;
//  - indicators: blink on the side it's changing lane or turning toward, and
//    keep blinking a moment after; both together (hazards) when told to.
// Steering is positive to the left (it turns the heading anticlockwise from
// above); a lane shift is positive to the right of the direction of travel.

export const BLINK_HZ = 1.5; // flashes a second, like a real indicator
const HOLD = 1.2; // seconds an indicator keeps going after the move ends
const TURNING = 0.2; // smoothed steer that counts as a turn
const SHIFTING = 0.25; // m/s of sideways lane shift that counts as a lane change

/**
 * Updates `car`'s indicator state and returns how lit each lamp is (0…1).
 * @param {object} car  keeps its own blink state between frames
 * @param {{ steer: number, speed: number, shift?: number, braking: boolean,
 *           reversing: boolean, hazard?: boolean, night: boolean, t: number, dt: number }} input
 */
export function carLamps(car, { steer, speed, shift = 0, braking, reversing, hazard = false, night, t, dt }) {
  const ease = 1 - Math.exp(-3 * Math.max(dt, 0));
  car.lampSteer = (car.lampSteer ?? 0) + (steer - (car.lampSteer ?? 0)) * ease;
  const sideways = dt > 0 ? (shift - (car.lampShift ?? shift)) / dt : 0;
  car.lampShift = shift;

  let want = 0; // -1 left, 1 right, 2 both
  if (hazard) want = 2;
  else if (Math.abs(sideways) > SHIFTING) want = sideways > 0 ? 1 : -1;
  else if (Math.abs(car.lampSteer) > TURNING && Math.abs(speed) > 1) want = car.lampSteer > 0 ? -1 : 1;
  if (want) {
    car.blinker = want;
    car.blinkUntil = t + HOLD;
  } else if (t > (car.blinkUntil ?? 0)) car.blinker = 0;

  const flash = Math.floor(t * BLINK_HZ * 2) % 2 === 0 ? 1 : 0;
  const side = car.blinker ?? 0;
  return {
    head: night ? 1 : 0.25,
    // Kept well below the brake level: red that bright saturates, and braking must stand out.
    tail: braking ? 1 : night ? 0.12 : 0.03,
    brake: braking ? 1 : 0,
    reverse: reversing ? 1 : 0,
    left: (side === -1 || side === 2) && flash ? 1 : 0,
    right: (side === 1 || side === 2) && flash ? 1 : 0,
  };
}
