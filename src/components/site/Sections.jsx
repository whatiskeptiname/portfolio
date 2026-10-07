// src/components/site/Sections.jsx — the sections of the landing page.
import React, { useState } from "react";
import { profile } from "../../content/profile";
import { background, caseStudies, highlights, roles, skills, summary } from "../../content/resume";
import { featured, languageColor, languageGroups, projects } from "../../data";
import { formatPeriod, timelineRows, yearsSince } from "../../lib/career";
import ProjectCard, { LanguageDot, Stars } from "../ProjectCard";
import PlanetArt from "./PlanetArt";

const asset = (path) => `${import.meta.env.BASE_URL}${path}`;

// Picks out numbers like 7x, 80.26%, 40k+ so results stand out in prose.
function Emphasize({ children }) {
  const parts = children.split(/(\d[\d.,]*(?:x|×|%|k\+|\+)(?=[\s,.;)]|$))/g);
  return parts.map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

export function Header() {
  return (
    <header className="site-header">
      <div className="container">
        <a className="brand" href="#top">
          {profile.name}
        </a>
        <nav className="nav" aria-label="Main">
          <a className="nav-optional" href="#experience">Experience</a>
          <a href="#work">Work</a>
          <a className="nav-optional" href="#toolbox">Toolbox</a>
          <a className="nav-optional" href="#open-source">Open source</a>
          <a href="#contact">Contact</a>
          <a href="#/city">3D planet</a>
        </nav>
      </div>
    </header>
  );
}

