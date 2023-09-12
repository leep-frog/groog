import * as vscode from 'vscode';
import { ColorMode } from './color_mode';
import { TypeHandler } from './handler';
import { CursorMove, DeleteCommand } from './interfaces';
import { Recorder } from './record';
import { Emacs } from './emacs';

export class TerminalFindHandler extends TypeHandler {
  whenContext: string = "terminal.find";
  private emacs: Emacs;

  constructor(cm : ColorMode, emacs: Emacs) {
    super(cm);
    this.emacs = emacs;
  }

  async nextMatch(): Promise<void> {
    return vscode.commands.executeCommand("workbench.action.terminal.findNext");
  }

  async prevMatch(): Promise<void> {
    await vscode.commands.executeCommand("workbench.action.terminal.findPrevious");
  }

  async handleActivation(): Promise<void> {
    return vscode.commands.executeCommand("workbench.action.terminal.focusFind");
  }

  async handleDeactivation(): Promise<void> {
    return vscode.commands.executeCommand("workbench.action.terminal.hideFind");
  }

  register(context: vscode.ExtensionContext, recorder: Recorder) {
    recorder.registerCommand(context, 'terminal.find', this.emacs.lockWrap(() => {
      if (this.isActive()) {
        return this.nextMatch();
      }
      return this.activate();
    }));
    recorder.registerCommand(context, 'terminal.reverseFind', this.emacs.lockWrap(() => {
      if (this.isActive()) {
        return this.prevMatch();
      }
      return this.activate();
    }));
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
  async onYank() { }
  alwaysOnYank: boolean = false;
  async onKill() { }
  alwaysOnKill: boolean = false;
}
