/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `yarn build` or `yarn build-main`, this file is compiled to
 * `./src/main.prod.js` using webpack. This gives us some performance wins.
 *
 * OAuth support based on file GitHub Desktop src file main.ts
 * See https://github.com/desktop/desktop/blob/development/app/src/main-process/main.ts
 */
import * as URL from 'url';
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import path from 'path';
import { app, BrowserWindow, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { parseAppURL } from './parse-app-url';

require('dotenv').config();

const { SCHEME_NAME } = process.env; // https://stackoverflow.com/a/54661242/64904
const DARWIN = process.platform === 'darwin';
const WIN32 = process.platform === 'win32';
// const LINUX  = process.platform === 'linux';
/** Extra argument for the protocol launcher on Windows */
const protocolLauncherArg = '--protocol-launcher';
const possibleProtocols = new Set([SCHEME_NAME]);

export default class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

/**
 * Handle the url sent to this application
 * @param url the incoming url argument
 */
function handleAppURL(url: string) {
  // log.info('Processing protocol url');
  const action = parseAppURL(url);
  // This manual focus call _shouldn't_ be necessary, but is for Chrome on
  // macOS. See https://github.com/desktop/desktop/issues/973.
  // log.info(`Sending action!\n${JSON.stringify(action, null, 4)}`);
  if (mainWindow) {
    mainWindow.focus();
    mainWindow.show();
    mainWindow.webContents.send('url-action', action);
  }
}

/**
 * Attempt to detect and handle any protocol handler arguments passed
 * either via the command line directly to the current process or through
 * IPC from a duplicate instance (see makeSingleInstance)
 *
 * @param args Essentially process.argv, i.e. the first element is the exec
 *             path
 */
function handlePossibleProtocolLauncherArgs(args: ReadonlyArray<string>) {
  log.info(`Received possible protocol arguments: ${args.length}`);

  if (WIN32) {
    // Desktop registers it's protocol handler callback on Windows as
    // `[executable path] --protocol-launcher "%1"`. Note that extra command
    // line arguments might be added by Chromium
    // (https://electronjs.org/docs/api/app#event-second-instance).
    // At launch Desktop checks for that exact scenario here before doing any
    // processing. If there's more than one matching url argument because of a
    // malformed or untrusted url then we bail out.
    const matchingUrls = args.filter((arg) => {
      // sometimes `URL.parse` throws an error
      try {
        const url = URL.parse(arg);
        // i think this `slice` is just removing a trailing `:`
        return url.protocol && possibleProtocols.has(url.protocol.slice(0, -1));
      } catch (e) {
        log.error(`Unable to parse argument as URL: ${arg}`);
        return false;
      }
    });

    if (args.includes(protocolLauncherArg) && matchingUrls.length === 1) {
      handleAppURL(matchingUrls[0]);
    } else {
      log.error(`Malformed launch arguments received: ${args}`);
    }
  } else if (args.length > 1) {
    handleAppURL(args[1]);
  }
}

/**
 * Wrapper around app.setAsDefaultProtocolClient that adds our
 * custom prefix command line switches on Windows.
 */
function setAsDefaultProtocolClient(protocol: string | undefined) {
  if (!protocol) {
    return;
  }
  if (WIN32) {
    app.setAsDefaultProtocolClient(protocol, process.execPath, [
      protocolLauncherArg,
    ]);
  } else {
    app.setAsDefaultProtocolClient(protocol);
  }
}

if (process.env.NODE_ENV === 'production') {
  // eslint-disable-next-line global-require
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

if (
  process.env.NODE_ENV === 'development' ||
  process.env.DEBUG_PROD === 'true'
) {
  // eslint-disable-next-line global-require
  require('electron-debug')();
}

const installExtensions = async () => {
  // eslint-disable-next-line global-require
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload
      // eslint-disable-next-line
    ).catch(console.log);
};

const createWindow = async () => {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  ) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'resources')
    : path.join(__dirname, '../resources');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      nodeIntegration: true,
    },
  });

  mainWindow.loadURL(`file://${__dirname}/index.html`);

  // @TODO: Use 'ready-to-show' event
  //        https://github.com/electron/electron/blob/master/docs/api/browser-window.md#using-ready-to-show-event
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.on('new-window', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line no-new
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) createWindow();
});

if (DARWIN) {
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleAppURL(url);
  });
} else if (WIN32 && process.argv.length > 1) {
  handlePossibleProtocolLauncherArgs(process.argv);
}

app.on('ready', () => {
  possibleProtocols.forEach((protocol) => setAsDefaultProtocolClient(protocol));
});

// eslint-disable-next-line no-console
app.whenReady().then(createWindow).catch(console.log);
