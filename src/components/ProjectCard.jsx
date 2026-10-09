// src/components/ProjectCard.jsx
import React from "react";
import { languageColor } from "../data";

export function Stars({ count }) {
  if (!count) return null;
  return (
    <span className="stars" aria-label={`${count} stars`}>
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
      </svg>
      {count}
    </span>
  );
}

export function LanguageDot({ language }) {
  return (
    <span className="lang-dot" style={{ "--dot": languageColor(language) }}>
      {language}
    </span>
  );
}

export default function ProjectCard({ project }) {
  return (
    <article className="tile card">
      {project.image && (
        <img className="card-image" src={`${import.meta.env.BASE_URL}${project.image}`} alt="" loading="lazy" />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <LanguageDot language={project.language} />
        <Stars count={project.stars} />
      </div>
      <h3 className="card-title">{project.title}</h3>
      <p className="card-desc">{project.description || "No description yet."}</p>
      <div className="card-footer">
        <div className="card-links">
          <a href={project.url} target="_blank" rel="noopener noreferrer">
            Source ↗
          </a>
          {project.demo && (
            <a href={project.demo} target="_blank" rel="noopener noreferrer">
              Live demo ↗
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
