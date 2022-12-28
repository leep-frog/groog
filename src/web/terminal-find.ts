import * as vscode from 'vscode';
import { ColorMode } from './color_mode';
import { TypeHandler } from './handler';
import { CursorMove, DeleteCommand } from './interfaces';
import { Recorder } from './record';

export class TerminalFindHandler extends TypeHandler {
  whenContext: string = "terminal.find";

  constructor(cm : ColorMode) {
    super(cm);
  }

  async nextMatch() {
    await vscode.commands.executeCommand("workbench.action.terminal.findNext");
  }

  async prevMatch() {
    await vscode.commands.executeCommand("workbench.action.terminal.findPrevious");
  }

  async handleActivation() {
    await vscode.commands.executeCommand("workbench.action.terminal.focusFind");
  }

  async handleDeactivation() {
    await vscode.commands.executeCommand("workbench.action.terminal.hideFind");
  }

  register(context: vscode.ExtensionContext, recorder: Recorder) {
    recorder.registerCommand(context, 'terminal.find', async () => {
      if (this.isActive()) {
        await this.nextMatch();
      } else {
        this.activate();
      }
    });
    recorder.registerCommand(context, 'terminal.reverseFind', async () => {
      if (this.isActive()) {
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
  alwaysOnYank: boolean = false;
  async onKill(s: string | undefined) { }
  alwaysOnKill: boolean = false;
}
