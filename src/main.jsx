// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// The fonts are served from this site, not Google Fonts, so opening a page tells
// no one else about the visit.
import "@fontsource-variable/fraunces/standard.css";
import "@fontsource-variable/schibsted-grotesk";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
