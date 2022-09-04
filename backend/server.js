import path from "node:path";
import fs from "node:fs";
import os from "node:os";

import serveHandler from "serve-handler";
import express from "express";
import ws from "express-ws";
import pty from "node-pty";

const USE_BINARY = os.platform() !== "win32";

let terminals = {};
let logs = {};

// create app
const app = new express();
ws(app);

// create rt-log directory
if (!fs.existsSync("rt-log/")) fs.mkdirSync("rt-log/");

// terminal endpoints
app.post("/api/terminals", (request, response) => {
    const env = Object.assign({}, process.env);
    env["COLORTERM"] = "truecolor";

    // create terminal
    let term = pty.spawn(
        process.platform === "win32" ? "cmd.exe" : "bash",
        [],
        {
            name: "xterm-256color",
            cols: 80,
            rows: 24,
            cwd: process.platform === "win32" ? undefined : env.PWD,
            env: env,
            encoding: USE_BINARY ? null : "utf8",
            handleFlowControl: true,
        }
    );

    console.log(`[NEW TERMINAL] PID: ${term.pid}`);

    // store terminal
    terminals[term.pid.toString()] = term;
    logs[term.pid.toString()] = "";

    fs.writeFileSync(`rt-log/${term.pid}.log`, "");

    term.onData(function (data) {
        logs[term.pid] += data;

        // convert arraybuffer to string
        if (typeof data !== "string") {
            data = String.fromCharCode.apply(String, data);
        }

        // write to log
        if (fs.existsSync(`rt-log/${term.pid}.log`)) {
            fs.appendFileSync(`rt-log/${term.pid}.log`, data);
        }
    });

    // close
    response.send(term.pid.toString());
    response.end();
});

app.post("/api/terminals/:pid/edit/size", (request, response) => {
    const pid = parseInt(request.params.pid),
        cols = parseInt(request.query.cols),
        rows = parseInt(request.query.rows),
        term = terminals[pid];

    term.resize(cols, rows);
    console.log(`[EDIT TERMINAL] ${pid}.size = ${rows}x${cols} (RxC)`);

    // close
    response.end();
});

app.ws("/api/terminals/:pid", function (ws, request) {
    let term = terminals[parseInt(request.params.pid)];
    console.log(`[EDIT TERMINAL] ${request.params.pid}.ws.status = open`);

    function s2uin16(string) {
        return new Uint8Array(Buffer.from(string, "utf-8"));
    }

    ws.send(
        s2uin16(
            JSON.stringify({
                t: "PTY_DATA",
                d: logs[term.pid],
            })
        )
    );

    // string message buffering
    function buffer(socket, timeout) {
        let s = "";
        let sender = null;

        return (data) => {
            data = JSON.parse(data).d;

            s += data;
            if (!sender) {
                sender = setTimeout(() => {
                    socket.send(s);
                    s = "";
                    sender = null;
                }, timeout);
            }
        };
    }

    // binary message buffering
    function bufferUtf8(socket, timeout) {
        let buffer = [];
        let sender = null;
        let length = 0;

        return (data) => {
            buffer.push(data);
            length += data.length;
            if (!sender) {
                sender = setTimeout(() => {
                    socket.send(Buffer.concat(buffer, length));
                    buffer = [];
                    sender = null;
                    length = 0;
                }, timeout);
            }
        };
    }

    const send = USE_BINARY ? bufferUtf8(ws, 0) : buffer(ws, 5);

    // listen for data
    term.onData((data) => {
        try {
            send(
                // convert the string to a Uint8Array first
                s2uin16(
                    JSON.stringify({
                        t: "PTY_DATA",
                        d: data.toString() // at this point "data" is a Buffer, convert it to a string before sending,
                    })
                )
            );
        } catch (ex) {
            console.error(
                `[ERROR TERMINAL] ${request.params.pid}.error - failed to load data on post...\n`,
                ex
            );

            return;
        }
    });

    term.onExit(() => {
        // handle exit
        send(
            s2uin16(
                JSON.stringify({
                    t: "PTY_EXIT",
                })
            )
        );
    });

    ws.on("message", function (msg) {
        term.write(msg);
    });

    ws.on("close", function () {
        term.kill();
        console.log(`[EDIT TERMINAL] ${request.params.pid}.ws.status = closed`);
        fs.unlinkSync(`rt-log/${term.pid}.log`);

        // clean up
        delete terminals[term.pid];
        delete logs[term.pid];
    });
});

// base endpoint
app.get(/^\/(.*)/, async (request, response) => {
    let newPath = path.resolve(`/frontend/dist${request.url}`);

    // search under frontend for the url instead
    request.url = newPath;

    // handle with serverHandler
    return await serveHandler(request, response, {
        cleanUrls: true,
    });
});

console.log("\x1b[1m\x1b[35m⬢ ~ \x1b[1m\x1b[32m Server started!\x1b[0m");
app.listen(3057);
