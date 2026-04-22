import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";

import { App } from "./App";
import "./styles.css";

if (import.meta.env.PROD) {
  registerSW({ immediate: true });
} else {
  // Dev safeguard: clean stale SW/caches so local clients don't diverge.
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => undefined);
  }

  if ("caches" in window) {
    void caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => undefined);
  }
}

const rootElement = document.querySelector<HTMLDivElement>("#app");

if (!rootElement) {
  throw new Error("#app container not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);