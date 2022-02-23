import * as vscode from 'vscode';
import {Recorder} from './record';

export class FindHandler {
  active: boolean;
  findText: string;
  cursorStack: CursorStack;

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

  register(context: vscode.ExtensionContext, recorder: Recorder) {
    recorder.registerCommand(context, 'find', () => {
      if (this.active) {
        this.nextMatch();
      } else {
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
  }

  findWithArgs() {
    if (this.findText.length === 0) {
      vscode.commands.executeCommand("editor.actions.findWithArgs", {"searchString": "ENTER" + "_TEXT"});
    } else {
      vscode.commands.executeCommand("editor.actions.findWithArgs", {"searchString": this.findText});
    }
    vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    this.cursorToFront();
    this.nextMatch();
  }

  ctrlG() {
    this.deactivate();
  }

  textHandler(s: string): boolean {
    if (s === "\n") {
      // TODO: shift enter
      this.nextMatch();
      return false;
    }
    this.findText = this.findText.concat(s);
    this.cursorStack.push();
    this.findWithArgs();
    return false;
  }

  moveHandler(s: string): boolean {
    // TODO: ctrl+p previous match? Or ctrl+shift+p (and ctrl+n for next)
    this.deactivate();
    return true;
  }

  delHandler(s: string): boolean {
    switch (s) {
      case "deleteLeft":
        this.findText = this.findText.slice(0, this.findText.length-1);
        this.cursorStack.popAndSet();
        this.findWithArgs();
        break;
      default:
        vscode.window.showInformationMessage("Unsupported find command: " + s);
      }
    return false;
  }

  // TODO: do something like error message or deactivate
  onYank(s: string | undefined) {}
  onKill(s: string | undefined) {}
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