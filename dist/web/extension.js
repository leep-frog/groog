/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Emacs = exports.cursorMoves = void 0;
const vscode = __webpack_require__(1);
const jumpDist = 10;
exports.cursorMoves = [
    "cursorUp", "cursorDown", "cursorLeft", "cursorRight",
    "cursorHome", "cursorEnd",
    "cursorWordLeft", "cursorWordRight",
    "cursorTop", "cursorBottom"
];
class Emacs {
    constructor() {
        this.yanked = "";
        // TODO: store this in persistent storage somewhere
        this.qmk = false;
        this.markMode = false;
    }
    toggleQMK() {
        if (this) {
            console.log("qmk yes");
        }
        else {
            console.log("qmk no");
        }
        if (this.qmk) {
            vscode.window.showInformationMessage('Basic keyboard mode activated');
        }
        else {
            vscode.window.showInformationMessage('QMK keyboard mode activated');
        }
        this.qmk = !this.qmk;
        vscode.commands.executeCommand('setContext', 'groog.qmk', this.qmk);
    }
    toggleMarkMode() {
        if (this.markMode) {
            // Deselect
            vscode.commands.executeCommand("cancelSelection");
        }
        this.markMode = !this.markMode;
        vscode.commands.executeCommand('setContext', 'groog.markMode', true);
    }
    yank() {
        var _a, _b, _c;
        this.markMode = false;
        let range = (_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.selection;
        let maybe = (_b = vscode.window.activeTextEditor) === null || _b === void 0 ? void 0 : _b.document.getText(range);
        if (maybe) {
            this.yanked = maybe;
            (_c = vscode.window.activeTextEditor) === null || _c === void 0 ? void 0 : _c.edit(editBuilder => {
                if (range) {
                    editBuilder.delete(range);
                }
            });
        }
        maybe ? this.yanked = maybe : this.yanked = "";
    }
    paste() {
        var _a;
        this.markMode = false;
        // Overwrite selection if relevant.
        (_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.edit(editBuilder => {
            let editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }
            editBuilder.insert(editor.selection.active, this.yanked);
        });
    }
    ctrlG() {
        if (this.markMode) {
            this.toggleMarkMode();
        }
        else {
            // This is done in toggle mark mode so don't need to do it twice
            // if not in that mode.
            vscode.commands.executeCommand("cancelSelection");
        }
        vscode.commands.executeCommand("closeFindWidget");
        vscode.commands.executeCommand("removeSecondaryCursors");
    }
    kill() {
        var _a;
        this.markMode = false;
        let editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        let startPos = editor.selection.active;
        let endPos = editor.document.lineAt(startPos.line).range.end;
        let range = new vscode.Range(startPos, endPos);
        let text = editor.document.getText(range);
        if (text.trim().length === 0) {
            range = new vscode.Range(startPos, new vscode.Position(startPos.line + 1, 0));
        }
        this.yanked = editor.document.getText(range);
        (_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.edit(editBuilder => {
            editBuilder.delete(range);
        });
    }
    // C-l
    jump() {
        this.move("cursorMove", { "to": "up", "by": "line", "value": jumpDist });
    }
    // C-v
    fall() {
        this.move("cursorMove", { "to": "down", "by": "line", "value": jumpDist });
    }
    move(vsCommand, ...rest) {
        if (this.markMode) {
            vscode.commands.executeCommand(vsCommand + "Select", ...rest);
        }
        else {
            vscode.commands.executeCommand(vsCommand, ...rest);
        }
    }
}
exports.Emacs = Emacs;


/***/ }),
/* 3 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Recorder = void 0;
const vscode = __webpack_require__(1);
class Recorder {
    constructor() {
        this.baseCommand = true;
        this.recording = false;
        this.setRecording(false);
        this.recordBook = [];
    }
    setRecording(b) {
        vscode.commands.executeCommand('setContext', 'groog.recording', b);
        this.recording = b;
    }
    Execute(command, args, callback) {
        if (command.includes("groog.record") || !this.recording || !this.baseCommand) {
            return callback(...args);
        }
        this.recordBook = this.recordBook.concat(new record(command, args));
        this.baseCommand = false;
        let r = callback(...args);
        this.baseCommand = true;
        return r;
    }
    StartRecording() {
        if (this.recording) {
            vscode.window.showInformationMessage("Already recording!");
        }
        else {
            this.setRecording(true);
            this.recordBook = [];
            vscode.window.showInformationMessage("Recording started!");
        }
    }
    EndRecording() {
        if (!this.recording) {
            vscode.window.showInformationMessage("Not recording!");
        }
        else {
            this.setRecording(false);
            vscode.window.showInformationMessage("Recording ended!");
        }
    }
    Playback() {
        if (this.recording) {
            vscode.window.showInformationMessage("Still recording!");
            return;
        }
        vscode.window.showInformationMessage("Playing recording!");
        let sl = [];
        for (var record of this.recordBook) {
            vscode.commands.executeCommand(record.command, ...record.args);
        }
    }
}
exports.Recorder = Recorder;
class record {
    constructor(command, args) {
        this.command = command;
        this.args = args;
    }
}


/***/ }),
/* 4 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.multiCommand = void 0;
const vscode = __webpack_require__(1);
function multiCommand(mc) {
    for (var command of mc.sequence) {
        vscode.commands.executeCommand(command);
    }
}
exports.multiCommand = multiCommand;


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.deactivate = exports.activate = void 0;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __webpack_require__(1);
const emacs_1 = __webpack_require__(2);
const record_1 = __webpack_require__(3);
const multi_command_1 = __webpack_require__(4);
let baseCommand = true;
let recording = false;
function register(context, commandName, callback) {
    context.subscriptions.push(vscode.commands.registerCommand("groog." + commandName, (...args) => {
        recorder.Execute("groog." + commandName, args, callback);
    }));
}
const groogery = new emacs_1.Emacs();
const recorder = new record_1.Recorder();
let bet = "qwertyuiopasdfghjklzxcvbnm";
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    vscode.window.showInformationMessage("yupo");
    for (var b of bet) {
        const lb = b;
        const ub = b.toUpperCase();
        register(context, lb, () => {
            vscode.commands.executeCommand("type", { "text": lb });
        });
        register(context, ub, () => {
            vscode.commands.executeCommand("type", { "text": ub });
        });
    }
    /*register(context, "a", () => {
      vscode.window.showInformationMessage("lower a");
    });
    register(context, "A", () => {
      vscode.window.showInformationMessage("upper a");
    });*/
    /*register(context, "A", () => {
      vscode.window.showInformationMessage("upper a");
    });*/
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
    register(context, "multiCommand.execute", multi_command_1.multiCommand);
    register(context, "record.startRecording", () => recorder.StartRecording());
    register(context, "record.endRecording", () => recorder.EndRecording());
    register(context, "record.playRecording", () => recorder.Playback());
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "groog" is now active in the web extension host!');
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('groog.helloWorld', () => {
        // The code you place here will be executed every time your command is executed
        // Display a message box to the user
        vscode.window.showInformationMessage('Hello World from groog in a web extension host!');
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;

})();

var __webpack_export_target__ = exports;
for(var i in __webpack_exports__) __webpack_export_target__[i] = __webpack_exports__[i];
if(__webpack_exports__.__esModule) Object.defineProperty(__webpack_export_target__, "__esModule", { value: true });
/******/ })()
;
//# sourceMappingURL=extension.js.map