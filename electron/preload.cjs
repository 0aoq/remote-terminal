const { ipcRenderer } = require("electron");

onload = () => {
    let info = {
        selectedImage: undefined,
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

            info.selectedImage = {
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

    ipcRenderer.on("context-command", (e, command) => {
        switch (command) {
            // images
            case "copy-img-addr":
                if (info.selectedImage !== undefined) {
                    navigator.clipboard.writeText(info.selectedImage.location);
                }

                break;

            case "open-img-addr":
                if (info.selectedImage !== undefined) {
                    window.open(info.selectedImage.location);
                }

                break;

            // navigation
            case "navigate-prompt":
                window.location.href = "http://localhost:3057/browser.html?replace";
                break;

            // default
            default:
                break;
        }
    });
};
