import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import { CloseQuickPickAction, NoOpQuickPickAction, PressItemButtonQuickPickAction, PressUnknownButtonQuickPickAction, SelectItemQuickPickAction, SimpleTestCase, SimpleTestCaseProps, StubbablesConfig, UserInteraction, cmd } from '@leep-frog/vscode-test-stubber';
import * as vscode from 'vscode';
import { Document, FindRecord, Match } from '../../find';
import { CommandRecord, Record, RecordBook, TypeRecord } from '../../record';
import path = require('path');

// Note: this needs to be identical to the value in .vscode-test.mjs (trying to have shared import there is awkward).
// export const stubbableTestFile = path.resolve(".vscode-test", "stubbable-file.json");
export const stubbableTestFile = `C:\\Users\\gleep\\Desktop\\Coding\\vs-code\\groog\\.vscode-test\\stubbable-file.json`;

function startingFile(filename: string) {
  return path.resolve(__dirname, "..", "..", "..", "src", "test", "test-workspace", filename);
}

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
  wantSuggestible?: string[];
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
  // Whole word match tests
  {
    name: "match whole word",
    document: [
      "one",
      "onetwo",
      "aoneb",
      "twoone",
      "prefix one suffix",
      "prefix onethree",
      "onefour suffix",
      "onetwo again",
    ],
    queryText: "one",
    wholeWord: true,
    wantPattern: /one/gm,
    wantSuggestible: [
      "onefour",
      "onethree",
      "onetwo",
    ],
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
          new vscode.Position(4, 7),
          new vscode.Position(4, 10),
        ),
        text: "one",
      },
    ],
  },
  /* Useful for commenting out tests. */
];

interface RecordingQuickPickProps {
  label: string,
  recordBook: RecordBook,
  savable?: boolean,
  repeatable?: boolean,
}

function recordingQuickPick(props: RecordingQuickPickProps) {
  const buttons = [];

  if (props.savable) {
    buttons.push({
      iconPath: {
        id: "save",
      },
      tooltip: "Save recording as...",
    });
  }

  if (props.repeatable) {
    buttons.push({
      iconPath: {
        id: "debug-rerun",
      },
      tooltip: "Run repeatedly",
    });
  }

  return {
    buttons,
    label: props.label,
    recordBook: props.recordBook,
  };
}

function recordBook(records: Record[]) {
  const rb = new RecordBook();
  rb.locked = true;
  rb.records = records;
  return rb;
}

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
      assert.deepStrictEqual(got, [convertTestMatches(dtc.wantPattern, dtc.want), dtc.wantSuggestible ?? [], dtc.wantError]);
    });
  });
});

// Frequently used commands
const ctrlG = cmd("groog.ctrlG");
const closeAllEditors = cmd("workbench.action.closeEditorsAndGroup");

function type(text: string) : UserInteraction {
  return cmd("groog.type", { "text": text });
}

function selection(line: number, char: number) : vscode.Selection {
  return new vscode.Selection(line, char, line, char);
}

interface TestCase {
  name: string;
  stubbablesConfig?: StubbablesConfig;
  stc: SimpleTestCaseProps;
  runSolo?: boolean;
}

const TEST_ITERATIONS = 1;

