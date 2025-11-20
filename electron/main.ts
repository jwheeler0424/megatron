import path from "path";
import { app, BrowserWindow, Menu, protocol, session, shell } from "electron";
// import defaultMenu from 'electron-default-menu';
import { createHandler } from "./megatron";

let mainWindow: BrowserWindow | null = null;

process.env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = "true";
process.env["ELECTRON_ENABLE_LOGGING"] = "true";

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));

// ⬇ Next.js handler ⬇

// change to your path, make sure it's added to Electron Builder files
const appPath = app.getAppPath();
const dev = process.env.NODE_ENV === "development";
const dir = path.join(appPath, ".next", "standalone");
const NEXT_DEV_URL = "http://localhost:3000";

// ⬆ Next.js handler ⬆

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 800,
    webPreferences: {
      contextIsolation: true, // protect against prototype pollution
      // devTools: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Load the application based on the environment
  if (dev) {
    // ----------------------------------------------------
    // DEVELOPMENT: Load from Next.js HMR Server
    // ----------------------------------------------------
    console.log(`Loading Next.js from ${NEXT_DEV_URL}...`);
    mainWindow.loadURL(NEXT_DEV_URL);
    mainWindow.webContents.openDevTools(); // Enable DevTools for hot reloading visibility
  } else {
    // ----------------------------------------------------
    // PRODUCTION: Load from custom 'app://' protocol (Next Step P4)
    // ----------------------------------------------------

    const { createInterceptor, localhostUrl } = createHandler({
      dev,
      dir,
      protocol,
      debug: true,
      // ... and other Nex.js server options https://nextjs.org/docs/pages/building-your-application/configuring/custom-server
      turbo: true, // optional
    });

    let stopIntercept: Awaited<ReturnType<typeof createInterceptor>>;
    console.log(
      "Production mode detected. Initializing custom protocol handler..."
    );
    // We will implement the custom protocol logic here in the next step (P4)
    // For now, let's keep it simple:
    await mainWindow.loadURL(localhostUrl + "/");
    // ⬇ Next.js handler ⬇

    stopIntercept = await createInterceptor({
      session: mainWindow.webContents.session,
    });

    // ⬆ Next.js handler ⬆

    mainWindow.once("ready-to-show", () =>
      mainWindow?.webContents.openDevTools()
    );

    mainWindow.on("closed", () => {
      mainWindow = null;
      stopIntercept?.();
    });
    // Menu.setApplicationMenu(Menu.buildFromTemplate(defaultMenu(app, shell)));

    // Should be last, after all listeners and menu

    await app.whenReady();

    console.log("[APP] Loaded", localhostUrl);
  }
};

app.on("ready", createWindow);

app.on("window-all-closed", () => app.quit()); // (process.platform !== 'darwin') &&

app.on(
  "activate",
  () =>
    BrowserWindow.getAllWindows().length === 0 && !mainWindow && createWindow()
);
