import * as vscode from 'vscode';
import { Recorder } from './record';
import { MarkHandler } from './mark';
import { FindHandler } from './find';
import { multiCommand } from './multi-command';
import { TypeHandler } from './interfaces';

const jumpDist = 10;
export const cursorMoves: string[] = [
  // Note: if you are receiving an error of the form
  // `command "groog.cursorUp" already exists`, it is probably
  // because this extension is installed twice. Once as a regular
  // extension and once as the development extension. Disable
  // the regular extension to get the correct behavior.
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

const ctrlGCommands: string[] = [
  "cancelSelection",
  "closeFindWidget",
  "closeParameterHints",
  "removeSecondaryCursors",
];

const deleteLeft = "deleteLeft";
const deleteRight = "deleteRight";
const deleteWordLeft = "deleteWordLeft";
const deleteWordRight = "deleteWordRight";

export const deleteCommands: string[] = [
  deleteLeft,
  deleteRight,
  deleteWordLeft,
  deleteWordRight,
];

const qmkKey = "groog.keys.qmkState";

class GlobalStateTracker<T> {
  private key: string;

  constructor(key: string) {
    this.key = key;
  }

  get(context: vscode.ExtensionContext): T | undefined {
    return context.globalState.get<T>(this.key);
  }

  update(context: vscode.ExtensionContext, t: T) {
    context.globalState.update(this.key, t);
  }
}

export class Emacs {
  private qmk: GlobalStateTracker<boolean>;
  recorder: Recorder;
  typeHandlers: TypeHandler[];

  constructor() {
    this.qmk = new GlobalStateTracker<boolean>(qmkKey);
    this.recorder = new Recorder();
    this.typeHandlers = [
      new FindHandler(),
      new MarkHandler(),
      this.recorder,
    ];
  }

  register(context: vscode.ExtensionContext) {
    for (var move of cursorMoves) {
      const m = move;
      this.recorder.registerCommand(context, move, () => this.move(m));
    }
    for (var dc of deleteCommands) {
      const d = dc;
      this.recorder.registerCommand(context, d, () => this.delCommand(d));
    }

    context.subscriptions.push(vscode.commands.registerCommand('type', (...args: any[]) => {
      this.type(...args);
    }));

    this.recorder.registerCommand(context, 'jump', () => this.jump());
    this.recorder.registerCommand(context, 'fall', () => this.fall());
    this.recorder.registerCommand(context, 'format', () => this.format());

    this.recorder.registerCommand(context, 'toggleQMK', () => this.toggleQMK(context));
    this.recorder.registerCommand(context, 'yank', () => this.yank());
    this.recorder.registerCommand(context, 'kill', () => this.kill());
    this.recorder.registerCommand(context, 'ctrlG', () => this.ctrlG());

    // This needs to be a groog command so it can be recorded.
    this.recorder.registerCommand(context, 'undo', () => vscode.commands.executeCommand("undo"));

    for (var th of this.typeHandlers) {
      th.register(context, this.recorder);
    }

    this.recorder.registerCommand(context, "multiCommand.execute", multiCommand);

    // After all commands have been registered, check persistent data for qmk setting.
    this.setQMK(context, this.qmk.get(context));
  }

  runHandlers(thCallback: (th: TypeHandler) => boolean, applyCallback: () => void) {
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

  type(...args: any[]) {
    if (!vscode.window.activeTextEditor) {
      vscode.window.showInformationMessage("NOT TEXT EDITOR?!?!");
    }

    let s = (args[0] as TypeArg).text;
    this.runHandlers(
      (th: TypeHandler): boolean => { return th.textHandler(s); },
      () => { vscode.commands.executeCommand("default:type", ...args); },
    );
  }

  delCommand(d: string) {
    this.runHandlers(
      (th: TypeHandler): boolean => { return th.delHandler(d); },
      () => { vscode.commands.executeCommand(d); },
    );
  }

  toggleQMK(context: vscode.ExtensionContext) {
    this.setQMK(context, !this.qmk.get(context));
  }

  setQMK(context: vscode.ExtensionContext, bu: boolean | undefined) {
    let b = bu || false;
    if (b) {
      vscode.window.showInformationMessage('QMK keyboard mode activated');
    } else {
      vscode.window.showInformationMessage('Basic keyboard mode activated');
    }
    this.qmk.update(context, b);
    vscode.commands.executeCommand('setContext', 'groog.qmk', b);
  }

  yank() {
    let range = vscode.window.activeTextEditor?.selection;
    let maybe = vscode.window.activeTextEditor?.document.getText(range);
    if (maybe) {
      vscode.window.activeTextEditor?.edit(editBuilder => {
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
    for (var cmd of ctrlGCommands) {
      vscode.commands.executeCommand(cmd);
    }
  }

  kill() {
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
    vscode.window.activeTextEditor?.edit(editBuilder => {
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

  move(vsCommand: string, ...rest: any[]) {
    this.runHandlers(
      (th: TypeHandler): boolean => { return th.moveHandler(vsCommand, ...rest); },
      () => { vscode.commands.executeCommand(vsCommand, ...rest); },
    );
  }

  format() {
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    if (editor.selection.isEmpty) {
      vscode.commands.executeCommand("editor.action.formatDocument");
      vscode.commands.executeCommand("editor.action.trimTrailingWhitespace");
    } else {
      vscode.commands.executeCommand("editor.action.formatSelection");
    }
  }
}

class TypeArg {
  text: string;

  constructor(text: string) {
    this.text = "";
  }
}
