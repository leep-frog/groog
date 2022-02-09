"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const emacs_1 = require("./emacs");
function getCurrentPos() {
    return vscode.window.activeTextEditor?.selection.active;
}
function register(context, commandName, callback) {
    context.subscriptions.push(vscode.commands.registerCommand("groog." + commandName, () => {
        callback();
    }));
}
const groogery = new emacs_1.Emacs();
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    for (var move of emacs_1.cursorMoves) {
        const m = move;
        register(context, move, () => groogery.move(m));
    }
    register(context, 'jump', () => groogery.jump());
    register(context, 'fall', () => groogery.fall());
    register(context, 'toggleQMK', () => groogery.toggleQMK());
    register(context, 'toggleMarkMode', () => groogery.toggleMarkMode());
    register(context, 'yank', () => groogery.yank());
    register(context, 'paste', () => groogery.paste());
    register(context, 'kill', () => groogery.kill());
    register(context, 'ctrlG', () => groogery.ctrlG());
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map