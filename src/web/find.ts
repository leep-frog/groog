import * as vscode from 'vscode';
import { Recorder } from './record';
import { TypeHandler } from './interfaces';

export class FindHandler implements TypeHandler {
  active: boolean;
  findText: string;
  cursorStack: CursorStack;

  constructor() {
    this.active = false;
    this.findText = "";
    this.cursorStack = new CursorStack();
  }

  nextMatch() {
    // Then find next match
    vscode.commands.executeCommand("editor.action.nextMatchFindAction");
  }

  prevMatch() {
    vscode.commands.executeCommand("editor.action.previousMatchFindAction");
  }

  register(context: vscode.ExtensionContext, recorder: Recorder) {
    recorder.registerCommand(context, 'find', () => {
      if (this.active) {
        this.nextMatch();
      } else {
        this.activate();
      }
    });
    recorder.registerCommand(context, 'reverseFind', () => {
      if (this.active) {
        this.prevMatch();
      } else {
        this.activate();
      }
    });
    vscode.window.onDidChangeActiveTextEditor(() => {
      this.deactivate();
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
    // TODO: make text clearing optional? Differentiate in activate maybe?
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
    }
    );
    cursorToFront();
    this.nextMatch();
  }

  ctrlG() {
    this.deactivate();
  }

  textHandler(s: string): boolean {
    // Enter, shift+enter, ctrl+n, ctrl+p taken care of in package.json
    this.findText = this.findText.concat(s);
    this.cursorStack.push();
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
        if (this.findText.length > 0) {
          this.findText = this.findText.slice(0, this.findText.length - 1);
          this.cursorStack.popAndSet();
          this.findWithArgs();
        }
        break;
      default:
        vscode.window.showInformationMessage("Unsupported find command: " + s);
    }
    return false;
  }

  // TODO: do something like error message or deactivate
  onYank(s: string | undefined) { }
  alwaysOnYank(): boolean { return false; }
  onKill(s: string | undefined) { }
  alwaysOnKill(): boolean { return false; }
}

class CursorStack {
  selections: vscode.Position[];

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
      // No longer error here since we can run out of cursor positions if
      // we start a search with a non-empty findText.
      // vscode.window.showErrorMessage("Ran out of cursor positions");
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

export function cursorToFront() {
    // Move cursor to beginning of selection
    let editor = vscode.window.activeTextEditor;
    if (editor) {
      let startPos = editor.selection.start;
      editor.selection = new vscode.Selection(startPos, startPos);
    }
  }