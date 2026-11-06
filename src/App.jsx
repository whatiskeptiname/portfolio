// src/App.jsx
import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { CaseStudies, Contact, Experience, Footer, Header, Hero, OpenSource, Toolbox, WhyHireMe } from "./components/site/Sections";
import LifeBackground from "./components/site/LifeBackground";
import { PLANET, canonicalHash, isPlanet, pageTitle } from "./lib/sections";
import { profile } from "./content/profile";

// The 3D city (and three.js) only downloads when someone opens it.
const CityExplorer = lazy(() => import("./city/CityExplorer"));

// The address, with old links moved to where that page is now.
function currentHash() {
  const hash = window.location.hash;
  const moved = canonicalHash(hash);
  if (moved !== hash) window.history.replaceState(null, "", moved);
  return moved;
}

function useHash() {
  const [hash, setHash] = useState(currentHash);
  useEffect(() => {
    const onChange = () => setHash(currentHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHash();
  const inCity = isPlanet(hash);

  // Arriving on the page (a direct link, or back from the planet) the browser's
  // own jump-to-anchor has already happened, before the sections existed: do it
  // now, at once, and again when the web fonts land and reflow the text above it.
  const arriving = useRef(true);
  useEffect(() => {
    if (inCity) {
      arriving.current = true;
      return;
    }
    const target = hash.length > 1 ? document.getElementById(hash.slice(1)) : null;
    if (arriving.current) {
      arriving.current = false;
      if (!target) return;
      target.scrollIntoView({ behavior: "instant" });
      document.fonts?.ready.then(() => {
        if (window.location.hash === hash) target.scrollIntoView({ behavior: "instant" });
      });
    } else {
      target?.scrollIntoView();
    }
  }, [inCity, hash]);

  // The landing page's Header titles its own sections.
  useEffect(() => {
    if (inCity) document.title = pageTitle(profile.name, PLANET.label);
  }, [inCity]);

  if (inCity) {
    return (
      <Suspense fallback={<div className="city-loading">Approaching the planet…</div>}>
        <CityExplorer
          initialVehicle={new URLSearchParams(hash.split("?")[1]).get("vehicle")}
          initialView={new URLSearchParams(hash.split("?")[1]).get("view")}
          onExit={() => (window.location.hash = "#contact")}
        />
      </Suspense>
    );
  }

  return (
    <>
      <LifeBackground />
      <a className="skip-link" href="#work">Skip to work</a>
      <Header />
      <main>
        <Hero />
        <WhyHireMe />
        <CaseStudies />
        <Experience />
        <Toolbox />
        <OpenSource />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
