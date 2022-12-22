import * as vscode from 'vscode';
import { ColorizedHandler, ColorMode, Mode } from './color_mode';
import { CursorMove, DeleteCommand, TypeHandler } from './interfaces';
import { Recorder } from './record';

// TODO: Implement a FindReplaceHandler?  alt+s/f -> type search term -> enter -> type replace term -> enter
//       Would need to ensure regexp grouping still works (just use typescript regex on selection text (only if regexp enabled?)).
//       Don't worry about implementing this until find a strong need for it.
export class FindHandler extends ColorizedHandler implements TypeHandler {
  active: boolean;
  findText: string;
  cursorStack: CursorStack;

  constructor(cm: ColorMode) {
    super(cm);
    this.active = false;
    this.findText = "";
    this.cursorStack = new CursorStack();
  }

  async nextMatch() {
    // Then find next match
    await vscode.commands.executeCommand("editor.action.nextMatchFindAction");
  }

  async prevMatch() {
    await vscode.commands.executeCommand("editor.action.previousMatchFindAction");
  }

  register(context: vscode.ExtensionContext, recorder: Recorder) {
    recorder.registerCommand(context, 'find', async () => {
      if (this.active) {
        await this.nextMatch();
      } else {
        await this.activate();
      }
    });
    recorder.registerCommand(context, 'reverseFind', async () => {
      if (this.active) {
        await this.prevMatch();
      } else {
        await this.activate();
      }
    });
    vscode.window.onDidChangeActiveTextEditor(async () => {
      await this.deactivate();
    });
  }

  async colorActivate() {
    this.active = true;
    await vscode.commands.executeCommand('setContext', 'groog.findMode', true);
    await this.findWithArgs();
  }

  async colorDeactivate() {
    this.active = false;
    await vscode.commands.executeCommand('setContext', 'groog.findMode', false);
    // TODO: make text clearing optional? Differentiate in activate maybe?
    this.findText = "";
    this.cursorStack.clear();
    await vscode.commands.executeCommand("cancelSelection");
    await vscode.commands.executeCommand("closeFindWidget");
  }

  mode(): Mode {
    return Mode.FIND;
  }

  async findWithArgs() {
    let txt = this.findText;
    if (this.findText.length === 0) {
      txt = "ENTER" + "_TEXT";
    }
    await vscode.commands.executeCommand("editor.actions.findWithArgs", { "searchString": txt }).then(async () => {
      await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    }, async () => {
      await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    }
    );
    await cursorToFront();
    await this.nextMatch();
  }

  async ctrlG() {
    await this.deactivate();
  }

  async textHandler(s: string): Promise<boolean> {
    // Enter, shift+enter, ctrl+n, ctrl+p taken care of in package.json
    this.findText = this.findText.concat(s);
    this.cursorStack.push();
    await this.findWithArgs();
    return false;
  }

  async moveHandler(cmd: CursorMove): Promise<boolean> {
    await this.deactivate();
    return true;
  }

  async delHandler(s: DeleteCommand): Promise<boolean> {
    switch (s) {
      case DeleteCommand.left:
        if (this.findText.length > 0) {
          this.findText = this.findText.slice(0, this.findText.length - 1);
          this.cursorStack.popAndSet();
          await this.findWithArgs();
        }
        break;
      default:
        vscode.window.showInformationMessage("Unsupported find command: " + s);
    }
    return false;
  }

  // TODO: do something like error message or deactivate
  async onYank(s: string | undefined) { }
  async alwaysOnYank(): Promise<boolean> { return false; }
  async onKill(s: string | undefined) { }
  async alwaysOnKill(): Promise<boolean> { return false; }
}

class CursorStack {
  selections: vscode.Position[];

  constructor() {
    this.selections = [];
  }

  push() {
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("Couldn't find active editor");
      this.selections.push(new vscode.Position(0, 0));
      return;
    }
    this.selections.push(new vscode.Position(editor.selection.start.line, editor.selection.start.character));
  }

  popAndSet() {
    let p = this.selections.pop();
    if (!p) {
      // No longer error here since we can run out of cursor positions if
      // we start a search with a non-empty findText.
      // vscode.window.showErrorMessage("Ran out of cursor positions");
      return;
    }
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("Undefined editor");
      return;
    }
    // https://github.com/microsoft/vscode/issues/111#issuecomment-157998910
    editor.selection = new vscode.Selection(p, p);
  }

  clear() {
    this.selections = [];
  }
}

export function cursorToFront() {
  // Move cursor to beginning of selection
  let editor = vscode.window.activeTextEditor;
  if (editor) {
    let startPos = editor.selection.start;
    editor.selection = new vscode.Selection(startPos, startPos);
  }
}
