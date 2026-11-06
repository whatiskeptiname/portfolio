// One drawn icon set for the whole site, in a single stroke, so nothing depends
// on how a device renders emoji or text glyphs. Sized by the text around it.
import React from "react";

const PATHS = {
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  arrowDown: "M12 5v14M6 13l6 6 6-6",
  external: "M7 17L17 7M9 7h8v8",
  play: "M7 4.5v15l12-7.5z",
  pause: "M8 5v14M16 5v14",
  close: "M6 6l12 12M18 6L6 18",
  pin: "M12 21s7-6.2 7-11.5a7 7 0 10-14 0C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  camera: "M4 8h3.5L9 5.5h6L16.5 8H20v11H4zM12 16a3 3 0 100-6 3 3 0 000 6z",
  expand: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",
  sound: "M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM15.5 9a4 4 0 010 6M18 6.5a8 8 0 010 11",
  mute: "M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM16 9.5l5 5M21 9.5l-5 5",
  compass: "M12 21a9 9 0 100-18 9 9 0 000 18zM15.5 8.5l-2 5-5 2 2-5z",
  music: "M9 18V6l10-2v12M9 18a3 3 0 11-6 0 3 3 0 016 0zM19 16a3 3 0 11-6 0 3 3 0 016 0z",
  sliders: "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 8a2 2 0 100-4 2 2 0 000 4zM9 14a2 2 0 100-4 2 2 0 000 4zM17 20a2 2 0 100-4 2 2 0 000 4z",
  left: "M15 5l-7 7 7 7",
  right: "M9 5l7 7-7 7",
  up: "M5 15l7-7 7 7",
  down: "M5 9l7 7 7-7",
  ascend: "M5 4h14M6 15l6-6 6 6M12 9v11",
  descend: "M5 20h14M6 9l6 6 6-6M12 15V4",
  sun: "M12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4",
  moon: "M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z",
};

export default function Icon({ name, className = "" }) {
  return (
    <svg className={`icon ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
