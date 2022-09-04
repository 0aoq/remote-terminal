const { app, BrowserWindow } = require("electron");
const { exec } = require("child_process");
const path = require("node:path");
const url = require("node:url");

let childprocess;

function createWindow() {
    // Create the browser window.
    const window = new BrowserWindow({
        width: 667, // 80 columns
        height: 457, // 25 rows
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    // start backend
    childprocess = exec(
        `cd ${path.resolve(__dirname, "../")} && node backend/server.js`,
        (error, stdout, stderr) => {
            console.log(`\n${error}`);
            console.log(`\n${stderr}`);
            console.log(`\n${stdout}`);
        }
    );

    window.setMenuBarVisibility(false);

    console.log(
        "\x1b[1m\x1b[35m⬢ ~ \x1b[1m\x1b[32m Waiting for server...\x1b[0m"
    );

    setTimeout(() => {
        // give the server some time to load
        console.log(
            "\x1b[1m\x1b[35m⬢ ~ \x1b[1m\x1b[32m Client loaded!\x1b[0m"
        );

        window.loadURL("http://localhost:3057/?electron");
    }, 150);
}

app.whenReady().then(() => {
    createWindow();

    app.on("activate", function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", function () {
    if (process.platform !== "darwin") app.quit();

    console.log(
        "\x1b[1m\x1b[35m⬢ ~ \x1b[1m\x1b[32m Windows closed, terminating server process.\x1b[0m"
    );

    console.log(
        "\x1b[1m\x1b[35m⬢ ~ \x1b[1m\x1b[32m Goodbye for now!\x1b[0m"
    );

    childprocess.kill();
});
