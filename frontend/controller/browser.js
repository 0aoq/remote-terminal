import browserPage from "../browser.html";

const openTerminal = document.getElementById("openTerminal");
const openBrowser = document.getElementById("openBrowser");

const terminal = document.getElementById("terminal");
const iframe = document.querySelector("iframe");

// check if we're in electron
let isElectron = window.location.search.slice(1) === "electron";

// if we're not in electron, hide the button
if (!isElectron) {
    openBrowser.remove();
    openTerminal.remove();
    iframe.remove();
} else {
    openBrowser.addEventListener("click", () => {
        iframe.src = "./browser.html";

        // handle webview
        terminal.style.display = "none";
        iframe.style.display = "block";

        openTerminal.classList.toggle("active");
        openBrowser.classList.toggle("active");
    });

    openTerminal.addEventListener("click", () => {
        // handle webview
        terminal.style.display = "block";
        iframe.style.display = "none";

        openTerminal.classList.toggle("active");
        openBrowser.classList.toggle("active");
    });
}
