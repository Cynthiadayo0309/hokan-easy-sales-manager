const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');

async function render() {
  const projectRoot = path.resolve(__dirname, '..');
  const sourcePath = path.join(
    projectRoot,
    'docs',
    'demo',
    '訪看かんたん売上管理_紹介資料.html'
  );
  const outputPath = path.join(
    projectRoot,
    'docs',
    'demo',
    '訪看かんたん売上管理_紹介資料.pdf'
  );

  const window = new BrowserWindow({
    show: false,
    width: 1600,
    height: 1100,
    backgroundColor: '#f5f7f8',
    webPreferences: {
      sandbox: true,
      contextIsolation: true
    }
  });

  await window.loadFile(sourcePath);
  await window.webContents.executeJavaScript(
    'document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true'
  );

  const pageCount = await window.webContents.executeJavaScript(
    'document.querySelectorAll(".slide").length'
  );

  const previewDirectory = path.join(app.getPath('temp'), 'hokan-demo-material-preview');
  fs.mkdirSync(previewDirectory, { recursive: true });
  const previewPages = Array.from({ length: pageCount }, (_, index) => index + 1);
  const previewPaths = [];

  for (const pageNumber of previewPages) {
    const bounds = await window.webContents.executeJavaScript(`(() => {
      const slide = document.querySelectorAll('.slide')[${pageNumber - 1}];
      slide.scrollIntoView({ block: 'start' });
      const rect = slide.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 80));
    const image = await window.webContents.capturePage(bounds);
    const previewPath = path.join(
      previewDirectory,
      `page-${String(pageNumber).padStart(2, '0')}.png`
    );
    fs.writeFileSync(previewPath, image.toPNG());
    previewPaths.push(previewPath);
  }

  const pdf = await window.webContents.printToPDF({
    printBackground: true,
    landscape: true,
    pageSize: 'A4',
    preferCSSPageSize: true,
    margins: { marginType: 'none' }
  });

  fs.writeFileSync(outputPath, pdf);
  process.stdout.write(
    JSON.stringify({ outputPath, pageCount, bytes: pdf.length, previewPaths }, null, 2) + '\n'
  );
  window.destroy();
  app.quit();
}

app.whenReady().then(render).catch((error) => {
  process.stderr.write(String(error && error.stack ? error.stack : error) + '\n');
  app.exit(1);
});
