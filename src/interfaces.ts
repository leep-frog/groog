import * as vscode from 'vscode';

export enum CursorMove {
  Move = "cursorMove",
  Up = "cursorUp",
  Down = "cursorDown",
  Left = "cursorLeft",
  Right = "cursorRight",
  Home = "cursorHome",
  End = "cursorEnd",
  WordLeft = "cursorWordLeft",
  WordRight = "cursorWordRight",
  Top = "cursorTop",
  Bottom = "cursorBottom",
};

export enum CtrlGCommand {
  CancelSelection = "cancelSelection",
  CloseFindWidget = "closeFindWidget",
  CloseParameterHints = "closeParameterHints",
  RemoveSecondaryCursors = "removeSecondaryCursors",
  NotificationsclearAll = "notifications.clearAll",
  WorkbenchActionTerminalHideFind = "workbench.action.terminal.hideFind",
  CloseReferenceSearch = "closeReferenceSearch",
  CloseMarkersNavigation = "closeMarkersNavigation",
  InlineChatClose = "inlineChat.close",
}

export enum DeleteCommand {
  Left = "deleteLeft",
  Right = "deleteRight",
  WordLeft = "deleteWordLeft",
  WordRight = "deleteWordRight",
}

export async function setGroogContext(context: string, value: boolean) {
  await vscode.commands.executeCommand('setContext', `groog.context.${context}Mode`, value);
}
