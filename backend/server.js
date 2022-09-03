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
        }
    );

    console.log(`[NEW TERMINAL] PID: ${term.pid}`);

    // store terminal
    terminals[term.pid.toString()] = term;
    logs[term.pid.toString()] = "";

    term.on("data", function (data) {
        logs[term.pid] += data;
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
    console.log(`[EDIT TERMINAL] ${pid}.Size = ${rows}x${cols} (RxC)`);

    // close
    response.end();
});

app.ws("/api/terminals/:pid", function (ws, request) {
    let term = terminals[parseInt(request.params.pid)];
    console.log(`[EDIT TERMINAL] ${request.params.pid}.ws.status = open`);
    ws.send(logs[term.pid]);

    // string message buffering
    function buffer(socket, timeout) {
        let s = "";
        let sender = null;
        return (data) => {
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

    const send = USE_BINARY ? bufferUtf8(ws, 5) : buffer(ws, 5);

    // WARNING: This is a naive implementation that will not throttle the flow of data. This means
    // it could flood the communication channel and make the terminal unresponsive. Learn more about
    // the problem and how to implement flow control at https://xtermjs.org/docs/guides/flowcontrol/
    term.on("data", function (data) {
        try {
            send(data);
        } catch (ex) {
            console.error(
                `[ERROR TERMINAL] ${request.params.pid}.error - failed to load data on post`
            );

            return;
        }
    });

    ws.on("message", function (msg) {
        term.write(msg);
    });

    ws.on("close", function () {
        term.kill();
        console.log(`[EDIT TERMINAL] ${request.params.pid}.ws.status = closed`);

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

app.listen(3000);