export function Hero() {
  const firstRole = roles.reduce((a, b) => (a.start < b.start ? a : b));
  return (
    <section className="hero" id="top">
      <div className="container">
        <div className="hero-grid">
          <div>
            <p className="section-label">{profile.role}</p>
            <h1>{profile.name}</h1>
            <p className="tagline">{profile.tagline}</p>
            <div className="hero-meta">
              {profile.location && <span>📍 {profile.location}</span>}
              <span>{yearsSince(firstRole.start)}+ years in ML engineering</span>
              <span>@{profile.github}</span>
            </div>
            <div className="hero-actions">
              <a className="btn btn-primary" href="#work">See my work</a>
              <a className="btn" href="#/city">Explore the 3D planet →</a>
              {profile.resumeUrl && (
                <a className="btn" href={asset(profile.resumeUrl)} target="_blank" rel="noopener noreferrer">
                  Résumé (PDF)
                </a>
              )}
            </div>
          </div>
          <img
            className="avatar"
            src={`https://github.com/${profile.github}.png?size=336`}
            alt={`Portrait of ${profile.name}`}
            width="168"
            height="168"
          />
        </div>
        <div className="stats">
          {highlights.map((h) => (
            <div className="stat" key={h.label}>
              <div className="stat-value">{h.value}</div>
              <div className="stat-label">{h.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function About() {
  return (
    <section id="about">
      <div className="container about-grid">
        <div>
          <p className="section-label">About</p>
          <h2>Computer vision, all the way to production</h2>
          <div className="prose">
            <p className="lead">{summary}</p>
            {profile.about.map((para) => (
              <p key={para}>{para}</p>
            ))}
          </div>
        </div>
        <LanguageBars />
      </div>
    </section>
  );
}

function LanguageBars() {
  const max = Math.max(...languageGroups.map((g) => g.projects.length));
  return (
    <aside className="side-card" aria-label="Open-source projects per language">
      <h3>On GitHub</h3>
      <p className="side-card-sub">
        {projects.length} public projects, {projects.reduce((s, p) => s + p.stars, 0)} stars
      </p>
      <div className="lang-bars">
        {languageGroups.map(({ language, projects: list }) => (
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
    </aside>
  );
}

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

  return (
    <section id="experience">
      <div className="container">
        <p className="section-label">Experience</p>
        <h2>From robotics club to production ML</h2>

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

        <ol className="roles">
          {roles.map((role) => (
            <li className="role" key={role.id}>
              <div className="role-head">
                <div>
                  <h3>{role.title}</h3>
                  <p className="role-org">
                    {role.org} · {role.location}
                  </p>
                </div>
                <span className="period">{formatPeriod(role.start, role.end)}</span>
              </div>
              {role.projects && (
                <div className="role-projects">
                  {role.projects.map((id) => (
                    <a key={id} className="role-project" href={`#case-${id}`}>
                      {byId.get(id)?.title}
                    </a>
                  ))}
                </div>
              )}
              {role.highlights && (
                <ul className="bullets">
                  {role.highlights.map((h) => (
                    <li key={h}>
                      <Emphasize>{h}</Emphasize>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function CaseStudies() {
  return (
    <section id="work">
      <div className="container">
        <p className="section-label">Selected work</p>
        <h2>Case studies</h2>
        <div className="case-grid">
          {caseStudies.map((c, i) => (
            <CaseStudy key={c.id} study={c} span={caseSpan(i, caseStudies.length)} />
          ))}
        </div>
      </div>
    </section>
  );
}

// Desktop grid has 6 columns: the first two studies are half-width, the rest
// thirds, and a leftover last row stretches to fill.
function caseSpan(i, n) {
  if (i < 2) return 3;
  const rest = n - 2;
  const lastRowStart = 2 + rest - (rest % 3 || 3);
  return i >= lastRowStart ? 6 / (n - lastRowStart) : 2;
}

function CaseStudy({ study, span }) {
  const [open, setOpen] = useState(false);
  const shown = open ? study.highlights : study.highlights.slice(0, 2);
  return (
    <article className="case" id={`case-${study.id}`} style={{ "--span": span }}>
      <p className="case-org">{study.org}</p>
      <h3>{study.title}</h3>
      {study.metric && (
        <p className="case-metric">
          <span className="case-metric-value">{study.metric.value}</span>
          <span>{study.metric.label}</span>
        </p>
      )}
      <ul className="bullets">
        {shown.map((h) => (
          <li key={h}>
            <Emphasize>{h}</Emphasize>
          </li>
        ))}
      </ul>
      {study.highlights.length > 2 && (
        <button className="link-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "Show less" : `Show ${study.highlights.length - 2} more`}
        </button>
      )}
      <ul className="tags">
        {study.tags.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </article>
  );
}

export function Toolbox() {
  return (
    <section id="toolbox">
      <div className="container">
        <p className="section-label">Toolbox</p>
        <h2>What I build with</h2>
        <div className="toolbox">
          {skills.map((s) => (
            <div className="toolbox-group" key={s.category}>
              <h3>{s.category}</h3>
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

// The "equator" between the résumé half of the page and the open-source
// half — and the way into the 3D planet where the same split is a real globe.
export function Equator() {
  return (
    <section className="equator" aria-labelledby="equator-heading">
      <div className="container equator-grid">
        <div>
          <p className="section-label">The equator</p>
          <h2 id="equator-heading">Two hemispheres, one planet</h2>
          <p>
            Above this line is my résumé; below it, everything I&rsquo;ve built in the open. In the 3D
            version they&rsquo;re literally two halves of a small planet lit by a black hole: glass
            towers of work and learning in the north, a district per programming language in the
            south, a highway round the equator between them and a river winding pole to pole.
            Drive it, or flip the car into a drone and fly it.
          </p>
          <a className="btn btn-primary" href="#/city">Visit the planet →</a>
          <p className="note">Needs WebGL. Best on a laptop with a keyboard.</p>
        </div>
        <PlanetArt />
      </div>
    </section>
  );
}

/** Wraps one half of the page in its hemisphere's palette, with a marker. */
export function Hemisphere({ side, children }) {
  const label = side === "north" ? "Northern hemisphere · résumé" : "Southern hemisphere · open source";
  return (
    <div className={`hemisphere hemisphere-${side}`}>
      <div className="container">
        <p className="hemisphere-marker" aria-hidden="true">
          <span>{side === "north" ? "N" : "S"}</span>
          {label}
        </p>
      </div>
      {children}
    </div>
  );
}

export function OpenSource() {
  return (
    <section id="open-source">
      <div className="container">
        <p className="section-label">Open source</p>
        <h2>
          <span className="prompt" aria-hidden="true">~/github $ </span>Side projects
        </h2>
        <p className="section-intro">
          Mostly from my robotics-club and fellowship years: Arduino bots, air-quality sensors and
          early ML experiments.
        </p>
        <div className="card-grid">
          {featured.map((p) => (
            <ProjectCard key={p.name} project={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function ProjectIndex() {
  const [filter, setFilter] = useState(null);
  const shown = filter ? projects.filter((p) => p.language === filter) : projects;
  return (
    <section id="all-projects" style={{ paddingTop: 0 }}>
      <div className="container">
        <h3 className="subheading">All repositories</h3>
        <div className="filters" role="group" aria-label="Filter by language">
          <button className="chip" aria-pressed={filter === null} onClick={() => setFilter(null)}>
            All<span className="count">{projects.length}</span>
          </button>
          {languageGroups.map(({ language, projects: list }) => (
            <button
              key={language}
              className="chip"
              aria-pressed={filter === language}
              onClick={() => setFilter(language)}
            >
              {language}
              <span className="count">{list.length}</span>
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
      </div>
    </section>
  );
}

export function Background() {
  const catdox = caseStudies.find((c) => c.id === "catdox");
  return (
    <section id="background">
      <div className="container">
        <p className="section-label">Background</p>
        <h2>Education, writing &amp; community</h2>
        <div className="background-grid">
          {background.map((b) => (
            <article className="bg-card" key={b.id}>
              <span className={`bg-kind kind-${b.kind.toLowerCase()}`}>{b.kind}</span>
              <h3>{b.title}</h3>
              <p className="role-org">{b.org}</p>
              <span className="period">{formatPeriod(b.start, b.end)}</span>
              {b.highlights?.map((h) => (
                <p key={h} className="bg-text">
                  {h}
                </p>
              ))}
            </article>
          ))}
          {catdox && (
            <article className="bg-card">
              <span className="bg-kind kind-award">Award</span>
              <h3>{catdox.title}</h3>
              <p className="role-org">{catdox.org}</p>
              <p className="bg-text">
                Recognised in the &ldquo;extremely useful&rdquo; category for a Nepali/English document
                extraction pipeline. <a href="#case-catdox">See the case study</a>.
              </p>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}

export function Contact() {
  return (
    <section id="contact">
      <div className="container">
        <p className="section-label">Contact</p>
        <h2>Let&rsquo;s talk</h2>
        <p className="prose" style={{ color: "var(--muted)" }}>
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
