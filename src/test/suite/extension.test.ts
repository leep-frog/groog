import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { Document, Match } from '../../find';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Sample test', () => {
    assert.strictEqual(-1, [1, 2, 3].indexOf(5));
    assert.strictEqual(-1, [1, 2, 3].indexOf(0));
  });
});

interface TestMatch {
  range: vscode.Range;
  text: string;
}

function convertTestMatches(pattern : RegExp | undefined, testMatches: TestMatch[]): Match[] {
  return testMatches.map((tm, index) => {
    return {
      ...tm,
      pattern: pattern!,
      index,
    };
  });
}

interface DocumentTest {
  name: string;
  document: string[];
  queryText: string;
  caseInsensitive?: boolean;
  regex?: boolean;
  wholeWord?: boolean;
  want: TestMatch[];
  wantPattern?: RegExp;
  wantError?: string;
}

const documentTestCases: DocumentTest[] = [
  {
    name: "empty string search",
    document: [
      "one two three",
    ],
    queryText: "",
    want: [],
  },
  {
    name: "Literal string search",
    document: [
      "one two three",
    ],
    queryText: "two",
    wantPattern: /two/gm,
    want: [
      {
        range: new vscode.Range(
          new vscode.Position(0, 4),
          new vscode.Position(0, 7),
        ),
        text: "two",
      },
    ],
  },
  {
    name: "Literal string search requires case match",
    document: [
      "one two three",
    ],
    queryText: "Two",
    wantPattern: /Two/gm,
    want: [],
  },
  {
    name: "Literal string search - no match",
    document: [
      "one two three",
    ],
    queryText: "four",
    want: [],
  },
  {
    name: "Literal string search with multiple matches",
    document: [
      "one two three four five six seven",
    ],
    queryText: "e ",
    wantPattern: /e /gm,
    want: [
      {
        range: new vscode.Range(
          new vscode.Position(0, 2),
          new vscode.Position(0, 4),
        ),
        text: "e ",
      },
      {
        range: new vscode.Range(
          new vscode.Position(0, 12),
          new vscode.Position(0, 14),
        ),
        text: "e ",
      },
      {
        range: new vscode.Range(
          new vscode.Position(0, 22),
          new vscode.Position(0, 24),
        ),
        text: "e ",
      },
    ],
  },
  {
    name: "Literal string search with overlapping matches",
    document: [
      " abc abc abc abc abc ",
    ],
    queryText: " abc abc ",
    wantPattern: / abc abc /gm,
    want: [
      {
        range: new vscode.Range(
          new vscode.Position(0, 0),
          new vscode.Position(0, 9),
        ),
        text: " abc abc ",
      },
      {
        range: new vscode.Range(
          new vscode.Position(0, 12),
          new vscode.Position(0, 21),
        ),
        text: " abc abc ",
      },
    ],
  },
  // Match case tests
  {
    name: "Literal string search case insensitive",
    document: [
      "one two three",
    ],
    caseInsensitive: true,
    queryText: "TWO",
    wantPattern: /two/gim,
    want: [
      {
        range: new vscode.Range(
          new vscode.Position(0, 4),
          new vscode.Position(0, 7),
        ),
        text: "two",
      },
    ],
  },
  {
    name: "Literal string search with multiple matches",
    document: [
      "one two THREE four five six seven",
    ],
    caseInsensitive: true,
    queryText: "e ",
    wantPattern: /e /gim,
    want: [
      {
        range: new vscode.Range(
          new vscode.Position(0, 2),
          new vscode.Position(0, 4),
        ),
        text: "e ",
      },
      {
        range: new vscode.Range(
          new vscode.Position(0, 12),
          new vscode.Position(0, 14),
        ),
        text: "E ",
      },
      {
        range: new vscode.Range(
          new vscode.Position(0, 22),
          new vscode.Position(0, 24),
        ),
        text: "e ",
      },
    ],
  },
  // Regex tests
  {
    name: "regex search",
    document: [
      "one two three",
    ],
    queryText: "[vwxyz]",
    regex: true,
    wantPattern: /[vwxyz]/gm,
    want: [
      {
        range: new vscode.Range(
          new vscode.Position(0, 5),
          new vscode.Position(0, 6),
        ),
        text: "w",
      },
    ],
  },
  {
    name: "regex search requires case",
    document: [
      "one tWo three woW",
    ],
    queryText: "[vwxyz]",
    regex: true,
    wantPattern: /[vwxyz]/gm,
    want: [
      {
        range: new vscode.Range(
          new vscode.Position(0, 14),
          new vscode.Position(0, 15),
        ),
        text: "w",
      },
    ],
  },
  {
    name: "regex search with multiple matches",
    document: [
      "one two three four five six seven",
    ],
    queryText: "o.. ",
    regex: true,
    wantPattern: /o.. /gm,
    want: [
      {
        range: new vscode.Range(
          new vscode.Position(0, 0),
          new vscode.Position(0, 4),
        ),
        text: "one ",
      },
      {
        range: new vscode.Range(
          new vscode.Position(0, 15),
          new vscode.Position(0, 19),
        ),
        text: "our ",
      },
    ],
  },
  // Regex and case tests
  {
    name: "regex search",
    document: [
      "one two three",
    ],
    queryText: "[vwxyz]",
    caseInsensitive: true,
    regex: true,
    wantPattern: /[vwxyz]/gim,
    want: [
      {
        range: new vscode.Range(
          new vscode.Position(0, 5),
          new vscode.Position(0, 6),
        ),
        text: "w",
      },
    ],
  },
  {
    name: "regex search with multiple matches",
    document: [
      "one two three four five six seven",
    ],
    queryText: "o.. ",
    regex: true,
    wantPattern: /o.. /gm,
    want: [
      {
        range: new vscode.Range(
          new vscode.Position(0, 0),
          new vscode.Position(0, 4),
        ),
        text: "one ",
      },
      {
        range: new vscode.Range(
          new vscode.Position(0, 15),
          new vscode.Position(0, 19),
        ),
        text: "our ",
      },
    ],
  },
  // Regex and newline character
  {
    name: "regex .* doesn't catch newline character",
    document: [
      "one",
      "two",
      "three",
      "two",
      "one",
    ],
    queryText: "o.*",
    regex: true,
    wantPattern: /o.*/gm,
    want: [
      {
        range: new vscode.Range(
          new vscode.Position(0, 0),
          new vscode.Position(0, 3),
        ),
        text: "one",
      },
      {
        range: new vscode.Range(
          new vscode.Position(1, 2),
          new vscode.Position(1, 3),
        ),
        text: "o",
      },
      {
        range: new vscode.Range(
          new vscode.Position(3, 2),
          new vscode.Position(3, 3),
        ),
        text: "o",
      },
      {
        range: new vscode.Range(
          new vscode.Position(4, 0),
          new vscode.Position(4, 3),
        ),
        text: "one",
      },
    ],
  },
  {
    name: "regex with \n does catch newline character",
    document: [
      "one",
      "two",
      "three",
      "two",
      "one",
    ],
    queryText: "o.*\nt.+\nth",
    regex: true,
    wantPattern: /o.*\nt.+\nth/gm,
    want: [
      {
        range: new vscode.Range(
          new vscode.Position(0, 0),
          new vscode.Position(2, 2),
        ),
        text: "one\ntwo\nth",
      },
    ],
  },
  {
    name: "non-regex with \n does catch newline character",
    document: [
      "one",
      "two",
      "three",
      "two",
      "one",
    ],
    queryText: "one\ntwo\nth",
    wantPattern: /one\ntwo\nth/gm,
    want: [
      {
        range: new vscode.Range(
          new vscode.Position(0, 0),
          new vscode.Position(2, 2),
        ),
        text: "one\ntwo\nth",
      },
    ],
  },
  // Whole word match (TODO)
  /* Useful for commenting out tests. */
];

