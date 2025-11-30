const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 980,
    height: 660,
    minWidth: 700,
    minHeight: 420,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile('index.html');
  // Open devtools if env var set
  if (process.env.ELECTRON_DEVTOOLS === '1') win.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Expose "open file dialog" via IPC
ipcMain.handle('dialog:openFiles', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (result.canceled) return [];
  return result.filePaths;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

