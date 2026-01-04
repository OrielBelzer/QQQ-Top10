import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

function fmt(x) {
  try {
    if (x instanceof Error) return `${x.name}: ${x.message}\n\n${x.stack || ""}`;
    if (typeof x === "string") return x;
    return JSON.stringify(x, Object.getOwnPropertyNames(x), 2);
  } catch {
    return String(x);
  }
}

function show(label, details) {
  const html = `
<div style="padding:16px;font-family:ui-monospace,Menlo,monospace;white-space:pre-wrap;color:#b00020">
${label}

${details}
</div>`;
  document.body.innerHTML = html;
}

window.addEventListener("error", (e) => {
  // Safari sometimes gives an ErrorEvent without e.error populated
  const parts = [
    `message: ${e?.message || ""}`,
    `source: ${e?.filename || ""}:${e?.lineno || ""}:${e?.colno || ""}`,
    "",
    "error:",
    fmt(e?.error || e)
  ].join("\n");
  show("Runtime error", parts);
});

window.addEventListener("unhandledrejection", (e) => {
  const parts = [
    "reason:",
    fmt(e?.reason || e)
  ].join("\n");
  show("Unhandled promise rejection", parts);
});

try {
  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("Missing #root element in index.html");
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (e) {
  show("Startup error", fmt(e));
}
