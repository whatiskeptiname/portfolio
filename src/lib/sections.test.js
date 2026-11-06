import { describe, expect, it } from "vitest";
import { PLANET, SECTIONS, canonicalHash, isPlanet, pageTitle } from "./sections";

describe("page names and addresses", () => {
  it("names each section's address after its label", () => {
    for (const s of SECTIONS) expect(s.id).toBe(s.label.toLowerCase());
  });

  it("forwards old addresses, keeping their options", () => {
    expect(canonicalHash("#/city")).toBe(PLANET.hash);
    expect(canonicalHash("#/city?vehicle=drone&view=eye")).toBe(`${PLANET.hash}?vehicle=drone&view=eye`);
    expect(canonicalHash("#open-source")).toBe("#projects");
  });

  it("leaves current addresses and deep links alone", () => {
    for (const hash of ["", "#work", "#projects", "#case-surgery", "#/planet", "#/planet?vehicle=car"]) expect(canonicalHash(hash)).toBe(hash);
  });

  it("recognises the planet, with or without options, and nothing else", () => {
    expect(isPlanet("#/planet")).toBe(true);
    expect(isPlanet("#/planet?vehicle=car")).toBe(true);
    expect(isPlanet("#/planets")).toBe(false);
    expect(isPlanet("#work")).toBe(false);
    expect(isPlanet("")).toBe(false);
  });

  it("titles the tab with the page's name", () => {
    expect(pageTitle("Ann", "Work")).toBe("Work · Ann");
    expect(pageTitle("Ann")).toBe("Ann · Portfolio");
  });
});