suite('Document.matches Test Suite', () => {
  documentTestCases.forEach(dtc => {
    test(dtc.name, () => {
      const doc = new Document(dtc.document.join("\n"));
      const got = doc.matches({
        queryText: dtc.queryText,
        caseInsensitive: !!dtc.caseInsensitive,
        regex: !!dtc.regex,
        wholeWord: !!dtc.wholeWord,
      });
      assert.deepStrictEqual(got, [convertTestMatches(dtc.wantPattern, dtc.want), dtc.wantError]);
    });
  });
});

interface CommandExecution {
  command: string;
  args?: any[];
}

function cmd(command: string, ...args: any[]) : CommandExecution {
  return {
    command,
    args,
  };
}

function type(text: string) : CommandExecution {
  return cmd("groog.type", { "text": text });
}

function selection(line: number, char: number) : vscode.Selection {
  return new vscode.Selection(line, char, line, char);
}

interface TestCase {
  name: string;
  startingText?: string[];
  commands?: CommandExecution[];
  wantDocument: string[];
  wantSelections: vscode.Selection[];
  wantInfoMessages?: string[];
  wantErrorMessages?: string[];
}

const testCases: TestCase[] = [
  // Basic/setup tests
  {
    name: "Captures opening info message",
    startingText: [],
    wantDocument: [],
    wantSelections: [
      selection(0, 0),
    ],
    commands: [
      cmd("groog.cursorRight"),
    ],
    wantInfoMessages: [
      `Basic keyboard mode activated`,
    ],
  },
  {
    name: "Works for empty file and no changes",
    wantDocument: [],
    wantSelections: [
      selection(0, 0),
    ],
  },
  {
    name: "Writes text to file",
    startingText: [
      "abc",
    ],
    wantDocument: [
      "abc",
    ],
    wantSelections: [
      selection(0, 0),
    ],
  },
  // Record tests
  {
    name: "Record playback fails if no recording set",
    startingText: [
      "abc",
      "1",
      "defabc",
      "2",
    ],
    wantDocument: [
      "abc",
      "1",
      "defabc",
      "2",
    ],
    wantSelections: [
      selection(0, 0),
    ],
    commands: [
      cmd("groog.record.playRecording"),
    ],
    wantErrorMessages: [
      `No recordings exist yet!`,
    ],
  },
  {
    name: "Records and plays back",
    startingText: [
      "abc",
      "1",
      "defabc",
      "2",
    ],
    wantDocument: [
      "abcx",
      "1yx",
      "defyabc",
      "2",
    ],
    wantSelections: [
      selection(2, 4),
    ],
    commands: [
      cmd("groog.record.startRecording"),
      cmd("groog.cursorEnd"),
      type("x"),
      cmd("groog.cursorDown"),
      type("y"),
      cmd("groog.record.endRecording"),
      cmd("groog.record.playRecording"),
    ],
  },
];

