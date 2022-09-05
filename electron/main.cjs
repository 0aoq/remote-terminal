const { app, BrowserWindow, session } = require("electron");
const cm = require("electron-context-menu");
const { exec } = require("child_process");
const path = require("node:path");
const fs = require("node:fs");

if (!fs.existsSync(path.resolve(__dirname, "extensions")))
    fs.mkdirSync(path.resolve(__dirname, "extensions"));

let childprocess;

let win = null;
function createWindow() {
    // create window
    cm({
        showSearchWithGoogle: false,
        showInspectElement: false,
    });

    const window = new BrowserWindow({
        width: 667, // 80 columns
        height: 457, // 25 rows
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    win = window;

    // start backend
    childprocess = exec(
        `cd ${path.resolve(__dirname, "../")} && node backend/server.js`,
        (error, stdout, stdetrr) => {
            console.log(`\n${error}`);
            console.log(`\n${stdetrr}`);
            console.log(`\n${stdout}`);
        }
    );

    window.setMenuBarVisibility(false);

    console.log(
        "\x1b[1m\x1b[35m⬢ ~ \x1b[1m\x1b[32m Waiting for server...\x1b[0m"
    );

    // load extensions
    const getDirectories = (source) =>
        fs
            .readdirSync(source, { withFileTypes: true })
            .filter((dirent) => dirent.isDirectory())
            .map((dirent) => dirent.name);

    for (let dir of getDirectories(path.resolve(__dirname, "extensions"))) {
        console.log(
            `\x1b[1m\x1b[35m⬢ ~ \x1b[1m\x1b[32m Attempting to load extension! ${dir}\x1b[0m`
        );

        session.defaultSession.loadExtension(path.resolve(__dirname, "extensions", dir))
            .then(({ id }) => {
                console.log(
                    `\x1b[1m\x1b[35m⬢ ~ \x1b[1m\x1b[32m Extension loaded! ${id}\x1b[0m`
                );
            })
            .catch(console.error);
    }

    // load page
    setTimeout(() => {
        // give the server some time to load
        console.log("\x1b[1m\x1b[35m⬢ ~ \x1b[1m\x1b[32m Client loaded!\x1b[0m");

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

    console.log("\x1b[1m\x1b[35m⬢ ~ \x1b[1m\x1b[32m Goodbye for now!\x1b[0m");

    childprocess.kill();
});
