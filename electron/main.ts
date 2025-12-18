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
import { ChildProcess, execSync } from 'child_process';
import { app, BrowserWindow, ipcMain, protocol, session, shell } from 'electron';
import fs from 'fs';
import net, { AddressInfo } from 'net';
import path from 'path';

let nextProcess: ChildProcess | undefined;
let serverPort: number | undefined;
let mainWindow: BrowserWindow | null = null;

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
process.env['ELECTRON_ENABLE_LOGGING'] = 'true';

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

const mode = app.isPackaged
  ? 'packaged'
  : process.env.NODE_ENV === 'production'
    ? 'production'
    : 'development';
const isDev = mode === 'development' && !app.isPackaged;

const enableHttps = true; // Set to true to enable HTTPS

const appPath = app.getAppPath();

if (app.isPackaged)
  fs.readdir(appPath, (err, files) => {
    if (err) {
      console.error('Error reading directory:', err);
      return;
    }
    console.log('Directory contents:', files); // 'files' is an array of filenames and directory names
  });

let watcher: fs.FSWatcher | null = null;

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'http',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
    },
  },
  {
    scheme: 'https',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
    },
  },
]);

let stopIntercept: (() => void) | null = null;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// eslint-disable-next-line @typescript-eslint/no-require-imports
if (require('electron-squirrel-startup')) {
  app.quit();
}

/**
 * Gets an available port by trying to listen on port 0.
 */
function getAvailablePort(): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    // const net = require("net");
    const server = net.createServer();
    server.unref(); // Don't prevent the Node.js process from exiting
    server.on('error', reject);
    server.listen(0, () => {
      const port = (server.address() as AddressInfo)?.port;
      server.close(() => {
        resolve(port);
      });
    });
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      nodeIntegrationInWorker: true,
      contextIsolation: true,
      devTools: isDev,
    },
  });

  const { createHandler } = await import('./next-electron.js');
  if (isDev) {
    watcher = fs.watch(path.join(appPath, 'src'), { recursive: true });
    watcher.on('change', (eventType, filename) => {
      console.log(`File changed: src/${filename}, event type: ${eventType}`);
      mainWindow?.reload();
    });
    try {
      // 2. Find an available port
      serverPort = await getAvailablePort();

      const { createInterceptor, url } = await createHandler({
        dev: isDev,
        dir: path.resolve(appPath),
        protocol,
        debug: false,
        port: serverPort,
        turbopack: true, // optional
        mode,
        https: enableHttps,
      });

      stopIntercept = await createInterceptor({
        session: mainWindow.webContents.session,
      });
      console.log(`Starting Next.js server internally on: ${url}`);

      // 3. Set the PORT environment variable for the script to use
      process.env.PORT = serverPort?.toString() ?? '0';

      // 4. Wait for the server to be ready before creating the window
      await app.whenReady();
      // await checkServerStatus(url);

      await mainWindow.loadURL(url + '/');

      console.log(`\x1b[36m[MAIN] Loaded app://::1:${serverPort?.toString() ?? 0}\x1b[0m`);
    } catch (e) {
      console.error('Failed to run Next.js Development Server:', e);
      app.quit();
      return;
    }
  } else {
    try {
      // 2. Find an available port
      serverPort = await getAvailablePort();

      const { createInterceptor, url } = await createHandler({
        dev: isDev,
        dir: path.resolve(appPath),
        protocol,
        debug: true,
        port: serverPort,
        turbopack: true, // optional
        mode,
        https: enableHttps,
      });

      stopIntercept = await createInterceptor({
        session: mainWindow.webContents.session,
      });
      console.log(`Starting Next.js server internally on: ${url}`);

      // 3. Set the PORT environment variable for the script to use
      process.env.PORT = serverPort?.toString() ?? '0';

      // 4. Wait for the server to be ready before creating the window
      await app.whenReady();
      // await checkServerStatus(url);

      await mainWindow.loadURL(url + '/');

      console.log('[APP] Loaded', url);
    } catch (e) {
      console.error('Failed to run Next.js Development Server:', e);
      app.quit();
      return;
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    watcher?.close();
    stopIntercept?.();
  });
}