function testCases(): TestCase[] {
  return [
    // Basic/setup tests
    {
      name: "Captures opening info message",
      stc: {
        userInteractions: [
          cmd("groog.cursorRight"), // Need command to activate extension.
        ],
      },
      stubbablesConfig: {
        expectedInfoMessages: [
          `Basic keyboard mode activated`,
        ],
        expectedErrorMessages: [
          `Failed to get editor.wordSeparator; defaulting to space character`,
        ],
      },
    },
    // Typo tests
    // Note: These typos are configured in src/test/test-workspace/.vscode/settings.json
    {
      name: "Typo does nothing if typing with no editor",
      stc: {
        userInteractions: [
          closeAllEditors,
          type(" "),
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          `Couldn't find active editor`,
        ],
      },
    },
    {
      name: "Typo fixer doesn't do anything if still typing",
      stc: {
        text: [],
        expectedSelections: [
          selection(0, 9),
        ],
        expectedText: [
          "typobuidl",
        ],
        userInteractions: [
          type("typobuid"),
          type("l"),
        ],
      },
    },
    {
      name: "Typo fixer fixes if word is over",
      stc: {
        text: [],
        expectedSelections: [
          selection(0, 6),
        ],
        expectedText: [
          "build ",
        ],
        userInteractions: [
          type("typobuid"),
          type("l"),
          type(" "),
        ],
      },
    },
    {
      name: "Typo fixer fixes if word is over with other word break character",
      stc: {
        text: [],
        expectedSelections: [
          selection(0, 6),
        ],
        expectedText: [
          "build(",
        ],
        userInteractions: [
          type("typobuid"),
          type("l"),
          type("("),
        ],
      },
    },
    {
      name: "Doesn't run typo if typing over a selection",
      stc: {
        selections: [
          new vscode.Selection(0, 9, 0, 11),
        ],
        expectedSelections: [
          selection(0, 10),
        ],
        expectedText: [
          "typobuidl ",
        ],
        userInteractions: [
          type(" "),
        ],
        text: [
          "typobuidl  ",
        ],
      },
    },
    {
      name: "Doesn't run typo if not at the end of a word",
      stc: {
        selections: [
          selection(0, 10),
        ],
        expectedSelections: [
          selection(0, 11),
        ],
        expectedText: [
          "typobuidl( ",
        ],
        userInteractions: [
          type(" "),
        ],
        text: [
          "typobuidl(",
        ],
      },
    },
    {
      name: "Language specific typo runs in that language",
      stc: {
        userInteractions: [
          type("  "),
          type("fpl"),
          type(" "),
          type(`"abc"`),
        ],
        file: startingFile("empty.go"),
        selections: [
          selection(3, 0),
        ],
        expectedSelections: [
          selection(3, 19),
        ],
        expectedText: [
          "package main",
          "",
          "func main() {",
          `  fmt.Println("abc")`,
          "}",
          "",
        ],
      },
    },
    {
      name: "Regular word is not changed if not a configured break character",
      stc: {
        text: [],
        userInteractions: [
          type("typoabc"),
          type(" "),
        ],
        expectedSelections: [
          selection(0, 8),
        ],
        expectedText: [
          "typoabc ",
        ],
      },
    },
    {
      name: "Proper break character replaces word",
      stc: {
        text: [],
        userInteractions: [
          type("typoabc"),
          type("^"),
        ],
        expectedSelections: [
          selection(0, 4),
        ],
        expectedText: [
          "ABC^",
        ],
      },
    },
    {
      name: "Exclude break character replaces word without character",
      stc: {
        text: [],
        userInteractions: [
          type("typoabc"),
          type("."),
        ],
        expectedSelections: [
          selection(0, 3),
        ],
        expectedText: [
          "ABC",
        ],
      },
    },
    {
      name: "Replacement suffix",
      stc: {
        text: [],
        userInteractions: [
          type("typoabc"),
          type("$"),
        ],
        expectedSelections: [
          selection(0, 6),
        ],
        expectedText: [
          "ABC$ef",
        ],
      },
    },
    {
      name: "Replacement suffix after cursor",
      stc: {
        text: [],
        userInteractions: [
          type("typoabc"),
          type("-"),
        ],
        expectedSelections: [
          selection(0, 4),
        ],
        expectedText: [
          "ABC-EF",
        ],
      },
    },
    {
      name: "Replacement suffix before and after cursor",
      stc: {
        text: [],
        userInteractions: [
          type("typoabc"),
          type("&"),
        ],
        expectedSelections: [
          selection(0, 5),
        ],
        expectedText: [
          "ABCdeF",
        ],
      },
    },
    // Typo with multi-line suffix replacements
    {
      name: "Replacement suffix before and after cursor",
      stc: {
        userInteractions: [
          type("typoalphabet"),
          type(" "),
        ],
        text: [
          "The alphabet: ",
        ],
        selections: [
          selection(0, 14),
        ],
        expectedSelections: [
          selection(3, 1),
        ],
        expectedText: [
          "The alphabet: abcdef",
          "ghijkl",
          "mn",
          "opq",
          "rstuvw",
          "xyz",
        ],
      },
    },
    // Keyboard toggle tests
    {
      name: "Toggles to QMK mode",
      // TODO: Test something about context value
      stc: {
        userInteractions: [
          cmd("groog.toggleQMK"),
        ],
      },
      stubbablesConfig: {
        expectedInfoMessages: [
          `QMK keyboard mode activated`,
        ],
      },
    },
    {
      name: "Toggles back to basic keyboard mode",
      // TODO: Test something about context value
      stc: {
        userInteractions: [
          cmd("groog.toggleQMK"),
        ],
      },
      stubbablesConfig: {
        expectedInfoMessages: [
          `Basic keyboard mode activated`,
        ],
      },
    },
    // { TODOOOOOO
    // name: "Works for empty file and no changes",
    // },
    {
      name: "Writes text to file",
      stc: {
        text: [
          "abc",
        ],
        expectedText: [
          "abc",
        ],
      },
    },
    // Find command failure tests
    {
      name: "groog.find.replaceOne if not in find mode",
      stc: {
        userInteractions: [
          cmd("groog.find.replaceOne"),
        ],
        text: [
          "abc",
        ],
        expectedText: [
          "abc",
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          `Cannot replace matches when not in groog.find mode`,
        ],
      },
    },
    {
      name: "groog.find.replaceAll if not in find mode",
      stc: {
        userInteractions: [
          cmd("groog.find.replaceAll"),
        ],
        text: [
          "abc",
        ],
        expectedText: [
          "abc",
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          `Cannot replace matches when not in groog.find mode`,
        ],
      },
    },
    {
      name: "groog.find.toggleReplaceMode if not in find mode",
      stc: {
        userInteractions: [
          cmd("groog.find.toggleReplaceMode"),
        ],
        text: [
          "abc",
        ],
        expectedText: [
          "abc",
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          `groog.find.toggleReplaceMode can only be executed in find mode`,
        ],
      },
    },
    {
      name: "groog.find.previous if not in find mode",
      stc: {
        userInteractions: [
          cmd("groog.find.previous"),
        ],
        text: [
          "abc",
        ],
        expectedText: [
          "abc",
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          `groog.find.previous can only be executed in find mode`,
        ],
      },
    },
    {
      name: "groog.find.next if not in find mode",
      stc: {
        userInteractions: [
          cmd("groog.find.next"),
        ],
        text: [
          "abc",
        ],
        expectedText: [
          "abc",
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          `groog.find.next can only be executed in find mode`,
        ],
      },
    },
    // Find no editor tests
    {
      name: "groog.find fails if no editor",
      stc: {
        userInteractions: [
          closeAllEditors,
          cmd("groog.find"),
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          `Cannot activate find mode from outside an editor`,
        ],
      },
    },
    {
      name: "groog.reverseFind fails if no editor",
      stc: {
        userInteractions: [
          closeAllEditors,
          cmd("groog.reverseFind"),
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          `Cannot activate find mode from outside an editor`,
        ],
      },
    },
    {
      name: "groog.find deactivate fails if no editor",
      stc: {
        text: [
          "abc",
        ],
        userInteractions: [
          cmd("groog.find"),
          type("ab"),
          closeAllEditors,
          type("c"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'ab'
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'ab'
          [
            "ab",
            "Flags: []",
            "1 of 1",
          ],
        ],
        expectedErrorMessages: [
          `Cannot select text from outside the editor`,
        ],
      },
    },
    {
      name: "End of find cache",
      stc: {
        userInteractions: [
          cmd("groog.find"),
          type("ab"),
          cmd("groog.find.next"),
          type("c"),
        ],
        text: [
          "abc",
        ],
        expectedText: [
          "abc",
        ],
        expectedSelections: [
          new vscode.Selection(0, 0, 0, 3),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'ab'
          new NoOpQuickPickAction(), // type 'c'
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'ab'
          [
            "ab",
            "Flags: []",
            "1 of 1",
          ],
          // type 'c'
          [
            "abc",
            "Flags: []",
            "1 of 1",
          ],
        ],
        expectedInfoMessages: [
          `End of find cache`,
        ],
      },
    },
    {
      name: "Beginning of find cache",
      stc: {
        text: [
          "abc",
        ],
        expectedText: [
          "abc",
        ],
        userInteractions: [
          cmd("groog.find"),
          type("ab"),
          cmd("groog.find.previous"),
          type("c"),
        ],
        expectedSelections: [
          new vscode.Selection(0, 0, 0, 3),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'ab'
          new NoOpQuickPickAction(), // type 'c'
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'ab'
          [
            "ab",
            "Flags: []",
            "1 of 1",
          ],
          // type 'c'
          [
            "abc",
            "Flags: []",
            "1 of 1",
          ],
        ],
        expectedInfoMessages: [
          `No earlier find contexts available`,
        ],
      },
    },
    // Find tests
    {
      name: "Moving deactivates find",
      stc: {
        text: [
          "abcdef",
        ],
        expectedText: [
          "abXcdef",
        ],
        expectedSelections: [
          selection(0, 3),
        ],
        userInteractions: [
          cmd("groog.find"),
          type("cde"),
          cmd("groog.cursorLeft"),
          type("X"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'cde'
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'cde'
          [
            "cde",
            "Flags: []",
            "1 of 1",
          ],
        ],
      },
    },
    {
      name: "Unsupported delete command is ignored",
      stc: {
        text: [
          "abcdef",
        ],
        expectedText: [
          "abXf",
        ],
        expectedSelections: [
          selection(0, 3),
        ],
        userInteractions: [
          cmd("groog.find"),
          type("cd"),
          cmd("groog.deleteRight"),
          type("e"),
          ctrlG,
          type("X"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'cd'
          // deleteRight is ignored
          new NoOpQuickPickAction(), // type 'e'
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'cd'
          [
            "cd",
            "Flags: []",
            "1 of 1",
          ],
          // type 'e'
          [
            "cde",
            "Flags: []",
            "1 of 1",
          ],
        ],
        expectedErrorMessages: [
          `Unsupported find command: groog.deleteRight`,
        ],
      },
    },
    {
      name: "Supports groog.deleteLeft",
      stc: {
        text: [
          "abc1",
          "abc2",
          "abc3",
          "abc4",
        ],
        expectedText: [
          "abc1",
          "abc2",
          "abc3 HERE",
          "abc4",
        ],
        expectedSelections: [
          selection(2, 9),
        ],
        userInteractions: [
          cmd("groog.find"),
          type("abcX"),
          cmd("groog.deleteLeft"),
          type("3"),
          ctrlG,
          ctrlG,
          type(" HERE"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'abcX'
          new NoOpQuickPickAction(), // deleteLeft
          new NoOpQuickPickAction(), // type 'e'
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'abcX'
          [
            "abcX",
            "Flags: []",
            "No results",
          ],
          // deleteLeft
          [
            "abc",
            "Flags: []",
            "1 of 4",
          ],
          // type '3'
          [
            "abc3",
            "Flags: []",
            "1 of 1",
          ],
        ],
      },
    },
    {
      name: "Works with emacs pasting",
      stc: {
        text: [
          "bc",
          "abc1",
          "abc2",
          "abc3",
          "abc4",
        ],
        expectedText: [
          "",
          "abc1",
          "abc2 HERE",
          "abc3",
          "abc4",
        ],
        expectedSelections: [
          selection(2, 9),
        ],
        userInteractions: [
          cmd("groog.kill"),
          cmd("groog.find"),
          type("a"),
          cmd("groog.emacsPaste"),
          type("2"),
          ctrlG,
          ctrlG,
          type(" HERE"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'a'
          new NoOpQuickPickAction(), // paste
          new NoOpQuickPickAction(), // type '2'
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'a'
          [
            "a",
            "Flags: []",
            "1 of 4",
          ],
          // paste
          [
            "abc",
            "Flags: []",
            "1 of 4",
          ],
          // type '2'
          [
            "abc2",
            "Flags: []",
            "1 of 1",
          ],
        ],
      },
    },
    {
      name: "Works with regular pasting",
      stc: {
        text: [
          "bc",
          "abc1",
          "abc2",
          "abc3",
          "abc4",
        ],
        expectedText: [
          "bcX",
          "abc1",
          "abc2",
          "abc3 HERE",
          "abc4",
        ],
        expectedSelections: [
          selection(3, 9),
        ],
        userInteractions: [
          cmd("groog.toggleMarkMode"),
          cmd("groog.cursorEnd"),
          cmd("editor.action.clipboardCopyAction"),
          ctrlG,
          type("X"),
          cmd("groog.find"),
          type("a"),
          cmd("groog.paste"),
          type("3"),
          ctrlG,
          ctrlG,
          type(" HERE"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'a'
          new NoOpQuickPickAction(), // paste
          new NoOpQuickPickAction(), // type '3'
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'a'
          [
            "a",
            "Flags: []",
            "1 of 4",
          ],
          // paste
          [
            "abc",
            "Flags: []",
            "1 of 4",
          ],
          // type '3'
          [
            "abc3",
            "Flags: []",
            "1 of 1",
          ],
        ],
      },
    },
    {
      name: "Matches case word",
      stc: {
        text: [
          "ABC",
          "aBc",
          "Abc",
          "abc",
          "abC",
        ],
        expectedText: [
          "ABC",
          "aBc",
          "Abc",
          "xyz",
          "abC",
        ],
        expectedSelections: [
          selection(3, 3),
        ],
        userInteractions: [
          cmd("groog.find"),
          cmd("groog.find.toggleCaseSensitive"),
          type("abc"),
          ctrlG,
          cmd("groog.deleteLeft"),
          type("xyz"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // toggle case
          new NoOpQuickPickAction(), // type 'abc'
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // toggle case
          [
            " ",
            "Flags: [C]",
            "No results",
          ],
          // type 'abc'
          [
            "abc",
            "Flags: [C]",
            "1 of 1",
          ],
        ],
      },
    },
    {
      name: "Matches regex",
      stc: {
        text: [
          "1 jkslds jdkfjd 2",
          "b1 qwertyuiop 3a",
          " 1 qwertyuiop 3 ",
          "1 qwertyuiop 3",
          "1 asd fgh jkl\t4",
          "15",
        ],
        expectedText: [
          "1 jkslds jdkfjd 2",
          "b1 qwertyuiop 3a",
          " 1 qwertyuiop 3 ",
          "1 xyz 3",
          "1 asd fgh jkl\t4",
          "15",
        ],
        expectedSelections: [
          selection(3, 6),
        ],
        userInteractions: [
          cmd("groog.find"),
          cmd("groog.find.toggleRegex"),
          type("^1.*3$"),
          ctrlG,
          ctrlG,
          cmd("groog.cursorLeft"),
          cmd("groog.deleteWordLeft"),
          type("xyz "),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // toggle regex
          new NoOpQuickPickAction(), // type 'abc'
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // toggle regex
          [
            " ",
            "Flags: [R]",
            "No results",
          ],
          // type 'abc'
          [
            "^1.*3$",
            "Flags: [R]",
            "1 of 1",
          ],
        ],
      },
    },
    {
      name: "Matches whole word",
      stc: {
        text: [
          "abcd",
          "bcde",
          "bcd",
        ],
        expectedText: [
          "abcd",
          "bcde",
          "xyz",
        ],
        expectedSelections: [
          selection(2, 3),
        ],
        userInteractions: [
          cmd("groog.find"),
          cmd("groog.find.toggleWholeWord"),
          type("bcd"),
          ctrlG,
          cmd("groog.deleteLeft"),
          type("xyz"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // toggle whole word
          new NoOpQuickPickAction(), // type 'abc'
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // toggle whole word
          [
            " ",
            "Flags: [W]",
            "No results",
          ],
          // type 'abc'
          [
            "bcd",
            "Flags: [W]",
            "1 of 1",
          ],
        ],
      },
    },
    // Find whole word item accept logic
    // {
    //   name: "Matches whole word",
    //   text: [
    //     "abcd",
    //     "bcdef",
    //     "bcdeeee",
    //     "a BCDE fg",
    //     "bcause",
    //   ],
    //   expectedText: [
    //     "abcd",
    //     "bcdef",
    //     "bcdeeee",
    //     "a BCDE fg",
    //     "bcause",
    //   ],
    // stc: {
    //   userInteractions: [
    //     cmd("groog.find"),
    //     cmd("groog.find.toggleWholeWord"),
    //     type("bcd"),
    //     ctrlG,
    //     cmd("groog.deleteLeft"),
    //     type("xyz"),
    //   ],
    //   expectedSelections: [
    //     selection(2, 3),
    //   ],
    // },
    // Replace tests
    {
      name: "Replace fails if match failure",
      stc: {
        text: [
          "abc",
        ],
        expectedText: [
          "abc",
        ],
        userInteractions: [
          cmd("groog.find"),
          cmd("groog.find.toggleRegex"),
          type("?a"),
          cmd("groog.find.replaceOne"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // toggle regex
          new NoOpQuickPickAction(), // type '?a'
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // toggle whole word
          [
            " ",
            "Flags: [R]",
            "No results",
          ],
          // type '?a'
          [
            {
              label: "?a",
              description: "Invalid regular expression: /?a/gim: Nothing to repeat",
            },
            "Flags: [R]",
            "No results",
          ],
        ],
        expectedErrorMessages: [
          `Failed to get match info: Invalid regular expression: /?a/gim: Nothing to repeat`,
        ],
      },
    },
    {
      name: "Replace does nothing if no match",
      stc: {
        text: [
          "abc",
        ],
        expectedText: [
          "abc",
        ],
        userInteractions: [
          cmd("groog.find"),
          type("xyz"),
          cmd("groog.find.replaceOne"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'xyz'
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'xyz'
          [
            "xyz",
            "Flags: []",
            "No results",
          ],
        ],
      },
    },
    {
      name: "Replaces one vanilla text",
      stc: {
        text: [
          "abcd",
          "bcde",
          "bc",
          " BcD",
        ],
        expectedText: [
          "aXYZd",
          "bcde",
          "bc",
          " BcD",
        ],
        expectedSelections: [
        // Should be at next match
          new vscode.Selection(1, 0, 1, 2),
        ],
        userInteractions: [
          cmd("groog.find"),
          type("bc"),
          cmd("groog.find.toggleReplaceMode"),
          type("XYZ"),
          cmd("groog.find.replaceOne"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'bc'
          new NoOpQuickPickAction(), // toggle replace mode
          new NoOpQuickPickAction(), // type 'xyz'
          new NoOpQuickPickAction(), // replace
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'bc'
          [
            "bc",
            "Flags: []",
            "1 of 4",
          ],
          // toggle replace mode
          [
            {
              label: "bc",
              detail: "No replace text set",
            },
            "Flags: []",
            "1 of 4",
          ],
          // type 'xyz'
          [
            {
              label: "bc",
              detail: "XYZ",
            },
            "Flags: []",
            "1 of 4",
          ],
          // replace one
          [
            {
              label: "bc",
              detail: "XYZ",
            },
            "Flags: []",
            "1 of 3",
          ],
        ],
      },
    },
    {
      name: "Replaces all vanilla text",
      stc: {
        text: [
          "abcd",
          "bcde",
          "bc",
          " BcD",
        ],
        expectedText: [
          "aXYZd",
          "XYZde",
          "XYZ",
          " XYZD",
        ],
        userInteractions: [
          cmd("groog.find"),
          type("bc"),
          cmd("groog.find.toggleReplaceMode"),
          type("XYZ"),
          cmd("groog.find.replaceAll"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'bc'
          new NoOpQuickPickAction(), // toggle replace mode
          new NoOpQuickPickAction(), // type 'XYZ'
          new NoOpQuickPickAction(), // replace
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'bc'
          [
            "bc",
            "Flags: []",
            "1 of 4",
          ],
          // toggle replace mode
          [
            {
              label: "bc",
              detail: "No replace text set",
            },
            "Flags: []",
            "1 of 4",
          ],
          // type 'xyz'
          [
            {
              label: "bc",
              detail: "XYZ",
            },
            "Flags: []",
            "1 of 4",
          ],
          // replace one
          [
            {
              label: "bc",
              detail: "XYZ",
            },
            "Flags: []",
            "No results",
          ],
        ],
      },
    },
    {
      name: "Replaces one case match",
      stc: {
        text: [
          "aBc",
          "bcd",
          "bC",
          "abc",
        ],
        expectedText: [
          "aBc",
          "Xd",
          "bC",
          "abc",
        ],
        expectedSelections: [
        // Should be at next match
          new vscode.Selection(3, 1, 3, 3),
        ],
        userInteractions: [
          cmd("groog.find"),
          type("bc"),
          cmd("groog.find.toggleReplaceMode"),
          cmd("groog.find.toggleCaseSensitive"),
          type("X"),
          cmd("groog.find.replaceOne"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'bc'
          new NoOpQuickPickAction(), // toggle replace mode
          new NoOpQuickPickAction(), // toggle case sensitive
          new NoOpQuickPickAction(), // type 'X'
          new NoOpQuickPickAction(), // replace
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'bc'
          [
            "bc",
            "Flags: []",
            "1 of 4",
          ],
          // toggle replace mode
          [
            {
              label: "bc",
              detail: "No replace text set",
            },
            "Flags: []",
            "1 of 4",
          ],
          // toggle case sensitive
          [
            {
              label: "bc",
              detail: "No replace text set",
            },
            "Flags: [C]",
            "1 of 2",
          ],
          // type 'X'
          [
            {
              label: "bc",
              detail: "X",
            },
            "Flags: [C]",
            "1 of 2",
          ],
          // replace one
          [
            {
              label: "bc",
              detail: "X",
            },
            "Flags: [C]",
            "1 of 1",
          ],
        ],
      },
    },
    {
      name: "Replaces all case match",
      stc: {
        text: [
          "aBc",
          "bcd",
          "bC",
          "abc",
          "   vbcnxm ",
        ],
        expectedText: [
          "aBc",
          "Xd",
          "bC",
          "aX",
          "   vXnxm ",
        ],
        expectedSelections: [
        // Should be at next match
          selection(0, 0),
        ],
        userInteractions: [
          cmd("groog.find"),
          type("bc"),
          cmd("groog.find.toggleReplaceMode"),
          cmd("groog.find.toggleCaseSensitive"),
          type("X"),
          cmd("groog.find.replaceAll"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'bc'
          new NoOpQuickPickAction(), // toggle replace mode
          new NoOpQuickPickAction(), // toggle case sensitive
          new NoOpQuickPickAction(), // type 'X'
          new NoOpQuickPickAction(), // replace
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'bc'
          [
            "bc",
            "Flags: []",
            "1 of 5",
          ],
          // toggle replace mode
          [
            {
              label: "bc",
              detail: "No replace text set",
            },
            "Flags: []",
            "1 of 5",
          ],
          // toggle case sensitive
          [
            {
              label: "bc",
              detail: "No replace text set",
            },
            "Flags: [C]",
            "1 of 3",
          ],
          // type 'X'
          [
            {
              label: "bc",
              detail: "X",
            },
            "Flags: [C]",
            "1 of 3",
          ],
          // replace all
          [
            {
              label: "bc",
              detail: "X",
            },
            "Flags: [C]",
            "No results",
          ],
        ],
      },
    },
    {
      name: "Replaces one whole word match",
      stc: {
        text: [
          "aBc",
          "bc",
          "Bc",
          "bcd",
          " a bc d ",
        ],
        expectedText: [
          "aBc",
          "X",
          "Bc",
          "bcd",
          " a bc d ",
        ],
        expectedSelections: [
        // Should be at next match
          new vscode.Selection(2, 0, 2, 2),
        ],
        userInteractions: [
          cmd("groog.find"),
          type("bc"),
          cmd("groog.find.toggleReplaceMode"),
          cmd("groog.find.toggleWholeWord"),
          type("X"),
          cmd("groog.find.replaceOne"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'bc'
          new NoOpQuickPickAction(), // toggle replace mode
          new NoOpQuickPickAction(), // toggle whole word
          new NoOpQuickPickAction(), // type 'X'
          new NoOpQuickPickAction(), // replace
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'bc'
          [
            "bc",
            "Flags: []",
            "1 of 5",
          ],
          // toggle replace mode
          [
            {
              label: "bc",
              detail: "No replace text set",
            },
            "Flags: []",
            "1 of 5",
          ],
          // toggle whole word
          [
            {
              label: "bc",
              detail: "No replace text set",
            },
            "Flags: [W]",
            "1 of 3",
          ],
          // type 'X'
          [
            {
              label: "bc",
              detail: "X",
            },
            "Flags: [W]",
            "1 of 3",
          ],
          // replace all
          [
            {
              label: "bc",
              detail: "X",
            },
            "Flags: [W]",
            "1 of 2",
          ],
        ],
      },
    },
    {
      name: "Replaces all whole word match",
      stc: {
        text: [
          "aBc",
          "X",
          "Bc",
          "bcd",
          " a bc d ",
        ],
        expectedText: [
          "aBc",
          "X",
          "X",
          "bcd",
          " a X d ",
        ],
        userInteractions: [
          cmd("groog.find"),
          type("bc"),
          cmd("groog.find.toggleReplaceMode"),
          cmd("groog.find.toggleWholeWord"),
          type("X"),
          cmd("groog.find.replaceAll"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'bc'
          new NoOpQuickPickAction(), // toggle replace mode
          new NoOpQuickPickAction(), // toggle whole word
          new NoOpQuickPickAction(), // type 'X'
          new NoOpQuickPickAction(), // replace
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'bc'
          [
            "bc",
            "Flags: []",
            "1 of 4",
          ],
          // toggle replace mode
          [
            {
              label: "bc",
              detail: "No replace text set",
            },
            "Flags: []",
            "1 of 4",
          ],
          // toggle whole word
          [
            {
              label: "bc",
              detail: "No replace text set",
            },
            "Flags: [W]",
            "1 of 2",
          ],
          // type 'X'
          [
            {
              label: "bc",
              detail: "X",
            },
            "Flags: [W]",
            "1 of 2",
          ],
          // replace all
          [
            {
              label: "bc",
              detail: "X",
            },
            "Flags: [W]",
            "No results",
            // Whole-word suggestibles
            (() => { // Need to do this due to pickable being in FindQuickPickItem, but not vscode.QuickPickItem.
              return {
                label: "bcd",
                pickable: true,
              };
            })(),
          ],
        ],
      },
    },
    // Find context tests
    {
      name: "Find twice uses the previous find context",
      stc: {
        text: [
          "abc",
          "def",
          "abc2",
          "ghi",
          "abc3",
          "xyz",
        ],
        expectedText: [
          "aZZZ",
          "def",
          "aREPLACE2",
          "ghi",
          "abc3",
          "xyz",
        ],
        expectedSelections: [
          selection(2, 8),
        ],
        userInteractions: [
          cmd("groog.find"),
          type("bc"),
          ctrlG,
          cmd("groog.deleteLeft"),
          type("ZZZ"),
          cmd("groog.find"),
          cmd("groog.find"),
          ctrlG,
          cmd("groog.deleteLeft"),
          type("REPLACE"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'bc'
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // groog.find
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'bc'
          [
            "bc",
            "Flags: []",
            "1 of 3",
          ],
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'bc'
          [
            "bc",
            "Flags: []",
            "1 of 2",
          ],
        ],
      },
    },
    {
      name: "reverseFind",
      stc: {
        text: [
          "abc",
          "def",
          "abc2",
          "ghi",
          "abc3",
          "xyz",
          "abc4",
          "abc5",
        ],
        expectedText: [
          "abc",
          "def",
          "abc2",
          "ghi",
          "abc3",
          "xyz",
          "abc4",
          "aZZZ5",
        ],
        expectedSelections: [
          selection(7, 4),
        ],
        userInteractions: [
          cmd("groog.reverseFind"),
          type("bc"),
          ctrlG,
          cmd("groog.deleteLeft"),
          type("ZZZ"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.reverseFind
          new NoOpQuickPickAction(), // type 'bc'
        ],
        expectedQuickPickExecutions:[
          // groog.reverseFind
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'bc'
          [
            "bc",
            "Flags: []",
            "5 of 5",
          ],
        ],
      },
    },
    {
      name: "Multiple finds and reverseFind",
      stc: {
        text: [
          "abc",
          "def",
          "abc2",
          "ghi",
          "abc3",
          "xyz",
          "abc4",
          "abc5",
        ],
        expectedText: [
          "abc",
          "def",
          "aZZZ2",
          "ghi",
          "abc3",
          "xyz",
          "abc4",
          "abc5",
        ],
        expectedSelections: [
          selection(2, 4),
        ],
        userInteractions: [
          cmd("groog.find"),
          type("bc"), // abc
          cmd("groog.find"),  // abc2
          cmd("groog.find"),  // abc3
          cmd("groog.find"),  // abc4
          cmd("groog.reverseFind"),  // abc3
          cmd("groog.reverseFind"),  // abc2
          ctrlG,
          cmd("groog.deleteLeft"),
          type("ZZZ"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'bc'
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // groog.reverseFind
          new NoOpQuickPickAction(), // groog.reverseFind
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'bc'
          [
            "bc",
            "Flags: []",
            "1 of 5",
          ],
          // groog.find
          [
            "bc",
            "Flags: []",
            "2 of 5",
          ],
          // groog.find
          [
            "bc",
            "Flags: []",
            "3 of 5",
          ],
          // groog.find
          [
            "bc",
            "Flags: []",
            "4 of 5",
          ],
          // groog.reverseFind
          [
            "bc",
            "Flags: []",
            "3 of 5",
          ],
          // groog.reverseFind
          [
            "bc",
            "Flags: []",
            "2 of 5",
          ],
        ],
      },
    },
    {
      name: "Goes to previous context",
      stc: {
        text: [
          "abc",
          "def",
          "ghi",
          "xyz",
        ],
        expectedText: [
          "abc",
          "REPLACEf",
          "ghi",
          "xyz",
        ],
        expectedSelections: [
          selection(1, 7),
        ],
        userInteractions: [
          cmd("groog.find"),
          type("bc"),
          ctrlG,
          cmd("groog.find"),
          type("de"),
          ctrlG,
          cmd("groog.find"),
          type("xyz"),
          ctrlG,
          cmd("groog.find"),
          cmd("groog.find.previous"),
          cmd("groog.find.previous"),
          ctrlG,
          cmd("groog.deleteLeft"),
          type("REPLACE"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'bc'
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'de'
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'xyz'
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // groog.find.previous
          new NoOpQuickPickAction(), // groog.find.previous
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'bc'
          [
            "bc",
            "Flags: []",
            "1 of 1",
          ],
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'de'
          [
            "de",
            "Flags: []",
            "1 of 1",
          ],
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'xyz'
          [
            "xyz",
            "Flags: []",
            "1 of 1",
          ],
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // groog.find.previous
          [
            "xyz",
            "Flags: []",
            "1 of 1",
          ],
          // groog.find.previous
          [
            "de",
            "Flags: []",
            "1 of 1",
          ],
        ],
      },
    },
    {
      name: "Goes to previous context and continues typing",
      stc: {
        text: [
          "abc",
          "def",
          "ghi",
          "xyz",
        ],
        expectedText: [
          "abc",
          "REPLACE",
          "ghi",
          "xyz",
        ],
        expectedSelections: [
          selection(1, 7),
        ],
        userInteractions: [
          cmd("groog.find"),
          type("bc"),
          ctrlG,
          cmd("groog.find"),
          type("de"), // No `f`
          ctrlG,
          cmd("groog.find"),
          type("xyz"),
          ctrlG,
          cmd("groog.find"),
          cmd("groog.find.previous"),
          cmd("groog.find.previous"),
          cmd("groog.find.next"),
          cmd("groog.find.previous"),
          type("f"),
          ctrlG,
          cmd("groog.deleteLeft"),
          type("REPLACE"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'bc'
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'de'
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'xyz'
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // groog.find.previous
          new NoOpQuickPickAction(), // groog.find.previous
          new NoOpQuickPickAction(), // groog.find.next
          new NoOpQuickPickAction(), // groog.find.previous
          new NoOpQuickPickAction(), // type 'f'
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'bc'
          [
            "bc",
            "Flags: []",
            "1 of 1",
          ],
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'de'
          [
            "de",
            "Flags: []",
            "1 of 1",
          ],
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'xyz'
          [
            "xyz",
            "Flags: []",
            "1 of 1",
          ],
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // groog.find.previous
          [
            "xyz",
            "Flags: []",
            "1 of 1",
          ],
          // groog.find.previous
          [
            "de",
            "Flags: []",
            "1 of 1",
          ],
          // groog.find.next
          [
            "xyz",
            "Flags: []",
            "1 of 1",
          ],
          // groog.find.previous
          [
            "de",
            "Flags: []",
            "1 of 1",
          ],
          // tpye 'f'
          [
            "def",
            "Flags: []",
            "1 of 1",
          ],
        ],
      },
    },
    // Record tests
    {
      name: "Record playback fails if no recording set",
      stc: {
        text: [
          "abc",
        ],
        expectedText: [
          "abc",
        ],
        userInteractions: [
          cmd("groog.record.playRecording"),
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          `No recordings exist yet!`,
        ],
      },
    },
    {
      name: "Record playback fails if no recording set",
      stc: {
        text: [
          "abc",
        ],
        expectedText: [
          "abc",
        ],
        userInteractions: [
          cmd("groog.record.playRecordingRepeatedly"),
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          `No recordings exist yet!`,
        ],
      },
    },
    {
      name: "Save named recording fails if not recording",
      stc: {
        userInteractions: [
          cmd("groog.record.saveRecordingAs"),
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          `Not recording!`,
        ],
      },
    },
    {
      name: "End recording fails if not recording",
      stc: {
        userInteractions: [
          cmd("groog.record.endRecording"),
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          `Not recording!`,
        ],
      },
    },
    {
      name: "Handles nested startRecording commands",
      stc: {
        text: [
          "",
        ],
        expectedText: [
          "abc",
          "def",
          "ghi",
          "abc",
          "def",
          "",
        ],
        expectedSelections: [
          selection(5, 0),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          type("abc\n"),
          cmd("groog.record.startRecording"),
          type("def\n"),
          cmd("groog.record.endRecording"),
          type("ghi\n"),
          cmd("groog.record.playRecording"),
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          `Already recording!`,
        ],
      },
    },
    {
      name: "groog.deleteRight eats text",
      stc: {
        text: [
          "start",
          "text",
          "end",
        ],
        expectedText: [
          "startX",
          "textX",
          "end",
        ],
        expectedSelections: [
          selection(1, 5),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          cmd("groog.cursorEnd"),
          cmd("groog.cursorEnd"),
          type("X"),
          cmd("groog.record.endRecording"),

          cmd("groog.cursorRight"), // to next line

          cmd("groog.record.playNamedRecording"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new SelectItemQuickPickAction(["Recent recording 0"]),
        ],
        expectedQuickPickExecutions:[[
          recordingQuickPick({
            label: "Recent recording 0",
            recordBook: recordBook([
              new CommandRecord("groog.cursorEnd"), // Note only one of these
              new TypeRecord("X"),
            ]),
            savable: true,
          }),
        ]],
      },
    },
    {
      name: "Fails to playback if actively recording",
      stc: {
        text: [
          "abc",
        ],
        expectedText: [
          "xy",
          "xyabc",
        ],
        expectedSelections: [
          selection(1, 2),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          type("x"),
          cmd("groog.record.playRecording"),
          type("y"),
          cmd("groog.record.endRecording"),
          type("\n"),
          cmd("groog.record.playRecording"),
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          `Still recording!`,
        ],
      },
    },
    {
      name: "Fails to playback named recording if actively recording",
      stc: {
        text: [
          "abc",
        ],
        expectedText: [
          "xy",
          "xyabc",
        ],
        expectedSelections: [
          selection(1, 2),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          type("x"),
          cmd("groog.record.playNamedRecording"),
          type("y"),
          cmd("groog.record.endRecording"),
          type("\n"),
          cmd("groog.record.playRecording"),
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          `Still recording!`,
        ],
      },
    },
    {
      name: "Fails to playback if no named recording selected",
      stc: {
        text: [
          "abc",
        ],
        expectedText: [
          "abc",
        ],
        userInteractions: [
          cmd("groog.record.playNamedRecording"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [new SelectItemQuickPickAction([])],
        expectedQuickPickExecutions: [[]],
        expectedErrorMessages: [
          `No named recording selection made`,
        ],
      },
    },
    {
      name: "Fails to delete recording if actively recording",
      stc: {
        text: [
          "abc",
        ],
        expectedText: [
          "xy",
          "xyabc",
        ],
        expectedSelections: [
          selection(1, 2),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          type("x"),
          cmd("groog.record.deleteRecording"),
          type("y"),
          cmd("groog.record.endRecording"),
          type("\n"),
          cmd("groog.record.playRecording"),
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          `Still recording!`,
        ],
      },
    },
    {
      name: "Fails to repeatedly playback if actively recording",
      stc: {
        text: [
          "abc",
        ],
        expectedText: [
          "xy",
          "xyabc",
        ],
        expectedSelections: [
          selection(1, 2),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          type("x"),
          cmd("groog.record.playRecordingRepeatedly"),
          type("y"),
          cmd("groog.record.endRecording"),
          type("\n"),
          cmd("groog.record.playRecording"),
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          `Still recording!`,
        ],
      },
    },
    {
      name: "Records and plays back empty recording",
      stc: {
        text: [
          "start text",
        ],
        expectedText: [
          "start text",
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          cmd("groog.record.endRecording"),
          cmd("groog.record.playRecording"),
        ],
      },
    },
    {
      name: "Records and plays back text and command recording",
      stc: {
        text: [
          "start",
          "text",
          "ending",
        ],
        expectedText: [
          "start",
          "Ztext",
          "enZding",
        ],
        expectedSelections: [
          selection(2, 4),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          cmd("groog.cursorDown"),
          type("Z"),
          cmd("groog.cursorRight"),
          cmd("groog.record.endRecording"),
          cmd("groog.record.playRecording"),
        ],
      },
    },
    {
      name: "Records and plays back",
      stc: {
        text: [
          "abc",
          "1",
          "defabc",
          "2",
        ],
        expectedText: [
          "abcx",
          "1yx",
          "defyabc",
          "2",
        ],
        expectedSelections: [
          selection(2, 4),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          cmd("groog.cursorEnd"),
          type("x"),
          cmd("groog.cursorDown"),
          type("y"),
          cmd("groog.record.endRecording"),
          cmd("groog.record.playRecording"),
        ],
      },
    },
    {
      name: "Play back fails if no find match",
      stc: {
        text: [
          "abc",
          "1",
          "def",
          "ghi",
          "----",
          "def",
          "2",
          "3",
          "abc",
          "4",
        // No second ghi
        ],
        expectedText: [
          "un",
          "1",
          "deux",
          "trois",
          "----",
          "deux",
          "2",
          "3",
          "un",
          "4",
        ],
        expectedSelections: [
          selection(5, 4),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          cmd("groog.find"),
          type("abc"),
          ctrlG,
          type("un"),

          cmd("groog.find"),
          type("def"),
          ctrlG,
          type("deux"),

          cmd("groog.find"),
          type("ghi"),
          ctrlG,
          type("trois"),

          cmd("groog.record.endRecording"),
          cmd("groog.record.playRecording"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find for abc
          new NoOpQuickPickAction(), // groog.find for def
          new NoOpQuickPickAction(), // groog.find for ghi
          new NoOpQuickPickAction(), // groog.find for abc playback
          new NoOpQuickPickAction(), // groog.find for def playback
          new NoOpQuickPickAction(), // groog.find for ghi playback
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'abc'
          [
            "abc",
            "Flags: []",
            "1 of 2",
          ],
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'def'
          [
            "def",
            "Flags: []",
            "1 of 2",
          ],
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'ghi'
          [
            "ghi",
            "Flags: []",
            "1 of 1",
          ],
        ],
        expectedErrorMessages: [
          `No match found during recording playback`,
        ],
      },
    },
    {
      name: "Records and plays back when recording would be popped",
      stc: {
        text: [
          "start text",
        ],
        expectedText: [
          "xyz",
          "xyz",
          "start text",
        ],
        expectedSelections: [
          selection(2, 0),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          type("ab"),
          type("cde"),
          // All these deleteLefts cause the 'abcde' text record to be deleted entirely
          cmd("groog.deleteLeft"),
          cmd("groog.deleteLeft"),
          cmd("groog.deleteLeft"),
          cmd("groog.deleteLeft"),
          cmd("groog.deleteLeft"),
          type("xy"),
          type("z"),
          type("\n"),
          cmd("groog.record.endRecording"),
          cmd("groog.record.playRecording"),
        ],
      },
    },
    {
      name: "Saves recording as and plays back",
      stc: {
        text: [
          "abc",
          "1",
          "defabc",
          "2",
        ],
        expectedText: [
          "abcx",
          "1yx",
          "defyabc",
          "2",
        ],
        expectedSelections: [
          selection(2, 4),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          cmd("groog.cursorEnd"),
          type("x"),
          cmd("groog.cursorDown"),
          type("y"),
          cmd("groog.record.saveRecordingAs"),
          cmd("groog.record.playRecording"),
        ],
      },
      stubbablesConfig: {
        inputBoxResponses: ["some-name"],
        expectedInfoMessages: [
          `Recording saved as "some-name"!`,
        ],
        expectedInputBoxes: [
          {
            options: {
              placeHolder: "Recording name",
              title: "Save recording as:",
              validateInputProvided: true,
            },
            validationMessage: undefined,
          },
        ],
      },
    },
    {
      name: "Fails to name recording if reserved prefix",
      stc: {
        text: [
          "start text",
        ],
        expectedText: [
          "abc",
          "abc",
          "start text",
        ],
        expectedSelections: [
          selection(2, 0),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          type("a"),
          type("b"),
          type("c"),
          type("\n"),
          cmd("groog.record.saveRecordingAs"),
          cmd("groog.record.playRecording"),
        ],
      },
      stubbablesConfig: {
        inputBoxResponses: [
          "Recent recording bleh",
        ],
        expectedErrorMessages: [
          `No recording name provided`,
        ],
        expectedInputBoxes: [
          {
            options: {
              placeHolder: "Recording name",
              title: "Save recording as:",
              validateInputProvided: true,
            },
            validationMessage: {
              message: "This is a reserved prefix",
              severity: vscode.InputBoxValidationSeverity.Error,
            },
          },
        ],
      },
    },
    {
      name: "Fails to name recording if recording name already exists",
      stc: {
        text: [
          "start text",
        ],
        expectedText: [
          "abc",
          "ABC",
          "ABC",
          "start text",
        ],
        expectedSelections: [
          selection(3, 0),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          type("a"),
          type("b"),
          type("c"),
          type("\n"),
          cmd("groog.record.saveRecordingAs"),
          cmd("groog.record.startRecording"),
          type("ABC\n"),
          cmd("groog.record.saveRecordingAs"),
          cmd("groog.record.playRecording"),
        ],
      },
      stubbablesConfig: {
        inputBoxResponses: [
          "ABC Recording",
          "ABC Recording",
        ],
        expectedInputBoxes: [
          {
            options: {
              placeHolder: "Recording name",
              title: "Save recording as:",
              validateInputProvided: true,
            },
          },
          {
            options: {
              placeHolder: "Recording name",
              title: "Save recording as:",
              validateInputProvided: true,
            },
            validationMessage: {
              message: "This record name already exists",
              severity: vscode.InputBoxValidationSeverity.Error,
            },
          },
        ],
        expectedInfoMessages: [
          `Recording saved as "ABC Recording"!`,
        ],
        expectedErrorMessages: [
          `No recording name provided`,
        ],
      },
    },
    {
      name: "Plays back named recording specified by name",
      stc: {
        text: [
          "start text",
        ],
        expectedText: [
          "abc",
          "def",
          "ghi",
          "def",
          "start text",
        ],
        expectedSelections: [
          selection(4, 0),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          type("a"),
          type("b"),
          type("c"),
          type("\n"),
          cmd("groog.record.saveRecordingAs"),
          cmd("groog.record.startRecording"),
          type("def\n"),
          cmd("groog.record.saveRecordingAs"),
          cmd("groog.record.startRecording"),
          type("gh"),
          type("i\n"),
          cmd("groog.record.saveRecordingAs"),
          cmd("groog.record.playNamedRecording"),
        ],
      },
      stubbablesConfig: {
        inputBoxResponses: [
          "ABC Recording",
          "DEF Recording",
          "GHI Recording",
        ],
        quickPickActions: [new SelectItemQuickPickAction(["DEF Recording"])],
        expectedQuickPickExecutions:[[
          recordingQuickPick({
            label: "Recent recording 0",
            recordBook: recordBook([new TypeRecord("ghi\n")]),
            savable: true,
          }),
          recordingQuickPick({
            label: "Recent recording 1",
            recordBook: recordBook([new TypeRecord("def\n")]),
            savable: true,
          }),
          recordingQuickPick({
            label: "Recent recording 2",
            recordBook: recordBook([new TypeRecord("abc\n")]),
            savable: true,
          }),
          recordingQuickPick({
            label: "ABC Recording",
            recordBook: recordBook([new TypeRecord("abc\n")]),
          }),
          recordingQuickPick({
            label: "DEF Recording",
            recordBook: recordBook([new TypeRecord("def\n")]),
          }),
          recordingQuickPick({
            label: "GHI Recording",
            recordBook: recordBook([new TypeRecord("ghi\n")]),
          }),
        ]],
        expectedInputBoxes: [
          {
            options: {
              placeHolder: "Recording name",
              title: "Save recording as:",
              validateInputProvided: true,
            },
          },
          {
            options: {
              placeHolder: "Recording name",
              title: "Save recording as:",
              validateInputProvided: true,
            },
          },
          {
            options: {
              placeHolder: "Recording name",
              title: "Save recording as:",
              validateInputProvided: true,
            },
          },
        ],
        expectedInfoMessages: [
          `Recording saved as "ABC Recording"!`,
          `Recording saved as "DEF Recording"!`,
          `Recording saved as "GHI Recording"!`,
        ],
      },
    },
    {
      name: "Fails to play back named recording if multiple items are picked",
      stc: {
        text: [
          "start text",
        ],
        expectedText: [
          "abc",
          "def",
          "ghi",
          "start text",
        ],
        expectedSelections: [
          selection(3, 0),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          type("a"),
          type("b"),
          type("c"),
          type("\n"),
          cmd("groog.record.saveRecordingAs"),
          cmd("groog.record.startRecording"),
          type("def\n"),
          cmd("groog.record.saveRecordingAs"),
          cmd("groog.record.startRecording"),
          type("gh"),
          type("i\n"),
          cmd("groog.record.saveRecordingAs"),
          cmd("groog.record.playNamedRecording"),
        ],
      },
      stubbablesConfig: {
        inputBoxResponses: [
          "ABC Recording",
          "DEF Recording",
          "GHI Recording",
        ],
        quickPickActions: [new SelectItemQuickPickAction(["ABC Recording", "DEF Recording"])],
        expectedQuickPickExecutions:[[
          recordingQuickPick({
            label: "Recent recording 0",
            recordBook: recordBook([new TypeRecord("ghi\n")]),
            savable: true,
          }),
          recordingQuickPick({
            label: "Recent recording 1",
            recordBook: recordBook([new TypeRecord("def\n")]),
            savable: true,
          }),
          recordingQuickPick({
            label: "Recent recording 2",
            recordBook: recordBook([new TypeRecord("abc\n")]),
            savable: true,
          }),
          recordingQuickPick({
            label: "ABC Recording",
            recordBook: recordBook([new TypeRecord("abc\n")]),
          }),
          recordingQuickPick({
            label: "DEF Recording",
            recordBook: recordBook([new TypeRecord("def\n")]),
          }),
          recordingQuickPick({
            label: "GHI Recording",
            recordBook: recordBook([new TypeRecord("ghi\n")]),
          }),
        ]],
        expectedInputBoxes: [
          {
            options: {
              placeHolder: "Recording name",
              title: "Save recording as:",
              validateInputProvided: true,
            },
          },
          {
            options: {
              placeHolder: "Recording name",
              title: "Save recording as:",
              validateInputProvided: true,
            },
          },
          {
            options: {
              placeHolder: "Recording name",
              title: "Save recording as:",
              validateInputProvided: true,
            },
          },
        ],
        expectedInfoMessages: [
          `Recording saved as "ABC Recording"!`,
          `Recording saved as "DEF Recording"!`,
          `Recording saved as "GHI Recording"!`,
        ],
        expectedErrorMessages: [
          "Multiple selections made somehow?!",
        ],
      },
    },
    {
      name: "Deletes recording",
      stubbablesConfig: {
        inputBoxResponses: [
          "ABC Recording",
          "DEF Recording",
          "GHI Recording",
        ],
        quickPickActions: [
          new SelectItemQuickPickAction(["DEF Recording"]), // playNamedRecording (succeeds)
          new SelectItemQuickPickAction(["DEF Recording"]), // deleteRecording
          new CloseQuickPickAction(),                     // playNamedRecording (fails)
        ],
        expectedQuickPickExecutions:[
          // playNamedRecording
          [
            recordingQuickPick({
              label: "Recent recording 0",
              recordBook: recordBook([new TypeRecord("ghi\n")]),
              savable: true,
            }),
            recordingQuickPick({
              label: "Recent recording 1",
              recordBook: recordBook([new TypeRecord("def\n")]),
              savable: true,
            }),
            recordingQuickPick({
              label: "Recent recording 2",
              recordBook: recordBook([new TypeRecord("abc\n")]),
              savable: true,
            }),
            recordingQuickPick({
              label: "ABC Recording",
              recordBook: recordBook([new TypeRecord("abc\n")]),
            }),
            recordingQuickPick({
              label: "DEF Recording",
              recordBook: recordBook([new TypeRecord("def\n")]),
            }),
            recordingQuickPick({
              label: "GHI Recording",
              recordBook: recordBook([new TypeRecord("ghi\n")]),
            }),
          ],
          // deleteRecording
          ["ABC Recording", "DEF Recording", "GHI Recording"],
          // playNamedRecording
          [
            recordingQuickPick({
              label: "Recent recording 0",
              recordBook: recordBook([new TypeRecord("ghi\n")]),
              savable: true,
            }),
            recordingQuickPick({
              label: "Recent recording 1",
              recordBook: recordBook([new TypeRecord("def\n")]),
              savable: true,
            }),
            recordingQuickPick({
              label: "Recent recording 2",
              recordBook: recordBook([new TypeRecord("abc\n")]),
              savable: true,
            }),
            recordingQuickPick({
              label: "ABC Recording",
              recordBook: recordBook([new TypeRecord("abc\n")]),
            }),
            recordingQuickPick({
              label: "GHI Recording",
              recordBook: recordBook([new TypeRecord("ghi\n")]),
            }),
          ],
        ],
        expectedInfoMessages: [
          `Recording saved as "ABC Recording"!`,
          `Recording saved as "DEF Recording"!`,
          `Recording saved as "GHI Recording"!`,
        ],
        expectedInputBoxes: [
          {
            options: {
              placeHolder: "Recording name",
              title: "Save recording as:",
              validateInputProvided: true,
            },
          },
          {
            options: {
              placeHolder: "Recording name",
              title: "Save recording as:",
              validateInputProvided: true,
            },
          },
          {
            options: {
              placeHolder: "Recording name",
              title: "Save recording as:",
              validateInputProvided: true,
            },
          },
        ],
      },
      stc: {
        text: [
          "start text",
        ],
        expectedText: [
          "abc",
          "def",
          "ghi",
          "def",
          "start text",
        ],
        expectedSelections: [
          selection(4, 0),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          type("abc\n"),
          cmd("groog.record.saveRecordingAs"),
          cmd("groog.record.startRecording"),
          type("def\n"),
          cmd("groog.record.saveRecordingAs"),
          cmd("groog.record.startRecording"),
          type("ghi\n"),
          cmd("groog.record.saveRecordingAs"),
          cmd("groog.record.playNamedRecording"),
          cmd("groog.record.deleteRecording"),
          cmd("groog.record.playNamedRecording"),
        ],
      },
    },
    {
      name: "Records kill and paste",
      stc: {
        text: [
          "abc",
          "1",
          "defabc",
          "2",
        ],
        expectedText: [
          "abcxabc",
          "1x1",
          "defabc",
          "2",
        ],
        expectedSelections: [
          selection(2, 0),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          cmd("groog.kill"),
          cmd("groog.emacsPaste"),
          type("x"),
          cmd("groog.emacsPaste"),
          cmd("groog.cursorDown"),
          cmd("groog.cursorHome"),
          cmd("groog.record.endRecording"),
          cmd("groog.record.playRecording"),
        ],
      },
    },
    {
      name: "Records maim and paste",
      stc: {
        text: [
          "abc",
          "1",
          "defabc",
          "2",
        ],
        expectedText: [
          "abcxabcabc",
          "1x11",
          "defabc",
          "2",
        ],
        expectedSelections: [
          selection(2, 0),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          cmd("groog.maim"),
          cmd("groog.emacsPaste"),
          type("x"),
          cmd("groog.emacsPaste"),
          cmd("groog.cursorDown"),
          cmd("groog.cursorHome"),
          cmd("groog.record.endRecording"),
          cmd("groog.record.playRecording"),
        ],
      },
    },
    {
      name: "Records mark and paste",
      stc: {
        text: [
          "abc",
          "1",
          "defabc",
          "2",
          "zzz",
        ],
        expectedText: [
          "abc",
          "1 End line",
          "Newline",
          "abc",
          "1",
          "defabc",
          "2 End line",
          "Newline",
          "defabc",
          "2",
          "zzz",
        ],
        expectedSelections: [
          selection(10, 0),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          cmd("groog.toggleMarkMode"),
          cmd("groog.cursorDown"),
          cmd("groog.cursorEnd"),
          cmd("groog.yank"),
          cmd("groog.emacsPaste"),
          type(" End line\nNewline\n"),
          cmd("groog.emacsPaste"),
          cmd("groog.cursorDown"),
          cmd("groog.cursorHome"),
          cmd("groog.record.endRecording"),
          cmd("groog.record.playRecording"),
        ],
      },
    },
    {
      name: "Records vanilla copy and paste",
      stc: {
        text: [
          "abc",
          "1",
          "defabc",
          "2",
        ],
        expectedText: [
          "abcxabcabc",
          "abcxabc1",
          "defabc",
          "2",
        ],
        expectedSelections: [
          selection(2, 0),
        ],
        userInteractions: [
          cmd("groog.toggleMarkMode"),
          cmd("groog.cursorEnd"),
          cmd("editor.action.clipboardCopyAction"),
          cmd("groog.cursorHome"),

          cmd("groog.record.startRecording"),
          cmd("groog.paste"),
          type("x"),
          cmd("groog.paste"),
          cmd("groog.cursorDown"),
          cmd("groog.cursorHome"),
          cmd("groog.record.endRecording"),
          cmd("groog.record.playRecording"),
        ],
      },
    },
    {
      name: "Records with find",
      stc: {
        text: [
          "abc",
          "1",
          "defabc",
          "2",
        ],
        expectedText: [
          "xyz",
          "1",
          "defxyz",
          "2",
        ],
        expectedSelections: [
          selection(2, 6),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          cmd("groog.find"),
          type("abc"),
          ctrlG,
          cmd("groog.deleteLeft"),
          type("xyz"),
          cmd("groog.record.endRecording"),
          cmd("groog.record.playRecording"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'abc'
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'abc'
          [
            "abc",
            "Flags: []",
            "1 of 2",
          ],
        ],
      },
    },
    // Repeat recording tests
    {
      name: "Repeat recording fails if doesn't start with find",
      stc: {
        text: [
          "start text",
        ],
        expectedText: [
          "xyz",
          "start text",
        ],
        expectedSelections: [
          selection(1, 0),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          type("xyz\n"),
          cmd("groog.record.endRecording"),
          cmd("groog.record.playRecordingRepeatedly"),
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          `This recording isn't repeatable`,
        ],
      },
    },
    {
      name: "Repeat record playback with decreasing find matches",
      stc: {
        text: [
          "abc",
          "1",
          "defabc",
          "2",
          ".abcabc...abc.....",
        ],
        expectedText: [
          "xyz",
          "1",
          "defxyz",
          "2",
          ".xyzxyz...xyz.....",
        ],
        expectedSelections: [
          selection(4, 13),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          cmd("groog.find"),
          type("abc"),
          ctrlG,
          cmd("groog.deleteLeft"),
          type("xyz"),
          cmd("groog.record.endRecording"),
          cmd("groog.record.playRecordingRepeatedly"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'abc'
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'abc'
          [
            "abc",
            "Flags: []",
            "1 of 5",
          ],
        ],
        expectedErrorMessages: [
          "No match found during recording playback",
        ],
      },
    },
    {
      name: "Repeat record playback fails if subsequent find fails",
      stc: {
        text: [
          "abc def",
          "1",
          "abc BLOOP def",
          "2",
          "abc FIN ghi",
          "abc ANOTHER",
        ],
        expectedText: [
          "ABC XYZ",
          "1",
          "ABC BLOOP XYZ",
          "2",
          "ABC FIN ghi",
          "abc ANOTHER",
        ],
        expectedSelections: [
          selection(4, 3),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          cmd("groog.find"),
          type("abc"),
          ctrlG,
          cmd("groog.deleteLeft"),
          type("ABC"),
          cmd("groog.find"),
          type("def"),
          ctrlG,
          cmd("groog.deleteLeft"),
          type("XYZ"), // Note this can't be 'DEF' otherwise it still matches find
          cmd("groog.record.endRecording"),

          cmd("groog.record.playRecordingRepeatedly"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'abc'
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'def'
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'abc'
          [
            "abc",
            "Flags: []",
            "1 of 4",
          ],
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'def'
          [
            "def",
            "Flags: []",
            "1 of 2",
          ],
        ],
        expectedErrorMessages: [
          "No match found during recording playback",
        ],
      },
    },
    {
      name: "Repeat record playback with non-decreasing find matches",
      stc: {
        text: [
          "abc",
          "1",
          "defabc",
          "2",
          ".abcabc...abc.....",
        ],
        expectedText: [
        // Once for record and once for playback
          "abcxyzxyz",
          "1",
          "defabcxyz",
          "2",
          ".abcxyzabcxyz...abcxyz.....",
        ],
        expectedSelections: [
          new vscode.Selection(2, 3, 2, 6),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          cmd("groog.find"),
          type("abc"),
          ctrlG,
          ctrlG,
          type("xyz"),
          cmd("groog.record.endRecording"),
          cmd("groog.record.playRecordingRepeatedly"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'abc'
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'abc'
          [
            "abc",
            "Flags: []",
            "1 of 5",
          ],
        ],
        expectedInfoMessages: [
          "Successfully ran recording on all matches",
        ],
      },
    },
    {
      name: "Record with skipped find executions",
      stc: {
        text: [
          "abc",
          "1",
          "defabc",
          "2",
          ".abc...abc.....",
        ],
        expectedText: [
          "abc",
          "1",
          // Once for record and once for playback
          "defabcxyzxyz",
          "2",
          ".abc...abcxyz.....",
        ],
        expectedSelections: [
          new vscode.Selection(4, 7, 4, 10),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          cmd("groog.find"),
          type("abc"),
          cmd("groog.find"),
          ctrlG,
          ctrlG,
          type("xyz"),
          cmd("groog.record.endRecording"),
          cmd("groog.record.playRecordingRepeatedly"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'abc'
          new NoOpQuickPickAction(), // groog.find
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'abc'
          [
            "abc",
            "Flags: []",
            "1 of 4",
          ],
          // groog.find
          [
            "abc",
            "Flags: []",
            "2 of 4",
          ],
        ],
        expectedErrorMessages: [
          "Landed on same match index, ending repeat playback",
        ],
      },
    },
    {
      name: "Record repeat playback ends if start in non-decrease mode and count changes",
      stc: {
        text: [
          "abcdef",
          "1",
          "....abc.....",
          "",
          "abc",
          "",
          "abc123",
        ],
        expectedText: [
          "abcdeZf",
          "1",
          "....abc....Z.",
          "",
          "abZc",
          "",
          "abc123",
        ],
        expectedSelections: [
          new vscode.Selection(6, 0, 6, 3),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          cmd("groog.find"),
          type("abc"),
          ctrlG,
          cmd("groog.cursorEnd"),
          cmd("groog.cursorLeft"),
          type("Z"),
          cmd("groog.record.endRecording"),
          cmd("groog.record.playRecordingRepeatedly"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'abc'
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'abc'
          [
            "abc",
            "Flags: []",
            "1 of 4",
          ],
        ],
        expectedErrorMessages: [
          "Number of matches changed (4 -> 3), ending repeat playback",
        ],
      },
    },
    {
      name: "Record repeat playback ends if start in decrease mode and count does not change",
      stc: {
        text: [
          "defabc",
          "1",
          "....abc",
          "",
          "abcdef",
          "",
          "123abc",
        ],
        expectedText: [
          "defabZc",
          "1",
          "....abZc",
          "",
          "abcdeZf",
          "",
          "123abc",
        ],
        expectedSelections: [
          new vscode.Selection(6, 3, 6, 6),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          cmd("groog.find"),
          type("abc"),
          ctrlG,
          cmd("groog.cursorEnd"),
          cmd("groog.cursorLeft"),
          type("Z"),
          cmd("groog.record.endRecording"),
          cmd("groog.record.playRecordingRepeatedly"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'abc'
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'abc'
          [
            "abc",
            "Flags: []",
            "1 of 4",
          ],
        ],
        expectedErrorMessages: [
          "Number of matches did not decrease, ending repeat playback",
        ],
      },
    },
    // Repeat record playback with buttons
    {
      name: "Repeat named record playback with decreasing find matches",
      stc: {
        text: [
          "abc",
          "1",
          "defabc",
          "2",
          ".abcabc...abc.....",
        ],
        expectedText: [
          "xyz",
          "1",
          "defxyz",
          "2",
          ".xyzxyz...xyz.....",
        ],
        expectedSelections: [
          selection(4, 13),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          cmd("groog.find"),
          type("abc"),
          ctrlG,
          cmd("groog.deleteLeft"),
          type("xyz"),
          cmd("groog.record.endRecording"),
          cmd("groog.record.playNamedRecording"),
        ],
      },
      stubbablesConfig: {
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'abc'

          // Save recording
          new PressItemButtonQuickPickAction("Recent recording 0", 1),
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'abc'
          [
            "abc",
            "Flags: []",
            "1 of 5",
          ],
          // playNamedRecording
          [
            recordingQuickPick({
              label: "Recent recording 0",
              recordBook: recordBook([
                new FindRecord(0, {
                  caseInsensitive: true,
                  prevMatchOnChange: false,
                  queryText: "abc",
                  regex: false,
                  wholeWord: false,
                }),
                new CommandRecord("groog.deleteLeft"),
                new TypeRecord("xyz"),
              ]),
              savable: true,
              repeatable: true,
            }),
          ],
        ],
        expectedErrorMessages: [
          `No match found during recording playback`,
        ],
      },
    },
    // SaveRecentRecordingButton
    {
      name: "Fails if unknown button",
      stc: {
        text: [
          "abc",
          "def",
          "ghi",
          "def",
        ],
        expectedText: [
          "abc",
          "XYZ",
          "ghi",
          "def",
        ],
        expectedSelections: [selection(1, 3)],
        userInteractions: [
          cmd("groog.record.startRecording"),
          cmd("groog.find"),
          type("def"),
          ctrlG,
          type("XYZ"),
          cmd("groog.record.endRecording"),

          cmd("groog.record.playNamedRecording"),
        ],
      },
      stubbablesConfig: {
        inputBoxResponses: [
          "My favorite recording",
        ],
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'def'

          // playNamedRecording
          new PressUnknownButtonQuickPickAction("Recent recording 0"),
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'abc'
          [
            "def",
            "Flags: []",
            "1 of 2",
          ],
          // playNamedRecording (to save)
          [
            recordingQuickPick({
              label: "Recent recording 0",
              recordBook: recordBook([
                new FindRecord(0, {
                  caseInsensitive: true,
                  prevMatchOnChange: false,
                  queryText: "def",
                  regex: false,
                  wholeWord: false,
                }),
                new TypeRecord("XYZ"),
              ]),
              savable: true,
              repeatable: true,
            }),
          ],
        ],
        expectedErrorMessages: [
          `Unknown item button`,
        ],
      },
    },
    {
      name: "Save a recent recording",
      stc: {
        text: [
          "abc",
          "1",
          "def",
          "ghi",
          "----",
          "def",
          "2",
          "3",
          "ghi",
          "4",
          "abc",
        ],
        expectedText: [
          "un",
          "1",
          "deux",
          "trois",
          "----",
          "deux",
          "2",
          "3",
          "ghi",
          "4",
          "abc",
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          cmd("groog.find"),
          type("abc"),
          ctrlG,
          type("un"),
          cmd("groog.record.endRecording"),

          cmd("groog.record.startRecording"),
          cmd("groog.find"),
          type("def"),
          ctrlG,
          type("deux"),
          cmd("groog.record.endRecording"),

          cmd("groog.record.startRecording"),
          cmd("groog.find"),
          type("ghi"),
          ctrlG,
          type("trois"),
          cmd("groog.record.endRecording"),

          cmd("groog.record.playNamedRecording"),
          cmd("groog.record.playNamedRecording"),
        ],
        expectedSelections: [selection(5, 4)],
      },
      stubbablesConfig: {
        inputBoxResponses: [
          "My favorite recording",
        ],
        quickPickActions: [
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'abc'
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'def'
          new NoOpQuickPickAction(), // groog.find
          new NoOpQuickPickAction(), // type 'ghi'

          // Save abc recording
          new PressItemButtonQuickPickAction("Recent recording 1", 0),
          new SelectItemQuickPickAction(["My favorite recording"]),
        ],
        expectedQuickPickExecutions:[
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'abc'
          [
            "abc",
            "Flags: []",
            "1 of 2",
          ],
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'def'
          [
            "def",
            "Flags: []",
            "1 of 2",
          ],
          // groog.find
          [
            " ",
            "Flags: []",
            "No results",
          ],
          // type 'ghi'
          [
            "ghi",
            "Flags: []",
            "1 of 2",
          ],
          // playNamedRecording (to save)
          [
            recordingQuickPick({
              label: "Recent recording 0",
              recordBook: recordBook([
                new FindRecord(0, {
                  caseInsensitive: true,
                  prevMatchOnChange: false,
                  queryText: "ghi",
                  regex: false,
                  wholeWord: false,
                }),
                new TypeRecord("trois"),
              ]),
              savable: true,
              repeatable: true,
            }),
            recordingQuickPick({
              label: "Recent recording 1",
              recordBook: recordBook([
                new FindRecord(0, {
                  caseInsensitive: true,
                  prevMatchOnChange: false,
                  queryText: "def",
                  regex: false,
                  wholeWord: false,
                }),
                new TypeRecord("deux"),
              ]),
              savable: true,
              repeatable: true,
            }),
            recordingQuickPick({
              label: "Recent recording 2",
              recordBook: recordBook([
                new FindRecord(0, {
                  caseInsensitive: true,
                  prevMatchOnChange: false,
                  queryText: "abc",
                  regex: false,
                  wholeWord: false,
                }),
                new TypeRecord("un"),
              ]),
              savable: true,
              repeatable: true,
            }),
          ],
          // playNamedRecording (to playback)
          [
            recordingQuickPick({
              label: "Recent recording 0",
              recordBook: recordBook([
                new FindRecord(0, {
                  caseInsensitive: true,
                  prevMatchOnChange: false,
                  queryText: "ghi",
                  regex: false,
                  wholeWord: false,
                }),
                new TypeRecord("trois"),
              ]),
              savable: true,
              repeatable: true,
            }),
            recordingQuickPick({
              label: "Recent recording 1",
              recordBook: recordBook([
                new FindRecord(0, {
                  caseInsensitive: true,
                  prevMatchOnChange: false,
                  queryText: "def",
                  regex: false,
                  wholeWord: false,
                }),
                new TypeRecord("deux"),
              ]),
              savable: true,
              repeatable: true,
            }),
            recordingQuickPick({
              label: "Recent recording 2",
              recordBook: recordBook([
                new FindRecord(0, {
                  caseInsensitive: true,
                  prevMatchOnChange: false,
                  queryText: "abc",
                  regex: false,
                  wholeWord: false,
                }),
                new TypeRecord("un"),
              ]),
              savable: true,
              repeatable: true,
            }),
            recordingQuickPick({
              label: "My favorite recording",
              recordBook: recordBook([
                new FindRecord(0, {
                  caseInsensitive: true,
                  prevMatchOnChange: false,
                  queryText: "def",
                  regex: false,
                  wholeWord: false,
                }),
                new TypeRecord("deux"),
              ]),
              repeatable: true,
            }),
          ],
        ],
        expectedInputBoxes: [
          {
            options: {
              placeHolder: "Recording name",
              title: "Save recording as:",
              validateInputProvided: true,
            },
            validationMessage: undefined,
          },
        ],
        expectedInfoMessages: [
          `Recording saved as "My favorite recording"!`,
        ],
      },
    },
    {
      name: "Playback a recent recording",
      stc: {
        text: [
          "",
        ],
        expectedText: [
          "abcdefghijklghi",
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          type("abc"),
          cmd("groog.record.endRecording"),

          cmd("groog.record.startRecording"),
          type("def"),
          cmd("groog.record.endRecording"),

          cmd("groog.record.startRecording"),
          type("ghi"),
          cmd("groog.record.endRecording"),

          cmd("groog.record.startRecording"),
          type("jkl"),
          cmd("groog.record.endRecording"),

          cmd("groog.record.playNamedRecording"),
        ],
        expectedSelections: [selection(0, 15)],
      },
      stubbablesConfig: {
        quickPickActions: [
        // Run second to last recording (ghi)
          new SelectItemQuickPickAction(["Recent recording 1"]),
        ],
        expectedQuickPickExecutions:[
          [
            recordingQuickPick({
              label: "Recent recording 0",
              recordBook: recordBook([new TypeRecord("jkl")]),
              savable: true,
            }),
            recordingQuickPick({
              label: "Recent recording 1",
              recordBook: recordBook([new TypeRecord("ghi")]),
              savable: true,
            }),
            recordingQuickPick({
              label: "Recent recording 2",
              recordBook: recordBook([new TypeRecord("def")]),
              savable: true,
            }),
          ],
        ],
      },
    },
    // Record undo tests
    {
      name: "Record undo fails if no recordings",
      stc: {
        text: [
          "start text",
        ],
        expectedText: [
          "start text",
        ],
        userInteractions: [
          cmd("groog.record.undo"),
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          `No recordings exist yet!`,
        ],
      },
    },
    {
      name: "Record undo fails if recording is locked",
      stc: {
        text: [
          "start text",
        ],
        expectedText: [
          "abc",
          "start text",
        ],
        expectedSelections: [
          selection(1, 0),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          type("abc\n"),
          cmd("groog.record.endRecording"),
          cmd("groog.record.undo"),
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          `Cannot undo a locked recording`,
        ],
      },
    },
    {
      name: "Record undo does nothing if empty record book",
      stc: {
        text: [
          "start text",
        ],
        expectedText: [
          "def",
          "Xdef",
          "start text",
        ],
        expectedSelections: [
          selection(2, 0),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          cmd("groog.record.undo"),
          type("d"),
          type("e"),
          type("f"),
          type("\n"),
          cmd("groog.record.endRecording"),
          type("X"),
          cmd("groog.record.playRecording"),
        ],
      },
    },
    {
      name: "Record undo works if recording is locked",
      stc: {
        text: [
          "start text",
        ],
        expectedText: [
          "abc",
          "abc",
          "start text",
        ],
        expectedSelections: [
          selection(2, 0),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          type("a"),
          type("b"),
          type("Z"),
          cmd("groog.record.undo"),
          type("c"),
          type("\n"),
          cmd("groog.record.endRecording"),
          cmd("groog.record.playRecording"),
        ],
      },
    },
    {
      name: "Record undo fails",
      stc: {
        text: [
          "start text",
        ],
        expectedText: [
          "ac",
          "ac",
          "bbstart text",
        ],
        expectedSelections: [
          selection(2, 0),
        ],
        userInteractions: [
          cmd("groog.record.startRecording"),
          type("a"),
          type("b"),
          cmd("groog.cursorLeft"),
          cmd("groog.record.undo"),
          type("c"),
          type("\n"),
          cmd("groog.record.endRecording"),
          cmd("groog.record.playRecording"),
        ],
      },
      stubbablesConfig: {
        expectedInfoMessages: [
          `Undo failed`,
        ],
      },
    },
    // Type-over tests
    {
      name: "Typing a bracket automatically adds a closing bracket",
      stc: {
        text: [
          "",
        ],
        expectedText: [
          "{}",
        ],
        expectedSelections: [
          selection(0, 1),
        ],
        userInteractions: [
          type("{"),
        ],
      },
    },
    {
      name: "Typing a bracket at the end of a line automatically adds a closing bracket",
      stc: {
        text: [
          "some text ",
        ],
        expectedText: [
          "some text {}",
        ],
        selections: [
          selection(0, 10),
        ],
        expectedSelections: [
          selection(0, 11),
        ],
        userInteractions: [
          type("{"),
        ],
      },
    },
    {
      name: "Typing a bracket not at the end of a line automatically only adds opening bracket",
      stc: {
        text: [
          "some text ",
        ],
        expectedText: [
          "some tex{t ",
        ],
        selections: [
          selection(0, 8),
        ],
        expectedSelections: [
          selection(0, 9),
        ],
        userInteractions: [
          type("{"),
        ],
      },
    },
    {
      name: "Typing a bracket at the end of a line, ignoring whitespace characters, adds closing bracket",
      stc: {
        text: [
          "some text  \t\t \t ",
        ],
        expectedText: [
          "some text{}  \t\t \t ",
        ],
        selections: [
          selection(0, 9),
        ],
        expectedSelections: [
          selection(0, 10),
        ],
        userInteractions: [
          type("{"),
        ],
      },
    },
    {
      name: "Typing a bracket over selection simply adds bracket",
      stc: {
        // Note: the custom logic doesn't do anything here. We simply return
        // applied=false back to emacs.ts and it types the character as normal.
        text: [
          "some text  \t\t \t \t",
        ],
        selections: [new vscode.Selection(0, 10, 0, 15)],
        expectedText: [
          "some text { \t",
        ],
        expectedSelections: [
          selection(0, 11),
        ],
        userInteractions: [
          type("{"),
        ],
      },
    },
    {
      name: "Typing a bracket over multiple selections only adds brackets to empty selections",
      stc: {
        // Note: since our custom logic runs on some of the selections
        // (aka empty selections with no suffix text),
        // and returns applied=true to emacs.ts, then no typing will be executed there.
        // Hence why the non-empty selections don't have any changes
        text: [
          "some text  \t\t \t \t",
          "some text  \t\t \t \t",
          "some text  suffix",
          "some text ",
          "some text  suffix",
        ],
        selections: [
          selection(0, 10),
          new vscode.Selection(1, 10, 1, 15),
          selection(2, 10),
          selection(3, 10),
          new vscode.Selection(4, 10, 4, 15),
        ],
        expectedText: [
          "some text {} \t\t \t \t",
          "some text  \t\t \t \t",
          "some text  suffix",
          "some text {}",
          "some text  suffix",
        ],
        expectedSelections: [
          selection(0, 11),
          new vscode.Selection(1, 10, 1, 15),
          selection(2, 10),
          selection(3, 11),
          new vscode.Selection(4, 10, 4, 15),
        ],
        userInteractions: [
          type("{"),
        ],
      },
    },
    {
      name: "Groog commands with multiple selections work",
      stc: {
        text: [
          "0123456789",
        ],
        selections: [new vscode.Selection(0, 3, 0, 4), new vscode.Selection(0, 6, 0, 8)],
        expectedText: [
          "0124589",
        ],
        expectedSelections: [
          selection(0, 3),
          selection(0, 5),
        ],
        userInteractions: [
          cmd("groog.deleteLeft"),
        ],
      },
    },
    {
      name: "Types over type-overable characters",
      stc: {
        text: [
          "]}'\"`",
        ],
        expectedText: [
          "0]1}2'3\"4`5",
        ],
        expectedSelections: [selection(0, 11)],
        userInteractions: [
          type("0"),
          type("]"),
          type("1"),
          type("}"),
          type("2"),
          type("'"),
          type("3"),
          type(`"`),
          type("4"),
          type("`"),
          type("5"),
        ],
      },
    },
    {
      name: "Does not type over when character not type-overable",
      stc: {
        text: [
        // Close paren is not included in type-over list
          ")",
        ],
        expectedText: [
          "))",
        ],
        expectedSelections: [selection(0, 1)],
        userInteractions: [
          type(")"),
        ],
      },
    },
    {
      name: "Does not type over when next character is different",
      stc: {
        text: [
          ")",
        ],
        expectedText: [
          "])",
        ],
        expectedSelections: [selection(0, 1)],
        userInteractions: [
          type("]"),
        ],
      },
    },
    // Delete right at end of line
    {
      name: "deleteRight removes single non-whitespace character if trailing characters aren't all whitespace",
      stc: {
        text: [
          "prefix abc",
          "next line",
        ],
        selections: [selection(0, 7)],
        expectedText: [
          "prefix bc",
          "next line",
        ],
        expectedSelections: [selection(0, 7)],
        userInteractions: [
          cmd("groog.deleteRight"),
        ],
      },
    },
    {
      name: "deleteWordRight removes single word if trailing characters aren't all whitespace",
      stc: {
        text: [
          "prefix abc def",
          "next line",
        ],
        selections: [selection(0, 7)],
        expectedText: [
          "prefix  def",
          "next line",
        ],
        expectedSelections: [selection(0, 7)],
        userInteractions: [
          cmd("groog.deleteWordRight"),
        ],
      },
    },
    {
      name: "deleteRight removes single whitespace character if trailing characters aren't all whitespace",
      stc: {
        text: [
          "prefix \tabc",
          "next line",
        ],
        selections: [selection(0, 7)],
        expectedText: [
          "prefix abc",
          "next line",
        ],
        expectedSelections: [selection(0, 7)],
        userInteractions: [
          cmd("groog.deleteRight"),
        ],
      },
    },
    {
      name: "deleteWordRight removes single word if trailing characters aren't all whitespace",
      stc: {
        text: [
          "prefix \t abc def",
          "next line",
        ],
        selections: [selection(0, 7)],
        expectedText: [
        // Note only the tab is removed
          "prefix abc def",
          "next line",
        ],
        expectedSelections: [selection(0, 7)],
        userInteractions: [
          cmd("groog.deleteWordRight"),
        ],
      },
    },
    {
      name: "deleteRight removes newline",
      stc: {
        text: [
          "prefix ",
          "next line",
        ],
        selections: [selection(0, 7)],
        expectedText: [
          "prefix next line",
        ],
        expectedSelections: [selection(0, 7)],
        userInteractions: [
          cmd("groog.deleteRight"),
        ],
      },
    },
    {
      name: "deleteRight removes trailing whitespace and newline",
      stc: {
        text: [
          "prefix \t \t \t",
          "next line",
        ],
        selections: [selection(0, 7)],
        expectedText: [
          "prefix next line",
        ],
        expectedSelections: [selection(0, 7)],
        userInteractions: [
          cmd("groog.deleteRight"),
        ],
      },
    },
    {
      name: "deleteRight removes preceding whitespace and newline",
      stc: {
        text: [
          "prefix ",
          " \t \t next line",
        ],
        selections: [selection(0, 7)],
        expectedText: [
          "prefix next line",
        ],
        expectedSelections: [selection(0, 7)],
        userInteractions: [
          cmd("groog.deleteRight"),
        ],
      },
    },
    {
      name: "deleteRight removes trailing whitespace, preceding whitespace, and newline",
      stc: {
        text: [
          "prefix \t \t \t",
          " \t \t next line",
        ],
        selections: [selection(0, 7)],
        expectedText: [
          "prefix next line",
        ],
        expectedSelections: [selection(0, 7)],
        userInteractions: [
          cmd("groog.deleteRight"),
        ],
      },
    },
    {
      name: "deleteWordRight removes trailing whitespace, preceding whitespace, and newline",
      stc: {
        text: [
          "prefix \t \t \t",
          " \t \t next line",
        ],
        selections: [selection(0, 7)],
        expectedText: [
          "prefix next line",
        ],
        expectedSelections: [selection(0, 7)],
        userInteractions: [
          cmd("groog.deleteWordRight"),
        ],
      },
    },
    {
      name: "deleteRight does nothing if at the end of the document",
      stc: {
        text: [
          "first line",
          "middle line",
          "last line",
        ],
        selections: [selection(2, 9)],
        expectedText: [
          "first line",
          "middle line",
          "last line",
        ],
        expectedSelections: [selection(2, 9)],
        userInteractions: [
          cmd("groog.deleteRight"),
        ],
      },
    },
    {
      name: "deleteWordRight does nothing if at the end of the document",
      stc: {
        text: [
          "first line",
          "middle line",
          "last line",
        ],
        selections: [selection(2, 9)],
        expectedText: [
          "first line",
          "middle line",
          "last line",
        ],
        expectedSelections: [selection(2, 9)],
        userInteractions: [
          cmd("groog.deleteWordRight"),
        ],
      },
    },
    {
      name: "deleteRight deletes whitespace if at the end of the document",
      stc: {
        text: [
          "first line",
          "middle line",
          "last line \t \t ",
        ],
        selections: [selection(2, 9)],
        expectedText: [
          "first line",
          "middle line",
          "last line",
        ],
        expectedSelections: [selection(2, 9)],
        userInteractions: [
          cmd("groog.deleteRight"),
        ],
      },
    },
    {
      name: "deleteWordRight deletes whitespace if at the end of the document",
      stc: {
        text: [
          "first line",
          "middle line",
          "last line \t \t ",
        ],
        selections: [selection(2, 9)],
        expectedText: [
          "first line",
          "middle line",
          "last line",
        ],
        expectedSelections: [selection(2, 9)],
        userInteractions: [
          cmd("groog.deleteWordRight"),
        ],
      },
    },
    {
      name: "deleteRight deletes only one character if at the last line of the document and non-whitespace characters after",
      stc: {
        text: [
          "first line",
          "middle line",
          "last line\t \t X  ",
        ],
        selections: [selection(2, 9)],
        expectedText: [
          "first line",
          "middle line",
          "last line \t X  ",
        ],
        expectedSelections: [selection(2, 9)],
        userInteractions: [
          cmd("groog.deleteRight"),
        ],
      },
    },
    {
      name: "deleteWordRight deletes only one character if at the last line of the document and non-whitespace characters after",
      stc: {
        text: [
          "first line",
          "middle line",
          "last line\t \t X  ",
        ],
        selections: [selection(2, 9)],
        expectedText: [
          "first line",
          "middle line",
          "last line \t X  ",
        ],
        expectedSelections: [selection(2, 9)],
        userInteractions: [
          cmd("groog.deleteRight"),
        ],
      },
    },
    // Notification tests
    {
      name: "Notification fails if no args",
      stc: {
        userInteractions: [
          cmd("groog.message.info"),
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          "No message set",
        ],
      },
    },
    {
      name: "Notification fails if no message",
      stc: {
        userInteractions: [
          cmd("groog.message.info", {}),
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          "No message set",
        ],
      },
    },
    {
      name: "Notification fails if wrong args",
      stc: {
        userInteractions: [
          cmd("groog.message.info", {
            badKey: "hello there",
          }),
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          "No message set",
        ],
      },
    },
    {
      name: "Notification fails if empty message",
      stc: {
        userInteractions: [
          cmd("groog.message.info", {
            message: "",
          }),
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          "No message set",
        ],
      },
    },
    {
      name: "Notification is sent",
      stc: {
        userInteractions: [
          cmd("groog.message.info", {
            message: "Hello there",
          }),
        ],
      },
      stubbablesConfig: {
        expectedInfoMessages: [
          "Hello there",
        ],
      },
    },
    {
      name: "Error notification is sent",
      stc: {
        userInteractions: [
          cmd("groog.message.info", {
            message: "General Kenobi",
            error: true,
          }),
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          "General Kenobi",
        ],
      },
    },
    // Copy file name tests
    {
      name: "Fails to copy file name if no editor",
      stc: {
        userInteractions: [
          closeAllEditors,
          cmd("groog.copyFilename"),
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          "No active editor",
        ],
      },
    },
    {
      name: "Copies file name",
      stc: {
        file: startingFile("empty.go"),
        expectedText: [
          "empty.gopackage main",
          "",
          "func main() {",
          "",
          "}",
          "",
        ],
        expectedSelections: [selection(0, 8)],
        userInteractions: [
          cmd("groog.copyFilename"),
          cmd("groog.paste"),
        ],
      },
      stubbablesConfig: {
        expectedInfoMessages: [
          "Filename copied!",
        ],
      },
    },
    // Multi-command tests
    {
      name: "Runs multi-command",
      stc: {
        text: [],
        expectedText: [
          "abcdef",
        ],
        expectedSelections: [selection(0, 6)],
        userInteractions: [
          cmd("groog.multiCommand.execute", {
            sequence: [
              {
                command: "groog.type",
                args: {
                  "text": "abc",
                },
              },
              {
                command: "groog.message.info",
                args: {
                  "message": "hi",
                },
              },
              {
                command: "groog.type",
                args: {
                  "text": "def",
                },
              },
            ],
          }),
        ],
      },
      stubbablesConfig: {
        expectedInfoMessages: [
          "hi",
        ],
      },
    },
    // Test file tests
    {
      name: "Fails to run test file if no previous file set",
      stc: {
        userInteractions: [
          cmd("groog.testFile"),
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          "Previous file not set",
        ],
      },
    },
    {
      name: "Fails to run test file if no file suffix",
      stc: {
        file: startingFile("greetings.txt"),
        userInteractions: [
          cmd("groog.testFile"),
        ],
        expectedText: [
          "Hello there",
          "",
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          "Unknown file suffix: txt",
        ],
      },
    },
    {
      name: "Fails to run test file if no file suffix (message displayed at part 0)",
      stc: {
        file: startingFile("greetings.txt"),
        userInteractions: [
          cmd("groog.testFile", {part: 0}),
        ],
        expectedText: [
          "Hello there",
          "",
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          "Unknown file suffix: txt",
        ],
      },
    },
    {
      name: "Fails to run test file if no file suffix (no message displayed at part 1)",
      stc: {
        file: startingFile("greetings.txt"),
        userInteractions: [
          cmd("groog.testFile", {part: 1}),
        ],
        expectedText: [
          "Hello there",
          "",
        ],
      },
    },
    {
      name: "Fails to run test file if go file suffix",
      stc: {
        file: startingFile("empty.go"),
        userInteractions: [
          cmd("groog.testFile"),
        ],
        expectedText: [
          "package main",
          "",
          "func main() {",
          "",
          "}",
          "",
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          "go testing should be routed to custom command in keybindings.go",
        ],
      },
    },
    {
      name: "Doesn't toggle fixed test file if no file visited",
      stc: {
        userInteractions: [
          cmd("groog.toggleFixedTestFile"),
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          "No active file",
        ],
      },
    },
    {
      name: "Toggles fixed test file to current active file",
      stc: {
        file: startingFile("bloop.java"),
        expectedText: [""],
        userInteractions: [
          cmd("groog.toggleFixedTestFile"),
        ],
      },
      stubbablesConfig: {
        expectedInfoMessages: [
          `Set fixed test file to bloop.java`,
        ],
      },
    },
    {
      name: "Toggles ignore test file to false",
      stc: {
        file: startingFile("bloop.java"),
        expectedText: [""],
        userInteractions: [
          cmd("groog.toggleFixedTestFile"),
          cmd("groog.toggleFixedTestFile"),
        ],
      },
      stubbablesConfig: {
        expectedInfoMessages: [
          `Set fixed test file to bloop.java`,
          "Unset fixed test file",
        ],
      },
    },
    // Scripts tests
    {
      name: "Newline replacement fails if no editor",
      stc: {
        userInteractions: [
          cmd("groog.script.replaceNewlineStringsWithQuotes"),
        ],
      },
      stubbablesConfig: {
        expectedErrorMessages: [
          "No active text editor.",
        ],
      },
    },
    {
      name: "Runs newline replacement with quotes",
      stc: {
        text: [
          `  "One\\ntwo three\\nfour\\nfive six seven\\n eight nine \\nten"`,
        ],
        userInteractions: [
          cmd("groog.script.replaceNewlineStringsWithQuotes"),
        ],
        expectedText: [
          `  "One",`,
          `  "two three",`,
          `  "four",`,
          `  "five six seven",`,
          `  " eight nine ",`,
          `  "ten"`,
        ],
      },
    },
    {
      name: "Runs newline replacement with ticks",
      stc: {
        text: [
          "  `One\\ntwo three\\nfour\\nfive six seven\\n eight nine \\nten`",
        ],
        userInteractions: [
          cmd("groog.script.replaceNewlineStringsWithTicks"),
        ],
        expectedText: [
          "  `One`,",
          "  `two three`,",
          "  `four`,",
          "  `five six seven`,",
          "  ` eight nine `,",
          "  `ten`",
        ],
      },
    },
    {
      name: "Updates settings",
      runSolo: true,
      stc: {
        userInteractions: [
          cmd("groog.updateSettings"),
        ],
      },
      stubbablesConfig: {
        expectedInfoMessages: [
          `Settings have been updated!`,
        ],
        expectedErrorMessages: [
          `Failed to fetch editor.wordSeparators setting`,
        ],
        expectedWorkspaceConfiguration: {
          configuration: new Map<vscode.ConfigurationTarget, Map<string, any>>([
            [vscode.ConfigurationTarget.Global, new Map<string, any>([
              ["editor", new Map<string, any>([
                ['autoClosingBrackets', 'never'],
                ['autoClosingQuotes', 'never'],
                ['codeActionsOnSave', {
                  'source.fixAll.eslint': true,
                  'source.organizeImports': true,
                }],
                ['cursorSurroundingLines', 6],
                ['detectIndentation', false],
                ['insertSpaces', true],
                ['rulers', [
                  80,
                  200,
                ]],
                ['tabSize', 2],
              ])],
              ["files", new Map<string, any>([
                ['eol', '\n'],
                ['insertFinalNewline', true],
                ['trimFinalNewlines', true],
                ['trimTrailingWhitespace', true],
              ])],
              ["gopls", new Map<string, any>([
                ['analyses', {
                  composites: false,
                }],
              ])],
              ["powershell", new Map<string, any>([
                ['startAutomatically', false],
              ])],
              ["terminal", new Map<string, any>([
                ['integrated', new Map<string, any>([
                  ['allowChords', true],
                  ['automationProfile', new Map<string, any>([
                    ['windows', {
                      path: 'C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
                    }],
                  ])],
                  ['commandsToSkipShell', [
                    'workbench.action.terminal.sendSequence',
                    'groog.message.info',
                    'workbench.action.closePanel',
                    'workbench.action.terminal.focusNext',
                    'workbench.action.terminal.focusPrevious',
                    'workbench.action.terminal.newWithProfile',
                    'groog.terminal.find',
                    'groog.terminal.reverseFind',
                    'workbench.action.terminal.focusFind',
                    'workbench.action.terminal.findNext',
                    'workbench.action.terminal.findPrevious',
                    'groog.ctrlG',
                    'groog.multiCommand.execute',
                    'termin-all-or-nothing.closePanel',
                  ]],
                ])],
              ])],
            ])],
          ]),
        },
      },
    },
  /* Useful for commenting out tests. */
  ];
}

// Run `npm run test` to execute these tests.
suite('Groog commands', () => {
  const requireRunSolo = testCases().some(tc => tc.runSolo);

  for (let iteration = 0; iteration < TEST_ITERATIONS; iteration++) {
    testCases().forEach((tc, idx) => {
      if (requireRunSolo && !(tc.runSolo || idx === 0)) {
        return;
      }

      // Don't check for opening info message more than once
      if (idx === 0 && iteration !== 0) {
        return;
      }

      test(`${iteration} ${tc.name}`, async () => {

        if (idx) {
          await vscode.commands.executeCommand("groog.testReset");
        }

        // Run the commands
        await new SimpleTestCase(tc.stc).runTest(stubbableTestFile, tc.stubbablesConfig).catch(e => {
          throw e;
        });
      });
    });
  }
});

function assertDefined<T>(t: T | undefined, objectName: string): T {
  assert.notEqual(t, undefined, `Expected ${objectName} to be defined, but it was undefined`);
  return t!;
}

function assertUndefined<T>(t: T | undefined, objectName: string) {
  assert.equal(t, undefined, `Expected ${objectName} to be undefined, but it was defined: ${t}`);
}
