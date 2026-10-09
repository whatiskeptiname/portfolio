// src/components/site/Sections.jsx — the sections of the landing page, laid
// out as a bento grid: every idea gets its own rounded tile, and tiles span
// one or more columns so each row fills edge to edge.
import React, { Suspense, lazy, useState } from "react";
import { profile } from "../../content/profile";
import { background, caseStudies, highlights, roles, skills, summary } from "../../content/resume";
import { featured, languageColor, languageGroups, projects } from "../../data";
import { formatPeriod, timelineRows, yearsSince } from "../../lib/career";
import ProjectCard, { LanguageDot, Stars } from "../ProjectCard";
import PlanetArt from "./PlanetArt";
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

function SectionHead({ label, title, children }) {
  return (
    <header className="section-head">
      <p className="section-label">{label}</p>
      <h2>{title}</h2>
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

export function Header() {
  return (
    <header className="site-header">
      <div className="container">
        <a className="brand" href="#top">
          {profile.name}
        </a>
        <nav className="nav" aria-label="Main">
          <a href="#work">Work</a>
          <a className="nav-optional" href="#experience">Experience</a>
          <a className="nav-optional" href="#toolbox">Toolbox</a>
          <a className="nav-optional" href="#open-source">Projects</a>
          <a href="#contact">Contact</a>
          <a className="nav-cta" href="#/city">3D planet</a>
          <ThemeToggle />
        </nav>
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

        <a className="tile tile-planet" href="#/city">
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

        <a className="tile tile-github" href="#open-source">
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
        <SectionHead label="Selected work" title="Case studies" />
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
        <SectionHead label="Experience" title="From robotics club to production ML" />
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
        <SectionHead label="Toolbox" title="What I build with" />
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
    <section id="open-source">
      <div className="container">
        <SectionHead label="Open source" title="Side projects">
          Mostly from my robotics-club and fellowship years: Arduino bots, air-quality sensors and early
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
          <p className="section-label">Contact</p>
          <h2>Let&rsquo;s build something</h2>
          <p className="muted">
            Open to ML engineering roles and collaborations, especially in computer vision, model
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
