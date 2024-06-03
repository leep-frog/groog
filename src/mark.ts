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

  private lineParts(line: string) {
    const partsRegex = /^(\s*)(.*)$/;
    const match = partsRegex.exec(line)!;
    const whitespacePrefix = match.at(1)!;
    const lineText = match.at(2)!;
    return {
      whitespacePrefix,
      lineText,
    };
  }

  async paste(text: string, pasteIndent?: string): Promise<boolean> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return false;
    }

    // Calculate the current editor's whitespacing configuration
    const fileIndent = editor.options.insertSpaces ? ' '.repeat(editor.options.indentSize as number) : '\t';
    const fileNumSpaces = (editor.options.indentSize || editor.options.tabSize) as number;

    // Convert the paste lines into lineParts objects
    const rawLineInfo = text.split('\n').map(this.lineParts);


    // Infer what the indentation used by the paste is.
    const lineInfosWithWhitespace = rawLineInfo.filter(a => a.whitespacePrefix);

    if (pasteIndent !== undefined) {
      // Use provided value if given
    } else if (lineInfosWithWhitespace.length === 0) {
      // Doesn't matter if none of the lines are indented
      pasteIndent = '';
    } else if (lineInfosWithWhitespace.some(a => a.whitespacePrefix.includes('\t'))) {
      // If any tabs, then assume tabs
      pasteIndent = '\t';
    } else if (lineInfosWithWhitespace.map(a => whitespaceSubstringCount(a.whitespacePrefix, ' ')).some(spaceCount => spaceCount % 4 === 2)) {
      // Otherwise, determine if two spaces or four
      pasteIndent = '  ';
    } else {
      pasteIndent = '    ';
    }

    // TODO: Can this method just update reference instead of setting?
    rawLineInfo[0] = this.getFirstLine(pasteIndent, rawLineInfo[0], rawLineInfo[1]);
    const pasteBaseIndents = whitespaceSubstringCount(rawLineInfo[0].whitespacePrefix, pasteIndent);

    // Make the document edits
    return editor.edit(editBuilder => {

      // Iterate over all selections
      for (const sel of editor.selections) {

        // Get all text in the line behind start of current selection cursor
        const curPrefix = getPrefixText(editor, new vscode.Range(sel.start, sel.end)) || "";

        // Generate the single replacement string from the list of paste line infos.
        const replacement = rawLineInfo.map((lineInfo, idx) => {
          const lineIndentCount = whitespaceSubstringCount(lineInfo.whitespacePrefix, pasteIndent!);
          let newIndentCount = lineIndentCount - pasteBaseIndents;

          // If relevant (newIndentCount is negative), then remove
          let endIndex = curPrefix.length;
          for (; newIndentCount < 0; newIndentCount++) {
            if (curPrefix.at(endIndex - 1) === '\t') {
              endIndex--;
            } else {
              // Otherwise, remove up to the number of spaces
              for (let j = 0; j < fileNumSpaces && curPrefix.at(endIndex-1) === ' '; j++) {
                endIndex--;
              }
            }
          }

          // Construct the final replacement string
          //     (removed indents if negative indentation detected)     + (   additional indents to add   ) + (remaining text)
          //     (  This is not needed for first, since curPrefix is
          //     (  always on first line and will never be negative)
          return (idx ? curPrefix.slice(0, Math.max(0, endIndex)) : '') + fileIndent.repeat(newIndentCount) + lineInfo.lineText;
        }).join('\n');

        // Update the document
        editBuilder.delete(sel);
        editBuilder.insert(sel.start, replacement);
      }
    }).then(() => true);
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

  private getFirstLine(indent: string, firstLineInfo: {lineText: string, whitespacePrefix: string}, secondLineInfo?: {lineText: string, whitespacePrefix: string}) {
    // If first line already has whitespace prefix, then no inferrence needed
    if (firstLineInfo.whitespacePrefix) {
      return firstLineInfo;
    }

    // Otherwise, try to infer from the second line
    if (!secondLineInfo) {
      return firstLineInfo;
    }

    // If the second line has no whitespace prefix, then indented the same as the first line
    if (!secondLineInfo.whitespacePrefix) {
      return firstLineInfo;
    }

    // If not, then try to infer the indentation of the first line from the indentation of the second line

    // If we expect the second line to be extra indented, however, we need to adjust
    if (this.indentInferred(firstLineInfo.lineText, secondLineInfo.lineText)) {
      // Assume the first line is indented one less than the second line, in which case we should remove an indent (i.e. tab or set of spaces)
      return {
        lineText: firstLineInfo.lineText,
        whitespacePrefix: secondLineInfo.whitespacePrefix.replace(indent, ''),
      };
    }

    // Otherwise, second line is indented the same as the first line, so just use that
    return {
      lineText: firstLineInfo.lineText,
      whitespacePrefix: secondLineInfo.whitespacePrefix,
    };
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

function whitespaceSubstringCount(str: string, ws: string): number {
  if (!str || !ws) {
    return 0;
  }

  // This is sometimes zero if we ultimately run ` ''.split('') `
  // hence why we use regex instead
  const r = new RegExp(ws, 'g');
  return str.match(r)?.length || 0;
}
