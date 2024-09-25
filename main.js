const path = require('path');
const os = require('os');
const fs = require('fs');
const resizeImg = require('resize-img');
const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron');

const isMac = process.platform === 'darwin';
const isDev = process.env.NODE_ENV !== 'production';

let mainWindow;
// Create main window
function createMainWindow() {
  mainWindow = new BrowserWindow({
    title: 'Image Resizer',
    width: isDev ? 1000 : 500,
    height: 600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Open devtools if in dev env
  if (isDev) mainWindow.webContents.openDevTools();

  mainWindow.loadFile(path.join(__dirname, './renderer/index.html'));
}

// Create About window
function createAboutWindow() {
  const aboutWindow = new BrowserWindow({
    width: 300,
    height: 300,
    title: 'About Electron',
    icon: `${__dirname}/assets/icons/Icon_256x256.png`,
  });

  aboutWindow.setMenu(null); // Remove menu from about
  aboutWindow.loadFile(path.join(__dirname, './renderer/about.html'));
}

// Menu template
const menu = [
  ...(isMac
    ? [
        {
          label: app.name,
          submenu: [{ label: 'About', click: createAboutWindow }],
        },
      ]
    : []),
  {
    role: 'fileMenu',
  },
  ...(!isMac
    ? [
        {
          label: 'Help',
          submenu: [{ label: 'About', click: createAboutWindow }],
        },
      ]
    : []),
  ...(isDev
    ? [
        {
          label: 'Developer',
          submenu: [
            { role: 'reload' },
            { role: 'forcereload' },
            { type: 'separator' },
            { role: 'toggledevtools' },
          ],
        },
      ]
    : []),
];

// App is ready
app.whenReady().then(() => {
  createMainWindow();

  // Implement menu
  const mainMenu = Menu.buildFromTemplate(menu);
  Menu.setApplicationMenu(mainMenu);

  // Remove mainWindow from memory on close
  mainWindow.on('closed', () => (mainWindow = null));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// Respond to ipcRenderer resize
ipcMain.on('image:resize', (e, options) => {
  options.dest = path.join(os.homedir(), 'Pictures/imageresizer');
  console.log(options);
  resizeImage(options);
});

// Resize the image
async function resizeImage({ imgPath, width, height, dest }) {
  try {
    // On Linux, file.path might be null, so use dialog to get the file path if necessary
    if (!imgPath) {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Select Image File',
        properties: ['openFile'],
        filters: [
          { name: 'Images', extensions: ['jpg', 'png', 'gif', 'jpeg'] },
        ],
      });

      if (canceled || filePaths.length === 0) {
        event.reply('image:done', { error: 'No file selected' });
        return;
      }

      imgPath = filePaths[0];
    }

    const newPath = await resizeImg(fs.readFileSync(imgPath), {
      width: +width,
      height: +height,
    });

    // Create filename
    const filename = path.basename(imgPath);

    // Create dest folder if not exists
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }

    // Write file to dest
    fs.writeFileSync(path.join(dest, filename), newPath);

    // send success to render
    mainWindow.webContents.send('image:done');

    // Open dest folder
    shell.openPath(dest);
  } catch (error) {
    console.log(error);
  }
}

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});
