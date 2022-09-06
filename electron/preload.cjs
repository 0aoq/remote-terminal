const { ipcRenderer } = require("electron");

onload = () => {
    let anchorHrefText = document.createElement("p");

    anchorHrefText.style.position = "fixed";
    anchorHrefText.style.zIndex = "9999";
    anchorHrefText.style.bottom = "0.5%";
    anchorHrefText.style.left = "0.5%";
    anchorHrefText.style.borderRadius = "0.2rem 0.4rem";
    anchorHrefText.style.padding = "0.5rem";
    anchorHrefText.style.background = "rgb(10, 10, 10)";
    anchorHrefText.style.boxShadow = "box-shadow: 0 0 8px rgba(0, 0, 0, 0.5)";
    anchorHrefText.style.color = "white";
    anchorHrefText.style.display = "none";
    anchorHrefText.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    anchorHrefText.style.fontSize = "12px"

    let anchorsWithListeners = [];
    setInterval(() => {
        for (let a of document.querySelectorAll("a")) {
            // switch all https links into rtss
            a.href = a.href.replaceAll("https://", "rtss://");

            // whenever the link is hovered show a window in the bottom left with the href (electron doesn't do this automatically)
            if (!anchorsWithListeners.includes(a)) {
                anchorsWithListeners.push(a);
                a.addEventListener("mouseenter", () => {
                    anchorHrefText.style.display = "block";
                    anchorHrefText.innerText = a.href;
                });

                a.addEventListener("mouseleave", () => {
                    anchorHrefText.style.display = "none";
                    anchorHrefText.innerText = "";
                });
            }
        }
    }, 1000);

    document.body.append(anchorHrefText);

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

    ipcRenderer.on("context-command", (e, command) => {
        switch (command) {
            // images
            case "copy-img-addr":
                if (info.selectedMedia !== undefined) {
                    navigator.clipboard.writeText(info.selectedMedia.location);
                }

                break;

            case "open-img-addr":
                if (info.selectedMedia !== undefined) {
                    window.open(info.selectedMedia.location);
                }

                break;

            // navigation
            case "navigate-prompt":
                window.location.href =
                    "http://localhost:3057/browser.html?replace";
                break;

            case "history-back":
                window.history.back();
                break;

            case "history-forward":
                window.history.forward();
                break;

            // default
            default:
                break;
        }
    });
};
