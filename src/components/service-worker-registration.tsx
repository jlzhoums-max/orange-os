"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") {
      return;
    }

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) {
        return;
      }

      refreshing = true;
      window.location.reload();
    });

    window.addEventListener("load", () => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((registration) => {
        void registration.update();
      });
    });
  }, []);

  return null;
}
