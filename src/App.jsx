// src/App.jsx
import React from "react";
import { Canvas } from "@react-three/fiber";
import Layout from "./components/Layout";
import ProjectGallery3D from "./components/ProjectGallery3D";
import useGitHubRepos from "./hooks/useGitHubRepos";

export default function App() {
  const username = "whatiskeptiname";
  const { groupedRepos, loading, error } = useGitHubRepos(username);

  if (loading) {
    return <Layout><div>Loading…</div></Layout>;
  }
  if (error || !groupedRepos) {
    return <Layout><div>Error: {error?.message ?? "No repos"}</div></Layout>;
  }

  return (
    <Layout>
      <Canvas
        camera={{ position: [0, 12, 30], fov: 60 }}
        style={{ width: "100%", height: "100vh", background: "#e0f7fa" }}
      >
        <ProjectGallery3D reposByLanguage={groupedRepos} />
      </Canvas>
    </Layout>
  );
}
