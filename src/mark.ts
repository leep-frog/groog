import * as vscode from 'vscode';
import { ColorMode, HandlerColoring, gutterHandlerColoring } from './color_mode';
import { Copier } from './copier';
import { Emacs } from './emacs';
import { TypeHandler } from './handler';
import { CtrlGCommand, CursorMove, DeleteCommand } from './interfaces';
import { Recorder } from './record';

export class MarkHandler extends TypeHandler {
  yanked: string;
  yankedPrefix: string;
  yankedIndentation?: string;
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
      this.keepSelectionOnDeactivation = true;
      return this.deactivate().then(() => {
        // Use runHandlers to check if other handlers should handle the pasting instead.
        return this.emacs.runHandlers(
          async (th: TypeHandler) => th.onEmacsPaste(this.yanked),
          async () => {
            const prefixHasNonWhitespace = /[^\s]/.test(this.yankedPrefix);
            return this.applyPaste(this.yanked, this.yankedIndentation, /^\s*/.exec(this.yankedPrefix)?.at(0)!, prefixHasNonWhitespace);
          },
        );
      });
    });
    recorder.registerCommand(context, 'paste', async (): Promise<any> => {
      // For paste, we assume that the first and second line are indented the same amount
      return vscode.env.clipboard.readText().then(text => {

        // Use runHandlers to check if other handlers should handle the pasting isntead.
        return this.emacs.runHandlers(
          async (th: TypeHandler) => th.onPaste(text),
          async () => this.applyPaste(text).then(pasted => pasted ? false : vscode.commands.executeCommand("editor.action.clipboardPasteAction")),
        );
      });
    });
  }

  async applyPaste(text: string, fromIndentation?: string, fixedFirstLineIndentation?: string, firstLinePrefixHasText?: boolean) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return false;
    }

    const copier = new Copier(text, fromIndentation, fixedFirstLineIndentation, firstLinePrefixHasText);
    return copier.apply(editor);
  }

  async handleActivation() {
    // This can be set (and never unset) when running emacsPaste command when this isn't active
    // Rather than only fix there, be sure to always clear this when activating
    this.keepSelectionOnDeactivation = false;
  }
  onRedundantActivate(): void { }

  async handleDeactivation() {
    // Don't cancel the selection on delete command
    if (this.keepSelectionOnDeactivation) {
      this.keepSelectionOnDeactivation = false;
    } else {
      await vscode.commands.executeCommand(CtrlGCommand.CancelSelection);
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

  async moveHandler(vsCommand: CursorMove, ...args: any[]): Promise<boolean> {
    // See below link for cusorMove args (including "select" keyword)
    // https://code.visualstudio.com/api/references/commands
    if (vsCommand === CursorMove.Move) {
      // Only the first arg is considered by cursorMove command (I tested with
      // multiple cursorMove argument objects, but the second one was ignored).
      args[0].select = true;
      return vscode.commands.executeCommand(vsCommand, ...args).then(() => false);
    }
    return vscode.commands.executeCommand(vsCommand + "Select", ...args).then(() => false);
  }

  async delHandler(s: DeleteCommand): Promise<boolean> {
    this.keepSelectionOnDeactivation = true;
    return this.deactivate().then(() => true);
  }

  async onYank(prefixText: string, text: string, indentation: string) {
    await this.deactivate();
    this.yankedPrefix = prefixText;
    this.yanked = text;
    this.yankedIndentation = indentation;
  }

  alwaysOnYank: boolean = true;

  async onKill(s: string) {
    this.yanked = s;
    // Yanked text is one line so no need to consider the prefix context in this case.
    this.yankedPrefix = "";
    await this.deactivate();
  }

  alwaysOnKill: boolean = true;

  async onPaste(): Promise<boolean> {
    return true;
  }
  async onEmacsPaste(): Promise<boolean> {
    return true;
  }

  async testReset() { }
}
