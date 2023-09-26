import * as vscode from 'vscode';
import { DeleteCommand } from './interfaces';


interface TypedCharacterHandlerFunction {
  // Return true if the typed character should be ignored.
  (editor: vscode.TextEditor, selection: vscode.Selection, editBuilder: vscode.TextEditorEdit): [vscode.Selection, boolean];
}

const characterFnMap: Map<string, TypedCharacterHandlerFunction> = new Map<string, TypedCharacterHandlerFunction>([
  // We only want the type-over feature of the autoClose* settings of vs code
  // i.e. we don't want the closing character to be automatically added, except for brackets
  ["{", openBracketFunction("{}")],
  ["[", openBracketFunction("[]")],
  ["(", openBracketFunction("()")],
  ...typeOverFunctions(
    "]",
    "}",
    "'",
    "\"",
    '`',
    ")"
  ),
]);

const deleteFnMap: Map<DeleteCommand, TypedCharacterHandlerFunction> = new Map<DeleteCommand, TypedCharacterHandlerFunction>([
  [DeleteCommand.right, deleteSpaceRight],
  [DeleteCommand.wordRight, deleteSpaceRight],
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
    editor.selections.forEach((sel: vscode.Selection, idx) => {
      if (sel.isEmpty) {
        const [newSelection, shouldApply] = fn(editor, sel, editBuilder);
        applied = applied || shouldApply;
        newSelections.push(newSelection || sel);
      } else {
        newSelections.push(sel);
      }
    });
  }).then(res => {
    if (!res) {
      vscode.window.showInformationMessage(`Failed to execute edit`);
    } else {
      editor.selections = newSelections;
    }
    return applied;
  });
}

function openBracketFunction(openClose: string): (editor: vscode.TextEditor, selection: vscode.Selection, editBuilder: vscode.TextEditorEdit) => [vscode.Selection, boolean] {
  return (editor: vscode.TextEditor, selection: vscode.Selection, editBuilder: vscode.TextEditorEdit): [vscode.Selection, boolean] => {
    if (!onlyWhitespaceToRight(editor, selection)) {
      return [selection, false];
    }

    const middlePos = selection.active.translate({characterDelta: 1});
    editBuilder.insert(selection.active, openClose);
    return [new vscode.Selection(middlePos, middlePos), true];
  };
}

function typeOverFunctions(...characters: string[]): Iterable<[string, TypedCharacterHandlerFunction]> {
  return characters.map(c => [c, typeOverFunction(c)]);
}

// If typing 'character' symbol, and the next character is that character, then simply
// type over it (i.e. move the cursor to the next position.
function typeOverFunction(character: string): TypedCharacterHandlerFunction {
  return (editor: vscode.TextEditor, selection: vscode.Selection, editBuilder: vscode.TextEditorEdit): [vscode.Selection, boolean] => {
    const cursor = selection.active;
    const nextPos = cursor.translate({characterDelta: 1});
    const nextChar = editor.document.getText(new vscode.Range(cursor, nextPos));
    if (nextChar !== character) {
      return [selection, false];
    };

    // Move the cursor
    return [new vscode.Selection(nextPos, nextPos), true];
  };
}

function onlyWhitespaceToRight(editor: vscode.TextEditor, selection: vscode.Selection): boolean {
  const lineNumber = selection.active.line;
  const line = editor.document.lineAt(lineNumber);
  const remainingText = line.text.slice(selection.active.character);
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
    new vscode.Position(lineNumber+1, editor.document.lineAt(lineNumber+1).firstNonWhitespaceCharacterIndex);

  editBuilder.delete(new vscode.Range(
    selection.active,
    endPos,
  ));
  return [selection, true];
}
