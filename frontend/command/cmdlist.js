export default {
    clientjs: (log, args) => {
        // execute javascript code given from the terminal on the browser
        const code = args.join(" ");
        new Function(code)();
        log("[CLIENTJS] Running client code!");
    },
};
