import { WebLinksAddon } from "xterm-addon-web-links";
import { AttachAddon } from "xterm-addon-attach";
import { WebglAddon } from "xterm-addon-webgl";
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
    theme: theme,
    cursorBlink: true,
});

terminal.open(document.body);

const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);

terminal.loadAddon(new WebLinksAddon());
terminal.loadAddon(new WebglAddon());

(async () => {
    // create connection
    const pid = await (
        await fetch("/api/terminals", { method: "POST" })
    ).text();
    if (!parseFloat(pid)) return; // PID is invalid

    console.log(`Terminal created! PID: ${pid}`);

    // update size
    async function updateSize(size) {
        await fetch(`/api/terminals/${pid}/edit/size?cols=${size.cols}&rows=${size.rows}`, {
            method: "POST",
        });
    }

    terminal.onResize(updateSize);

    // socket
    const socket = new WebSocket(
        `ws://${window.location.host}/api/terminals/${pid}`
    );

    socket.addEventListener("open", () => {
        console.log("Connection established");

        const attachAddon = new AttachAddon(socket, {
            bidirectional: true,
        });

        terminal.loadAddon(attachAddon);
    });

    // data listener
    terminal.onData((e) => {});
    
    // refit every 500ms
    setInterval(() => {
        fitAddon.fit();
    }, 500);
})();
