import { useEffect, useState } from "react";
import { WebContainer } from "@webcontainer/api";

/** Singleton boot promise – WebContainer allows only one instance per page. */
let bootPromise: Promise<WebContainer> | null = null;

function getWebContainer(): Promise<WebContainer> {
  if (bootPromise) return bootPromise;
  bootPromise = WebContainer.boot();
  return bootPromise;
}

export function useWebContainer(): WebContainer | null {
  const [webcontainer, setWebcontainer] = useState<WebContainer | null>(null);

  useEffect(() => {
    getWebContainer()
      .then(setWebcontainer)
      .catch((error) => console.error("Failed to initialize WebContainer:", error));
  }, []);

  return webcontainer;
}