// src/components/Layout.jsx
import React from "react";

export default function Layout({ children }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: "#ffffff", // white background around Canvas
      }}
    >
      <main style={{ flexGrow: 1 }}>{children}</main>
      <footer
        style={{
          background: "#edf2f7", // very light gray
          color: "#4a5568",
          textAlign: "center",
          padding: "12px 0",
        }}
      >
        © {new Date().getFullYear()} Susan Ghimire. Built with Vite & Three.js.
      </footer>
    </div>
  );
}
