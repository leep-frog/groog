import * as vscode from 'vscode';
import {Recorder} from './record';
import {MarkHandler} from './mark';
import {FindHandler} from './find';
import {multiCommand} from './multi-command';

const jumpDist = 10;
export const cursorMoves: string[] = [
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

export const deleteCommands: string[] = [
  deleteLeft,
  deleteRight,
  deleteWordLeft,
  deleteWordRight,
];

interface Registerable {
  register(context: vscode.ExtensionContext, recorder: Recorder): void;
}

interface TypeHandler extends Registerable {  
  active: boolean;
  activate(): void;
  deactivate(): void;
  ctrlG(): void;

  onYank(text: string | undefined): void
  alwaysOnYank(): boolean
  onKill(text: string | undefined): void
  alwaysOnKill(): boolean

  // Returns whether or not to still send the code
  textHandler(s: string): boolean;
  delHandler(cmd: string): boolean;
  moveHandler(cmd: string, ...rest: any[]): boolean;

  // TODO pasteHandler
  // TODO escape handler (or just same ctrl g?)
}

export class Emacs {
  private qmk: boolean;
  recorder: Recorder;
  typeHandlers: TypeHandler[];

  constructor() {
    // TODO: store this in persistent storage somewhere
    this.qmk = false;
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

    this.recorder.registerCommand(context, 'toggleQMK', () => this.toggleQMK());
    this.recorder.registerCommand(context, 'yank', () => this.yank());
    this.recorder.registerCommand(context, 'kill', () => this.kill());
    this.recorder.registerCommand(context, 'ctrlG', () => this.ctrlG());

    for (var th of this.typeHandlers) {
      th.register(context, this.recorder);
    }

    this.recorder.registerCommand(context, "multiCommand.execute", multiCommand);
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
      () => {vscode.commands.executeCommand("default:type", ...args);},
    );
  }

  delCommand(d: string) {
    this.runHandlers(
      (th: TypeHandler): boolean => { return th.delHandler(d); },
      () => {vscode.commands.executeCommand(d);},
    );
  }

  toggleQMK() {
    if (this.qmk) {
      vscode.window.showInformationMessage('Basic keyboard mode activated');
    } else {
      vscode.window.showInformationMessage('QMK keyboard mode activated');
    }
		this.qmk = !this.qmk;
    vscode.commands.executeCommand('setContext', 'groog.qmk', this.qmk);
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
    vscode.commands.executeCommand("cancelSelection");
    vscode.commands.executeCommand("closeFindWidget");
    vscode.commands.executeCommand("removeSecondaryCursors");
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
    this.move("cursorMove", {"to": "up", "by": "line", "value": jumpDist});
  }

  // C-v
  fall() {
    this.move("cursorMove", {"to": "down", "by": "line", "value": jumpDist});
  }

  move(vsCommand: string, ...rest: any[]) {
    this.runHandlers(
      (th: TypeHandler): boolean => { return th.moveHandler(vsCommand, ...rest); },
      () => {vscode.commands.executeCommand(vsCommand, ...rest);},
    );
  }
}

class TypeArg {
  text: string;

  constructor(text: string) {
    this.text = "";
  }
}
