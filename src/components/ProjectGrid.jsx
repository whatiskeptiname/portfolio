// src/components/ProjectGrid.jsx
import React from "react";
import ProjectCard from "./ProjectCard";

export default function ProjectGrid({ repos }) {
  return (
    <div className="grid">
      {repos.map((repo) => (
        <ProjectCard key={repo.name} repo={repo} />
      ))}
    </div>
  );
}
