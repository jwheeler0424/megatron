/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />
declare global {
  interface Window {
    api?: {
      ping: () => Promise<string>;
      getAppInfo: () => Promise<AppInfo>; // New function signature
      beep: () => Promise<void>; // New function signature
      // add others as you expose them
    };
  }
}
