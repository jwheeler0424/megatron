/* eslint-disable @typescript-eslint/no-require-imports */
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
import { app, BrowserWindow, protocol, net, ipcMain, shell } from "electron";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import { ServerResponse } from "http";

let nextProcess: ChildProcess | undefined;
let serverPort: number | undefined;
let mainWindow: BrowserWindow | null = null;

const isProduction = app.isPackaged || process.env.NODE_ENV === "production";
const isDev = !isProduction;
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

/**
 * Utility function to handle exponential backoff for checking the server status.
 * This is still useful as the internal Next.js server takes a moment to start listening.
 */
function checkServerStatus(url: string, maxRetries = 10, delay = 1000) {
  return new Promise((resolve, reject) => {
    const attempt = (retryCount: number) => {
      // Note: Since 'fetch' is not available in the main process globally,
      // we use Node's built-in 'http' module for this check.
      const http = require("http");
      http
        .get(url, (response: ServerResponse) => {
          if (response.statusCode === 200) {
            resolve(true);
          } else {
            reject(
              new Error(
                `Server responded with status code ${response.statusCode}`
              )
            );
          }
        })
        .on("error", (error: Error) => {
          if (retryCount > 0) {
            console.log(
              `Server not ready, retrying in ${delay}ms... (${retryCount} attempts left)`
            );
            setTimeout(() => attempt(retryCount - 1), delay);
          } else {
            reject(
              new Error(
                "Next.js server failed to start or respond within the timeout."
              )
            );
          }
        });
    };
    attempt(maxRetries);
  });
}

/**
 * Starts the Next.js standalone server by requiring it directly into the Electron process.
 * This avoids the need to 'spawn' the 'node' executable, resolving packaging errors.
 */
async function startNextServer() {
  // 1. Determine the correct path to the server.js file
  const scriptPath = app.isPackaged
    ? path.join(__dirname, "..","standalone", "server.js") // FIXED: Use relative path for ASAR compatibility
    : path.join(".next", "standalone", "server.js");

  console.log("Starting Next.js server from:", scriptPath);

  // 2. Find an available port
  serverPort = await getAvailablePort();
  const url = `http://localhost:${serverPort}`;

  console.log(`Starting Next.js server internally on: ${url}`);
  console.log(`Loading script from: ${scriptPath}`);

  // 3. Set the PORT environment variable for the script to use
  process.env.PORT = serverPort?.toString() ?? "0";

  try {
    // 4. Require the Next.js server script directly
    // This executes the script inside the current Electron main process.
    require(scriptPath);
  } catch (e) {
    console.error("Failed to run Next.js server script:", e);
    app.quit();
    return;
  }

  // 5. Wait for the server to be ready before creating the window
  await checkServerStatus(url);

  return url;
}

/**
 * Gets an available port by trying to listen on port 0.
 */
function getAvailablePort(): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    const net = require("net");
    const server = net.createServer();
    server.unref(); // Don't prevent the Node.js process from exiting
    server.on("error", reject);
    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => {
        resolve(port);
      });
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: isDev,
    },
  });

  if (isDev) {
    // PHASE 1: DEV MODE
    // In dev, we just load the Next.js dev server directly.
    // Next.js handles HMR and everything else.
    console.log("Running in development mode: Loading localhost:3000");
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    // Start the Next.js server and navigate the window once it's ready
    startNextServer()
      .then((url) => {
        mainWindow?.loadURL(url as string);

        // Open DevTools automatically if not packaged
        if (!app.isPackaged) {
          mainWindow?.webContents.openDevTools();
        }
      })
      .catch((err) => {
        console.error(
          "FATAL ERROR: Could not start application server.",
          err.message
        );
        app.quit();
      });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Prepare the app
app.whenReady().then(async () => {
  console.log(
    "Main Process: app.whenReady() executed. Registering IPC handlers..."
  );

  // 1. Handler for Ping
  ipcMain.handle("ping", () => {
    console.log('Main Process: Ping received and responding with "pong".');
    return "pong";
  });

  // 2. Handler for getAppInfo (CRITICAL FIX for system info)
  ipcMain.handle("get-app-info", () => {
    console.log("Main Process: Handling get-app-info request.");
    return {
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      appVersion: app.getVersion(),
    };
  });

  // 3. Handler for beep (CRITICAL FIX for beep sound)
  ipcMain.handle("beep-sound", () => {
    console.log("Main Process: Triggering system beep.");
    shell.beep(); // Use the Electron shell API
    // No return value (void) but the promise resolves successfully
  });

  if (!isDev) {
    // 1. Register the custom protocol 'app'
    // This allows the renderer to load resources using 'app://' without exposing the port.
    protocol.handle("app", async (request) => {
      const url = request.url.replace(
        "app://",
        `http://localhost:${serverPort}/`
      );

      // Use the net module to fetch the content from the actual Next.js server.
      return net.fetch(url);
    });
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

if (!isDev)
  app.on("before-quit", () => {
    if (nextProcess) {
      nextProcess.kill();
    }
  });
