/**
 * PLAN:
 * Run two child processes for dev with Electron and Next.js
 * In production, use Next.js's standalone mode and point Electron to that build
 * using dynamic import and serve via a custom server while loading the standlone
 * files to the electron output folder. Also need to include the static files and
 * other scripts which have been created in this folder.
 *
 * STEP 1: Get the dev mode working with two processes
 *
 * STEP 2: Get the production mode working with standalone build
 *
 */
import { app, BrowserWindow, protocol } from "electron";
let mainWindow: BrowserWindow | null = null;

process.env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = "true";
process.env["ELECTRON_ENABLE_LOGGING"] = "true";

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));

const appPath = app.getAppPath();
const getDefaultMode = () =>
  app.isPackaged ? "production" : process.env.NODE_ENV;
const dev = process.env.NODE_ENV === "development";
const defaultMode = getDefaultMode();

let stopIntercept: (() => void) | null = null;

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 800,
    webPreferences: {
      contextIsolation: true, // protect against prototype pollution
      devTools: true,
    },
  });

  // ⬇ Next.js handler ⬇

  stopIntercept = null;
  // stopIntercept = await createInterceptor({ session: mainWindow.webContents.session });

  // ⬆ Next.js handler ⬆

  mainWindow.once("ready-to-show", () =>
    mainWindow?.webContents.openDevTools()
  );

  mainWindow.on("closed", () => {
    mainWindow = null;
    stopIntercept?.();
  });

  // Menu.setApplicationMenu(Menu.buildFromTemplate(defaultMenu(app, shell)));

  // // Should be last, after all listeners and menu

  // await app.whenReady();

  // await mainWindow.loadURL(localhostUrl + '/');

  // console.log('[APP] Loaded', localhostUrl);
  console.log({ dev, defaultMode });
};

app.on("ready", createWindow);

app.on("window-all-closed", () => app.quit()); // (process.platform !== 'darwin') &&

app.on(
  "activate",
  () =>
    BrowserWindow.getAllWindows().length === 0 && !mainWindow && createWindow()
);
