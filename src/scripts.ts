import * as vscode from 'vscode';
import { Recorder } from './record';

export class Scripts {

  register(context: vscode.ExtensionContext, recorder: Recorder) {
    recorder.registerCommand(context, "script.replaceNewlineStringsWithQuotes", () => this.replaceNewLines(`"`));
    recorder.registerCommand(context, "script.replaceNewlineStringsWithTicks", () => this.replaceNewLines("`"));
  }

  async replaceNewLines(quote: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage(`No active text editor.`);
      return;
    }
    const cursor = editor.selection.active;
    const line = editor.document.lineAt(cursor.line);
    const prefixRange = new vscode.Range(
      new vscode.Position(line.lineNumber, 0),
      new vscode.Position(line.lineNumber, line.firstNonWhitespaceCharacterIndex),
    );
    const prefix = editor.document.getText(prefixRange);

    return editor.edit(editBuilder => {
      const newText = editor.document.getText(line.range).replace(/\\n/g, `${quote},\n${prefix}${quote}`);
      editBuilder.replace(line.range, newText);
    });
  }
}