// Prepare the app
app.whenReady().then(async () => {
  console.log('\x1b[36m[MAIN] Application ready!\x1b[0m');

  if (enableHttps) {
    console.log('\x1b[32m[MAIN] HTTPS is enabled\x1b[0m');
    const certDir = path.join(appPath, 'certificates');
    const keyPath = path.join(certDir, 'localhost-key.pem');
    const certPath = path.join(certDir, 'localhost.pem');

    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir);
    }

    if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
      console.log('Certificates not found. Generating self-signed certificates...');
      try {
        // Requires mkcert to be installed on the system
        execSync(`mkcert -install`, { stdio: 'inherit' });
        execSync(`mkcert -key-file ${keyPath} -cert-file ${certPath} localhost 127.0.0.1 ::1`, {
          stdio: 'inherit',
        });
        console.log('Certificates generated successfully.');
      } catch (error) {
        console.error(
          'Failed to generate certificates. Ensure mkcert is installed and in your PATH.'
        );
        process.exit(1);
      }
    }

    app.commandLine.appendSwitch('ignore-certificate-errors');
    app.commandLine.appendSwitch('enable-features', 'NetworkService,NetworkServiceInProcess');
    app.commandLine.appendSwitch('cert-server', 'localhost');
    app.commandLine.appendSwitch('cert-key', fs.readFileSync(keyPath).toString());
    app.commandLine.appendSwitch('cert-cert', fs.readFileSync(certPath).toString());
    app.commandLine.appendSwitch('enable-https');

    console.log('\x1b[32m[MAIN] SSL Certificates setup completed\x1b[0m');
  }

  console.log('\x1b[33m[MAIN] Registering IPC handlers...\x1b[0m');

  // 1. Handler for Ping
  ipcMain.handle('ping', () => {
    console.log('\x1b[36m[IPC] Ping received and responding with "pong".\x1b[0m');
    return 'pong';
  });

  // 2. Handler for getAppInfo (CRITICAL FIX for system info)
  ipcMain.handle('get-app-info', () => {
    console.log('\x1b[36m[IPC] Handling get-app-info request.\x1b[0m');
    return {
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      appVersion: app.getVersion(),
    };
  });

  // 3. Handler for beep (CRITICAL FIX for beep sound)
  ipcMain.handle('beep-sound', () => {
    console.log('\x1b[36m[IPC] Triggering system beep.\x1b[0m');
    shell.beep(); // Use the Electron shell API
    // No return value (void) but the promise resolves successfully
  });

  console.log('\x1b[32m[MAIN] IPC handlers registered\x1b[0m');
  if (isDev) {
    console.log('\x1b[33m[MAIN] Installing DevTools extensions...\x1b[0m');
    const extensions = [
      {
        id: 'REACT_DEVELOPER_TOOLS',
        name: 'React Developer Tools',
        path: path.join(app.getAppPath(), 'extensions', 'react-devtools'),
      },
      {
        id: 'REDUX_DEVTOOLS',
        name: 'Redux DevTools',
        path: path.join(app.getAppPath(), 'extensions', 'redux-devtools'),
      },
    ];
    for (const pack of extensions) {
      try {
        await session.defaultSession.extensions.loadExtension(pack.path, {
          allowFileAccess: true,
        });
        console.log(`\x1b[32m[MAIN] Installed Extension: ${pack.name}\x1b[0m`);
      } catch (err) {
        console.error(`\x1b[31m[MAIN] Failed to install extension: ${pack.name}\x1b[0m`, err);
      }
    }
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

if (!isDev)
  app.on('before-quit', () => {
    if (nextProcess) {
      nextProcess.kill();
    }
  });
