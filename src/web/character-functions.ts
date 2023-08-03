import * as vscode from 'vscode';
import { DeleteCommand } from './interfaces';


interface TypedCharacterHandlerFunction {
  // Return true if the typed character should be ignored.
  (editor: vscode.TextEditor): boolean;
}

const characterFnMap: Map<string, TypedCharacterHandlerFunction> = new Map<string, TypedCharacterHandlerFunction>([
  // We only want the type-over feature of the autoClose* settings of vs code
  // i.e. we don't want the closing character to be automatically added, except for brackets
  ["{", openBracketFunction],
  ...typeOverFunctions(
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

export function handleTypedCharacter(s: string): boolean {
  return genericHandle<string>(s, characterFnMap);
}

export function handleDeleteCharacter(dc: DeleteCommand): boolean {
  return genericHandle<string>(dc, deleteFnMap);
}

function genericHandle<T>(t: T, map: Map<T, TypedCharacterHandlerFunction>): boolean {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !editor.selection.isEmpty) {
    return false;
  }

  const fn: TypedCharacterHandlerFunction | undefined = map.get(t);
  if (!fn) {
    return false;
  }
  return fn(editor);
}

function openBracketFunction(editor: vscode.TextEditor): boolean {
  editor.edit(editBuilder => {
    editBuilder.insert(editor.selection.active, "{}");
  });
  const nextPos = editor.selection.active.translate({characterDelta: 1});
  editor.selection = new vscode.Selection(nextPos, nextPos);

  return true;
}

function typeOverFunctions(...characters: string[]): Iterable<[string, TypedCharacterHandlerFunction]> {
  return characters.map(c => [c, typeOverFunction(c)]);
}

// If typing 'character' symbol, and the next character is that character, then simply
// type over it (i.e. move the cursor to the next position.
function typeOverFunction(character: string): TypedCharacterHandlerFunction {
  return (editor: vscode.TextEditor) => {
    const cursor = editor.selection.active;
    const nextPos = cursor.translate({characterDelta: 1});
    const nextChar = editor.document.getText(new vscode.Range(cursor, nextPos));
    if (nextChar !== character) {
      return false;
    };

    // Move the cursor
    editor.selection = new vscode.Selection(nextPos, nextPos);
    return true;
  };
}

function deleteSpaceRight(editor: vscode.TextEditor): boolean {
  const lineNumber = editor.selection.active.line;
  const line = editor.document.lineAt(lineNumber);

  const remainingText = line.text.slice(editor.selection.active.character);
  if (!/^\s*$/.test(remainingText)) {
    return false;
  }

  editor.edit(editBuilder => {
    const endPos = lineNumber + 1 === editor.document.lineCount ?
      new vscode.Position(lineNumber, line.text.length) :
      new vscode.Position(lineNumber+1, editor.document.lineAt(lineNumber+1).firstNonWhitespaceCharacterIndex);

    editBuilder.delete(new vscode.Range(
      editor.selection.active,
      endPos,
    ));
  });
  return true;
}
