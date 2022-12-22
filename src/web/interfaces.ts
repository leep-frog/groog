import * as vscode from 'vscode';
import { Recorder } from './record';

export interface Registerable {
  register(context: vscode.ExtensionContext, recorder: Recorder): void;
}

export interface TypeHandler extends Registerable {
  active: boolean;
  ctrlG(): Thenable<void>;

  onYank(text: string | undefined): Thenable<void>
  alwaysOnYank(): Thenable<boolean>
  onKill(text: string | undefined): Thenable<void>
  alwaysOnKill(): Thenable<boolean>

  // Returns whether or not to still send the code
  textHandler(s: string): Thenable<boolean>;
  delHandler(cmd: DeleteCommand): Thenable<boolean>;
  moveHandler(cmd: CursorMove, ...rest: any[]): Thenable<boolean>;

  // TODO pasteHandler
  // TODO escape handler (or just same ctrl g?)
}

export enum CursorMove {
  move = "cursorMove",
  up = "cursorUp",
  down = "cursorDown",
  left = "cursorLeft",
  right = "cursorRight",
  home = "cursorHome",
  end = "cursorEnd",
  wordLeft = "cursorWordLeft",
  wordRight = "cursorWordRight",
  top = "cursorTop",
  bottom = "cursorBottom",
};

export enum CtrlGCommand {
  cancelSelection = "cancelSelection",
  closeFindWidget = "closeFindWidget",
  closeParameterHints = "closeParameterHints",
  removeSecondaryCursors = "removeSecondaryCursors",
  notificationsclearAll = "notifications.clearAll",
  workbenchActionTerminalHideFind = "workbench.action.terminal.hideFind",
  closeReferenceSearch = "closeReferenceSearch",
}

export enum DeleteCommand {
  left = "deleteLeft",
  right = "deleteRight",
  wordLeft = "deleteWordLeft",
  wordRight = "deleteWordRight",
}
