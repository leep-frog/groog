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
          async () => this.paste(this.yanked, this.yankedPrefix),
        );
      });
    });
    recorder.registerCommand(context, 'paste', async (): Promise<any> => {
      // For paste, we assume that the first and second line are indented the same amount
      return vscode.env.clipboard.readText().then(text => {

        // Use runHandlers to check if other handlers should handle the pasting isntead.
        return this.emacs.runHandlers(
          async (th: TypeHandler) => th.onPaste(text),
          async () => this.paste(text).then(pasted => pasted ? false : vscode.commands.executeCommand("editor.action.clipboardPasteAction")),
        );
      });
    });
  }

  private indentInferred(firstLine: string, secondLine: string) {
    // If opening more things than closing, then assume an indent
    const charMap = new Map<string, number>();
    for (const char of firstLine) {
      charMap.set(char, (charMap.get(char) || 0) + 1);
    }
    if (((charMap.get("(") || 0) > (charMap.get(")") || 0)) || ((charMap.get("{") || 0) > (charMap.get("}") || 0)) || ((charMap.get("[") || 0) > (charMap.get("]") || 0))) {
      return true;
    }

    // If second line is a nested function, then assume an indent
    return secondLine.trim().startsWith(".");
  }

  private getReplacement(editor: vscode.TextEditor, text: string, prefix?: string): [string, string | undefined] {
    const lines = text.split('\n');

    if (prefix !== undefined) {
      return [text, prefix];
    }

    const prefixRegex = /^\s+/;

    // Use whitespace prefix of first line
    const firstLinePrefix = prefixRegex.exec(lines.at(0)!)?.at(0)!;
    if (firstLinePrefix) {
      return [text.replace(firstLinePrefix, ''), firstLinePrefix];
    }

    // Otherwise, try to infer from the second line
    if (lines.length <= 1) {
      return [text, undefined];
    }

    const secondLinePrefix = prefixRegex.exec(lines.at(1)!)?.at(0)!;

    // If the second line has no whitespace prefix, then indented the same as the first line
    if (!secondLinePrefix) {
      return [text, secondLinePrefix];
    }

    // If not, then try to infer the indentation of the first line from the indentation of the second line

    // If we expect the second line to be extra indented, however, we need to adjust
    if (this.indentInferred(lines[0], lines[1])) {
      // Assume the first line is indented one less than the second line, in which case we should remove an indent (i.e. tab or set of spaces)
      const whitespaceReplacer = secondLinePrefix.endsWith('\t') ? '\t' : ' '.repeat(editor.options.tabSize as number);
      return [text, secondLinePrefix.replace(whitespaceReplacer, '')];

    }
    // Otherwise, second line is indented the same as the first line, so just use that
    return [text, secondLinePrefix];
  }

  // fixedPrefixText must be used if provided
  async paste(text: string, prefixText?: string): Promise<boolean> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return false;
    }

    return editor.edit(editBuilder => {
      for (const sel of editor.selections) {
        // Get all text in the line behind start of current selection cursor
        const curPrefix = getPrefixText(editor, new vscode.Range(sel.start, sel.end)) || "";

        const [newText, replacementPrefix] = this.getReplacement(editor, text, prefixText);

        // If all preceding text is whitespace, then trim text
        const replacement = replaceAll(newText, "\n" + (replacementPrefix || ""), "\n" + curPrefix);

        // Update the doc
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
