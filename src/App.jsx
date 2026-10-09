// src/App.jsx
import React, { Suspense, lazy, useEffect, useState } from "react";
import { CaseStudies, Contact, Experience, Footer, Header, Hero, OpenSource, Toolbox } from "./components/site/Sections";

// The 3D city (and three.js) only downloads when someone opens it.
const CityExplorer = lazy(() => import("./city/CityExplorer"));

const CITY_HASH = "#/city";

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHash();
  const inCity = hash === CITY_HASH || hash.startsWith(`${CITY_HASH}?`);

  // Coming back from the city re-renders the page, so the browser's own
  // jump-to-anchor already happened; redo it once the section exists.
  useEffect(() => {
    if (inCity || hash.length < 2) return;
    document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [inCity, hash]);

  if (inCity) {
    return (
      <Suspense fallback={<div className="city-loading">Approaching the planet…</div>}>
        <CityExplorer
          initialVehicle={new URLSearchParams(hash.split("?")[1]).get("vehicle")}
          initialView={new URLSearchParams(hash.split("?")[1]).get("view")}
          onExit={() => (window.location.hash = "#open-source")}
        />
      </Suspense>
    );
  }

  return (
    <>
      <a className="skip-link" href="#work">Skip to work</a>
      <Header />
      <main>
        <Hero />
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
