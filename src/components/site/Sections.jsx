// src/components/site/Sections.jsx — the sections of the landing page.
import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { profile } from "../../content/profile";
import { alongside, background, buildPath, caseStudies, caseStudyOrder, highlights, roles, skills, strengths, summary } from "../../content/resume";
import { featured, languageColor, languageGroups, projects } from "../../data";
import { formatPeriod, timelineRows, yearsSince } from "../../lib/career";
import Icon from "../Icon";
import ProjectCard, { LanguageDot, Stars } from "../ProjectCard";
import { PLANET, SECTIONS, pageTitle } from "../../lib/sections";
import { FIGURES } from "./figureMap";
import { InferenceRace } from "./Figures";
import "./figures.css";
import PlanetD from "./PlanetD";
import { enterLearn, enterPlanet, preloadLearn, preloadPlanet } from "./portal";
import { CATALOG } from "../../learn/catalog";
import { learnHash } from "../../learn/route";
import ThemeToggle from "./ThemeToggle";

const asset = (path) => `${import.meta.env.BASE_URL}${path}`;

// The case-study simulations only download when someone opens one.
const SimPlayer = lazy(() => import("../sims/SimPlayer"));
// The chapter pictures are small, but keep them off the first paint.
const Cover = lazy(() => import("../../learn/Covers"));

// Picks out numbers like 7x, 80.26%, 40k+ so results stand out in prose.
function Emphasize({ children }) {
  const parts = children.split(/(\d[\d.,]*(?:x|×|%|k\+|\+)(?=[\s,.;)]|$))/g);
  return parts.map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

/**
 * Shows the first `keep` items and a "Show N more" toggle for the rest, so
 * the page reads short by default with every detail one click away.
 */
function Expandable({ items, keep = 1, children, noun = "more" }) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, keep);
  const hidden = items.length - keep;
  return (
    <>
      {children(shown)}
      {hidden > 0 && (
        <button className="link-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "Show less" : `Show ${hidden} ${noun}`}
        </button>
      )}
    </>
  );
}

// A section's heading is its name, the same one the header and URL use.
function SectionHead({ id, children }) {
  return (
    <header className="section-head">
      <h2>{SECTIONS.find((n) => n.id === id).label}</h2>
      {children && <p className="section-intro">{children}</p>}
    </header>
  );
}

function Bullets({ items, keep = 1 }) {
  return (
    <Expandable items={items} keep={keep}>
      {(shown) => (
        <ul className="bullets">
          {shown.map((h) => (
            <li key={h}>
              <Emphasize>{h}</Emphasize>
            </li>
          ))}
        </ul>
      )}
    </Expandable>
  );
}

/**
 * Which section you're reading: the last one whose top has passed 40% of
 * the way down the screen (null on the hero, where the name lights up
 * instead), or the last one once you've scrolled to the bottom.
 */
function useCurrentSection(ids) {
  const [current, setCurrent] = useState(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.4;
      let found = null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) found = id;
      }
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) found = ids[ids.length - 1];
      setCurrent(found);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ids]);
  return current;
}

const NAV_IDS = SECTIONS.map((n) => n.id);

const ARRIVAL = 1500; // ms a link gets to scroll to its target before the address follows the page again

// Keeps the tab's title and the address on the page you're reading. A deep link
// within that page (#case-surgery, say) stays until you scroll out of it, and an
// address you've just followed is left alone while the page scrolls to it.
function useSectionAddress(current) {
  const followed = useRef(performance.now());
  useEffect(() => {
    const note = () => (followed.current = performance.now());
    window.addEventListener("hashchange", note);
    return () => window.removeEventListener("hashchange", note);
  }, []);
  useEffect(() => {
    document.title = pageTitle(profile.name, SECTIONS.find((n) => n.id === current)?.label);
    const { hash, pathname, search } = window.location;
    if (hash.startsWith("#/")) return; // on the way to the planet
    const target = hash.length > 1 ? document.getElementById(hash.slice(1)) : null;
    const inTarget = target?.closest("section")?.id === (current ?? "top");
    if (target && !inTarget && performance.now() - followed.current < ARRIVAL) return;
    if (inTarget && hash !== "#top") return;
    const next = current ? `#${current}` : pathname + search;
    if (next !== (current ? hash : pathname + search + hash)) window.history.replaceState(null, "", next);
  }, [current]);
}

