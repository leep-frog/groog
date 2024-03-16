import * as vscode from 'vscode';
import { ColorMode, HandlerColoring, gutterHandlerColoring } from './color_mode';
import { Emacs } from './emacs';
import { TypeHandler, getPrefixText } from './handler';
import { CtrlGCommand, CursorMove, DeleteCommand } from './interfaces';
import { Recorder } from './record';

export class MarkHandler extends TypeHandler {
  yanked: string;
  yankedPrefix: string;
  readonly whenContext: string = "mark";
  private emacs: Emacs;
  private keepSelectionOnDeactivation: boolean;

  constructor(cm: ColorMode, emacs: Emacs) {
    super(cm);
    this.yanked = "";
    this.yankedPrefix = "";
    this.emacs = emacs;
    this.keepSelectionOnDeactivation = false;
  }

  getColoring(context: vscode.ExtensionContext): HandlerColoring {
    return gutterHandlerColoring(context, "mark");
  }

  registerHandler(context: vscode.ExtensionContext, recorder: Recorder) {
    recorder.registerCommand(context, 'toggleMarkMode', () => {
      if (this.isActive()) {
        return this.deactivate();
      }
      return this.activate();
    });
    recorder.registerCommand(context, 'emacsPaste', async (): Promise<any> => {
      return this.deactivate().then(() => {
        // Use runHandlers to check if other handlers should handle the pasting instead.
        return this.emacs.runHandlers(
          async (th: TypeHandler) => th.onEmacsPaste(this.yanked),
          async () => this.paste(this.yankedPrefix, this.yanked),
        );
      });
    });
    recorder.registerCommand(context, 'paste', async (): Promise<any> => {
      // For paste, we assume that the first and second line are indented the same amount
      return vscode.env.clipboard.readText().then(text => {

        // Use runHandlers to check if other handlers should handle the pasting isntead.
        this.emacs.runHandlers(
          async (th: TypeHandler) => th.onPaste(text),
          async () => {
            const prefixRegex = /^(\s*)/;
            let prefix: string = prefixRegex.exec(text)?.[0] || "";

            // If no prefix, then check the second line of the copied text (if it exists)
            if (!prefix) {
              const lines: string[] = text.split("\n");
              if (lines.length > 1) {
                prefix = prefixRegex.exec(lines[1])?.[0] || "";
              }
            }

            const pasteText: string = text.replace(prefixRegex, "");
            return this.paste(prefix, pasteText).then(pasted => pasted ? false : vscode.commands.executeCommand("editor.action.clipboardPasteAction"));
          }
        );
      });
    });
  }

  async paste(prefixText: string, text: string): Promise<boolean> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return false;
    }

    return editor.edit(editBuilder => {
      for (const sel of editor.selections) {
        const curPrefix = getPrefixText(editor, new vscode.Range(sel.start, sel.end));
        const whitespaceRegex = /^\s*$/;
        const prefixesWhitespaceOnly = whitespaceRegex.test(prefixText) && (!curPrefix || whitespaceRegex.test(curPrefix));
        const replacement = prefixesWhitespaceOnly ? replaceAll(text, "\n" + prefixText, "\n" + curPrefix) : text;
        editBuilder.delete(sel);
        editBuilder.insert(sel.start, replacement);
      }
    }).then(() => true);
  }

  async handleActivation() {}
  onRedundantActivate(): void {}

  async handleDeactivation() {
    // Don't cancel the selection on delete command
    if (this.keepSelectionOnDeactivation) {
      this.keepSelectionOnDeactivation = false;
    } else {
      vscode.commands.executeCommand(CtrlGCommand.CancelSelection);
    }
  }

  async ctrlG(): Promise<boolean> {
    // Don't run ctrl+g commands.
    return this.deactivate().then(() => false);
  }

  async textHandler(s: string): Promise<boolean> {
    this.keepSelectionOnDeactivation = true;
    return this.deactivate().then(() => true);
  }

  async moveHandler(vsCommand: CursorMove, ...rest: any[]): Promise<boolean> {
    // See below link for cusorMove args (including "select" keyword)
    // https://code.visualstudio.com/api/references/commands
    if (vsCommand === CursorMove.Move) {
      rest[0].select = true;
      return vscode.commands.executeCommand(vsCommand, ...rest).then(() => false);
    }
    return vscode.commands.executeCommand(vsCommand + "Select", ...rest).then(() => false);
  }

  async delHandler(s: DeleteCommand): Promise<boolean> {
    this.keepSelectionOnDeactivation = true;
    return this.deactivate().then(() => true);
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

  async onPaste(text: string): Promise<boolean> {
    return true;
  }
  async onEmacsPaste(text: string): Promise<boolean> {
    return true;
  }

  async testReset() {}
}

function replaceAll(str: string, remove: string, replace: string): string {
  return str.split(remove).join(replace);
}
