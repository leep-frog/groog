import * as vscode from 'vscode';
import {Recorder} from './record';

export class MarkHandler {
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
    // See below link for cusorMove args (including "select" keyword)
    // https://code.visualstudio.com/api/references/commands
    if (vsCommand === "cursorMove") {
      rest[0].select = true;
      vscode.commands.executeCommand(vsCommand, ...rest);
    } else {
      vscode.commands.executeCommand(vsCommand + "Select", ...rest);
    }
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