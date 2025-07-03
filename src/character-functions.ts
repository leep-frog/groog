import { Dayjs } from 'dayjs';
import * as vscode from 'vscode';
import { DeleteCommand } from './interfaces';
import dayjs = require('dayjs');

const now = dayjs


interface TypedCharacterHandlerFunction {
  // Return true if the typed character should be ignored.
  (editor: vscode.TextEditor, selection: vscode.Selection, editBuilder: vscode.TextEditorEdit): [vscode.Selection, boolean];
}

export const AUTO_CLOSE_WINDOW_MS = process.env.TEST_MODE ? 400 : 30 * 1000; // 30 seconds
interface AutoCloseEvent {
  uri: vscode.Uri
  lineNumber: number;
  count: number;
  closedAt: Dayjs;
}

// TODO: Clear this on non-type events (use separate boolean though)
export const autoCloseEvents: Map<string, AutoCloseEvent> = new Map<string, AutoCloseEvent>();

export function characterFunctionTestReset(): void {
  autoCloseEvents.clear();
}

function getEvent(character: string, editor: vscode.TextEditor): AutoCloseEvent | undefined {

  const event = autoCloseEvents.get(character);
  if (!event) {
    return;
  }

  // If the event is too old, then not valid
  if (now().isAfter(event.closedAt.add(AUTO_CLOSE_WINDOW_MS, 'ms'))) {
    autoCloseEvents.delete(character);
    return;
  }

  // If not the same URI, then don't type over
  if (editor.document.uri.fsPath !== event.uri.fsPath) {
    return;
  }

  // If not the same line, then don't type over
  if (editor.selection.active.line !== event.lineNumber) {
    return;
  }

  // If already auto-closed enough times, then don't type over
  if (event.count <= 0) {
    return;
  }

  return event;
}


const characterFnMap: Map<string, TypedCharacterHandlerFunction> = new Map<string, TypedCharacterHandlerFunction>([
  // We only want the type-over feature of the autoClose* settings of vs code
  // i.e. we don't want the closing character to be automatically added, except for brackets

  // Removed parens because that wasn't becoming bothersome:
  // - type-over was annoying for nested parens (e.g. '(((...|)))' )
  // - without type-over, the auto-close was also super annoying: typing '()' resulted in '())'
  // Previously had a similar problem with brackets, but we fixed that with AutoCloseEvents...
  // ...(I think, revert if still annoying, but reasons why reverted here so we don't forget)
  ["{", openBracketFunction("{", "}")],
  ["[", openBracketFunction("[", "]")],
  ...typeOverFunctions(
    "}",
    "'",
    "\"",
    '`',
  ),
  ...typeOverAutoCloseFunctions(
    ")",
    "]",
  ),
]);

const deleteFnMap: Map<DeleteCommand, TypedCharacterHandlerFunction> = new Map<DeleteCommand, TypedCharacterHandlerFunction>([
  [DeleteCommand.Right, deleteSpaceRight],
  [DeleteCommand.WordRight, deleteSpaceRight],
]);

export function handleTypedCharacter(s: string): Promise<boolean> {
  return genericHandle<string>(s, characterFnMap);
}

export function handleDeleteCharacter(dc: DeleteCommand): Promise<boolean> {
  return genericHandle<string>(dc, deleteFnMap);
}

async function genericHandle<T>(t: T, map: Map<T, TypedCharacterHandlerFunction>): Promise<boolean> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return false;
  }

  const fn: TypedCharacterHandlerFunction | undefined = map.get(t);
  if (!fn) {
    return false;
  }

  const newSelections: vscode.Selection[] = [];

  let applied = false;
  return editor.edit(editBuilder => {
    newSelections.push(...editor.selections.map((sel: vscode.Selection) => {
      if (sel.isEmpty) {
        const [newSelection, shouldApply] = fn(editor, sel, editBuilder);
        applied = applied || shouldApply;
        return newSelection;
      } else {
        return sel;
      }
    }));
  }).then(res => {
    editor.selections = newSelections;
    return applied;
  });
}

