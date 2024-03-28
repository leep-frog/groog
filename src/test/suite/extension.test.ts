import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import { readFileSync, writeFileSync } from 'fs';
import * as vscode from 'vscode';
import { Document, Match } from '../../find';
import { CloseQuickPickAction, PressItemButtonQuickPickAction, SelectItemQuickPickAction, StubbablesConfig } from '../../stubs';

// Note: this needs to be identical to the value in .vscode-test.mjs (trying to have shared import there is awkward).
// export const stubbableTestFile = path.resolve(".vscode-test", "stubbable-file.json");
export const stubbableTestFile = `C:\\Users\\gleep\\Desktop\\Coding\\vs-code\\groog\\.vscode-test\\stubbable-file.json`;

class DelayExecution implements UserInteraction {
  constructor(
    public waitMs: number,
  ) {}

  delay() {
    return new Promise( resolve => setTimeout(resolve, this.waitMs) );
  }

  async do() {
    await this.delay();
  };
}

function delay(ms: number): UserInteraction {
  return new DelayExecution(ms);
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

interface UserInteraction {
  do(): Promise<any>;
}

class CommandExecution implements UserInteraction {
  constructor(
    public command: string,
    public args?: any[],
  ) {}

  async do() {
    return vscode.commands.executeCommand(this.command, ...(this.args || []));
  };
}

function cmd(command: string, ...args: any[]) : CommandExecution {
  return new CommandExecution(command, args);
}

const ctrlG = cmd("groog.ctrlG");

function type(text: string) : CommandExecution {
  return cmd("groog.type", { "text": text });
}

function selection(line: number, char: number) : vscode.Selection {
  return new vscode.Selection(line, char, line, char);
}

interface TestCase {
  name: string;
  runSolo?: boolean
  startingText?: string[];
  userInteractions?: UserInteraction[];
  inputBoxResponses?: string[];
  stubbablesConfig?: StubbablesConfig;
  wantDocument?: string[];
  wantSelections: vscode.Selection[];
  wantInputBoxValidationMessages?: vscode.InputBoxValidationMessage[];
  wantQuickPickOptions?: string[][];
  wantInfoMessages?: string[];
  wantErrorMessages?: string[];
}

const TEST_ITERATIONS = 1;

const testCases: () => TestCase[] = () => [
  // Basic/setup tests
  {
    name: "Captures opening info message",
    wantSelections: [
      selection(0, 0),
    ],
    userInteractions: [
      cmd("groog.cursorRight"),
    ],
    wantInfoMessages: [
      `Basic keyboard mode activated`,
    ],
  },
  {
    name: "Works for empty file and no changes",
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
  // Find tests
  {
    name: "Matches case word",
    startingText: [
      "ABC",
      "aBc",
      "Abc",
      "abc",
      "abC",
    ],
    wantDocument: [
      "ABC",
      "aBc",
      "Abc",
      "xyz",
      "abC",
    ],
    userInteractions: [
      cmd("groog.find"),
      cmd("groog.find.toggleCaseSensitive"),
      type("abc"),
      ctrlG,
      cmd("groog.deleteLeft"),
      type("xyz"),
    ],
    wantSelections: [
      selection(3, 3),
    ],
  },
  {
    name: "Matches regex",
    startingText: [
      "1 jkslds jdkfjd 2",
      "b1 qwertyuiop 3a",
      " 1 qwertyuiop 3 ",
      "1 qwertyuiop 3",
      "1 asd fgh jkl\t4",
      "15",
    ],
    wantDocument: [
      "1 jkslds jdkfjd 2",
      "b1 qwertyuiop 3a",
      " 1 qwertyuiop 3 ",
      "1 xyz 3",
      "1 asd fgh jkl\t4",
      "15",
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
    wantSelections: [
      selection(3, 6),
    ],
  },
  {
    name: "Matches whole word",
    startingText: [
      "abcd",
      "bcde",
      "bcd",
    ],
    wantDocument: [
      "abcd",
      "bcde",
      "xyz",
    ],
    userInteractions: [
      cmd("groog.find"),
      cmd("groog.find.toggleWholeWord"),
      type("bcd"),
      ctrlG,
      cmd("groog.deleteLeft"),
      type("xyz"),
    ],
    wantSelections: [
      selection(2, 3),
    ],
  },
  // Replace tests
  {
    name: "Replace fails if match failure",
    startingText: [
      "abc",
    ],
    userInteractions: [
      cmd("groog.find"),
      cmd("groog.find.toggleRegex"),
      type("?a"),
      cmd("groog.find.replaceOne"),
    ],
    wantSelections: [
      selection(0, 0),
    ],
    wantErrorMessages: [
      `Failed to get match info: Invalid regular expression: /?a/gim: Nothing to repeat`,
    ],
  },
  {
    name: "Replace does nothing if no match",
    startingText: [
      "abc",
    ],
    userInteractions: [
      cmd("groog.find"),
      type("xyz"),
      cmd("groog.find.replaceOne"),
    ],
    wantSelections: [
      selection(0, 0),
    ],
  },
  {
    name: "Replaces one vanilla text",
    startingText: [
      "abcd",
      "bcde",
      "bc",
      " BcD",
    ],
    wantDocument: [
      "aXYZd",
      "bcde",
      "bc",
      " BcD",
    ],
    userInteractions: [
      cmd("groog.find"),
      type("bc"),
      cmd("groog.find.toggleReplaceMode"),
      type("XYZ"),
      cmd("groog.find.replaceOne"),
    ],
    wantSelections: [
      // Should be at next match
      new vscode.Selection(1, 0, 1, 2),
    ],
  },
  {
    name: "Replaces all vanilla text",
    startingText: [
      "abcd",
      "bcde",
      "bc",
      " BcD",
    ],
    wantDocument: [
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
    wantSelections: [
      selection(0, 0),
    ],
  },
  {
    name: "Replaces one case match",
    startingText: [
      "aBc",
      "bcd",
      "bC",
      "abc",
    ],
    wantDocument: [
      "aBc",
      "Xd",
      "bC",
      "abc",
    ],
    userInteractions: [
      cmd("groog.find"),
      type("bc"),
      cmd("groog.find.toggleReplaceMode"),
      cmd("groog.find.toggleCaseSensitive"),
      type("X"),
      cmd("groog.find.replaceOne"),
    ],
    wantSelections: [
      // Should be at next match
      new vscode.Selection(3, 1, 3, 3),
    ],
  },
  {
    name: "Replaces all case match",
    startingText: [
      "aBc",
      "bcd",
      "bC",
      "abc",
      "   vbcnxm ",
    ],
    wantDocument: [
      "aBc",
      "Xd",
      "bC",
      "aX",
      "   vXnxm ",
    ],
    userInteractions: [
      cmd("groog.find"),
      type("bc"),
      cmd("groog.find.toggleReplaceMode"),
      cmd("groog.find.toggleCaseSensitive"),
      type("X"),
      cmd("groog.find.replaceAll"),
    ],
    wantSelections: [
      // Should be at next match
      selection(0, 0),
    ],
  },
  {
    name: "Replaces one whole word match",
    startingText: [
      "aBc",
      "bc",
      "Bc",
      "bcd",
      " a bc d ",
    ],
    wantDocument: [
      "aBc",
      "X",
      "Bc",
      "bcd",
      " a bc d ",
    ],
    userInteractions: [
      cmd("groog.find"),
      type("bc"),
      cmd("groog.find.toggleReplaceMode"),
      cmd("groog.find.toggleWholeWord"),
      type("X"),
      cmd("groog.find.replaceOne"),
    ],
    wantSelections: [
      // Should be at next match
      new vscode.Selection(2, 0, 2, 2),
    ],
  },
  {
    name: "Replaces all whole word match",
    startingText: [
      "aBc",
      "X",
      "Bc",
      "bcd",
      " a bc d ",
    ],
    wantDocument: [
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
    wantSelections: [
      selection(0, 0),
    ],
  },
  // Record tests
  {
    name: "Record playback fails if no recording set",
    startingText: [
      "abc",
    ],
    wantSelections: [
      selection(0, 0),
    ],
    userInteractions: [
      cmd("groog.record.playRecording"),
    ],
    wantErrorMessages: [
      `No recordings exist yet!`,
    ],
  },
  {
    name: "Record playback fails if no recording set",
    startingText: [
      "abc",
    ],
    wantSelections: [
      selection(0, 0),
    ],
    userInteractions: [
      cmd("groog.record.playRecordingRepeatedly"),
    ],
    wantErrorMessages: [
      `No recordings exist yet!`,
    ],
  },
  {
    name: "Save named recording fails if not recording",
    wantSelections: [
      selection(0, 0),
    ],
    userInteractions: [
      cmd("groog.record.saveRecordingAs"),
    ],
    wantErrorMessages: [
      `Not recording!`,
    ],
  },
  {
    name: "End recording fails if not recording",
    wantSelections: [
      selection(0, 0),
    ],
    userInteractions: [
      cmd("groog.record.endRecording"),
    ],
    wantErrorMessages: [
      `Not recording!`,
    ],
  },
  {
    name: "Fails to playback if actively recording",
    startingText: [
      "abc",
    ],
    wantDocument: [
      "xy",
      "xyabc",
    ],
    wantSelections: [
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
    wantErrorMessages: [
      `Still recording!`,
    ],
  },
  {
    name: "Fails to playback named recording if actively recording",
    startingText: [
      "abc",
    ],
    wantDocument: [
      "xy",
      "xyabc",
    ],
    wantSelections: [
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
    wantErrorMessages: [
      `Still recording!`,
    ],
  },
  {
    name: "Fails to playback if no named recording selected",
    startingText: [
      "abc",
    ],
    wantSelections: [
      selection(0, 0),
    ],
    userInteractions: [
      cmd("groog.record.playNamedRecording"),
    ],
    wantErrorMessages: [
      `No named recording selection made`,
    ],
    stubbablesConfig: {
      quickPickActions: [new SelectItemQuickPickAction([])],
    },
    wantQuickPickOptions: [[]],
  },
  {
    name: "Fails to delete recording if actively recording",
    startingText: [
      "abc",
    ],
    wantDocument: [
      "xy",
      "xyabc",
    ],
    wantSelections: [
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
    wantErrorMessages: [
      `Still recording!`,
    ],
  },
  {
    name: "Fails to repeatedly playback if actively recording",
    startingText: [
      "abc",
    ],
    wantDocument: [
      "xy",
      "xyabc",
    ],
    wantSelections: [
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
    wantErrorMessages: [
      `Still recording!`,
    ],
  },
  {
    name: "Records and plays back empty recording",
    startingText: [
      "start text",
    ],
    wantSelections: [
      selection(0, 0),
    ],
    userInteractions: [
      cmd("groog.record.startRecording"),
      cmd("groog.record.endRecording"),
      cmd("groog.record.playRecording"),
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
  {
    name: "Records and plays back when recording would be popped",
    startingText: [
      "start text",
    ],
    wantDocument: [
      "xyz",
      "xyz",
      "start text",
    ],
    wantSelections: [
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
  {
    name: "Saves recording as and plays back",
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
    inputBoxResponses: ["some-name"],
    userInteractions: [
      cmd("groog.record.startRecording"),
      cmd("groog.cursorEnd"),
      type("x"),
      cmd("groog.cursorDown"),
      type("y"),
      cmd("groog.record.saveRecordingAs"),
      cmd("groog.record.playRecording"),
    ],
    wantInfoMessages: [
      `Recording saved as "some-name"!`,
    ],
  },
  {
    name: "Fails to name recording if reserved prefix",
    startingText: [
      "start text",
    ],
    wantDocument: [
      "abc",
      "abc",
      "start text",
    ],
    wantSelections: [
      selection(2, 0),
    ],
    inputBoxResponses: [
      "Recent recording bleh",
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
    wantInputBoxValidationMessages: [
      {
        message: "This is a reserved prefix",
        severity: vscode.InputBoxValidationSeverity.Error,
      },
    ],
    wantErrorMessages: [
      `No recording name provided`,
    ],
  },
  {
    name: "Fails to name recording if recording name already exists",
    startingText: [
      "start text",
    ],
    wantDocument: [
      "abc",
      "ABC",
      "ABC",
      "start text",
    ],
    wantSelections: [
      selection(3, 0),
    ],
    inputBoxResponses: [
      "ABC Recording",
      "ABC Recording",
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
    wantInputBoxValidationMessages: [
      {
        message: "This record name already exists",
        severity: vscode.InputBoxValidationSeverity.Error,
      },
    ],
    wantErrorMessages: [
      `No recording name provided`,
    ],
    wantInfoMessages: [
      `Recording saved as "ABC Recording"!`,
    ],
  },
  {
    name: "Plays back named recording specified by name",
    startingText: [
      "start text",
    ],
    wantDocument: [
      "abc",
      "def",
      "ghi",
      "def",
      "start text",
    ],
    wantSelections: [
      selection(4, 0),
    ],
    inputBoxResponses: [
      "ABC Recording",
      "DEF Recording",
      "GHI Recording",
    ],
    stubbablesConfig: {
      quickPickActions: [new SelectItemQuickPickAction(["DEF Recording"])],
    },
    wantQuickPickOptions: [[
      "Recent recording 0", "Recent recording 1", "Recent recording 2",
      "ABC Recording", "DEF Recording", "GHI Recording",
    ]],
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
    wantInfoMessages: [
      `Recording saved as "ABC Recording"!`,
      `Recording saved as "DEF Recording"!`,
      `Recording saved as "GHI Recording"!`,
    ],
  },
  {
    name: "Fails to play back named recording if multiple items are picked",
    startingText: [
      "start text",
    ],
    wantDocument: [
      "abc",
      "def",
      "ghi",
      "start text",
    ],
    wantSelections: [
      selection(3, 0),
    ],
    inputBoxResponses: [
      "ABC Recording",
      "DEF Recording",
      "GHI Recording",
    ],
    stubbablesConfig: {
      quickPickActions: [new SelectItemQuickPickAction(["ABC Recording", "DEF Recording"])],
    },
    wantQuickPickOptions: [[
      "Recent recording 0", "Recent recording 1", "Recent recording 2",
      "ABC Recording", "DEF Recording", "GHI Recording",
    ]],
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
    wantInfoMessages: [
      `Recording saved as "ABC Recording"!`,
      `Recording saved as "DEF Recording"!`,
      `Recording saved as "GHI Recording"!`,
    ],
    wantErrorMessages: [
      "Multiple selections made somehow?!",
    ],
  },
  {
    name: "Deletes recording",
    startingText: [
      "start text",
    ],
    wantDocument: [
      "abc",
      "def",
      "ghi",
      "def",
      "start text",
    ],
    wantSelections: [
      selection(4, 0),
    ],
    inputBoxResponses: [
      "ABC Recording",
      "DEF Recording",
      "GHI Recording",
    ],
    stubbablesConfig: {
      quickPickActions: [
        new SelectItemQuickPickAction(["DEF Recording"]), // playNamedRecording (succeeds)
        new SelectItemQuickPickAction(["DEF Recording"]), // deleteRecording
        new CloseQuickPickAction(),                     // playNamedRecording (fails)
      ],
    },
    wantQuickPickOptions: [
      // playNamedRecording
      [
        "Recent recording 0", "Recent recording 1", "Recent recording 2",
        "ABC Recording", "DEF Recording", "GHI Recording",
      ],
      // deleteRecording
      ["ABC Recording", "DEF Recording", "GHI Recording"],
      // playNamedRecording
      [
        "Recent recording 0", "Recent recording 1", "Recent recording 2",
        "ABC Recording", "GHI Recording",
      ],
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
    wantInfoMessages: [
      `Recording saved as "ABC Recording"!`,
      `Recording saved as "DEF Recording"!`,
      `Recording saved as "GHI Recording"!`,
    ],
  },
  {
    name: "Records kill and paste",
    startingText: [
      "abc",
      "1",
      "defabc",
      "2",
    ],
    wantDocument: [
      "abcxabc",
      "1x1",
      "defabc",
      "2",
    ],
    wantSelections: [
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
  {
    name: "Records maim and paste",
    startingText: [
      "abc",
      "1",
      "defabc",
      "2",
    ],
    wantDocument: [
      "abcxabcabc",
      "1x11",
      "defabc",
      "2",
    ],
    wantSelections: [
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
  {
    name: "Records mark and paste",
    startingText: [
      "abc",
      "1",
      "defabc",
      "2",
      "zzz",
    ],
    wantDocument: [
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
    wantSelections: [
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
  {
    name: "Records with find",
    startingText: [
      "abc",
      "1",
      "defabc",
      "2",
    ],
    wantDocument: [
      "xyz",
      "1",
      "defxyz",
      "2",
    ],
    wantSelections: [
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
  // Repeat recording tests
  {
    name: "Repeat recording fails if doesn't start with find",
    startingText: [
      "start text",
    ],
    wantDocument: [
      "xyz",
      "start text",
    ],
    wantSelections: [
      selection(1, 0),
    ],
    userInteractions: [
      cmd("groog.record.startRecording"),
      type("xyz\n"),
      cmd("groog.record.endRecording"),
      cmd("groog.record.playRecordingRepeatedly"),
    ],
    wantErrorMessages: [
      `This recording isn't repeatable`,
    ],
  },
  {
    name: "Repeat record playback with decreasing find matches",
    startingText: [
      "abc",
      "1",
      "defabc",
      "2",
      ".abcabc...abc.....",
    ],
    wantDocument: [
      "xyz",
      "1",
      "defxyz",
      "2",
      ".xyzxyz...xyz.....",
    ],
    wantSelections: [
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
    wantErrorMessages: [
      "No match found during recording playback",
    ],
  },
  {
    name: "Repeat record playback with decreasing find matches",
    startingText: [
      "abc",
      "1",
      "defabc",
      "2",
      ".abcabc...abc.....",
    ],
    wantDocument: [
      // Once for record and once for playback
      "abcxyzxyz",
      "1",
      "defabcxyz",
      "2",
      ".abcxyzabcxyz...abcxyz.....",
    ],
    wantSelections: [
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
    wantInfoMessages: [
      "Successfully ran recording on all matches",
    ],
  },
  {
    name: "Record with skipped find executions",
    startingText: [
      "abc",
      "1",
      "defabc",
      "2",
      ".abc...abc.....",
    ],
    wantDocument: [
      "abc",
      "1",
      // Once for record and once for playback
      "defabcxyzxyz",
      "2",
      ".abc...abcxyz.....",
    ],
    wantSelections: [
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
    wantErrorMessages: [
      "Landed on same match index, ending repeat playback",
    ],
  },
  {
    name: "Record repeat playback ends if start in non-decrease mode and count changes",
    startingText: [
      "abcdef",
      "1",
      "....abc.....",
      "",
      "abc",
      "",
      "abc123",
    ],
    wantDocument: [
      "abcdeZf",
      "1",
      "....abc....Z.",
      "",
      "abZc",
      "",
      "abc123",
    ],
    wantSelections: [
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
    wantErrorMessages: [
      "Number of matches changed (4 -> 3), ending repeat playback",
    ],
  },
  {
    name: "Record repeat playback ends if start in decrease mode and count does not change",
    startingText: [
      "defabc",
      "1",
      "....abc",
      "",
      "abcdef",
      "",
      "123abc",
    ],
    wantDocument: [
      "defabZc",
      "1",
      "....abZc",
      "",
      "abcdeZf",
      "",
      "123abc",
    ],
    wantSelections: [
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
    wantErrorMessages: [
      "Number of matches did not decrease, ending repeat playback",
    ],
  },
  // Repeat record playback with buttons
  {
    name: "Repeat record playback with decreasing find matches",
    startingText: [
      "abc",
      "1",
      "defabc",
      "2",
      ".abcabc...abc.....",
    ],
    wantDocument: [
      "xyz",
      "1",
      "defxyz",
      "2",
      ".xyzxyz...xyz.....",
    ],
    wantSelections: [
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
    stubbablesConfig: {
      quickPickActions: [
        new PressItemButtonQuickPickAction("Recent recording 0", 1),
      ],
    },
    wantQuickPickOptions: [
      ["Recent recording 0"],
    ],
    wantErrorMessages: [
      `No match found during recording playback`,
    ],
  },
  // Record undo tests
  {
    name: "Record undo fails if no recordings",
    startingText: [
      "start text",
    ],
    wantDocument: [
      "start text",
    ],
    wantSelections: [
      selection(0, 0),
    ],
    userInteractions: [
      cmd("groog.record.undo"),
    ],
    wantErrorMessages: [
      `No recordings exist yet!`,
    ],
  },
  {
    name: "Record undo fails if recording is locked",
    startingText: [
      "start text",
    ],
    wantDocument: [
      "abc",
      "start text",
    ],
    wantSelections: [
      selection(1, 0),
    ],
    userInteractions: [
      cmd("groog.record.startRecording"),
      type("abc\n"),
      cmd("groog.record.endRecording"),
      cmd("groog.record.undo"),
    ],
    wantErrorMessages: [
      `Cannot undo a locked recording`,
    ],
  },
  {
    name: "Record undo does nothing if empty record book",
    startingText: [
      "start text",
    ],
    wantDocument: [
      "def",
      "Xdef",
      "start text",
    ],
    wantSelections: [
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
  {
    name: "Record undo works if recording is locked",
    startingText: [
      "start text",
    ],
    wantDocument: [
      "abc",
      "abc",
      "start text",
    ],
    wantSelections: [
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
  {
    name: "Record undo fails",
    startingText: [
      "start text",
    ],
    wantDocument: [
      "ac",
      "ac",
      "bbstart text",
    ],
    wantSelections: [
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
    wantInfoMessages: [
      `Undo failed`,
    ],
  },
  /* Useful for commenting out tests. */
];

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

        const startText = (tc.startingText || []).join("\n");
        const wantText = tc.wantDocument?.join("\n") || startText;

        // Create or clear the editor
        if (!vscode.window.activeTextEditor) {
          await vscode.commands.executeCommand("workbench.action.files.newUntitledFile");
        }
        const editor = assertDefined(vscode.window.activeTextEditor, "vscode.window.activeTextEditor");
        await editor.edit(eb => {
          const line = editor.document.lineAt(editor.document.lineCount-1);
          eb.delete(new vscode.Range(
            new vscode.Position(0, 0),
            new vscode.Position(line.lineNumber, line.text.length),
          ));
        });

        // Create the document if relevant
        await editor.edit(eb => {
          eb.insert(new vscode.Position(0, 0), startText);
        });
        editor.selection = new vscode.Selection(0, 0, 0, 0);

        // Stub out message functions
        // TODO: try/finally to ensure these are reset
        const gotInfoMessages : string[] = [];
        const originalShowInfo = vscode.window.showInformationMessage;
        vscode.window.showInformationMessage = async (s: string) => {
          gotInfoMessages.push(s);
          originalShowInfo(s);
        };
        const gotErrorMessages : string[] = [];
        const originalShowError = vscode.window.showErrorMessage;
        vscode.window.showErrorMessage = async (s: string) => {
          gotErrorMessages.push(s);
          originalShowError(s);
        };

        // Stub out input box interactions
        const gotInputBoxValidationMessages: (string | vscode.InputBoxValidationMessage)[] = [];
        vscode.window.showInputBox = async (options?: vscode.InputBoxOptions, token?: vscode.CancellationToken) => {
          const response = tc.inputBoxResponses?.shift();
          if (!response) {
            return response;
          }

          if (options?.validateInput) {
            const validationMessage = await options.validateInput(response);
            if (validationMessage) {
              gotInputBoxValidationMessages.push(validationMessage);
              validationMessage;
              return undefined;
            }
          }

          return response;
        };

        writeFileSync(stubbableTestFile, JSON.stringify(tc.stubbablesConfig || {}));

        // Run the commands
        for (const userInteraction of (tc.userInteractions || [])) {
          await userInteraction.do();
        }

        // Verify the outcome (assert in order of information (e.g. mismatch in error messages in more useful than text being mismatched)).
        const finalConfig: StubbablesConfig = JSON.parse(readFileSync(stubbableTestFile).toString());
        assertUndefined(finalConfig.error, "StubbablesConfig.error");
        assert.deepStrictEqual(finalConfig.quickPickActions ?? [], [], "Expected QUICK PICK ACTIONS to be empty");
        assert.deepStrictEqual(finalConfig.wantQuickPickOptions ?? [], tc.wantQuickPickOptions ?? [], "Expected QUICK PICK OPTIONS to be exactly equal");
        assert.deepStrictEqual(gotErrorMessages, tc.wantErrorMessages || [], "Expected ERROR MESSAGES to be exactly equal");
        assert.deepStrictEqual(gotInfoMessages, tc.wantInfoMessages || [], "Expected INFO MESSAGES to be exactly equal");
        assert.deepStrictEqual(gotInputBoxValidationMessages, tc.wantInputBoxValidationMessages || [], "Expected INPUT BOX VALIDATION MESSAGES to be exactly equal");

        assert.deepStrictEqual(editor.document.getText(), wantText, "Expected DOCUMENT TEXT to be exactly equal");
        assert.deepStrictEqual(editor.selections, tc.wantSelections, "Expected SELECTIONS to be exactly equal");

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
