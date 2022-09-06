const {
    app,
    session,
    protocol,

    BrowserWindow,

    Menu,
    MenuItem,

    ipcMain,
} = require("electron");
const { exec } = require("child_process");
const path = require("node:path");
const fs = require("node:fs");

if (!fs.existsSync(path.resolve(__dirname, "extensions")))
    fs.mkdirSync(path.resolve(__dirname, "extensions"));

const fetch = (...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args));

let childprocess;

let win = null;
function createWindow() {
    // create window
    const window = new BrowserWindow({
        width: 667, // 80 columns
        height: 457, // 25 rows
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    win = window; // doing this will force browser autocomplete for window.

    // remote terminal transport protocol
    const registerRTS = (httpProtocol, rtsProtocol, request, callback) => {
        const url = request.url.split(`${rtsProtocol}://`)[1];

        request.url = `${httpProtocol}://${url}`;
        request.session = null;

        callback(request);
    };

    protocol.registerHttpProtocol("rts", (request, callback) => {
        let httpProtocol = "http";
        let rtsProtocol = "rts";

        registerRTS(httpProtocol, rtsProtocol, request, callback);
    });

    protocol.registerHttpProtocol("rtss", (request, callback) => {
        let httpProtocol = "https";
        let rtsProtocol = "rtss";

        registerRTS(httpProtocol, rtsProtocol, request, callback);
    });

    let unwantedHosts = ["doubleclick.net"];
    session.defaultSession.webRequest.onBeforeSendHeaders(
        (details, callback) => {
            if (unwantedHosts.includes(new URL(details.url).hostname)) {
                // stop unwanted host connections
                console.log(
                    `\x1b[1m\x1b[35m⬢ ~ \x1b[1m\x1b[31m Blocked connection to unwanted host! ${details.url}\x1b[0m`
                );

                callback({
                    cancel: true,
                });
            } else {
                // not ad
                details.requestHeaders["X-RT-TUNNEL-INTERCEPT-TIME"] =
                    new Date().toISOString();

                callback(details);
            }
        }
    );

    // create menu
    const menu = [
        { role: "fileMenu" },
        { role: "editMenu" },
        {
            label: "Window",
            submenu: [
                { role: "minimize" },
                { role: "zoom" },
                { role: "reload" },
                { role: "forceReload" },
            ],
        },
        {
            label: "View",
            submenu: [
                { role: "toggleDevTools" },
                { type: "separator" },
                { role: "resetZoom" },
                { role: "zoomIn" },
                { role: "zoomOut" },
                { type: "separator" },
                { role: "togglefullscreen" },
            ],
        },
        {
            label: "Browser",
            submenu: [
                {
                    label: "Close Tab",
                    click: async () => {
                        window.webContents
                            .executeJavaScript(`window.close();`)
                            .catch(console.error);
                    },
                },
            ],
        },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(menu));

    // context menu
    function buildContextMenu(name, makeMenu) {
        ipcMain.on(name, (event) => {
            let _menu = makeMenu(event); // give the event to the builder
            Menu.buildFromTemplate([..._menu, ...menu]).popup(
                BrowserWindow.fromWebContents(event.sender)
            );
        });
    }

    // context menu text
    buildContextMenu("show-context-menu-text", (event) => {
        return [
            // context menu for text
            new MenuItem({ role: "cut" }),
            new MenuItem({ role: "copy" }),
            new MenuItem({ role: "paste" }),
            new MenuItem({ role: "selectAll" }),
            new MenuItem({ type: "separator" }),
        ];
    });

    // context menu images
    buildContextMenu("show-context-menu-image", (event) => {
        return [
            // context menu for text
            new MenuItem({
                label: "Copy Image Address",
                click: async () => {
                    event.sender.send("context-command", "copy-img-addr");
                },
            }),

            new MenuItem({
                label: "Open Image in New Tab",
                click: async () => {
                    event.sender.send("context-command", "open-img-addr");
                },
            }),

            new MenuItem({ type: "separator" }),
        ];
    });

    // base context menu
    buildContextMenu("show-context-menu", (event) => {
        return [
            new MenuItem({
                label: "Navigate",
                click: async () => {
                    event.sender.send("context-command", "navigate-prompt"); // prompt the user for a new page url
                },
            }),

            new MenuItem({
                label: "History",
                submenu: [
                    new MenuItem({
                        label: "Back",
                        click: async () => {
                            event.sender.send(
                                "context-command",
                                "history-back"
                            );
                        },
                    }),

                    new MenuItem({
                        label: "Forward",
                        click: async () => {
                            event.sender.send(
                                "context-command",
                                "history-forward"
                            );
                        },
                    }),
                ],
            }),

            new MenuItem({ type: "separator" }),
        ];
    });

    // handle window opening
    const windowOpenHandler = ({ url }) => {
        console.log(
            `\x1b[1m\x1b[35m⬢ ~ \x1b[1m\x1b[32m Opening custom window! ${url}\x1b[0m`
        );

        const windowb = new BrowserWindow({
            nodeIntegration: false,
            parent: null,
            width: 1000,
            height: 800,
            webPreferences: {
                preload: path.join(__dirname, "preload.cjs"),
                // devTools: false,
                sandbox: true,
                autoplayPolicy: "user-gesture-required",
                plugins: true,
            },
        });

        windowb.loadURL(url);
        windowb.webContents.setWindowOpenHandler(windowOpenHandler);

        console.log(
            [
                " ┌ \x1b[1mWindow Info\x1b[0m ─────────────────────────────────────────────────────────┐",
                "",
                `    \x1b[1m\x1b[34mProcess ID \x1b[0m- ${windowb.webContents.getProcessId()}`,
                `    \x1b[1m\x1b[32mTitle \x1b[0m- ${windowb.webContents.getTitle()}`,
                `    \x1b[1m\x1b[33mUserAgent \x1b[0m- ${windowb.webContents.getUserAgent()}`,
                `    \x1b[1m\x1b[35mType \x1b[0m- ${windowb.webContents.getType()}`,
                "",
                " └──────────────────────────────────────────────────────────────────────┘",
            ].join("\n\r")
        );

        return {
            action: "deny", // we're denying this because we'll just open a new browserview
        };
    };

    window.webContents.setWindowOpenHandler(windowOpenHandler);

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

        session.defaultSession
            .loadExtension(path.resolve(__dirname, "extensions", dir))
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
    }, 250);
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