export function Header() {
  const current = useCurrentSection(NAV_IDS);
  useSectionAddress(current);
  // Small screens: the links fold into a menu.
  const [open, setOpen] = useState(false);
  const bar = useRef();
  useEffect(() => {
    if (!open) return;
    const away = (e) => !bar.current?.contains(e.target) && setOpen(false);
    const escape = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", escape);
    };
  }, [open]);
  const here = SECTIONS.find((n) => n.id === current);
  return (
    <header className="site-header">
      <div className={`container${open ? " menu-open" : ""}`} ref={bar}>
        <a className={`brand${current === null ? " is-current" : ""}`} href="#top" aria-label={profile.name} aria-current={current === null ? "location" : undefined}>
          {/* With no room for the links, the bar says which page you're on instead. */}
          <span className={here ? "brand-name" : undefined}>{profile.name}</span>
          {here && <span className="brand-here">{here.label}</span>}
        </a>
        <nav className="nav" id="site-nav" aria-label="Main" onClick={(e) => e.target.closest("a") && setOpen(false)}>
          {SECTIONS.map((n) => (
            <a key={n.id} href={`#${n.id}`} className={current === n.id ? "is-current" : undefined} aria-current={current === n.id ? "location" : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          {/* A small easter egg: this is the only way in to the 3D planet. */}
          <a
            className="egg"
            href={PLANET.hash}
            aria-label="Something small is orbiting here"
            title="Something small is orbiting here"
            onPointerEnter={preloadPlanet}
            onFocus={preloadPlanet}
            onClick={(e) => enterPlanet(e, PLANET.hash)}
          >
            <PlanetD />
          </a>
          <ThemeToggle />
          <button className="menu-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="site-nav" aria-label="Menu">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Hero: what you'd be hiring, the results that back it, and how to get in touch.

// The headline, with the word that matters found the way a vision model would find it.
function Claim() {
  const [before, after] = profile.tagline.split(profile.taglineWord);
  return (
    <h1>
      {before}
      <span className="detected">
        {profile.taglineWord}
        <span className="detected-tag" aria-hidden="true">
          {profile.taglineTag}
        </span>
      </span>
      {after}
    </h1>
  );
}

export function Hero() {
  const firstRole = roles.reduce((a, b) => (a.start < b.start ? a : b));
  const current = roles.find((r) => r.end === null) ?? roles[0];
  return (
    <section className="hero" id="top">
      <div className="container">
        <div className="hero-grid">
          <div>
            <div className="hero-who">
              <img
                className="avatar"
                src={`https://github.com/${profile.github}.png?size=96`}
                alt={`Portrait of ${profile.name}`}
                width="48"
                height="48"
              />
              <p>
                <strong>{profile.name}</strong>
                <br />
                {profile.role}
                {profile.location && `, ${profile.location}`}
              </p>
            </div>
            <Claim />
            <div className="prose" id="about">
              <p>{summary}</p>
              <MoreAbout />
            </div>
            <div className="hero-actions">
              {profile.email && (
                <a className="btn btn-primary" href={`mailto:${profile.email}`}>
                  Email me <Icon name="arrowRight" />
                </a>
              )}
              {profile.resumeUrl && (
                <a className="btn" href={asset(profile.resumeUrl)} target="_blank" rel="noopener noreferrer">
                  Résumé (PDF)
                </a>
              )}
              <a className="btn" href="#work">See my work</a>
            </div>
            <p className="hero-open">Open to ML engineering roles and collaborations.</p>
          </div>
          <InferenceRace />
        </div>
        <dl className="results">
          {highlights.map((h) => (
            <div key={h.label}>
              <dt>{h.value}</dt>
              <dd>{h.label}</dd>
            </div>
          ))}
          <div>
            <dt>{yearsSince(firstRole.start)}+ years</dt>
            <dd>
              in ML, now {current.title} at {current.org}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

// Why hire me: what you'd get, at a glance. The proof is in the case studies below.
export function WhyHireMe() {
  const titleOf = (id) => caseStudies.find((c) => c.id === id)?.title;
  return (
    <section id="why-hire-me">
      <div className="container">
        <SectionHead id="why-hire-me">What I bring to a team</SectionHead>
        <ul className="strengths">
          {strengths.map((s) => {
            const Picture = FIGURES[s.figure];
            return (
              <li key={s.title}>
                <Picture />
                <div className="strength-text">
                  <h3>{s.title}</h3>
                  <p>{s.line}</p>
                  {s.work && (
                    <a className="strength-link" href={`#case-${s.work}`}>
                      {titleOf(s.work)} <Icon name="arrowDown" />
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function MoreAbout() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && profile.about.map((para) => <p key={para}>{para}</p>)}
      <button className="link-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? "Show less" : "More about me"}
      </button>
    </>
  );
}

function LanguageBars() {
  const max = Math.max(...languageGroups.map((g) => g.projects.length));
  return (
    <div className="languages" aria-label="Open-source projects per language">
      <p className="github-count">
        <strong>{projects.length}</strong> public projects · <strong>{projects.reduce((s, p) => s + p.stars, 0)}</strong> stars
      </p>
      <div className="lang-bars">
        {languageGroups.slice(0, 5).map(({ language, projects: list }) => (
          <div className="lang-bar" key={language}>
            <span>{language}</span>
            <div className="lang-bar-track">
              <div
                className="lang-bar-fill"
                style={{ width: `${(list.length / max) * 100}%`, background: languageColor(language) }}
              />
            </div>
            <span className="lang-bar-count">{list.length}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Work: one tile per case study; the first and last span two columns so the
// three-column grid fills (2+1, 1+1+1, 1+2).

export function CaseStudies() {
  const wide = (i) => i === 0 || (i === caseStudies.length - 1 && (caseStudies.length - 2) % 3 === 2);
  const [simulating, setSimulating] = useState(null);
  return (
    <section id="work">
      <div className="container">
        <SectionHead id="work">Selected case studies</SectionHead>
        <div className="bento bento-3">
          {caseStudyOrder.map((id) => caseStudies.find((c) => c.id === id)).map((c, i) => (
            <CaseStudy key={c.id} study={c} wide={wide(i)} onSimulate={() => setSimulating(c)} />
          ))}
        </div>
      </div>
      {simulating && (
        <Suspense fallback={<div className="sim-backdrop" />}>
          <SimPlayer study={simulating} onClose={() => setSimulating(null)} />
        </Suspense>
      )}
    </section>
  );
}

function CaseStudy({ study, wide, onSimulate }) {
  return (
    <article className={`tile case${wide ? " span-2" : ""}`} id={`case-${study.id}`}>
      {/* A real frame from the simulation, in the current theme. Opens it. */}
      <button className="case-poster" onClick={onSimulate} aria-label={`See how it works: ${study.title}`}>
        <img className="poster-light" src={asset(`sims/${study.id}-light.webp`)} alt="" loading="lazy" width="960" height="540" />
        <img className="poster-dark" src={asset(`sims/${study.id}-dark.webp`)} alt="" loading="lazy" width="960" height="540" />
        <span className="case-play">
          <Icon name="play" /> See how it works
        </span>
      </button>
      <div className="case-head">
        <p className="tile-label">{study.org}</p>
        <h3>{study.title}</h3>
        {study.metric && (
          <p className="case-metric">
            <span className="case-metric-value">{study.metric.value}</span>
            <span>{study.metric.label}</span>
          </p>
        )}
      </div>
      <div className="case-body">
        <Bullets items={study.highlights} keep={wide ? 2 : 1} />
        <ul className="tags">
          {study.tags.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Experience: the timeline, the roles, then education and community.

const KIND_LABEL = { work: "Work", Education: "Education", Leadership: "Leadership", Fellowship: "Fellowship" };

export function Experience() {
  const entries = [
    ...roles.map((r) => ({ id: r.id, label: r.title, sub: r.org, kind: "work", start: r.start, end: r.end })),
    ...background
      .filter((b) => b.start !== b.end)
      .map((b) => ({ id: b.id, label: b.title, sub: b.org, kind: b.kind, start: b.start, end: b.end })),
  ];
  const { startYear, endYear, rows } = timelineRows(entries);
  const years = Array.from({ length: endYear - startYear }, (_, i) => startYear + i);
  const byId = new Map(caseStudies.map((c) => [c.id, c]));
  const catdox = caseStudies.find((c) => c.id === "catdox");
  const extras = [
    ...background,
    ...(catdox ? [{ id: "award", kind: "Award", title: catdox.title, org: catdox.org.split(" · ")[0], date: catdox.org.split(" · ")[1], award: true }] : []),
  ];

  return (
    <section id="experience">
      <div className="container">
        <SectionHead id="experience">From robotics club to production ML</SectionHead>
        <div className="tile timeline-tile">
          <div className="timeline-chart" role="img" aria-label="Timeline of education, roles and leadership">
            <div className="timeline-axis" style={{ "--years": years.length }}>
              {years.map((y) => (
                <span key={y}>{y}</span>
              ))}
            </div>
            {rows.map((r) => (
              <div className="timeline-row" key={r.id}>
                <div className="timeline-label">
                  <strong>{r.label}</strong>
                  <span>{r.sub}</span>
                </div>
                <div className="timeline-track" style={{ "--years": years.length }}>
                  <div
                    className={`timeline-bar kind-${r.kind.toLowerCase()}${r.ongoing ? " ongoing" : ""}`}
                    style={{ left: `${r.left}%`, width: `${r.width}%` }}
                    title={KIND_LABEL[r.kind] ?? r.kind}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <ol className="ledger">
          {roles.map((role) => (
            <li key={role.id}>
              <div className="ledger-side">
                <span className="period">{formatPeriod(role.start, role.end)}</span>
                <span>{role.location}</span>
              </div>
              <div className="ledger-main">
                <h3>{role.title}</h3>
                <p className="muted">{role.org}</p>
                {role.projects && (
                  <div className="role-projects">
                    {role.projects.map((id) => (
                      <a key={id} className="role-project" href={`#case-${id}`}>
                        {byId.get(id)?.title} <Icon name="arrowDown" />
                      </a>
                    ))}
                  </div>
                )}
                {role.highlights && <Bullets items={role.highlights} />}
              </div>
            </li>
          ))}
        </ol>

        <h3 className="subheading" id="background">Education &amp; community</h3>
        <ol className="ledger">
          {extras.map((b) => (
            <li key={b.id}>
              <div className="ledger-side">
                <span className={`kind kind-${b.kind.toLowerCase()}`}>
                  <span className="kind-dot" aria-hidden="true" />
                  {b.kind}
                </span>
                <span className="period">{b.date ?? formatPeriod(b.start, b.end)}</span>
              </div>
              <div className="ledger-main">
                <h3>{b.title}</h3>
                <p className="muted">{b.org}</p>
                {b.highlights && (
                  <Expandable items={b.highlights}>
                    {(shown) =>
                      shown.map((h) => (
                        <p key={h} className="bg-text">
                          {h}
                        </p>
                      ))
                    }
                  </Expandable>
                )}
                {b.award && (
                  <p className="bg-text">
                    Recognised in the &ldquo;extremely useful&rdquo; category for a Nepali/English document
                    extraction pipeline. <a href="#case-catdox">See the case study</a>.
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Toolbox: the tools in the order the work happens, from labelled data to a
// model in production.

function ToolGroup({ category }) {
  const { items } = skills.find((s) => s.category === category);
  return (
    <div className="path-group">
      <h4>{category}</h4>
      <ul className="tools">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function Toolbox() {
  return (
    <section id="toolbox">
      <div className="container">
        <SectionHead id="toolbox">The whole path, from labelled data to a model in production</SectionHead>
        <ol className="path">
          {buildPath.map((step) => (
            <li key={step.stage}>
              <h3>{step.stage}</h3>
              {step.categories.map((c) => (
                <ToolGroup key={c} category={c} />
              ))}
            </li>
          ))}
        </ol>
        <div className="path-alongside">
          {alongside.map((c) => (
            <ToolGroup key={c} category={c} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Open source: the featured repositories as tiles, the rest in one list tile.

// The cards above already show the featured repositories; the list holds the rest.
const ROWS_SHOWN = 6;

export function OpenSource() {
  const [filter, setFilter] = useState(null);
  const [all, setAll] = useState(false);
  const featuredNames = new Set(featured.map((p) => p.name));
  const rest = projects.filter((p) => !featuredNames.has(p.name));
  const count = (language) => rest.filter((p) => p.language === language).length;
  const languages = languageGroups.map((g) => g.language).filter(count).sort((a, b) => count(b) - count(a));
  const matching = filter ? rest.filter((p) => p.language === filter) : rest;
  const shown = all || filter ? matching : matching.slice(0, ROWS_SHOWN);
  return (
    <section id="projects">
      <div className="container">
        <SectionHead id="projects">
          Side projects, mostly from my robotics-club and fellowship years: Arduino bots, air-quality sensors and early
          ML experiments.
        </SectionHead>
        <LanguageBars />
        <div className="featured">
          {featured.map((p) => (
            <ProjectCard key={p.name} project={p} />
          ))}
        </div>
        <div className="repos" id="all-projects">
          <h3 className="subheading">More repositories</h3>
          <div className="filters" role="group" aria-label="Filter by language">
            <button className="chip" aria-pressed={filter === null} onClick={() => setFilter(null)}>
              All<span className="count">{rest.length}</span>
            </button>
            {languages.map((language) => (
              <button
                key={language}
                className="chip"
                aria-pressed={filter === language}
                onClick={() => setFilter(language)}
              >
                {language}
                <span className="count">{count(language)}</span>
              </button>
            ))}
          </div>
          <ul className="project-list">
            {shown.map((p) => (
              <li className="project-row" key={p.name}>
                <a href={p.url} target="_blank" rel="noopener noreferrer">
                  {p.title}
                </a>
                <span className="meta">
                  <Stars count={p.stars} />
                  <LanguageDot language={p.language} />
                  <span className="year">{p.pushedAt?.slice(0, 4)}</span>
                </span>
                {p.description && <p>{p.description}</p>}
              </li>
            ))}
          </ul>
          {!filter && matching.length > ROWS_SHOWN && (
            <button className="link-btn list-more" onClick={() => setAll((a) => !a)} aria-expanded={all}>
              {all ? "Show fewer" : `Show all ${matching.length}`}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Learn: the doors into the lessons, one per chapter, each with its idea playing.

export function LearnSection() {
  return (
    <section id="learn">
      <div className="container">
        <SectionHead id="learn">
          Quick, hands-on explainers of how machine learning systems actually work, for when you use them more than you build them. They grew
          out of lectures I've taught and the hands-on tasks I designed and worked through.
        </SectionHead>
        <ol className="learn-doors">
          {CATALOG.map((c) => (
            <li key={c.id}>
              <a
                className="tile learn-door"
                href={learnHash(c.id)}
                onPointerEnter={preloadLearn}
                onFocus={preloadLearn}
                onClick={(e) => enterLearn(e, learnHash(c.id))}
              >
                <Suspense fallback={<div className="cover cover-placeholder" />}>
                  <Cover kind={c.cover} />
                </Suspense>
                <span className="learn-door-text">
                  <strong>{c.title}</strong>
                  <span>{c.hook}</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
        <a
          className="btn learn-all"
          href={learnHash()}
          onPointerEnter={preloadLearn}
          onFocus={preloadLearn}
          onClick={(e) => enterLearn(e, learnHash())}
        >
          All lessons <Icon name="arrowRight" />
        </a>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function Contact() {
  return (
    <section id="contact">
      <div className="container">
        <SectionHead id="contact">
          Let&rsquo;s talk. Open to ML engineering roles and collaborations, especially in computer vision, model
          optimization and MLOps.
        </SectionHead>
        {profile.email && (
          <a className="contact-email" href={`mailto:${profile.email}`}>
            {profile.email}
          </a>
        )}
        <div className="contact-links">
          {profile.links.map((l) => (
            <a key={l.href} className="btn" href={l.href} target="_blank" rel="noopener noreferrer">
              {l.label} <Icon name="external" />
            </a>
          ))}
          {profile.resumeUrl && (
            <a className="btn" href={asset(profile.resumeUrl)} target="_blank" rel="noopener noreferrer">
              Résumé (PDF)
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <span>
          © {new Date().getFullYear()} {profile.name}
        </span>
        <span>Built with React, Vite &amp; three.js</span>
      </div>
    </footer>
  );
}
