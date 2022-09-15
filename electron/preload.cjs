const { ipcRenderer } = require("electron");

onload = () => {
    // handle context menu
    let info = {
        selectedMedia: undefined,
    };

    window.addEventListener("contextmenu", (e) => {
        e.preventDefault();

        // send specific content menus
        if (window.getSelection().toString() !== "") {
            // we have selected text! send for text menu
            ipcRenderer.send("show-context-menu-text");
        } else if (e.target.nodeName === "IMG") {
            // image selected
            ipcRenderer.send("show-context-menu-image");

            info.selectedMedia = {
                origin: window.location.origin,
                src: e.target.getAttribute("src"),
                location: e.target
                    .getAttribute("src")
                    .startsWith(window.location.origin)
                    ? e.target.getAttribute("src")
                    : `${window.location.href}/${e.target.getAttribute("src")}`,
            };
        } else {
            // nothing special, send normal meny
            ipcRenderer.send("show-context-menu");
        }
    });
};