// To run these tests, run the `Extension Tests` configurations from `.vscode/launch.json` // TODO: Make an npm target that does this?
suite('Groog commands', () => {
  testCases.forEach(tc => {
    test(tc.name, async () => {

      // Create or clear the editor
      if (!vscode.window.activeTextEditor) {
        await vscode.commands.executeCommand("workbench.action.files.newUntitledFile");
      }
      const editor = assertDefined(vscode.window.activeTextEditor);
      await editor.edit(eb => {
        const line = editor.document.lineAt(editor.document.lineCount-1);
        eb.delete(new vscode.Range(
          new vscode.Position(0, 0),
          new vscode.Position(line.lineNumber, line.text.length),
        ));
      });

      // Create the document if relevant
      if (tc.startingText) {
        await editor.edit(eb => {
          eb.insert(new vscode.Position(0, 0), tc.startingText!.join("\n"));
        });
        editor.selection = new vscode.Selection(0, 0, 0, 0);
      }

      const gotInfoMessages : string[] = [];
      vscode.window.showInformationMessage = async (s: string) => {
        gotInfoMessages.push(s);
      };
      const gotErrorMessages : string[] = [];
      vscode.window.showErrorMessage = async (s: string) => {
        gotErrorMessages.push(s);
      };

      // Run the commands
      for (const cmd of (tc.commands || [])) {
        await vscode.commands.executeCommand(cmd.command, ...(cmd.args || []));
      }

      // Verify the outcome
      assert.deepStrictEqual(editor.document.getText(), tc.wantDocument.join("\n"));
      assert.deepStrictEqual(editor.selections, tc.wantSelections);
      assert.deepStrictEqual(gotInfoMessages, tc.wantInfoMessages || [], "Expected info messages to be exactly equal");
      assert.deepStrictEqual(gotErrorMessages, tc.wantErrorMessages || [], "Expected error messages to be exactly equal");
    });
  });
});

function assertDefined<T>(t?: T): T {
  assert.notEqual(t, undefined, "Expected object to be defined, but it was undefined");
  return t!;
}
