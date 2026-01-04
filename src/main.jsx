import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

function showErrorOnPage(label, err) {
  const msg = err?.stack || err?.message || String(err);
  document.body.innerHTML =
    "<div style='padding:16px;font-family:ui-monospace,Menlo,monospace;white-space:pre-wrap;color:#b00020'>" +
    label + "\n\n" + msg +
    "</div>";
}

window.addEventListener("error", (e) => {
  showErrorOnPage("Runtime error", e?.error || e?.message || e);
});

window.addEventListener("unhandledrejection", (e) => {
  showErrorOnPage("Unhandled promise rejection", e?.reason || e);
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
  showErrorOnPage("Startup error", e);
}
