import { ChildProcess, execSync } from 'child_process';
import chokidar from 'chokidar';
import { app, BrowserWindow, ipcMain, protocol, session, shell } from 'electron';
import fs from 'fs';
import net, { AddressInfo } from 'net';
import path from 'path';
import { logger } from './logger';
import { createHandler } from './next-electron';

let nextProcess: ChildProcess | undefined;
let serverPort: number | undefined;
let mainWindow: BrowserWindow | null = null;

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
process.env['ELECTRON_ENABLE_LOGGING'] = 'false';

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
process.on('warning', (w) => {
  if (w.name === 'ExtensionLoadWarning') return;
  console.warn(w);
});

const mode = app.isPackaged
  ? 'packaged'
  : process.env.NODE_ENV === 'production'
    ? 'production'
    : 'development';
const isDev = mode === 'development' && !app.isPackaged;

const enableHttps = true; // Set to true to enable HTTPS
const enableDebugger = false; //isDev;

app.commandLine.appendSwitch('enable-logging');
if (enableDebugger) {
  logger('MAIN', 'success', 'Debugger is enabled', 'info');
} else {
  logger('MAIN', 'disabled', 'Debugger is disabled', 'info');
  app.commandLine.appendSwitch('v', '-1');
  app.commandLine.appendSwitch('silent');
  app.commandLine.appendSwitch('disable-logging');
  app.commandLine.appendSwitch('no-warnings');
  const origEmitWarning = process.emitWarning;
  process.emitWarning = function (warning, ...args) {
    if (typeof warning === 'string' && warning.startsWith('Warning')) {
      return;
    }
    return origEmitWarning.call(process, warning);
  };
}
const appPath = app.getAppPath();

if (app.isPackaged)
  fs.readdir(appPath, (err, files) => {
    if (err) {
      console.error('Error reading directory:', err);
      return;
    }
    if (enableDebugger) console.log('Directory contents:', files); // 'files' is an array of filenames and directory names
  });

let watcher: fs.FSWatcher | null = null;

enableHttps
  ? protocol.registerSchemesAsPrivileged([
      {
        scheme: 'https',
        privileges: {
          standard: true,
          secure: true,
          supportFetchAPI: true,
          bypassCSP: true,
          stream: true,
        },
      },
      {
        scheme: 'http',
        privileges: {
          standard: true,
          secure: true,
          supportFetchAPI: true,
          bypassCSP: true,
          stream: true,
        },
      },
    ])
  : protocol.registerSchemesAsPrivileged([
      {
        scheme: 'http',
        privileges: {
          standard: true,
          secure: true,
          supportFetchAPI: true,
          bypassCSP: true,
          stream: true,
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

  // const { createHandler } = await import('./next-electron.js');
  if (isDev) {
    chokidar
      .watch(path.join(appPath, 'src'), { ignored: /database/, persistent: true })
      .on('change', (filePath) => {
        console.log(`\x1b[33m[WATCHER] File changed: ${filePath}\x1b[0m`);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.reload();
        }
      });

    try {
      // 2. Find an available port
      serverPort = await getAvailablePort();

      const { createInterceptor, url } = await createHandler({
        dev: isDev,
        dir: path.resolve(appPath),
        protocol,
        debug: enableDebugger,
        port: serverPort,
        turbopack: true, // optional
        mode,
        https: enableHttps,
      });

      stopIntercept = await createInterceptor({
        session: mainWindow.webContents.session,
      });
      logger('MAIN', 'default', `Starting Next.js server internally on: ${url}`, 'info');

      // 3. Set the PORT environment variable for the script to use
      process.env.PORT = serverPort?.toString() ?? '0';

      // 4. Wait for the server to be ready before creating the window
      await app.whenReady();
      // await checkServerStatus(url);

      await mainWindow.loadURL(url);

      logger('MAIN', 'default', `Loaded ${url}`, 'info');
    } catch (e) {
      logger('ERROR', 'error', 'Failed to run Next.js Development Server:', 'error');
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
        debug: enableDebugger,
        port: serverPort,
        turbopack: true, // optional
        mode,
        https: enableHttps,
      });

      stopIntercept = await createInterceptor({
        session: mainWindow.webContents.session,
      });
      logger('MAIN', 'info', `Starting Next.js server internally on: ${url}`, 'info');

      // 3. Set the PORT environment variable for the script to use
      process.env.PORT = serverPort?.toString() ?? '0';

      // 4. Wait for the server to be ready before creating the window
      await app.whenReady();
      // await checkServerStatus(url);

      await mainWindow.loadURL(url);

      logger('MAIN', 'info', `Loaded URL: ${url}`, 'info');
    } catch (e) {
      logger('ERROR', 'error', 'Failed to run Next.js Development Server:', 'error');
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
  logger('MAIN', 'info', 'Application ready!', 'info');

  if (enableHttps) {
    logger('MAIN', 'info', 'HTTPS is enabled', 'info');
    const certDir = path.join(appPath, 'certificates');
    const keyPath = path.join(certDir, 'localhost-key.pem');
    const certPath = path.join(certDir, 'localhost.pem');

    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir);
    }

    if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
      logger(
        'MAIN',
        'active',
        'Certificates not found. Generating self-signed certificates...',
        'info'
      );
      try {
        // Requires mkcert to be installed on the system
        execSync(`mkcert -install`, { stdio: 'inherit' });
        execSync(`mkcert -key-file ${keyPath} -cert-file ${certPath} localhost 127.0.0.1 ::1`, {
          stdio: 'inherit',
        });
        logger('MAIN', 'success', 'Certificates generated successfully.', 'info');
      } catch (error) {
        logger(
          'ERROR',
          'error',
          'Failed to generate certificates. Ensure mkcert is installed and in your PATH.',
          'error'
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

    logger('MAIN', 'success', 'SSL Certificates setup completed', 'info');
  }

  logger('MAIN', 'active', 'Registering IPC handlers...', 'info');

  // 1. Handler for Ping
  ipcMain.handle('ping', () => {
    logger('IPC', 'info', 'Ping received and responding with "pong".', 'info');
    return 'pong';
  });

  // 2. Handler for getAppInfo (CRITICAL FIX for system info)
  ipcMain.handle('get-app-info', () => {
    logger('IPC', 'info', 'Handling get-app-info request.', 'info');
    return {
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      appVersion: app.getVersion(),
    };
  });

  // 3. Handler for beep (CRITICAL FIX for beep sound)
  ipcMain.handle('beep-sound', () => {
    logger('IPC', 'info', 'Handling beep-sound request.', 'info');
    shell.beep(); // Use the Electron shell API
    // No return value (void) but the promise resolves successfully
  });

  logger('MAIN', 'success', 'IPC handlers registered successfully.', 'info');
  if (isDev && !app.isPackaged) {
    logger('MAIN', 'active', 'Installing DevTools extensions...', 'info');
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
        logger('MAIN', 'success', `Installed Extension: ${pack.name}`, 'info');
      } catch (err) {
        logger('ERROR', 'error', `Failed to install extension: ${pack.name}`, 'error');
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
