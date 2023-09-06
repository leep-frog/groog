import * as vscode from 'vscode';
import { ColorMode, ModeColor } from './color_mode';
import { TypeHandler, getPrefixText } from './handler';
import { CursorMove, DeleteCommand } from './interfaces';
import { Recorder } from './record';

export class MarkHandler extends TypeHandler {
  yanked: string;
  yankedPrefix: string;
  whenContext: string = "mark";

  constructor(cm: ColorMode) {
    super(cm, ModeColor.mark);
    this.yanked = "";
    this.yankedPrefix = "";
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

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const sel = editor.selection;
      const curPrefix = getPrefixText(editor, new vscode.Range(sel.start, sel.end));
      await vscode.window.activeTextEditor?.edit(editBuilder => {
        const whitespaceRegex = /^\s*$/;
        const prefixesWhitespaceOnly = whitespaceRegex.test(this.yankedPrefix) && (!curPrefix || whitespaceRegex.test(curPrefix));
        const replacement = prefixesWhitespaceOnly ? replaceAll(this.yanked, "\n" + this.yankedPrefix, "\n" + curPrefix) : this.yanked;
        editBuilder.delete(editor.selection);
        editBuilder.insert(editor.selection.start, replacement);
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

  async onYank(prefixText: string | undefined, text: string | undefined) {
    await this.deactivate();
    this.yankedPrefix = prefixText ?? "";
    this.yanked = text ?? "";
  }

  alwaysOnYank: boolean = true;

  async onKill(s: string | undefined) {
    await this.deactivate();
    s ? this.yanked = s : this.yanked = "";
    // Yanked text is one line so need to consider the prefix context in this case.
    this.yankedPrefix = "";
  }

  alwaysOnKill: boolean = true;
}

function replaceAll(str: string, remove: string, replace: string): string {
  return str.split(remove).join(replace);
}
