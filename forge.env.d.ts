/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />
declare global {
  interface Window {
    api?: {
      ping: () => Promise<string>;
      createWindow?: (route: string) => Promise<{ id: number }>;
      // add others as you expose them
    };
  }
}