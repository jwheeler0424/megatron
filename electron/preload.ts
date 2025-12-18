import { contextBridge, ipcRenderer } from 'electron';

// Define the structure for the application info object
export type AppInfo = {
  nodeVersion: string;
  electronVersion: string;
  appVersion: string;
};

// Define the complete API structure for type safety
export type Api = {
  ping: () => Promise<string>;
  getAppInfo: () => Promise<AppInfo>; // New function signature
  beep: () => Promise<void>; // New function signature
};

const api: Api = {
  // Existing function
  ping: () => ipcRenderer.invoke('ping'),

  // New function to fetch system info
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // New function to trigger a system beep
  beep: () => ipcRenderer.invoke('beep-sound'),
};

// Expose the API globally to the renderer process
contextBridge.exposeInMainWorld('api', api);

const IGNORED_STRINGS = ['Image with src', 'Fetch', 'Download the React DevTools'];
const origInfo = window.console.info;
window.console.info = function (...args) {
  if (!IGNORED_STRINGS.some((str) => args[0] && args[0].includes(str))) {
    origInfo.apply(window.console, args);
  }
};
