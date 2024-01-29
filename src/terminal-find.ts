import * as vscode from 'vscode';
import { ColorMode } from './color_mode';
import { TypeHandler } from './handler';
import { CursorMove, DeleteCommand } from './interfaces';
import { Recorder } from './record';
import { Emacs } from './emacs';

export class TerminalFindHandler extends TypeHandler {
  readonly whenContext: string = "terminal.find";

  constructor(cm : ColorMode) {
    super(cm);
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
    recorder.registerCommand(context, 'terminal.find', () => {
      if (this.isActive()) {
        return this.nextMatch();
      }
      return this.activate();
    });
    recorder.registerCommand(context, 'terminal.reverseFind', () => {
      if (this.isActive()) {
        return this.prevMatch();
      }
      return this.activate();
    });

    // Note: this handler is deactivated by ctrlG and that is activated whenever
    // we close or open the panel.
  }

  async ctrlG(): Promise<boolean> {
    // Don't run ctrl+g commands.
    return this.deactivate().then(() => false);
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

  // To paste in the terminal find, we need to right+click and paste
  async onPaste(text: string): Promise<boolean> {
    this.deactivate();
    return true;
  }
  async onEmacsPaste(text: string): Promise<boolean> {
    this.deactivate();
    return true;
  }
}