function openBracketFunction(open: string, close: string): (editor: vscode.TextEditor, selection: vscode.Selection, editBuilder: vscode.TextEditorEdit) => [vscode.Selection, boolean] {
  const openClose = open + close;
  return (editor: vscode.TextEditor, selection: vscode.Selection, editBuilder: vscode.TextEditorEdit): [vscode.Selection, boolean] => {
    if (!onlyWhitespaceToRight(editor, selection, close)) {
      return [selection, false];
    }

    const existingEvent = getEvent(close, editor);
    // If the event exists and is still relevant, then increment the count
    if (existingEvent) {
      existingEvent.count++;
      existingEvent.closedAt = now();
    } else {
      // Otherwise, create a new event
      autoCloseEvents.set(close, {
        uri: editor.document.uri,
        lineNumber: selection.active.line,
        count: 1,
        closedAt: now(),
      });
    }

    const middlePos = selection.active.translate({ characterDelta: 1 });
    editBuilder.insert(selection.active, openClose);
    return [new vscode.Selection(middlePos, middlePos), true];
  };
}

function typeOverFunctions(...characters: string[]): Iterable<[string, TypedCharacterHandlerFunction]> {
  return characters.map(c => [c, typeOverFunction(c, false)]);
}

function typeOverAutoCloseFunctions(...characters: string[]): Iterable<[string, TypedCharacterHandlerFunction]> {
  return characters.map(c => [c, typeOverFunction(c, true)]);
}

// If typing 'character' symbol, and the next character is that character, then simply
// type over it (i.e. move the cursor to the next position).
function typeOverFunction(character: string, onlyForAutoClose: boolean): TypedCharacterHandlerFunction {
  return (editor: vscode.TextEditor, selection: vscode.Selection, editBuilder: vscode.TextEditorEdit): [vscode.Selection, boolean] => {

    if (onlyForAutoClose) {
      const event = getEvent(character, editor);
      if (!event) {
        return [selection, false];
      }
      event.count--;
    }

    const cursor = selection.active;
    const nextPos = cursor.translate({ characterDelta: 1 });
    const nextChar = editor.document.getText(new vscode.Range(cursor, nextPos));
    if (nextChar !== character) {
      return [selection, false];
    };

    // Move the cursor
    return [new vscode.Selection(nextPos, nextPos), true];
  };
}

function onlyWhitespaceToRight(editor: vscode.TextEditor, selection: vscode.Selection, ignorePrefixCharacter?: string): boolean {
  const lineNumber = selection.active.line;
  const line = editor.document.lineAt(lineNumber);
  let remainingText = line.text.slice(selection.active.character);
  if (ignorePrefixCharacter) {
    // If we have a prefix character, remove it from the remaining text
    remainingText = remainingText.replace(new RegExp(`\\${ignorePrefixCharacter}`, 'g'), '');
  }
  return /^\s*$/.test(remainingText);
}

function deleteSpaceRight(editor: vscode.TextEditor, selection: vscode.Selection, editBuilder: vscode.TextEditorEdit): [vscode.Selection, boolean] {
  if (!onlyWhitespaceToRight(editor, selection)) {
    return [selection, false];
  }

  const lineNumber = selection.active.line;
  const line = editor.document.lineAt(lineNumber);

  const endPos = lineNumber + 1 === editor.document.lineCount ?
    new vscode.Position(lineNumber, line.text.length) :
    new vscode.Position(lineNumber + 1, editor.document.lineAt(lineNumber + 1).firstNonWhitespaceCharacterIndex);

  editBuilder.delete(new vscode.Range(
    selection.active,
    endPos,
  ));
  return [selection, true];
}

export function endDocumentPosition(editor: vscode.TextEditor): vscode.Position {
  const doc = editor.document;
  return doc.lineAt(doc.lineCount - 1).range.end;
}
