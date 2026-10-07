// The drone's battery: a 4S LiPo pack. The current it draws rises steeply
// with throttle; that drains the charge continuously, and the pack's
// internal resistance makes the voltage sag the instant the throttle goes up
// (and recover when it comes off). As the charge runs low the resting voltage
// falls away, the motors lose power, and empty, they can barely keep it up.
// Time runs faster than real (SPEEDUP) so a flight lasts a few minutes.
// Pure, so it's testable.

export const BATTERY = {
  cells: 4,
  capacityAh: 1.3,
  resistance: 0.018, // Ω for the pack
  idleA: 1.5,
  maxA: 75, // at full throttle
  speedup: 1.5,
  low: 0.2, // charge fraction: time to swap
  empty: 0.03,
};

/** A full pack. */
export function freshBattery() {
  return { charge: 1, current: 0, volts: restVolts(1), swaps: 0 };
}

/** Resting voltage of the pack at a state of charge (a LiPo's discharge curve). */
export function restVolts(charge) {
  const c = Math.max(0, Math.min(1, charge));
  // Flat through the middle, falling off steeply below ~15%.
  const cell = c > 0.15 ? 3.55 + 0.65 * ((c - 0.15) / 0.85) : 3.0 + (0.55 * c) / 0.15;
  return BATTERY.cells * cell;
}

/**
 * Draws power for `dt` seconds at `throttle` (0…1): updates the charge, the
 * current and the voltage under load. Returns how much of the motors' power
 * is available (1 until it's nearly flat).
 */
export function stepBattery(b, throttle, dt) {
  const t = Math.max(0, Math.min(1, throttle));
  b.current = BATTERY.idleA + BATTERY.maxA * t ** 1.6;
  b.charge = Math.max(0, b.charge - (b.current * dt * BATTERY.speedup) / (BATTERY.capacityAh * 3600));
  b.volts = Math.max(0, restVolts(b.charge) - b.current * BATTERY.resistance);
  return available(b);
}

/** The share of full motor power the pack can still give. */
export function available(b) {
  return b.charge <= BATTERY.empty ? 0.35 : b.charge < 0.1 ? 0.35 + (0.65 * (b.charge - BATTERY.empty)) / (0.1 - BATTERY.empty) : 1;
}

/** Swaps in a fresh pack. */
export function swapBattery(b) {
  Object.assign(b, freshBattery(), { swaps: (b.swaps ?? 0) + 1 });
  return b;
}

export const isLow = (b) => b.charge < BATTERY.low;
