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
exports.deleteCommands = exports.Emacs = exports.cursorMoves = void 0;
const vscode = __webpack_require__(1);
const jumpDist = 10;
exports.cursorMoves = [
    "cursorUp", "cursorDown", "cursorLeft", "cursorRight",
    "cursorHome", "cursorEnd",
    "cursorWordLeft", "cursorWordRight",
    "cursorTop", "cursorBottom"
];
class Emacs {
    constructor(r) {
        // TODO: store this in persistent storage somewhere
        this.qmk = false;
        this.typeHandlers = [
            //new FindHandler(),
            new MarkHandler(),
            r,
        ];
    }
    register(context, recorder) {
        for (var th of this.typeHandlers) {
            th.register(context, recorder);
        }
    }
    type(...args) {
        if (!vscode.window.activeTextEditor) {
            vscode.window.showInformationMessage("NOT TEXT EDITOR?!?!");
        }
        let apply = true;
        let s = args[0].text;
        for (var th of this.typeHandlers) {
            if (th.active) {
                apply && (apply = th.textHandler(s));
            }
        }
        if (apply) {
            vscode.commands.executeCommand("default:type", ...args);
        }
    }
    delCommand(d) {
        let apply = true;
        for (var th of this.typeHandlers) {
            if (th.active) {
                apply && (apply = th.textHandler(d));
            }
        }
        if (apply) {
            vscode.commands.executeCommand(d);
        }
    }
    toggleQMK() {
        if (this.qmk) {
            vscode.window.showInformationMessage('Basic keyboard mode activated');
        }
        else {
            vscode.window.showInformationMessage('QMK keyboard mode activated');
        }
        this.qmk = !this.qmk;
        vscode.commands.executeCommand('setContext', 'groog.qmk', this.qmk);
    }
    yank() {
        var _a, _b, _c;
        let range = (_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.selection;
        let maybe = (_b = vscode.window.activeTextEditor) === null || _b === void 0 ? void 0 : _b.document.getText(range);
        if (maybe) {
            (_c = vscode.window.activeTextEditor) === null || _c === void 0 ? void 0 : _c.edit(editBuilder => {
                if (range) {
                    editBuilder.delete(range);
                }
            });
        }
        for (var th of this.typeHandlers) {
            if (th.active) {
                th.onYank(maybe);
            }
        }
    }
    ctrlG() {
        for (var th of this.typeHandlers) {
            if (th.active) {
                th.ctrlG();
            }
        }
        vscode.commands.executeCommand("cancelSelection");
        vscode.commands.executeCommand("closeFindWidget");
        vscode.commands.executeCommand("removeSecondaryCursors");
    }
    kill() {
        var _a;
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
        for (var th of this.typeHandlers) {
            th.onKill(text);
        }
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
        let apply = true;
        for (var th of this.typeHandlers) {
            if (th.active) {
                apply && (apply = th.moveHandler(vsCommand, ...rest));
            }
        }
        if (apply) {
            vscode.commands.executeCommand(vsCommand, ...rest);
        }
    }
}
exports.Emacs = Emacs;
const deleteLeft = "deleteLeft";
const deleteRight = "deleteRight";
const deleteWordLeft = "deleteWordLeft";
const deleteWordRight = "deleteWordRight";
exports.deleteCommands = [
    deleteLeft,
    deleteRight,
    deleteWordLeft,
    deleteWordRight,
];
class FindHandler {
    constructor() {
        this.active = false;
        this.findText = "";
    }
    register(context, recorder) {
        recorder.registerCommand(context, 'find', () => {
            if (this.active) {
                // Go to next find
                vscode.commands.executeCommand("editor.action.moveSelectionToNextFindMatch");
            }
            else {
                this.activate();
            }
        });
    }
    activate() {
        this.active = true;
        this.findWithArgs();
    }
    deactivate() {
        this.active = false;
        this.findText = "";
    }
    findWithArgs() {
        if (this.findText.length === 0) {
            vscode.commands.executeCommand("editor.actions.findWithArgs", { "searchString": "ENTER_TEXT" });
        }
        else {
            vscode.commands.executeCommand("editor.actions.findWithArgs", { "searchString": this.findText });
        }
        vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    }
    ctrlG() {
        this.deactivate();
    }
    textHandler(s) {
        this.findText = this.findText.concat(s);
        this.findWithArgs();
        return false;
    }
    moveHandler(s) {
        this.deactivate();
        return true;
    }
    delHandler(s) {
        switch (s) {
            case "deleteLeft":
                this.findText = this.findText.slice(0, this.findText.length - 1);
                this.findWithArgs();
            default:
                vscode.window.showInformationMessage("Unsupported find command: " + s);
        }
        return false;
    }
    onYank(s) { }
    onKill(s) { }
}
class MarkHandler {
    constructor() {
        this.active = false;
        this.yanked = "";
    }
    register(context, recorder) {
        recorder.registerCommand(context, 'toggleMarkMode', () => {
            if (this.active) {
                this.deactivate();
            }
            else {
                this.activate();
            }
        });
        recorder.registerCommand(context, 'paste', () => {
            var _a;
            if (this.active) {
                this.deactivate();
            }
            (_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.edit(editBuilder => {
                let editor = vscode.window.activeTextEditor;
                if (!editor) {
                    return;
                }
                editBuilder.insert(editor.selection.active, this.yanked);
            });
        });
    }
    activate() {
        this.active = true;
        vscode.commands.executeCommand('setContext', 'groog.markMode', true);
    }
    deactivate() {
        this.active = false;
        vscode.commands.executeCommand('setContext', 'groog.markMode', false);
    }
    ctrlG() {
        this.deactivate();
    }
    textHandler(s) {
        this.deactivate();
        return true;
    }
    moveHandler(vsCommand, ...rest) {
        vscode.commands.executeCommand(vsCommand + "Select", ...rest);
        return false;
    }
    delHandler(s) {
        this.deactivate();
        return true;
    }
    onYank(s) {
        this.deactivate();
        s ? this.yanked = s : this.yanked = "";
    }
    onKill(s) {
        this.deactivate();
        s ? this.yanked = s : this.yanked = "";
    }
}
class TypeArg {
    constructor(text) {
        this.text = "";
    }
}


/***/ }),
/* 3 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Recorder = void 0;
const vscode = __webpack_require__(1);
class Recorder {
    constructor() {
        this.baseCommand = true;
        this.active = false;
        this.recordBook = [];
    }
    register(context, recorder) {
        recorder.registerCommand(context, "record.startRecording", () => recorder.startRecording());
        recorder.registerCommand(context, "record.endRecording", () => recorder.endRecording());
        recorder.registerCommand(context, "record.playRecording", () => recorder.playback());
    }
    registerCommand(context, commandName, callback) {
        context.subscriptions.push(vscode.commands.registerCommand("groog." + commandName, (...args) => {
            this.execute("groog." + commandName, args, callback);
        }));
    }
    execute(command, args, callback) {
        if (command.includes("groog.record") || !this.active || !this.baseCommand) {
            return callback(...args);
        }
        this.addRecord(new record(command, args));
        this.baseCommand = false;
        let r = callback(...args);
        this.baseCommand = true;
        return r;
    }
    startRecording() {
        if (this.active) {
            vscode.window.showInformationMessage("Already recording!");
        }
        else {
            this.activate();
            this.recordBook = [];
            vscode.window.showInformationMessage("Recording started!");
        }
    }
    endRecording() {
        if (!this.active) {
            vscode.window.showInformationMessage("Not recording!");
        }
        else {
            this.deactivate();
            vscode.window.showInformationMessage("Recording ended!");
        }
    }
    playback() {
        if (this.active) {
            vscode.window.showInformationMessage("Still recording!");
            return;
        }
        vscode.window.showInformationMessage("Playing recording!");
        let sl = [];
        for (var record of this.recordBook) {
            vscode.window.showInformationMessage("playing " + record.command + "(" + record.args + ")");
            vscode.commands.executeCommand(record.command, ...record.args);
        }
    }
    activate() {
        this.active = true;
        vscode.commands.executeCommand('setContext', 'groog.recording', true);
    }
    deactivate() {
        this.active = false;
        vscode.commands.executeCommand('setContext', 'groog.recording', false);
    }
    addRecord(r) {
        this.recordBook = this.recordBook.concat(r);
    }
    textHandler(s) {
        this.addRecord(new record("default:type", [{ "text": s }]));
        return true;
    }
    // Make this implement type interface:
    // All these functions are associated with a "groog.*" command so these are
    // already added to the record book via the "type" command handling
    onKill(s) { }
    ctrlG() { }
    onYank(s) { }
    delHandler(s) {
        return true;
    }
    moveHandler(vsCommand, ...rest) {
        return true;
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
const recorder = new record_1.Recorder();
const groogery = new emacs_1.Emacs(recorder);
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    vscode.window.showInformationMessage("yupo");
    for (var move of emacs_1.cursorMoves) {
        const m = move;
        recorder.registerCommand(context, move, () => groogery.move(m));
    }
    for (var dc of emacs_1.deleteCommands) {
        const d = dc;
        recorder.registerCommand(context, d, () => groogery.delCommand(d));
    }
    context.subscriptions.push(vscode.commands.registerCommand('type', (...args) => {
        groogery.type(...args);
    }));
    recorder.registerCommand(context, 'jump', () => groogery.jump());
    recorder.registerCommand(context, 'fall', () => groogery.fall());
    recorder.registerCommand(context, 'toggleQMK', () => groogery.toggleQMK());
    recorder.registerCommand(context, 'yank', () => groogery.yank());
    recorder.registerCommand(context, 'kill', () => groogery.kill());
    recorder.registerCommand(context, 'ctrlG', () => groogery.ctrlG());
    recorder.registerCommand(context, "multiCommand.execute", multi_command_1.multiCommand);
    for (var th of groogery.typeHandlers) {
        th.register(context, recorder);
    }
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