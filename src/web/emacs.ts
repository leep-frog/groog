import * as vscode from 'vscode';
import {Recorder} from './record';
import {MarkHandler} from './mark';
import {FindHandler} from './find';

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
  onKill(text: string | undefined): void

  // Returns whether or not to still send the code
  textHandler(s: string): boolean;
  delHandler(cmd: string): boolean;
  moveHandler(cmd: string, ...rest: any[]): boolean;

  // TODO pasteHandler
  // TODO escape handler (or just same ctrl g?)
  // TODO: enterHandler (or just defer to type handlers?)
}

export class Emacs {
  private qmk: boolean;
  // TODO: Move these to Finder type

  recorder: Recorder;
  typeHandlers: TypeHandler[];

  constructor(r: Recorder) {
    // TODO: store this in persistent storage somewhere
    this.qmk = false;
    this.recorder = new Recorder();
    this.typeHandlers = [
      new FindHandler(),
      new MarkHandler(),
      this.recorder,
    ];
  }

  register(context: vscode.ExtensionContext, recorder: Recorder) {
    for (var move of cursorMoves) {
      const m = move;
      recorder.registerCommand(context, move, () => this.move(m));
    }
    for (var dc of deleteCommands) {
      const d = dc;
      recorder.registerCommand(context, d, () => this.delCommand(d));
    }

    context.subscriptions.push(vscode.commands.registerCommand('type', (...args: any[]) => {
      this.type(...args);
    }));

    recorder.registerCommand(context, 'jump', () => this.jump());
    recorder.registerCommand(context, 'fall', () => this.fall());

    recorder.registerCommand(context, 'toggleQMK', () => this.toggleQMK());
    recorder.registerCommand(context, 'yank', () => this.yank());
    recorder.registerCommand(context, 'kill', () => this.kill());
    recorder.registerCommand(context, 'ctrlG', () => this.ctrlG());

    for (var th of this.typeHandlers) {
      th.register(context, recorder);
    }
  }

  type(...args: any[]) {
    if (!vscode.window.activeTextEditor) {
      vscode.window.showInformationMessage("NOT TEXT EDITOR?!?!");
		}

    let apply = true;
    let s = (args[0] as TypeArg).text;
    for (var th of this.typeHandlers) {
      if (th.active) {
        apply &&= th.textHandler(s);
      }
    }
    if (apply) {
      vscode.commands.executeCommand("default:type", ...args);
    }
  }

  delCommand(d: string) {
    let apply = true;
    for (var th of this.typeHandlers) {
      if (th.active) {
        apply &&= th.delHandler(d);
      }
    }
    if (apply) {
      vscode.commands.executeCommand(d);
    }
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
    let apply = true;
    for (var th of this.typeHandlers) {
      if (th.active) {
        apply &&= th.moveHandler(vsCommand, ...rest);
      }
    }
    if (apply) {
      vscode.commands.executeCommand(vsCommand, ...rest);
    }
  }
}

class TypeArg {
  text: string;

  constructor(text: string) {
    this.text = "";
  }
}
