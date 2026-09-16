const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const { openStore } = require("./database.cjs");
if (process.env.PHRASE_TEST_DATA)
  app.setPath("userData", process.env.PHRASE_TEST_DATA);
function windowOpen() {
  const win = new BrowserWindow({
    show: !process.env.PHRASE_TEST_DATA,
    width: 1360,
    height: 900,
    minWidth: 850,
    minHeight: 640,
    title: "Phrase",
    backgroundColor: "#f7f8fa",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.webContents.on("will-prevent-unload", (event) => {
    const choice = require("electron").dialog.showMessageBoxSync(win, {
      type: "question",
      buttons: ["編集に戻る", "保存せず終了"],
      defaultId: 0,
      cancelId: 0,
      message: "未保存の内容があります。",
      detail: "セットは保存ボタン、学習は「保存して終了」で保存できます。",
    });
    if (choice === 1) event.preventDefault();
  });
  win.loadFile(path.join(__dirname, "../dist/index.html"));
}
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else
  app
    .whenReady()
    .then(async () => {
      const store = await openStore(
        path.join(app.getPath("userData"), "phrase.sqlite"),
      );
      const check = (event) => {
        if (event.senderFrame !== event.sender.mainFrame)
          throw Error("Unauthorized frame");
      };
      ipcMain.handle("phrase:load", (event) => {
        check(event);
        return store.load();
      });
      ipcMain.handle("phrase:save", (event, json) => {
        check(event);
        return store.save(json);
      });
      windowOpen();
      app.on("second-instance", () => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
          if (win.isMinimized()) win.restore();
          win.show();
          win.focus();
        }
      });
      app.on("activate", () => {
        if (!BrowserWindow.getAllWindows().length) windowOpen();
      });
    })
    .catch((error) => {
      require("electron").dialog.showErrorBox(
        "Phraseを起動できません",
        String(error),
      );
      app.quit();
    });
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
