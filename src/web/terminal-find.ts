import * as vscode from 'vscode';
import { CursorMove, DeleteCommand, TypeHandler } from './interfaces';
import { Recorder } from './record';

export class TerminalFindHandler implements TypeHandler {
  active: boolean;

  constructor() {
    this.active = false;
  }

  async nextMatch() {
    await vscode.commands.executeCommand("workbench.action.terminal.findNext");
  }

  async prevMatch() {
    await vscode.commands.executeCommand("workbench.action.terminal.findPrevious");
  }

  async activate() {
    if (!this.active) {
      this.active = true;
      await vscode.commands.executeCommand("workbench.action.terminal.focusFind");
      await vscode.commands.executeCommand('setContext', 'groog.terminal.finding', true);
    }
  }

  async deactivate() {
    if (this.active) {
      this.active = false;
      await vscode.commands.executeCommand("workbench.action.terminal.hideFind");
      await vscode.commands.executeCommand('setContext', 'groog.terminal.finding', false);
    }
  }


  register(context: vscode.ExtensionContext, recorder: Recorder) {
    recorder.registerCommand(context, 'terminal.find', async () => {
      if (this.active) {
        await this.nextMatch();
      } else {
        this.activate();
      }
    });
    recorder.registerCommand(context, 'terminal.reverseFind', async () => {
      if (this.active) {
        await this.prevMatch();
      } else {
        this.activate();
      }
    });
  }

  async ctrlG() {
    await this.deactivate();
  }

  async textHandler(s: string): Promise<boolean> {
    return true;
  }

  async moveHandler(cm: CursorMove): Promise<boolean> {
    switch (cm) {
      case CursorMove.up:
        this.nextMatch();
        break;
      case CursorMove.down:
        this.prevMatch();
        break;
    }
    await this.deactivate();
    return true;
  }

  async delHandler(dc: DeleteCommand): Promise<boolean> {
    return true;
  }

  // TODO: do something like error message or deactivate
  async onYank(s: string | undefined) { }
  async alwaysOnYank(): Promise<boolean> { return false; }
  async onKill(s: string | undefined) { }
  async alwaysOnKill(): Promise<boolean> { return false; }
}
