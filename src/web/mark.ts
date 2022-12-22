import * as vscode from 'vscode';
import { ColorMode, ModeColor } from './color_mode';
import { TypeHandler } from './handler';
import { CursorMove, DeleteCommand } from './interfaces';
import { Recorder } from './record';

export class MarkHandler extends TypeHandler {
  yanked: string;
  whenContext: string = "groog.markMode";

  constructor(cm: ColorMode) {
    super(cm, ModeColor.mark);
    this.yanked = "";
  }

  register(context: vscode.ExtensionContext, recorder: Recorder) {
    recorder.registerCommand(context, 'toggleMarkMode', async () => {
      if (this.isActive()) {
        await this.deactivate();
      } else {
        await this.activate();
      }
    });
    recorder.registerCommand(context, 'paste', async () => {
      if (this.isActive()) {
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

  async handleActivation() {}

  async handleDeactivation() {}

  async ctrlG() {
    await this.deactivate();
  }

  async textHandler(s: string): Promise<boolean> {
    await this.deactivate();
    return true;
  }

  async moveHandler(vsCommand: CursorMove, ...rest: any[]): Promise<boolean> {
    // See below link for cusorMove args (including "select" keyword)
    // https://code.visualstudio.com/api/references/commands
    if (vsCommand === CursorMove.move) {
      rest[0].select = true;
      await vscode.commands.executeCommand(vsCommand, ...rest);
    } else {
      await vscode.commands.executeCommand(vsCommand + "Select", ...rest);
    }
    return false;
  }

  async delHandler(s: DeleteCommand): Promise<boolean> {
    await this.deactivate();
    return true;
  }

  async onYank(s: string | undefined) {
    await this.deactivate();
    s ? this.yanked = s : this.yanked = "";
  }

  alwaysOnYank: boolean = true;

  async onKill(s: string | undefined) {
    await this.deactivate();
    s ? this.yanked = s : this.yanked = "";
  }

  alwaysOnKill: boolean = true;
}
