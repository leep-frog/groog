import * as vscode from 'vscode';
import {Recorder} from './record';

const jumpDist = 10;
export const cursorMoves: string[] = [
  "cursorUp", "cursorDown", "cursorLeft", "cursorRight",
  "cursorHome", "cursorEnd",
  "cursorWordLeft", "cursorWordRight",
  "cursorTop", "cursorBottom"
];

export class Emacs {
  private qmk: boolean;
  // TODO: Move these to Finder type

  typeHandlers: TypeHandler[];

  constructor(r: Recorder) {
    // TODO: store this in persistent storage somewhere
    this.qmk = false;
    this.typeHandlers = [
      //new FindHandler(),
      new MarkHandler(),
      r,
    ];
  }

  register(context: vscode.ExtensionContext, recorder: Recorder) {
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
        apply &&= th.textHandler(d);
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

interface TypeHandler {
  register(context: vscode.ExtensionContext, recorder: Recorder): void;
  active: boolean;
  activate(): void;
  deactivate(): void;
    ctrlG(): void;

  onYank(text: string | undefined): void
  onKill(text: string | undefined): void
  // TODO pasteHandler
  // TODO escape handler (or just same ctrl g?)
  // TODO: enterHandler
  // Returns whether or not to still send the code
  textHandler(s: string): boolean;
  delHandler(cmd: string): boolean;
  moveHandler(cmd: string, ...rest: any[]): boolean;
}

class FindHandler {
  active: boolean;
  findText: string;

  constructor() {
    this.active = false;
    this.findText = "";
  }

  register(context: vscode.ExtensionContext, recorder: Recorder) {
    recorder.registerCommand(context, 'find', () => {
      if (this.active) {
        // Go to next find
        vscode.commands.executeCommand("editor.action.moveSelectionToNextFindMatch");
      } else {
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
      vscode.commands.executeCommand("editor.actions.findWithArgs", {"searchString": "ENTER_TEXT"});
    } else {
      vscode.commands.executeCommand("editor.actions.findWithArgs", {"searchString": this.findText});
    }
    vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
  }

  ctrlG() {
    this.deactivate();
  }

  textHandler(s: string): boolean {
    this.findText = this.findText.concat(s);
    this.findWithArgs();
    return false;
  }

  moveHandler(s: string): boolean {
    this.deactivate();
    return true;
  }

  delHandler(s: string): boolean {
    switch (s) {
      case "deleteLeft":
        this.findText = this.findText.slice(0, this.findText.length-1);
        this.findWithArgs();
      default:
        vscode.window.showInformationMessage("Unsupported find command: " + s);
      }
    return false;
  }

  onYank(s: string | undefined) {}
  onKill(s: string | undefined) {}
}

class MarkHandler {
  active: boolean;
  yanked: string;

  constructor() {
    this.active = false;
    this.yanked = "";
  }

  register(context: vscode.ExtensionContext, recorder: Recorder) {
    recorder.registerCommand(context, 'toggleMarkMode', () => {
      if (this.active) {
        this.deactivate();
      } else {
        this.activate();
      }
    });
    recorder.registerCommand(context, 'paste', () => {
      if (this.active) {
        this.deactivate();
      }

      vscode.window.activeTextEditor?.edit(editBuilder => {
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

  textHandler(s: string): boolean {
    this.deactivate();
    return true;
  }

  moveHandler(vsCommand: string, ...rest: any[]): boolean {
    vscode.commands.executeCommand(vsCommand + "Select", ...rest);
    return false;
  }

  delHandler(s: string): boolean {
    this.deactivate();
    return true;
  }

  
  onYank(s: string | undefined) {
    this.deactivate();
    s ? this.yanked = s : this.yanked = "";
  }

  onKill(s: string | undefined) {
    this.deactivate();
    s ? this.yanked = s : this.yanked = "";
  }
}

class TypeArg {
  text: string;

  constructor(text: string) {
    this.text = "";
  }
}