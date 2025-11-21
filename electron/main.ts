/* eslint-disable @typescript-eslint/no-explicit-any */
import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fork } from "child_process";
import fs from "fs";
import http from "http";

const isDev = process.env.NODE_ENV !== "production" && !app.isPackaged;
const NEXT_PORT = process.env.NEXT_PORT || "3000";
let nextProcess: any = null;
let mainWindow: BrowserWindow | null = null;

function waitForServer(
  port: string | number,
  timeoutMs = 15000
): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function check() {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: Number(port),
          path: "/",
          method: "HEAD",
          timeout: 2000,
        },
        (res) => {
          resolve();
        }
      );
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error("Timed out waiting for server"));
        } else {
          setTimeout(check, 250);
        }
      });
      req.on("timeout", () => {
        req.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error("Timed out waiting for server"));
        } else {
          setTimeout(check, 250);
        }
      });
      req.end();
    })();
  });
}

async function startNextStandalone() {
  if (isDev) return;

  // resolve packaged paths (this logic already exists in your doc)
  const resourcesPath = process.resourcesPath;
  const packagedNext = path.join(resourcesPath, "next", "standalone"); // we copy into dist-electron/next/standalone earlier
  const possiblePaths = [
    packagedNext,
    path.join(resourcesPath, "standalone"),
    path.join(process.execPath, "..", "next", "standalone"),
  ];

  let serverPath: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      serverPath = p;
      break;
    }
  }

  if (!serverPath) {
    console.error("Next standalone server not found. Tried:", possiblePaths);
    return;
  }

  const serverEntry = path.join(serverPath, "server.js");
  if (!fs.existsSync(serverEntry)) {
    console.error("Next server.js not found at", serverEntry);
    return;
  }

  nextProcess = fork(serverEntry, [], {
    env: { ...process.env, PORT: NEXT_PORT, NODE_ENV: "production" },
    cwd: serverPath,
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });

  nextProcess.stdout?.on?.("data", (d: Buffer) => {
    console.log("[next]", d.toString().trim());
  });
  nextProcess.stderr?.on?.("data", (d: Buffer) => {
    console.error("[next err]", d.toString().trim());
  });

  // wait until server responds before creating the window
  await waitForServer(NEXT_PORT, 20000);
}

async function createWindow(route = "/") {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  const url = `http://127.0.0.1:${NEXT_PORT}${route}`;

  await mainWindow.loadURL(url);
  mainWindow.webContents.on("did-start-loading", () => {
    console.log("Electron loading URL:", mainWindow?.webContents.getURL());
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  if (!isDev) {
    await startNextStandalone();
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // kill the next process if it exists
  if (nextProcess) {
    try {
      nextProcess.kill();
    } catch (e) {
      // passthrough
    }
  }

  if (process.platform !== "darwin") app.quit();
});

// Simple IPC example the renderer can call
ipcMain.handle("ping", async () => {
  return "pong from main";
});
