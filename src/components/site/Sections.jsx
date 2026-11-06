// src/components/site/Sections.jsx — the sections of the landing page, laid
// out as a bento grid: every idea gets its own rounded tile, and tiles span
// one or more columns so each row fills edge to edge.
import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { profile } from "../../content/profile";
import { background, caseStudies, highlights, roles, skills, summary } from "../../content/resume";
import { featured, languageColor, languageGroups, projects } from "../../data";
import { formatPeriod, timelineRows, yearsSince } from "../../lib/career";
import ProjectCard, { LanguageDot, Stars } from "../ProjectCard";
import PlanetArt from "./PlanetArt";
import { PLANET, SECTIONS, pageTitle } from "../../lib/sections";
import PlanetD from "./PlanetD";
import ThemeToggle from "./ThemeToggle";

const asset = (path) => `${import.meta.env.BASE_URL}${path}`;

// The case-study simulations only download when someone opens one.
const SimPlayer = lazy(() => import("../sims/SimPlayer"));

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
          <a className="nav-cta" href={PLANET.hash} aria-label={PLANET.label}>
            <span aria-hidden="true">
              3<PlanetD />
              <span className="nav-cta-word"> planet</span>
            </span>
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
// Hero: the whole profile at a glance, as tiles.

export function Hero() {
  const firstRole = roles.reduce((a, b) => (a.start < b.start ? a : b));
  const current = roles.find((r) => r.end === null) ?? roles[0];
  return (
    <section className="hero" id="top">
      <div className="container bento hero-bento">
        <div className="tile tile-intro">
          <img
            className="avatar"
            src={`https://github.com/${profile.github}.png?size=192`}
            alt={`Portrait of ${profile.name}`}
            width="72"
            height="72"
          />
          <p className="section-label">{profile.role}</p>
          <h1>{profile.name}</h1>
          <p className="tagline">{profile.tagline}</p>
          <div className="hero-meta">
            {profile.location && <span>📍 {profile.location}</span>}
            <span>{yearsSince(firstRole.start)}+ years in ML</span>
          </div>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#work">See my work</a>
            {profile.resumeUrl && (
              <a className="btn" href={asset(profile.resumeUrl)} target="_blank" rel="noopener noreferrer">
                Résumé (PDF)
              </a>
            )}
          </div>
        </div>

        <a className="tile tile-planet" href={PLANET.hash}>
          <PlanetArt />
          <div className="tile-planet-text">
            <p className="tile-label">Interactive</p>
            <h3>Drive my 3D planet</h3>
            <p>Résumé in the north, open source in the south. Drive it, or fly it as a drone.</p>
            <span className="tile-arrow" aria-hidden="true">→</span>
          </div>
        </a>

        <div className="tile tile-now">
          <p className="tile-label">
            <span className="live-dot" aria-hidden="true" />
            Currently
          </p>
          <h3>{current.title}</h3>
          <p className="muted">{current.org}</p>
        </div>

        {highlights.map((h, i) => (
          <div className={`tile tile-stat tile-stat-${i}`} key={h.label}>
            <div className="stat-value">{h.value}</div>
            <div className="stat-label">{h.label}</div>
          </div>
        ))}

        <div className="tile tile-about" id="about">
          <p className="tile-label">About</p>
          <div className="prose">
            <p className="lead">{summary}</p>
            <MoreAbout />
          </div>
        </div>

        <a className="tile tile-github" href="#projects">
          <LanguageBars />
        </a>

        <div className="tile tile-contact">
          <p className="tile-label">Say hello</p>
          {profile.email && (
            <a className="contact-email" href={`mailto:${profile.email}`}>
              {profile.email}
            </a>
          )}
          <div className="contact-links">
            {profile.links.map((l) => (
              <a key={l.href} className="btn btn-small" href={l.href} target="_blank" rel="noopener noreferrer">
                {l.label} ↗
              </a>
            ))}
          </div>
        </div>
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
    <div aria-label="Open-source projects per language">
      <p className="tile-label">On GitHub</p>
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
          {caseStudies.map((c, i) => (
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
      <p className="tile-label">{study.org}</p>
      <h3>{study.title}</h3>
      {study.metric && (
        <p className="case-metric">
          <span className="case-metric-value">{study.metric.value}</span>
          <span>{study.metric.label}</span>
        </p>
      )}
      <Bullets items={study.highlights} />
      <button className="sim-open" onClick={onSimulate}>
        <span aria-hidden="true">▶</span> Simulate
      </button>
      <ul className="tags">
        {study.tags.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
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
        <div className="bento bento-3">
          <div className="tile span-3 timeline-tile">
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

          {roles.map((role) => (
            <article className="tile role" key={role.id}>
              <p className="tile-label">
                {formatPeriod(role.start, role.end)} · {role.location}
              </p>
              <h3>{role.title}</h3>
              <p className="muted">{role.org}</p>
              {role.projects && (
                <div className="role-projects">
                  {role.projects.map((id) => (
                    <a key={id} className="role-project" href={`#case-${id}`}>
                      {byId.get(id)?.title}
                    </a>
                  ))}
                </div>
              )}
              {role.highlights && <Bullets items={role.highlights} />}
            </article>
          ))}
        </div>

        <h3 className="subheading" id="background">Education &amp; community</h3>
        <div className="bento bento-6">
          {extras.map((b, i) => (
            <article className={`tile bg${bgSpan(i, extras.length)}`} key={b.id}>
              <p className={`tile-label kind-${b.kind.toLowerCase()}`}>
                <span className="kind-dot" aria-hidden="true" />
                {b.kind} · {b.date ?? formatPeriod(b.start, b.end)}
              </p>
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
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// Six-column grid: rows of three tiles (span 2), and a short last row
// stretches its tiles so it fills too.
function bgSpan(i, n) {
  const lastRow = n % 3;
  if (lastRow && i >= n - lastRow) return ` span6-${6 / lastRow}`;
  return " span6-2";
}

// ---------------------------------------------------------------------------
// Toolbox: one tile per category.

export function Toolbox() {
  return (
    <section id="toolbox">
      <div className="container">
        <SectionHead id="toolbox">What I build with</SectionHead>
        <div className="bento bento-3">
          {skills.map((s) => (
            <div className="tile tool" key={s.category}>
              <p className="tile-label">{s.category}</p>
              <ul className="tags">
                {s.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
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
        <div className="bento bento-3">
          {featured.map((p) => (
            <ProjectCard key={p.name} project={p} />
          ))}
          <div className="tile span-3 repos" id="all-projects">
            <p className="tile-label">More repositories</p>
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
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function Contact() {
  return (
    <section id="contact">
      <div className="container">
        <div className="tile tile-cta">
          <h2>Contact</h2>
          <p className="muted">
            Let&rsquo;s talk. Open to ML engineering roles and collaborations, especially in computer vision, model
            optimization and MLOps.
          </p>
          <div className="contact-links">
            {profile.email && (
              <a className="btn btn-primary" href={`mailto:${profile.email}`}>
                {profile.email}
              </a>
            )}
            {profile.links.map((l) => (
              <a key={l.href} className="btn" href={l.href} target="_blank" rel="noopener noreferrer">
                {l.label} ↗
              </a>
            ))}
            {profile.resumeUrl && (
              <a className="btn" href={asset(profile.resumeUrl)} target="_blank" rel="noopener noreferrer">
                Résumé (PDF)
              </a>
            )}
          </div>
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
