import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import isDev from 'electron-is-dev';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

let win: BrowserWindow | null;

function createWindow() {
    win = new BrowserWindow({
        width: 1280,
        height: 800,
        icon: path.join(process.env.VITE_PUBLIC, 'logo.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        title: 'Foundr - AI 导演助手',
        backgroundColor: '#0a0a0a',
    });

    // Test actively push message to the Electron-Renderer
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date()).toLocaleString());
    });

    if (isDev) {
        win.loadURL(process.env['VITE_DEV_SERVER_URL'] || 'http://localhost:5173');
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(process.env.DIST, 'index.html'));
    }

    // Make all links open with the browser, not with the application
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https:')) shell.openExternal(url);
        return { action: 'deny' };
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
        win = null;
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.whenReady().then(createWindow);
