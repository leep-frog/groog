import * as vscode from 'vscode';

const jumpDist = 10;
export const cursorMoves: string[] = [
  "cursorUp", "cursorDown", "cursorLeft", "cursorRight",
  "cursorHome", "cursorEnd",
  "cursorWordLeft", "cursorWordRight",
  "cursorTop", "cursorBottom"
];

export class Emacs {
  private yanked: string;
  private qmk: boolean;
  private markMode: boolean;

  constructor() {
    this.yanked = "";
    // TODO: store this in persistent storage somewhere
    this.qmk = false;
    this.markMode = false;
  }

  toggleQMK() {
    if (this) {
      console.log("qmk yes");
    } else {
      console.log("qmk no");
    }
    if (this.qmk) {
      vscode.window.showInformationMessage('Basic keyboard mode activated');
    } else {
      vscode.window.showInformationMessage('QMK keyboard mode activated');
    }
		this.qmk = !this.qmk;
    vscode.commands.executeCommand('setContext', 'groog.qmk', this.qmk);
  }

  toggleMarkMode() {
    if (this.markMode) {
      // Deselect
      vscode.commands.executeCommand("cancelSelection");
    }
    this.markMode = !this.markMode;
    vscode.commands.executeCommand('setContext', 'groog.markMode', true);
  }

  yank() {
    this.markMode = false;

    let range = vscode.window.activeTextEditor?.selection;
    let maybe = vscode.window.activeTextEditor?.document.getText(range);
    if (maybe) {
      this.yanked = maybe;
      vscode.window.activeTextEditor?.edit(editBuilder => {
        if (range) {
          editBuilder.delete(range);
        }
      });
    }
    maybe ? this.yanked = maybe : this.yanked = "";
  }

  paste() {
    this.markMode = false;

    // Overwrite selection if relevant.

    vscode.window.activeTextEditor?.edit(editBuilder => {
      let editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      editBuilder.insert(editor.selection.active, this.yanked);
    });
  }

  ctrlG() {
    if (this.markMode) {
      this.toggleMarkMode();
    } else {
      // This is done in toggle mark mode so don't need to do it twice
      // if not in that mode.
      vscode.commands.executeCommand("cancelSelection");
    }
    vscode.commands.executeCommand("closeFindWidget");
    vscode.commands.executeCommand("removeSecondaryCursors");
  }

  kill() {
    this.markMode = false;    

    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    let startPos = editor.selection.active;
    let endPos = editor.document.lineAt(startPos.line).range.end;
    let range = new vscode.Range(startPos, endPos);
    let text = editor.document.getText(range);
    if (text.trim().length === 0) {
      range = new vscode.Range(startPos, new vscode.Position(startPos.line + 1, 0));
    }
    this.yanked = editor.document.getText(range);
    vscode.window.activeTextEditor?.edit(editBuilder => {
      editBuilder.delete(range);
    });
  }

  // C-l
  jump() {
    this.move("cursorMove", {"to": "up", "by": "line", "value": jumpDist});
  }

  // C-v
  fall() {
    this.move("cursorMove", {"to": "down", "by": "line", "value": jumpDist});
  }

  move(vsCommand: string, ...rest: any[]) {
    if (this.markMode) {
      vscode.commands.executeCommand(vsCommand + "Select", ...rest);
    } else {
      vscode.commands.executeCommand(vsCommand, ...rest);
    }
  }
}