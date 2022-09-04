/**
 * @file Handle custom command execution
 * @name execute.js
 */

import { Terminal } from "xterm";
import cmdlist from "./cmdlist";

let cmd = "";

/**
 * @function updateCommand
 * @description Append a character onto the command
 *
 * @param {string} character
 */
export function updateCommand(character) {
    if (character === "\u007f") {
        // handle backspace
        if (cmd.length > 0) {
            cmd = cmd.substring(0, cmd.length - 1);
        }
    } else {
        if (character === "\u0003") return;

        // add character normally
        cmd += character;
    }
}

/**
 * @function clearCommand
 * @description Reset the current command
 */
export function clearCommand() {
    cmd = "";
}

/**
 * @function execute
 * @description Execute the current command
 *
 * @param {Terminal} terminal The executing terminal
 * @param {WebSocket} socket The socket connection
 */
export function execute(terminal, socket) {
    const toExecute = cmd.split(" ")[0];
    if (!cmd.split(toExecute)[1]) return false;
    const args = cmd.split(toExecute)[1].split(" ");

    // evaluate
    if (cmdlist[toExecute]) {
        terminal.writeln(
            `\r\n\x1b[1m\x1b[35m⬢ ~ \x1b[1m\x1b[32mExecuting client command!\x1b[0m`
        );

        cmdlist[toExecute]((input) => {
            console.log(`[CLIENT LOG] ${input}`);
            terminal.writeln(`\r\n\x1b[1m\x1b[35m⬢ ~ ${input}\x1b[0m`);
        }, args);

        // remove the command from the terminal and return
        for (let i = 0; i < cmd.length; i++) {
            // send backspaces to socket
            socket.send("\u007f");
        }

        socket.send("\r");

        // return true because a command was found
        return true;
    }

    // return false if command is invalid
    return false;
}

// default export
export default (command) => {
    updateCommand, clearCommand, execute;
};
