/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Emacs = exports.deleteCommands = exports.cursorMoves = void 0;
const vscode = __webpack_require__(2);
const record_1 = __webpack_require__(3);
const mark_1 = __webpack_require__(4);
const find_1 = __webpack_require__(5);
const multi_command_1 = __webpack_require__(6);
const jumpDist = 10;
exports.cursorMoves = [
    "cursorUp",
    "cursorDown",
    "cursorLeft",
    "cursorRight",
    "cursorHome",
    "cursorEnd",
    "cursorWordLeft",
    "cursorWordRight",
    "cursorTop",
    "cursorBottom"
];
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
class Emacs {
    constructor() {
        // TODO: store this in persistent storage somewhere
        this.qmk = false;
        this.recorder = new record_1.Recorder();
        this.typeHandlers = [
            new find_1.FindHandler(),
            new mark_1.MarkHandler(),
            this.recorder,
        ];
    }
    register(context) {
        for (var move of exports.cursorMoves) {
            const m = move;
            this.recorder.registerCommand(context, move, () => this.move(m));
        }
        for (var dc of exports.deleteCommands) {
            const d = dc;
            this.recorder.registerCommand(context, d, () => this.delCommand(d));
        }
        context.subscriptions.push(vscode.commands.registerCommand('type', (...args) => {
            this.type(...args);
        }));
        this.recorder.registerCommand(context, 'jump', () => this.jump());
        this.recorder.registerCommand(context, 'fall', () => this.fall());
        this.recorder.registerCommand(context, 'toggleQMK', () => this.toggleQMK());
        this.recorder.registerCommand(context, 'yank', () => this.yank());
        this.recorder.registerCommand(context, 'kill', () => this.kill());
        this.recorder.registerCommand(context, 'ctrlG', () => this.ctrlG());
        for (var th of this.typeHandlers) {
            th.register(context, this.recorder);
        }
        this.recorder.registerCommand(context, "multiCommand.execute", multi_command_1.multiCommand);
    }
    runHandlers(thCallback, applyCallback) {
        let apply = true;
        for (var th of this.typeHandlers) {
            if (th.active) {
                if (!thCallback(th)) {
                    // Note, we can't do "apply &&= th.textHandler" because
                    // if apply is set to false at some point, then later
                    // handlers won't run
                    apply = false;
                }
            }
        }
        if (apply) {
            applyCallback();
        }
    }
    type(...args) {
        if (!vscode.window.activeTextEditor) {
            vscode.window.showInformationMessage("NOT TEXT EDITOR?!?!");
        }
        let s = args[0].text;
        this.runHandlers((th) => { return th.textHandler(s); }, () => { vscode.commands.executeCommand("default:type", ...args); });
    }
    delCommand(d) {
        this.runHandlers((th) => { return th.delHandler(d); }, () => { vscode.commands.executeCommand(d); });
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
            if (th.active || th.alwaysOnYank()) {
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
            if (th.active || th.alwaysOnKill()) {
                th.onKill(text);
            }
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
        this.runHandlers((th) => { return th.moveHandler(vsCommand, ...rest); }, () => { vscode.commands.executeCommand(vsCommand, ...rest); });
    }
}
exports.Emacs = Emacs;
class TypeArg {
    constructor(text) {
        this.text = "";
    }
}


/***/ }),
/* 2 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 3 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Recorder = void 0;
const vscode = __webpack_require__(2);
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
        this.addRecord(new Record(command, args));
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
            sl.push(record.command);
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
        this.addRecord(new Record("type", [{ "text": s }]));
        return true;
    }
    // All these functions are associated with a "groog.*" command so these are
    // already added to the record book via the "type" command handling
    onKill(s) { }
    alwaysOnKill() { return false; }
    ctrlG() { }
    onYank(s) { }
    alwaysOnYank() { return false; }
    delHandler(s) {
        return true;
    }
    moveHandler(vsCommand, ...rest) {
        return true;
    }
}
exports.Recorder = Recorder;
class Record {
    constructor(command, args) {
        this.command = command;
        this.args = args;
    }
}


/***/ }),
/* 4 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MarkHandler = void 0;
const vscode = __webpack_require__(2);
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
        // See below link for cusorMove args (including "select" keyword)
        // https://code.visualstudio.com/api/references/commands
        if (vsCommand === "cursorMove") {
            rest[0].select = true;
            vscode.commands.executeCommand(vsCommand, ...rest);
        }
        else {
            vscode.commands.executeCommand(vsCommand + "Select", ...rest);
        }
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
    alwaysOnYank() {
        return true;
    }
    onKill(s) {
        this.deactivate();
        s ? this.yanked = s : this.yanked = "";
    }
    alwaysOnKill() {
        return true;
    }
}
exports.MarkHandler = MarkHandler;


/***/ }),
/* 5 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.FindHandler = void 0;
const vscode = __webpack_require__(2);
class FindHandler {
    constructor() {
        this.active = false;
        this.findText = "";
        this.cursorStack = new CursorStack();
    }
    cursorToFront() {
        // Move cursor to beginning of selection
        let editor = vscode.window.activeTextEditor;
        if (editor) {
            let startPos = editor.selection.start;
            editor.selection = new vscode.Selection(startPos, startPos);
        }
    }
    nextMatch() {
        // Then find next match
        vscode.commands.executeCommand("editor.action.nextMatchFindAction");
    }
    prevMatch() {
        vscode.commands.executeCommand("editor.action.previousMatchFindAction");
    }
    register(context, recorder) {
        // TODO: cache previous find
        recorder.registerCommand(context, 'find', () => {
            if (this.active) {
                this.nextMatch();
            }
            else {
                this.activate();
            }
        });
        recorder.registerCommand(context, 'reverseFind', () => {
            if (this.active) {
                this.prevMatch();
            }
            else {
                this.activate();
            }
        });
    }
    activate() {
        this.active = true;
        vscode.commands.executeCommand('setContext', 'groog.findMode', true);
        this.findWithArgs();
    }
    deactivate() {
        this.active = false;
        vscode.commands.executeCommand('setContext', 'groog.findMode', false);
        this.findText = "";
        this.cursorStack.clear();
        vscode.commands.executeCommand("cancelSelection");
        vscode.commands.executeCommand("closeFindWidget");
    }
    findWithArgs() {
        let txt = this.findText;
        if (this.findText.length === 0) {
            txt = "ENTER" + "_TEXT";
        }
        vscode.commands.executeCommand("editor.actions.findWithArgs", { "searchString": txt }).then(() => {
            vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
        }, () => {
            vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
        });
        this.cursorToFront();
        this.nextMatch();
    }
    ctrlG() {
        this.deactivate();
    }
    textHandler(s) {
        // Enter, shift+enter, ctrl+n, ctrl+p taken care of in package.json
        this.findText = this.findText.concat(s);
        this.cursorStack.push();
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
                this.cursorStack.popAndSet();
                this.findWithArgs();
                break;
            default:
                vscode.window.showInformationMessage("Unsupported find command: " + s);
        }
        return false;
    }
    // TODO: do something like error message or deactivate
    onYank(s) { }
    alwaysOnYank() { return false; }
    onKill(s) { }
    alwaysOnKill() { return false; }
}
exports.FindHandler = FindHandler;
class CursorStack {
    constructor() {
        this.selections = [];
    }
    push() {
        let editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("Couldn't find active editor");
            this.selections.push(new vscode.Position(0, 0));
            return;
        }
        this.selections.push(new vscode.Position(editor.selection.start.line, editor.selection.start.character));
    }
    popAndSet() {
        let p = this.selections.pop();
        if (!p) {
            vscode.window.showErrorMessage("Ran out of cursor positions");
            return;
        }
        let editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("Undefined editor");
            return;
        }
        // https://github.com/microsoft/vscode/issues/111#issuecomment-157998910
        editor.selection = new vscode.Selection(p, p);
    }
    clear() {
        this.selections = [];
    }
}


/***/ }),
/* 6 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.multiCommand = void 0;
const vscode = __webpack_require__(2);
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
const emacs_1 = __webpack_require__(1);
const groogery = new emacs_1.Emacs();
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    groogery.register(context);
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