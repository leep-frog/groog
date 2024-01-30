import * as vscode from 'vscode';

const workbench = "workbench";
const colorCustomizations = "colorCustomizations";

export function gutterHandlerColoring(context: vscode.ExtensionContext, key: string): HandlerColoring {
  return {
    colorKey: key,
    decoration: vscode.window.createTextEditorDecorationType({
      gutterIconPath: context.asAbsolutePath(`media/${key}-gutter-icon.jpg`),
    }),
  };
}

export interface HandlerColoring {
  colorKey: string;
  decoration: vscode.TextEditorDecorationType;
}

interface HandlerColoringContext {
  coloring: HandlerColoring;
  editor: vscode.TextEditor;
}

export class ColorMode {

  private activeColorings: Map<string, HandlerColoringContext>;

  constructor() {
    this.activeColorings = new Map<string, HandlerColoringContext>();
  }

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
    this.activeColorings.set(coloring.colorKey, {
      coloring,
      editor,
    });
  }

  async remove(coloring?: HandlerColoring) {
    if (!coloring) {
      return;
    }

    const coloringCtx = this.activeColorings.get(coloring.colorKey);
    if (!coloringCtx) {
      return;
    }
    this.activeColorings.delete(coloring.colorKey);
    coloringCtx.editor.setDecorations(coloring.decoration, []);
  }
}
