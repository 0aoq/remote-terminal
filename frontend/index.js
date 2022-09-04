import { WebLinksAddon } from "xterm-addon-web-links";
import { FitAddon } from "xterm-addon-fit";

import xtermCSS from "xterm/css/xterm.css";
import xterm from "xterm";

// define theme
function hslToHex(h, s, l) {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color)
            .toString(16)
            .padStart(2, "0"); // convert to Hex and prefix "0" if needed
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

let themeBase = {
    // hue saturation
    h: 208,
    s: 8,

    // primary color hue/saturation
    ph: 325,
    ps: 33,
};

const theme = {
    background: hslToHex(themeBase.h, themeBase.s, 18),

    // cursor
    cursor: hslToHex(themeBase.ph, themeBase.ps, 52),
    cursorAccent: hslToHex(themeBase.ph, themeBase.ps, 52),

    // misc
    black: hslToHex(themeBase.h, themeBase.s, 14),
};

// create terminal
const terminal = new xterm.Terminal({
    fontFamily: '"Cascadia Code", Menlo, monospace',
    rightClickSelectsWord: true,
    altClickMovesCursor: true,
    rendererType: "canvas",
    cursorBlink: true,
    convertEol: true,
    logLevel: "info",
    theme: theme,
});

terminal.open(document.body);

const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);

terminal.loadAddon(new WebLinksAddon());

function ab2s(buffer) {
    let array = new Uint8Array(buffer);
    let string = String.fromCharCode.apply(String, array);
    return string;
}

(async () => {
    // create connection
    const requestedPID = performance.now();
    const pid = await (
        await fetch("/api/terminals", { method: "POST" })
    ).text();
    if (!parseFloat(pid)) return; // PID is invalid

    console.log(`Terminal created! PID: ${pid}`);

    fitAddon.fit();

    // update size
    async function updateSize(size) {
        await fetch(
            `/api/terminals/${pid}/edit/size?cols=${size.cols}&rows=${size.rows}`,
            {
                method: "POST",
            }
        );
    }

    terminal.onResize(updateSize);

    // socket
    const socket = new WebSocket(
        `${window.location.protocol === "https:" ? "wss://" : "ws://"}${
            window.location.host
        }/api/terminals/${pid}`
    );

    socket.binaryType = "arraybuffer";

    socket.addEventListener("open", () => {
        console.log("Connection established");

        // system messages
        terminal.writeln(
            [
                " Connected to Remote Terminal, information is below!",
                " \x1b[3mhttps://github.com/0aoq/remote-terminal\x1b[0m",
                "",
                " ┌ \x1b[1mInformation\x1b[0m ─────────────────────────────────────────────────────────┐",
                "",
                `    \x1b[1m\x1b[34mProcess ID \x1b[0m- ${pid}`,
                `    \x1b[1m\x1b[32mHost \x1b[0m- ${window.location.host}`,
                `    \x1b[1m\x1b[33mTerminal Size \x1b[0m- ${terminal.rows}x${terminal.cols}`,
                `    \x1b[1m\x1b[35mStarted \x1b[0m- ${new Date().toLocaleString()} (PID Response Time: ${
                    performance.now() - requestedPID
                }ms)`,
                "",
                " └──────────────────────────────────────────────────────────────────────┘",
                "",
            ].join("\n\r")
        );

        let systemShell = "\x1b[1m\x1b[35m⬢ ~ \x1b[1m\x1b[32m";
        terminal.writeln(
            [
                ` ${systemShell} Connection established (ws://)\x1b[0m`,
                ` ${systemShell} Starting user shell\x1b[0m`,
                "",
            ].join("\r\n")
        );

        // handle socket message event
        socket.addEventListener("message", (ev) => {
            // post data to terminal
            const data = ev.data;

            terminal.write(
                typeof data === "string" ? data : ab2s(new Uint8Array(data))
            );
        });
    });

    // data listener
    let isFirstInput = true;
    terminal.onData((data) => {
        if (isFirstInput) {
            fitAddon.fit();
            terminal.clear();
            isFirstInput = false;

            fetch(
                `/api/terminals/${pid}/edit/size?rows=${terminal.rows}&cols=${terminal.cols}`,
                {
                    method: "POST",
                }
            );
        }

        // make sure socket is still open
        if (socket.readyState !== 1) {
            return;
        }

        // send data
        const buffer = new Uint8Array(data.length);
        for (let i = 0; i < data.length; ++i) {
            buffer[i] = data.charCodeAt(i) & 255;
        }

        socket.send(buffer);
    });

    // refit every 500ms
    setInterval(() => {
        fitAddon.fit();
    }, 500);
})();
