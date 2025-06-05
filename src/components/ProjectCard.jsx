// src/components/ProjectCard.jsx
import React from "react";

export default function ProjectCard({ repo }) {
  return (
    <div className="card">
      <div className="card-content">
        <h3 className="card-title">{repo.name}</h3>
        <p className="card-desc">
          {repo.description || "No description provided."}
        </p>
      </div>
      <div className="card-footer">
        <div className="star">
          <svg viewBox="0 0 20 20">
            <path d="M9.049 2.927C9.32 2.046 10.68 2.046 10.951 2.927l.745 2.272c.1.305.377.52.697.588l2.485.361c.853.124 1.197 1.171.578 1.77l-1.8 1.754c-.248.242-.359.597-.297.945l.425 2.479c.146.852-.75 1.498-1.51 1.098l-2.228-1.17a.993.993 0 00-.93 0l-2.228 1.17c-.759.4-1.655-.246-1.51-1.098l.425-2.479a1.003 1.003 0 00-.297-.945L2.544 7.918c-.619-.6-.275-1.646.578-1.77l2.485-.361a1.003 1.003 0 00.697-.588l.745-2.272z" />
          </svg>
          <span>{repo.stargazers_count}</span>
        </div>
        <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
          View on GitHub
        </a>
      </div>
    </div>
  );
}
