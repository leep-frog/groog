import * as vscode from 'vscode';
import { Recorder } from './record';
import { TypeHandler } from './interfaces';

export class MarkHandler implements TypeHandler {
  active: boolean;
  yanked: string;

  constructor() {
    this.active = false;
    this.yanked = "";
  }

  register(context: vscode.ExtensionContext, recorder: Recorder) {
    recorder.registerCommand(context, 'toggleMarkMode', async () => {
      if (this.active) {
        await this.deactivate();
      } else {
        await this.activate();
      }
    });
    recorder.registerCommand(context, 'paste', async () => {
      if (this.active) {
        await this.deactivate();
      }

      await vscode.window.activeTextEditor?.edit(editBuilder => {
        let editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }
        editBuilder.insert(editor.selection.active, this.yanked);
      });
    });
  }

  async activate() {
    this.active = true;
    await vscode.commands.executeCommand('setContext', 'groog.markMode', true);
  }

  async deactivate() {
    this.active = false;
    await vscode.commands.executeCommand('setContext', 'groog.markMode', false);
  }

  async ctrlG() {
    await this.deactivate();
  }

  async textHandler(s: string): Promise<boolean> {
    await this.deactivate();
    return true;
  }

  async moveHandler(vsCommand: string, ...rest: any[]): Promise<boolean> {
    // See below link for cusorMove args (including "select" keyword)
    // https://code.visualstudio.com/api/references/commands
    if (vsCommand === "cursorMove") {
      rest[0].select = true;
      await vscode.commands.executeCommand(vsCommand, ...rest);
    } else {
      await vscode.commands.executeCommand(vsCommand + "Select", ...rest);
    }
    return false;
  }

  async delHandler(s: string): Promise<boolean> {
    await this.deactivate();
    return true;
  }

  async onYank(s: string | undefined) {
    await this.deactivate();
    s ? this.yanked = s : this.yanked = "";
  }

  async alwaysOnYank(): Promise<boolean> {
    return true;
  }

  async onKill(s: string | undefined) {
    await this.deactivate();
    s ? this.yanked = s : this.yanked = "";
  }

  async alwaysOnKill(): Promise<boolean> {
    return true;
  }
}
