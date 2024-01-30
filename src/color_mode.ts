import * as vscode from 'vscode';

const workbench = "workbench";
const colorCustomizations = "colorCustomizations";

export function gutterHandlerColoring(context: vscode.ExtensionContext, key: string): HandlerColoring {
  return {
    decoration: vscode.window.createTextEditorDecorationType({
      gutterIconPath: context.asAbsolutePath(`media/${key}-gutter-icon.jpg`),
    }),
  };
}

export interface HandlerColoring {
  decoration: vscode.TextEditorDecorationType;
}

export class ColorMode {
  constructor() {}

  async add(coloring?: HandlerColoring) {
    if (!coloring) {
      return;
    }

    // Add the decoration
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    editor.setDecorations(coloring.decoration, [new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(editor.document.lineCount, 0),
    )]);
  }

  async remove(coloring?: HandlerColoring) {
    if (!coloring) {
      return;
    }

    // Remove the decoration
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    editor.setDecorations(coloring.decoration, []);
  }
}
