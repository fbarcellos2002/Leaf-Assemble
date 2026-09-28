"use client";

import { useEffect } from "react";

export function ClearSessionActivity() {
  useEffect(() => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("leaf-assemble:last-activity:")) {
        window.localStorage.removeItem(key);
      }
    }
  }, []);

  return null;
}
