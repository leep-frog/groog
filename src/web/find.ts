import * as vscode from 'vscode';
import {Recorder} from './record';

export class FindHandler {
  active: boolean;
  findText: string;

  constructor() {
    this.active = false;
    this.findText = "";
  }

  nextMatch() {
    vscode.commands.executeCommand("editor.action.moveSelectionToNextFindMatch");
  }

  prevMatch() {
    vscode.commands.executeCommand("editor.action.moveSelectionToPreviousFindMatch");
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
    // TODO: ctrl+p previous match? Or ctrl+shift+p (and ctrl+n for next)
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