import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import { CloseQuickPickAction, PressItemButtonQuickPickAction, PressUnknownButtonQuickPickAction, SelectActiveItems, SelectItemQuickPickAction, SimpleTestCase, SimpleTestCaseProps, UserInteraction, Waiter, WorkspaceConfiguration, cmd, delay, openFile } from '@leep-frog/vscode-test-stubber';
import * as vscode from 'vscode';
import { tabbify } from '../../emacs';
import { Document, FIND_MEMORY_MS, FindQuickPickItem, FindRecord, Match } from '../../find';
import { TestFileArgs } from '../../misc-command';
import { CommandRecord, Record, RecordBook, TypeRecord } from '../../record';
import { ExecStub, TestResetArgs } from '../../stubs';
import { Correction } from '../../typos';
import path = require('path');

const tabbifyTestCases = [
  {
    input: ' \n abc def\n ',
    expectedOutput: ' \n abc def\n ',
  },
  {
    input: ' \n \t abc\t\tdef\n \t',
    expectedOutput: ' \n \\t abc\\t\\tdef\n \\t',
  },
];

const endCommentString = "*" + "/";

suite('tabbify tests', () => {
  tabbifyTestCases.forEach(tc => {
    test(tc.input, () => {
      assert.deepStrictEqual(tabbify(tc.input), tc.expectedOutput);
    });
  });
});

function textContainsWaiter(text: string): Waiter {
  return new Waiter(10, () => {
    const editor = vscode.window.activeTextEditor;
    return !!(editor && editor.document.getText().includes(text));
  });
}

// TODO: Move paste stuff to other file
interface PasteTestCase {
  name: string;
  runSolo?: boolean;
  selections?: vscode.Selection[],
  clipboard?: string[];
  startingFile?: string;
  text?: string[];
  expectedText?: string[];
  expectedEmacsText?: string[];
}

const TABS_FILE = startingFile('whitespace', 'tabs.go');
const TWO_SPACES_FILE = startingFile('whitespace', 'twoSpaces.ts');
const FOUR_SPACES_FILE = startingFile('whitespace', 'fourSpaces.java');

const pasteTestCases: PasteTestCase[] = [
  // TODO: Paste with no editor (but how to test this?)
  {
    name: "Pastes vanilla text",
    text: [],
    clipboard: ['hello there'],
    expectedText: ['hello there'],
  },
  {
    name: "Pastes text and trims prefix",
    text: [],
    clipboard: [' \t hello there  '],
    expectedText: ['hello there  '],
  },
  {
    name: "Pastes indented blob of text",
    text: ['\t\t'],
    selections: [selection(0, 3)],
    clipboard: [
      'hello',
      'there',
      'general',
      'kenobi',
    ],
    expectedText: [
      '\t\thello',
      '\t\tthere',
      '\t\tgeneral',
      '\t\tkenobi',
    ],
  },
  {
    name: "Pastes indented blob of text when non-whitespace in prefix",
    text: ['\tX\t'],
    selections: [selection(0, 3)],
    clipboard: [
      'hello',
      'there',
      'general',
      'kenobi',
    ],
    expectedText: [
      '\tX\thello',
      '\tthere',
      '\tgeneral',
      '\tkenobi',
    ],
  },
  {
    name: "Pastes indented blob of text for weird prefix",
    text: ['\t \t'],
    selections: [selection(0, 3)],
    clipboard: [
      'hello',
      'there',
      'general',
      'kenobi',
    ],
    expectedText: [
      '\t \thello',
      '\t \tthere',
      '\t \tgeneral',
      '\t \tkenobi',
    ],
  },
  {
    name: "Pastes text with tab indents (TABS_FILE with space clipboard prefix)",
    text: ['\t\t'],
    startingFile: TABS_FILE,
    selections: [selection(0, 2)],
    clipboard: [
      '  hello',
      '  there',
      '    general',
      '      ken',
      'obi',
      '  fin',
    ],
    expectedText: [
      '\t\thello',
      '\t\tthere',
      '\t\t\tgeneral',
      '\t\t\t\tken',
      '\tobi',
      '\t\tfin',
    ],
    // This isn't indented because the yanking logic is looking for tab prefixes,
    // but the clipboard pastes space indents.
    expectedEmacsText: [
      '\t\thello',
      '\t\tthere',
      '\t\tgeneral',
      '\t\tken',
      '\t\tobi',
      '\t\tfin',
    ],
  },
  {
    name: "Pastes text with tab indents (TABS_FILE with tabbed clipboard prefix)",
    text: ['\t\t'],
    startingFile: TABS_FILE,
    selections: [selection(0, 2)],
    clipboard: [
      '\thello',
      '\tthere',
      '\t\tgeneral',
      '\t\t\tken',
      'obi',
      '\tfin',
    ],
    expectedText: [
      '\t\thello',
      '\t\tthere',
      '\t\t\tgeneral',
      '\t\t\t\tken',
      '\tobi',
      '\t\tfin',
    ],
  },
  {
    name: "Pastes text with two-space indents",
    text: ['\t\t'],
    startingFile: TWO_SPACES_FILE,
    selections: [selection(0, 2)],
    clipboard: [
      '  hello',
      '  there',
      '    general',
      '      ken',
      'obi',
      '  fin',
    ],
    expectedText: [
      '\t\thello',
      '\t\tthere',
      '\t\t  general',
      '\t\t    ken',
      '\tobi',
      '\t\tfin',
    ],
  },
  {
    name: "Pastes text with four-space indents (but two space indents in yanked)",
    text: ['\t\t'],
    startingFile: FOUR_SPACES_FILE,
    selections: [selection(0, 2)],
    clipboard: [
      '  hello',
      '  there',
      '    general',
      '      ken',
      'obi',
      '  fin',
    ],
    expectedText: [
      '\t\thello',
      '\t\tthere',
      '\t\t    general',
      '\t\t        ken',
      '\tobi',
      '\t\tfin',
    ],
    // This isn't indented because the yanking logic is looking for tab prefixes,
    // but the clipboard pastes space indents.
    expectedEmacsText: [
      '\t\thello',
      '\t\tthere',
      '\t\t    general',
      '\t\t    ken',
      '\t\tobi',
      '\t\tfin',
    ],
  },
  {
    name: "Pastes text with four-space indents (with four space indents in yanked)",
    text: ['\t\t'],
    startingFile: FOUR_SPACES_FILE,
    selections: [selection(0, 2)],
    clipboard: [
      '    hello',
      '    there',
      '        general',
      '            ken',
      'obi',
      '    fin',
    ],
    expectedText: [
      '\t\thello',
      '\t\tthere',
      '\t\t    general',
      '\t\t        ken',
      '\tobi',
      '\t\tfin',
    ],
  },
  {
    name: "Paste text inferred as four-space indent (with TABS_FILE)",
    text: ['\t\t'],
    startingFile: TABS_FILE,
    selections: [selection(0, 2)],
    clipboard: [
      '    hello',
      '    there',
      '        general',
      '            ken',
      'obi',
      '    fin',
    ],
    expectedText: [
      '\t\thello',
      '\t\tthere',
      '\t\t\tgeneral',
      '\t\t\t\tken',
      '\tobi',
      '\t\tfin',
    ],
    // This isn't indented because the yanking logic is looking for tab prefixes,
    // but the clipboard pastes space indents.
    expectedEmacsText: [
      '\t\thello',
      '\t\tthere',
      '\t\tgeneral',
      '\t\tken',
      '\t\tobi',
      '\t\tfin',
    ],
  },
  {
    name: "Paste text inferred as four-space indent (with FOUR_SPACES_FILE)",
    text: ['\t\t'],
    startingFile: FOUR_SPACES_FILE,
    selections: [selection(0, 2)],
    clipboard: [
      '    hello',
      '    there',
      '        general',
      '            ken',
      'obi',
      '    fin',
    ],
    expectedText: [
      '\t\thello',
      '\t\tthere',
      '\t\t    general',
      '\t\t        ken',
      '\tobi',
      '\t\tfin',
    ],
  },
  {
    name: "Pastes text with indent and inferred first line indent (because of open bracket)",
    startingFile: TWO_SPACES_FILE,
    text: ['    '],
    selections: [selection(0, 4)],
    clipboard: [
      'hello {',
      '  there',
      '    general',
      'kenobi',
      '  fin',
    ],
    expectedText: [
      '    hello {',
      '      there',
      '        general',
      '    kenobi',
      '      fin',
    ],
  },
  {
    name: "Pastes text with indent and inferred first line indent (because of more open parens than close)",
    text: ['    '],
    startingFile: TWO_SPACES_FILE,
    selections: [selection(0, 4)],
    clipboard: [
      'hello(()',
      '    there',
      '      general',
      '  ken',
      'obi',
      '    fin',
    ],
    expectedText: [
      '    hello(()',
      '      there',
      '        general',
      '    ken',
      '  obi',
      '      fin',
    ],
    // yank knows the actual prefix, so no inference is done
    expectedEmacsText: [
      '    hello(()',
      '        there',
      '          general',
      '      ken',
      '    obi',
      '        fin',
    ],
  },
  {
    name: "Pastes text with indent and inferred first line indent (because of dot on second line)",
    startingFile: FOUR_SPACES_FILE,
    text: ['        '],
    selections: [selection(0, 2)],
    clipboard: [
      // Inferred as two-space indents from clipboard
      'hello',
      '      .there',
      '        general',
      '    ken',
      '  o',
      'bi',
      '    fin',
    ],
    expectedText: [
      '        hello',
      '            .there',
      '                general',
      '        ken',
      '    o',
      'bi',
      '        fin',
    ],
    // yank knows the actual prefix, so no inference is done (and just use floor(spaces/4))
    expectedEmacsText: [
      '        hello',
      '            .there',
      '                general',
      '            ken',
      '        o',
      '        bi',
      '            fin',
    ],
  },
  {
    name: "Pastes text with indent and inferred first line indent (because of extra open square brackets)",
    startingFile: TWO_SPACES_FILE,
    text: ['\t\t'],
    selections: [selection(0, 2)],
    clipboard: [
      'hello]][[[',
      '        there',
      '          general',
      '      ken',
      '    o',
      '  b',
      'i',
      '    fin',
    ],
    expectedText: [
      '\t\thello]][[[',
      '\t\t  there',
      '\t\t    general',
      '\t\tken',
      '\to',
      'b',
      'i',
      '\tfin',
    ],
    expectedEmacsText: [
      '\t\thello]][[[',
      '\t\t        there',
      '\t\t          general',
      '\t\t      ken',
      '\t\t    o',
      '\t\t  b',
      '\t\ti',
      '\t\t    fin',
    ],
  },
  {
    name: "Pasted text removes existing indents regardless if spaces or tabs",
    startingFile: TWO_SPACES_FILE,
    text: ['   \t  \t '],
    selections: [selection(0, 8)],
    clipboard: [
      'hello',
      '              there',
      '                general',
      '            ken',
      '          o',
      '        b',
      '      i',
      '    a',
      'b',
      'c',
    ],
    expectedText: [
      '   \t  \t hello',
      '   \t  \t there',
      '   \t  \t   general',
      '   \t  \tken',
      '   \t  o',
      '   \tb',
      '   i',
      ' a',
      'b',
      'c',
    ],
    expectedEmacsText: [
      '   \t  \t hello',
      '   \t  \t               there',
      '   \t  \t                 general',
      '   \t  \t             ken',
      '   \t  \t           o',
      '   \t  \t         b',
      '   \t  \t       i',
      '   \t  \t     a',
      '   \t  \t b',
      '   \t  \t c',
    ],
  },
  {
    name: "Pastes text and uses existing whitespace prefix",
    text: ['\t\t'],
    selections: [selection(0, 2)],
    clipboard: ['  hello there  '],
    expectedText: ['\t\thello there  '],
  },
  {
    name: "Pastes trimmed text if existing prefix doesn't have whitespace at beginning",
    text: ['Z\t\t'],
    selections: [selection(0, 3)],
    clipboard: ['  hello there  '],
    expectedText: ['Z\t\thello there  '],
  },
  {
    name: "Pastes trimmed text if existing prefix doesn't have whitespace at end",
    text: ['\t\tZ'],
    selections: [selection(0, 3)],
    clipboard: ['  hello there  '],
    expectedText: ['\t\tZhello there  '],
  },
  {
    name: "Pastes text with indented lines replaced",
    startingFile: TWO_SPACES_FILE,
    text: ['\t\t'],
    selections: [selection(0, 2)],
    clipboard: [
      '  hello',
      '    there',
      '  good',
      'bye',
    ],
    // Only existing text whiespace is included (not clipboard whitespace)
    expectedText: [
      '\t\thello',
      '\t\t  there',
      '\t\tgood',
      '\tbye',
    ],
  },
  {
    name: "Pastes text, inferring prefix from second line",
    startingFile: TWO_SPACES_FILE,
    text: ['\t\t'],
    selections: [selection(0, 2)],
    clipboard: [
      'hello',
      '  there',
      '    good',
      '  bye',
      'then',
    ],
    // Only existing text whiespace is included (not clipboard whitespace)
    expectedText: [
      '\t\thello',
      '\t\tthere',
      '\t\t  good',
      '\t\tbye',
      '\tthen',
    ],
    expectedEmacsText: [
      '\t\thello',
      '\t\t  there',
      '\t\t    good',
      '\t\t  bye',
      '\t\tthen',
    ],
  },
  {
    name: "Pastes text, inferring prefix from second line (but no whitespace prefix in second line)",
    startingFile: TWO_SPACES_FILE,
    text: ['\t\t'],
    selections: [selection(0, 2)],
    clipboard: [
      'hello',
      'abc  there',
      '    good',
      '  bye',
      'then',
    ],
    // Only existing text whiespace is included (not clipboard whitespace)
    expectedText: [
      '\t\thello',
      '\t\tabc  there',
      '\t\t    good',
      '\t\t  bye',
      '\t\tthen',
    ],
  },
  {
    name: "Pastes text, inferring spacing prefix from second line with extra indent (due to open bracket)",
    startingFile: TWO_SPACES_FILE,
    text: ['\t\t'],
    selections: [selection(0, 2)],
    clipboard: [
      'hello {',
      '    there',
      '    good',
      '      bye',
      'then',
      '  fin',
    ],
    // Only existing text whiespace is included (not clipboard whitespace)
    expectedText: [
      '\t\thello {',
      '\t\t  there',
      '\t\t  good',
      '\t\t    bye',
      '\tthen',
      '\t\tfin',
    ],
    expectedEmacsText: [
      '\t\thello {',
      '\t\t    there',
      '\t\t    good',
      '\t\t      bye',
      '\t\tthen',
      '\t\t  fin',
    ],
  },
  {
    name: "Pastes text, inferring tabbing prefix from second line with extra indent (due to open bracket)",
    startingFile: TABS_FILE,
    text: ['\t\t'],
    selections: [selection(0, 2)],
    clipboard: [
      'hello {',
      '\t\tthere',
      '\t\tgood',
      '\t\t\t\tbye',
      'then',
      '\tfin',
    ],
    // Only existing text whiespace is included (not clipboard whitespace)
    expectedText: [
      '\t\thello {',
      '\t\t\tthere',
      '\t\t\tgood',
      '\t\t\t\t\tbye',
      '\tthen',
      '\t\tfin',
    ],
    expectedEmacsText: [
      '\t\thello {',
      '\t\t\t\tthere',
      '\t\t\t\tgood',
      '\t\t\t\t\t\tbye',
      '\t\tthen',
      '\t\t\tfin',
    ],
  },
  {
    name: "Pastes text, inferring spacing prefix from second line with extra indent (due to open paren)",
    startingFile: TWO_SPACES_FILE,
    text: ['\t\t'],
    selections: [selection(0, 2)],
    clipboard: [
      'hello (',
      '    there',
      '    good',
      '      bye',
      'then',
      '  fin',
    ],
    // Only existing text whiespace is included (not clipboard whitespace)
    expectedText: [
      '\t\thello (',
      '\t\t  there',
      '\t\t  good',
      '\t\t    bye',
      '\tthen',
      '\t\tfin',
    ],
    expectedEmacsText: [
      '\t\thello (',
      '\t\t    there',
      '\t\t    good',
      '\t\t      bye',
      '\t\tthen',
      '\t\t  fin',
    ],
  },
  {
    name: "Pastes text, inferring tabbing prefix from second line with extra indent (due to open square bracket)",
    text: ['\t\t'],
    selections: [selection(0, 2)],
    clipboard: [
      'hello [',
      '\t\tthere',
      '\t\tgood',
      '\t\t\t\tbye',
      'then',
      '\tfin',
    ],
    // Only existing text whiespace is included (not clipboard whitespace)
    expectedText: [
      '\t\thello [',
      '\t\t\tthere',
      '\t\t\tgood',
      '\t\t\t\t\tbye',
      '\tthen',
      '\t\tfin',
    ],
    expectedEmacsText: [
      '\t\thello [',
      '\t\t\t\tthere',
      '\t\t\t\tgood',
      '\t\t\t\t\t\tbye',
      '\t\tthen',
      '\t\t\tfin',
    ],
  },
  {
    name: "Pastes text, inferring spacing prefix from second line with extra indent (due to dot)",
    startingFile: TWO_SPACES_FILE,
    text: ['\t\t'],
    selections: [selection(0, 2)],
    clipboard: [
      'hello',
      '    .there()',
      '    good',
      '      bye',
      'then',
      '  fin',
    ],
    // Only existing text whiespace is included (not clipboard whitespace)
    expectedText: [
      '\t\thello',
      '\t\t  .there()',
      '\t\t  good',
      '\t\t    bye',
      '\tthen',
      '\t\tfin',
    ],
    expectedEmacsText: [
      '\t\thello',
      '\t\t    .there()',
      '\t\t    good',
      '\t\t      bye',
      '\t\tthen',
      '\t\t  fin',
    ],
  },
  {
    name: "Pastes text, inferring tabbing prefix from second line with extra indent (due to dot)",
    text: ['\t\t'],
    selections: [selection(0, 2)],
    clipboard: [
      'hello',
      '\t\t.there()',
      '\t\tgood',
      '\t\t\t\tbye',
      'then',
      '\tfin',
    ],
    // Only existing text whiespace is included (not clipboard whitespace)
    expectedText: [
      '\t\thello',
      '\t\t\t.there()',
      '\t\t\tgood',
      '\t\t\t\t\tbye',
      '\tthen',
      '\t\tfin',
    ],
    expectedEmacsText: [
      '\t\thello',
      '\t\t\t\t.there()',
      '\t\t\t\tgood',
      '\t\t\t\t\t\tbye',
      '\t\tthen',
      '\t\t\tfin',
    ],
  },
  /* Useful for commenting out tests. */
];

export function getPasteTestCases(): TestCase[] {
  return [
    // groog.paste test cases
    ...pasteTestCases.map(tc => {
      return {
        ...tc,
        name: `[paste] ${tc.name}`,
        file: tc.startingFile || TABS_FILE,
        userInteractions: [
          // Write the text
          defaultType(tc.text?.join('\r') || ''),
          cmd("groog.paste"),

          // Put the cursor at the top cuz we don't care about testing that here
          cmd("groog.cursorTop"),
        ],
        expectedSelections: [selection(0, 0)],
      };
    }),

    // Test cases where entire text with no whitespace prefix is yanked and groog.emacsPaste
    ...pasteTestCases.map(tc => {

      // If we use \n, then vs code does clever indentation for us which we don't want.
      // Using \r does the trick (and actually just inserts a newline character.
      const clipText = tc.clipboard?.join('\r') || '';

      const clipWhitespace = /^\s*/.exec(clipText)?.at(0)!;
      const clipMainText = clipText.slice(clipWhitespace.length);

      return {
        ...tc,
        name: `[emacs paste no whitespace] ${tc.name}`,
        file: tc.startingFile || TABS_FILE,
        expectedText: tc.expectedEmacsText || tc.expectedText,
        userInteractions: [
          // Yank only the main text
          defaultType(clipMainText),
          cmd("groog.cursorTop"),
          defaultType(clipWhitespace),
          cmd("groog.toggleMarkMode"),
          cmd("groog.cursorBottom"),
          cmd("groog.yank"),

          // Clear all text
          cmd("groog.toggleMarkMode"),
          cmd("groog.cursorTop"),
          cmd("groog.deleteLeft"),

          // Type the actual starting text
          defaultType(tc.text?.join('\r') || ''),
          cmd("groog.emacsPaste"),

          // Put the cursor at the top cuz we don't care about testing that here
          cmd("groog.cursorTop"),
        ],
        expectedSelections: [selection(0, 0)],
      };
    }),

    // Test cases where entire text with whitespace prefix is yanked and groog.emacsPaste
    ...pasteTestCases.map(tc => {
      return {
        ...tc,
        name: `[emacs paste with whitespace] ${tc.name}`,
        file: tc.startingFile || TABS_FILE,
        expectedText: tc.expectedEmacsText || tc.expectedText,
        userInteractions: [
          // Yank all the text
          defaultType(tc.clipboard?.join('\r') || ''),
          cmd("groog.cursorTop"),
          cmd("groog.toggleMarkMode"),
          cmd("groog.cursorBottom"),
          cmd("groog.yank"),

          // Type the actual starting text
          defaultType(tc.text?.join('\r') || ''),
          cmd("groog.emacsPaste"),

          // Put the cursor at the top cuz we don't care about testing that here
          cmd("groog.cursorTop"),
        ],
        expectedSelections: [selection(0, 0)],
      };
    }),

    // One-off test cases
    {
      name: 'wtf',
      skipBecauseOfPaste: true,
      text: [''],
      expectedText: [
        'abc',
        'abc',
        '',
      ],
      expectedSelections: [selection(2, 0)],
      userInteractions: [
        defaultType('abc\n'),
        cmd('groog.toggleMarkMode'),
        cmd('groog.cursorUp'),
        cmd("editor.action.clipboardCopyAction"),
        ctrlG,
        cmd('groog.cursorDown'),
        // delay(1500),
        cmd('groog.paste'),
        // delay(1500),
      ],
    },
    {
      name: "Emacs paste uses preceding whitespace on first line (when no whitespace)",
      file: TWO_SPACES_FILE,
      expectedText: [
        '  def',
        '    ghi',
      ],
      userInteractions: [
        type([
          'abc  def',
          '  ghi',
        ].join('\r')),
        cmd("groog.toggleMarkMode"),
        cmd("groog.cursorUp"),
        cmd("groog.cursorEnd"),
        cmd("groog.cursorLeft"),
        cmd("groog.cursorLeft"),
        cmd("groog.cursorLeft"),
        cmd("groog.yank"),
        cmd('editor.action.selectAll'),
        cmd('groog.deleteLeft'),
        defaultType('  '),
        cmd("groog.cursorEnd"),
        cmd("groog.emacsPaste"),

        // Put the cursor at the top cuz we don't care about testing that here
        cmd("groog.cursorTop"),
      ],
    },
    {
      name: "Emacs paste uses preceding whitespace on line (when one indent)",
      file: TWO_SPACES_FILE,
      expectedText: [
        '  def',
        '  ghi',
      ],
      userInteractions: [
        type([
          '  abc  def',
          '  ghi',
        ].join('\r')),
        cmd("groog.toggleMarkMode"),
        cmd("groog.cursorUp"),
        cmd("groog.cursorEnd"),
        cmd("groog.cursorLeft"),
        cmd("groog.cursorLeft"),
        cmd("groog.cursorLeft"),
        cmd("groog.yank"),
        cmd('editor.action.selectAll'),
        cmd('groog.deleteLeft'),
        defaultType('  '),
        cmd("groog.cursorEnd"),
        cmd("groog.emacsPaste"),

        // Put the cursor at the top cuz we don't care about testing that here
        cmd("groog.cursorTop"),
      ],
    },
    {
      name: "Emacs paste uses preceding whitespace on line (when two indents)",
      file: TWO_SPACES_FILE,
      expectedText: [
        '  def',
        'ghi',
      ],
      userInteractions: [
        type([
          '    abc  def',
          '  ghi',
        ].join('\r')),
        cmd("groog.toggleMarkMode"),
        cmd("groog.cursorUp"),
        cmd("groog.cursorEnd"),
        cmd("groog.cursorLeft"),
        cmd("groog.cursorLeft"),
        cmd("groog.cursorLeft"),
        cmd("groog.yank"),
        cmd('editor.action.selectAll'),
        cmd('groog.deleteLeft'),
        defaultType('  '),
        cmd("groog.cursorEnd"),
        cmd("groog.emacsPaste"),

        // Put the cursor at the top cuz we don't care about testing that here
        cmd("groog.cursorTop"),
      ],
    },
  ];
}


function startingFile(...fileParts: string[]) {
  return path.resolve(__dirname, "..", "..", "..", "src", "test", "test-workspace", ...fileParts);
}

function pathParts(...fileParts: string[]) {
  return vscode.Uri.file(startingFile(...fileParts)).path.split('/');
}

interface TestMatch {
  range: vscode.Range;
  text: string;
}

function wordSeparatorConfiguration(sep: string, ...corrections: Correction[]): WorkspaceConfiguration {
  return {
    configuration: new Map<vscode.ConfigurationTarget, Map<string, any>>([
      [vscode.ConfigurationTarget.Global, new Map<string, any>([
        ["editor", new Map<string, any>([
          ['wordSeparators', sep],
        ])],
        ["groog", new Map<string, any>([
          ['typos', corrections],
        ])],
      ])],
    ]),
  };
}

function allWordSeparatorConfiguration(...corrections: Correction[]) {
  return wordSeparatorConfiguration("`~!@#$%^&*()-=+[{]}\\|;:'\",.<>/?_", ...corrections);
}

function convertTestMatches(pattern: RegExp | undefined, testMatches: TestMatch[]): Match[] {
  return testMatches.map((tm, index) => {
    return {
      ...tm,
      pattern: pattern!,
      index,
    };
  });
}

// Need to use this due to pickable being in FindQuickPickItem, but not vscode.QuickPickItem.
function findItem(f: FindQuickPickItem): FindQuickPickItem {
  return f;
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

  buttons.push({
    iconPath: {
      id: "run-all",
    },
    tooltip: "Run N times",
  });

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

function type(text: string): UserInteraction {
  return cmd("groog.type", { "text": text });
}

function defaultType(text: string): UserInteraction {
  return cmd("default:type", { "text": text });
}

export function selection(line: number, char: number): vscode.Selection {
  return new vscode.Selection(line, char, line, char);
}

function nTimesRecordValidationTestCase(name: string, input: string): TestCase {
  return {
    name,
    text: [
      "def",
    ],
    expectedText: [
      "abcdef",
    ],
    expectedSelections: [
      selection(0, 3),
    ],
    userInteractions: [
      cmd("groog.record.startRecording"),
      type("abc"),
      cmd("groog.record.endRecording"),
      cmd("groog.record.playRecordingNTimes"),
    ],
    inputBox: {
      expectedInputBoxes: [
        {
          options: {
            prompt: "17",
            title: "Number of times to playback the recording",
            validateInputProvided: true,
          },
          validationMessage: "Input must be a positive integer",
        },
      ],
      inputBoxResponses: [
        input,
      ],
    },
  };
}

export interface TestCase extends SimpleTestCaseProps {
  name: string;
  runSolo?: boolean;
  clipboard?: string[];
  execStubs?: ExecStub[];
  wantSendTerminalCommands?: [TestFileArgs | undefined, string][];

  // TODO: Remove after this issue is fixed
  // https://github.com/microsoft/vscode-test-cli/issues/69
  skipBecauseOfPaste?: boolean;
}

const TEST_ITERATIONS = 1;

function testCases(): TestCase[] {
  return [
    // Basic/setup tests
    {
      name: "Captures opening info message",
      userInteractions: [
        cmd("groog.cursorRight"), // Need command to activate extension.
      ],
      informationMessage: {
        expectedMessages: [
          `Basic keyboard mode activated`,
        ],
      },
      errorMessage: {
        expectedMessages: [
          `Failed to get editor.wordSeparator; defaulting to space character`,
        ],
      },
    },
    // Typo tests
    // Note: These typos are configured in src/test/test-workspace/.vscode/settings.json
    {
      name: "Typo does nothing if typing with no editor",
      userInteractions: [
        type(" "),
      ],
      workspaceConfiguration: {
        workspaceConfiguration: wordSeparatorConfiguration(' ^('),
        expectedWorkspaceConfiguration: wordSeparatorConfiguration(' ^('),
      },
      errorMessage: {
        expectedMessages: [
          `Couldn't find active editor`,
        ],
      },
    },
    {
      name: "Typo fixer doesn't do anything if still typing",
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
      workspaceConfiguration: {
        workspaceConfiguration: wordSeparatorConfiguration(' ^('),
      },
    },
    {
      name: "Typo fixer fixes if word is over (no word separator defaults to space)",
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
      workspaceConfiguration: {
        workspaceConfiguration: wordSeparatorConfiguration(' ', {
          words: {
            typobuidl: "build",
          },
        }),
      },
    },
    {
      name: "Typo fixer fixes if word is over (word separator setting with space)",
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
      workspaceConfiguration: {
        workspaceConfiguration: wordSeparatorConfiguration(' ', {
          words: {
            typobuidl: "build",
          },
        }),
      },
    },
    {
      name: "Typo fixer fixes if word is over (word separator setting without space in setting, but whitespce)",
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
      workspaceConfiguration: {
        workspaceConfiguration: wordSeparatorConfiguration('^?!', {
          words: {
            typobuidl: "build",
          },
        }),
      },
    },
    {
      name: "Typo fixer fixes if word is over (word separator setting without char in setting, and not whitespce)",
      text: [],
      expectedSelections: [
        selection(0, 10),
      ],
      expectedText: [
        "typobuidl-",
      ],
      userInteractions: [
        type("typobuid"),
        type("l"),
        type("-"),
      ],
      workspaceConfiguration: {
        workspaceConfiguration: wordSeparatorConfiguration('^?!', {
          words: {
            typobuidl: "build",
          },
        }),
      },
    },
    {
      name: "Typo fixer fixes if word is over with other word break character",
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
      workspaceConfiguration: {
        workspaceConfiguration: wordSeparatorConfiguration('(', {
          words: {
            typobuidl: "build",
          },
        }),
      },
    },
    {
      name: "Doesn't run typo if typing over a selection",
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
      workspaceConfiguration: {
        workspaceConfiguration: allWordSeparatorConfiguration({
          words: {
            typobuidl: "build",
          },
        }),
      },
    },
    {
      name: "Doesn't run typo if not at the end of a word",
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
      workspaceConfiguration: {
        workspaceConfiguration: allWordSeparatorConfiguration({
          words: {
            typobuidl: "build",
          },
        }),
      },
    },
    {
      name: "Language specific typo runs in that language",
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
      // Typo is a built-in typo
      workspaceConfiguration: {
        workspaceConfiguration: allWordSeparatorConfiguration(),
      },
    },
    {
      name: "Regular word is not changed if not a configured break character",
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
      workspaceConfiguration: {
        workspaceConfiguration: allWordSeparatorConfiguration({
          words: {
            typoabc: "ABC",
          },
          breakCharacters: "^",
        }),
      },
    },
    {
      name: "Proper break character replaces word if is a separator character",
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
      workspaceConfiguration: {
        workspaceConfiguration: wordSeparatorConfiguration("^", {
          words: {
            typoabc: "ABC",
          },
          breakCharacters: "^",
        }),
      },
    },
    {
      // TODO: Fix this
      name: "Proper break character does not replace word if not a separator character",
      text: [],
      userInteractions: [
        type("typoabc"),
        type("^"),
      ],
      expectedSelections: [
        selection(0, 8),
      ],
      expectedText: [
        "typoabc^",
      ],
      workspaceConfiguration: {
        workspaceConfiguration: wordSeparatorConfiguration(" ", {
          words: {
            typoabc: "ABC",
          },
          breakCharacters: "^",
        }),
      },
    },
    {
      name: "Exclude break character replaces word without character",
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
      workspaceConfiguration: {
        workspaceConfiguration: wordSeparatorConfiguration('.', {
          words: {
            typoabc: "ABC",
          },
          breakCharacters: '.',
          excludeBreakCharacter: true,
        }),
      },
    },
    {
      name: "Replacement suffix",
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
      workspaceConfiguration: {
        workspaceConfiguration: wordSeparatorConfiguration('$', {
          words: {
            typoabc: "ABC",
          },
          breakCharacters: '$',
          replacementSuffix: "ef",
        }),
      },
    },
    {
      name: "Replacement suffix after cursor",
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
      workspaceConfiguration: {
        workspaceConfiguration: wordSeparatorConfiguration('-', {
          words: {
            typoabc: "ABC",
          },
          breakCharacters: '-',
          replacementSuffixAfterCursor: "EF",
        }),
      },
    },
    {
      name: "Replacement suffix before and after cursor",
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
      workspaceConfiguration: {
        workspaceConfiguration: wordSeparatorConfiguration('&', {
          words: {
            typoabc: "ABC",
          },
          breakCharacters: '&',
          replacementSuffix: "de",
          excludeBreakCharacter: true,
          replacementSuffixAfterCursor: "F",
        }),
      },
    },
    // Typo with multi-line suffix replacements
    {
      name: "Replacement suffix before and after cursor",
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
      workspaceConfiguration: {
        workspaceConfiguration: wordSeparatorConfiguration(' ', {
          words: {
            typoalphabet: "abcdef\nghij",
          },
          replacementSuffix: "kl\nmn\no",
          excludeBreakCharacter: true,
          replacementSuffixAfterCursor: "pq\nrstuvw\nxyz",
        }),
      },
    },
    // Typo while recording tests
    {
      name: "Typo fixer isn't run while recording",
      text: [],
      expectedSelections: [
        selection(4, 0),
      ],
      expectedText: [
        // Regular type
        "ABCDEF ",
        // Recording
        "abc ",
        // End recording
        "playback",
        // Play recording
        "abc ",
        "",
      ],
      userInteractions: [
        // Type while not recording
        type("abc"),
        type(" "),
        type("\n"),
        cmd("groog.record.startRecording"),
        type("abc"),
        type(" "),
        type("\n"),
        cmd("groog.record.endRecording"),
        type("playback\n"),
        cmd("groog.record.playRecording"),
      ],
      workspaceConfiguration: {
        workspaceConfiguration: wordSeparatorConfiguration(' ', {
          words: {
            abc: "ABCDEF",
          },
        }),
      },
    },
    // Keyboard toggle tests
    {
      name: "Toggles to QMK mode",
      // TODO: Test something about context value
      userInteractions: [
        cmd("groog.toggleQMK"),
      ],
      informationMessage: {
        expectedMessages: [
          `QMK keyboard mode activated`,
        ],
      },
    },
    {
      name: "Toggles back to basic keyboard mode",
      // TODO: Test something about context value
      userInteractions: [
        cmd("groog.toggleQMK"),
      ],
      informationMessage: {
        expectedMessages: [
          `Basic keyboard mode activated`,
        ],
      },
    },
    {
      name: "Writes text to file",
      text: [
        "abc",
      ],
      expectedText: [
        "abc",
      ],
    },
    // Find command failure tests
    {
      name: "groog.find.replaceOne if not in find mode",
      userInteractions: [
        cmd("groog.find.replaceOne"),
      ],
      text: [
        "abc",
      ],
      expectedText: [
        "abc",
      ],
      errorMessage: {
        expectedMessages: [
          `Cannot replace matches when not in groog.find mode`,
        ],
      },
    },
    {
      name: "groog.find.replaceAll if not in find mode",
      userInteractions: [
        cmd("groog.find.replaceAll"),
      ],
      text: [
        "abc",
      ],
      expectedText: [
        "abc",
      ],
      errorMessage: {
        expectedMessages: [
          `Cannot replace matches when not in groog.find mode`,
        ],
      },
    },
    {
      name: "groog.find.toggleReplaceMode if not in find mode",
      userInteractions: [
        cmd("groog.find.toggleReplaceMode"),
      ],
      text: [
        "abc",
      ],
      expectedText: [
        "abc",
      ],
      errorMessage: {
        expectedMessages: [
          `groog.find.toggleReplaceMode can only be executed in find mode`,
        ],
      },
    },
    {
      name: "groog.find.previous if not in find mode",
      userInteractions: [
        cmd("groog.find.previous"),
      ],
      text: [
        "abc",
      ],
      expectedText: [
        "abc",
      ],
      errorMessage: {
        expectedMessages: [
          `groog.find.previous can only be executed in find mode`,
        ],
      },
    },
    {
      name: "groog.find.next if not in find mode",
      userInteractions: [
        cmd("groog.find.next"),
      ],
      text: [
        "abc",
      ],
      expectedText: [
        "abc",
      ],
      errorMessage: {
        expectedMessages: [
          `groog.find.next can only be executed in find mode`,
        ],
      },
    },
    // Find no editor tests
    {
      name: "groog.find fails if no editor",
      userInteractions: [
        cmd("groog.find"),
      ],
      errorMessage: {
        expectedMessages: [
          `Cannot activate find mode from outside an editor`,
        ],
      },
    },
    {
      name: "groog.reverseFind fails if no editor",
      userInteractions: [
        cmd("groog.reverseFind"),
      ],
      errorMessage: {
        expectedMessages: [
          `Cannot activate find mode from outside an editor`,
        ],
      },
    },
    {
      name: "groog.find deactivate fails if no editor",
      text: [
        "abc",
      ],
      userInteractions: [
        cmd("groog.find"),
        type("ab"),
        closeAllEditors,
        type("c"),
      ],
      quickPick: {
        expectedQuickPicks: [
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
      },
      errorMessage: {
        expectedMessages: [
          `Cannot select text from outside the editor`,
        ],
      },
    },
    {
      name: "End of find cache",
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
      quickPick: {
        expectedQuickPicks: [
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
      },
      informationMessage: {
        expectedMessages: [
          `End of find cache`,
        ],
      },
    },
    {
      name: "Beginning of find cache",
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
      quickPick: {
        expectedQuickPicks: [
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
      },
      informationMessage: {
        expectedMessages: [
          `No earlier find contexts available`,
        ],
      },
    },
    // Mark mode misc. tests
    {
      name: "Highlights text",
      text: [
        "abcdef",
        "ghijkl",
      ],
      expectedText: [
        "abcdef",
        "ghijkl",
      ],
      userInteractions: [
        cmd("groog.cursorRight"),
        cmd("groog.toggleMarkMode"),
        cmd("groog.cursorRight"),
        cmd("groog.cursorDown"),
        cmd("groog.cursorRight"),
      ],
      expectedSelections: [
        new vscode.Selection(0, 1, 1, 3),
      ],
    },
    {
      name: "Deactivating mark mode deselects",
      text: [
        "abcdef",
        "ghijkl",
      ],
      expectedText: [
        "abcdef",
        "ghijkl",
      ],
      userInteractions: [
        cmd("groog.cursorRight"),
        cmd("groog.toggleMarkMode"),
        cmd("groog.cursorRight"),
        cmd("groog.cursorDown"),
        cmd("groog.cursorRight"),
        cmd("groog.toggleMarkMode"),
      ],
      expectedSelections: [selection(1, 3)],
    },
    {
      name: "Handles move commands with select set to true",
      text: [
        "abcdef",
        "ghijkl",
        "mnopqr",
      ],
      expectedText: [
        "abcdef",
        "ghijkl",
        "mnopqr",
      ],
      userInteractions: [
        cmd("groog.cursorRight"),
        cmd("groog.toggleMarkMode"),
        cmd("groog.cursorMove", {
          to: 'right',
          by: 'character',
          value: 2,
        }),
        cmd("groog.cursorMove", {
          to: 'down',
        }),
      ],
      expectedSelections: [
        new vscode.Selection(0, 1, 1, 3),
      ],
    },
    {
      name: "Yanked text replaces selected text",
      text: [
        "  abc",
        "    def",
        "      ghi",
      ],
      selections: [selection(1, 4)],
      expectedText: [
        "  def",
        "  ghi",
      ],
      expectedSelections: [selection(1, 5)],
      userInteractions: [
        cmd("groog.toggleMarkMode"),
        cmd("groog.cursorDown"),
        cmd("groog.cursorEnd"),
        cmd("groog.yank"),
        cmd("groog.toggleMarkMode"),
        cmd("groog.cursorUp"),
        cmd("groog.cursorHome"),
        cmd("groog.emacsPaste"),
      ],
    },
    {
      name: "Falls back to regular pasting if no editor",
      clipboard: [
        'aSdF',
      ],
      expectedText: [
        '// search.txt',
        '',
        'asdf',
        '',
        'aSdF',
        '',
        'xaSdF',
        '',
      ],
      expectedSelections: [new vscode.Selection(4, 0, 4, 4)],
      userInteractions: [
        cmd("workbench.action.findInFiles"),
        cmd("toggleSearchWholeWord"),
        cmd("toggleSearchCaseSensitive"),
        cmd("groog.paste"),
        cmd("search.action.focusSearchList"),
        new Waiter(10, async () => {
          if (vscode.window.activeTextEditor) {
            return true;
          }

          await vscode.commands.executeCommand("list.focusDown");

          return false;
        }),
        // Clean up
        cmd("toggleSearchWholeWord"),
        cmd("toggleSearchCaseSensitive"),
        cmd("workbench.action.toggleSidebarVisibility"),
      ],
    },
    {
      name: "keepSelectionOnDeactivation gets cleared after emacs paste",
      text: [
        "abc",
        "def",
        "ghi",
        "jkl",
      ],
      expectedText: [
        "",
        "dabcef",
        "ghiX",
        "jkl",
      ],
      expectedSelections: [
        selection(2, 4),
      ],
      userInteractions: [
        cmd("groog.kill"),
        cmd("groog.cursorDown"),
        cmd("groog.cursorRight"),
        cmd("groog.emacsPaste"),
        cmd("groog.cursorDown"),
        cmd("groog.cursorHome"),
        cmd("groog.toggleMarkMode"),
        cmd("groog.cursorEnd"),
        cmd("groog.toggleMarkMode"), // deactivate should not keep selection
        type("X"),
      ],
    },
    // Find tests
    {
      name: "Moving deactivates find",
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
      quickPick: {
        expectedQuickPicks: [
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
      quickPick: {
        expectedQuickPicks: [
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
      },
      errorMessage: {
        expectedMessages: [
          `Unsupported find command: groog.deleteRight`,
        ],
      },
    },
    {
      name: "Supports groog.deleteLeft",
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
      quickPick: {
        expectedQuickPicks: [
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
      quickPick: {
        expectedQuickPicks: [
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
      skipBecauseOfPaste: true,
      name: "Works with regular pasting",
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
      quickPick: {
        expectedQuickPicks: [
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
      quickPick: {
        expectedQuickPicks: [
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
      quickPick: {
        expectedQuickPicks: [
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
      quickPick: {
        expectedQuickPicks: [
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
    {
      name: "Find with whole word fails on multiple active items",
      text: [
        "abcd",
        "bcd2",
        "bcd1",
        "bcd3",
      ],
      expectedText: [
        "abcd",
        "bcd2",
        "bcd1",
        "bcd3",
      ],
      userInteractions: [
        cmd("groog.find"),
        cmd("groog.find.toggleWholeWord"),
        type("b"),
        new SelectItemQuickPickAction(['bcd1', 'bcd2']),
      ],
      errorMessage: {
        expectedMessages: [
          `Multiple selections made somehow?!`,
        ],
      },
      quickPick: {
        expectedQuickPicks: [
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
          // type 'b'
          [
            "b",
            "Flags: [W]",
            "No results",
            findItem({
              label: "bcd1",
              pickable: true,
            }),
            findItem({
              label: "bcd2",
              pickable: true,
            }),
            findItem({
              label: "bcd3",
              pickable: true,
            }),
          ],
        ],
      },
    },
    {
      name: "Find with whole word fails on empty active items",
      text: [
        "abcd",
        "bcd2",
        "bcd1",
        "bcd3",
      ],
      expectedText: [
        "abcd",
        "bcd2",
        "bcd1",
        "bcd3",
      ],
      userInteractions: [
        cmd("groog.find"),
        cmd("groog.find.toggleWholeWord"),
        type("b"),
        new SelectItemQuickPickAction([]),
      ],
      errorMessage: {
        expectedMessages: [
          `No find item selected!`,
        ],
      },
      quickPick: {
        expectedQuickPicks: [
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
          // type 'b'
          [
            "b",
            "Flags: [W]",
            "No results",
            findItem({
              label: "bcd1",
              pickable: true,
            }),
            findItem({
              label: "bcd2",
              pickable: true,
            }),
            findItem({
              label: "bcd3",
              pickable: true,
            }),
          ],
        ],
      },
    },
    {
      name: "Find with whole word starts active on first suggestion",
      text: [
        "abcd",
        // This order ensures that labels are sorted in alphabetical order
        "bcd2",
        "bcd1",
        "bcd3",
      ],
      expectedText: [
        "abcd",
        "bcd2",
        "xyz",
        "bcd3",
      ],
      expectedSelections: [
        selection(2, 3),
      ],
      userInteractions: [
        cmd("groog.find"),
        cmd("groog.find.toggleWholeWord"),
        type("b"),
        new SelectActiveItems(),
        ctrlG,
        cmd("groog.deleteLeft"),
        type("xyz"),
      ],
      quickPick: {
        expectedQuickPicks: [
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
          // type 'b'
          [
            "b",
            "Flags: [W]",
            "No results",
            findItem({
              label: "bcd1",
              pickable: true,
            }),
            findItem({
              label: "bcd2",
              pickable: true,
            }),
            findItem({
              label: "bcd3",
              pickable: true,
            }),
          ],
          // SelectActiveItems
          [
            "bcd1",
            "Flags: [W]",
            "1 of 1",
          ],
        ],
      },
    },
    {
      name: "Find with whole word starts active on first suggestion and moves",
      text: [
        "abcd",
        // This order ensures that labels are sorted in alphabetical order
        "bcd2",
        "bcd1",
        "bcd3",
      ],
      expectedText: [
        "abcd",
        "xyz",
        "bcd1",
        "bcd3",
      ],
      expectedSelections: [
        selection(1, 3),
      ],
      userInteractions: [
        cmd("groog.find"),
        cmd("groog.find.toggleWholeWord"),
        type("b"),
        cmd('workbench.action.quickOpenNavigateNextInFilePicker'),
        cmd('workbench.action.quickOpenNavigateNextInFilePicker'),
        cmd('workbench.action.quickOpenNavigatePreviousInFilePicker'),
        new SelectActiveItems(),
        ctrlG,
        cmd("groog.deleteLeft"),
        type("xyz"),
      ],
      quickPick: {
        expectedQuickPicks: [
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
          // type 'b'
          [
            "b",
            "Flags: [W]",
            "No results",
            findItem({
              label: "bcd1",
              pickable: true,
            }),
            findItem({
              label: "bcd2",
              pickable: true,
            }),
            findItem({
              label: "bcd3",
              pickable: true,
            }),
          ],
          // SelectActiveItems on bcd2
          [
            "bcd2",
            "Flags: [W]",
            "1 of 1",
          ],
        ],
      },
    },
    {
      name: "Ignores non-pickable items (e.g. informational options)",
      text: [
        "abcd",
        "bcd2",
        "bcd1",
        "bcd3",
      ],
      expectedText: [
        "xyzabcd",
        "bcd2",
        "bcd1",
        "bcd3",
      ],
      expectedSelections: [
        selection(0, 3),
      ],
      userInteractions: [
        cmd("groog.find"),
        cmd("groog.find.toggleWholeWord"),
        type("b"),
        cmd('workbench.action.quickOpenNavigatePreviousInFilePicker'),
        new SelectActiveItems(),
        ctrlG,
        cmd("groog.deleteLeft"),
        type("xyz"),
      ],
      quickPick: {
        expectedQuickPicks: [
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
          // type 'b'
          [
            "b",
            "Flags: [W]",
            "No results",
            findItem({
              label: "bcd1",
              pickable: true,
            }),
            findItem({
              label: "bcd2",
              pickable: true,
            }),
            findItem({
              label: "bcd3",
              pickable: true,
            }),
          ],
          // SelectActiveItems user interaction does nothing since non-pickable item
        ],
      },
    },
    // Find memory tests
    {
      name: "Keeps all toggles if find is re-activated recently enough",
      text: [
        "Alpha",
        "abcd",
        "bcd1",
        "Bcd2",
      ],
      expectedText: [
        "midpoint Alpha",
        "abcd",
        "bcd1",
        "Bcd2",
      ],
      expectedSelections: [selection(0, 9)],
      userInteractions: [
        cmd("groog.find"),
        cmd("groog.find.toggleWholeWord"),
        cmd("groog.find.toggleCaseSensitive"),
        cmd("groog.find.toggleRegex"),
        type("[aA]"),
        ctrlG,
        type('midpoint '),
        // No delay to start next find
        cmd("groog.find"),
        type("[bB]"),
      ],
      quickPick: {
        expectedQuickPicks: [
          [
            " ",
            "Flags: []",
            "No results",
          ],
          [
            " ",
            "Flags: [W]",
            "No results",
          ],
          [
            " ",
            "Flags: [CW]",
            "No results",
          ],
          [
            " ",
            "Flags: [CWR]",
            "No results",
          ],
          [
            "[aA]",
            "Flags: [CWR]",
            "No results",
            findItem({
              label: 'Alpha',
              pickable: true,
            }),
            findItem({
              label: 'abcd',
              pickable: true,
            }),
          ],
          // Restart find (with same flags)
          [
            " ",
            "Flags: [CWR]",
            "No results",
          ],
          [
            "[bB]",
            "Flags: [CWR]",
            "No results",
            findItem({
              label: 'Bcd2',
              pickable: true,
            }),
            findItem({
              label: 'bcd1',
              pickable: true,
            }),
          ],
        ],
      },
    },
    {
      name: "Clears all toggles if find is re-activated too late",
      text: [
        "Alpha",
        "abcd",
        "bcd1",
        "Bcd2",
      ],
      expectedText: [
        "midpoint Alpha",
        "abcd",
        "bcd1",
        "Bcd2",
      ],
      expectedSelections: [selection(0, 9)],
      userInteractions: [
        cmd("groog.find"),
        cmd("groog.find.toggleWholeWord"),
        cmd("groog.find.toggleCaseSensitive"),
        cmd("groog.find.toggleRegex"),
        type("[aA]"),
        ctrlG,
        type('midpoint '),
        // Wait until memory is cleared
        delay(FIND_MEMORY_MS),
        cmd("groog.find"),
        type("[bB]"),
      ],
      quickPick: {
        expectedQuickPicks: [
          [
            " ",
            "Flags: []",
            "No results",
          ],
          [
            " ",
            "Flags: [W]",
            "No results",
          ],
          [
            " ",
            "Flags: [CW]",
            "No results",
          ],
          [
            " ",
            "Flags: [CWR]",
            "No results",
          ],
          [
            "[aA]",
            "Flags: [CWR]",
            "No results",
            findItem({
              label: 'Alpha',
              pickable: true,
            }),
            findItem({
              label: 'abcd',
              pickable: true,
            }),
          ],
          // Restart find (with cleared flags)
          [
            " ",
            "Flags: []",
            "No results",
          ],
          [
            "[bB]",
            "Flags: []",
            "No results",
          ],
        ],
      },
    },
    {
      name: "Keeps all toggles if find is re-activated recently enough (with replace mode)",
      text: [
        "Alpha",
        "abcd",
        "bcd1",
        "Bcd2",
      ],
      expectedText: [
        "midpoint Alpha",
        "abcd",
        "bcd1",
        "Bcd2",
      ],
      expectedSelections: [selection(0, 9)],
      userInteractions: [
        cmd("groog.find"),
        cmd("groog.find.toggleWholeWord"),
        cmd("groog.find.toggleCaseSensitive"),
        cmd("groog.find.toggleRegex"),
        cmd("groog.find.toggleReplaceMode"),
        type("[aA]"),
        ctrlG,
        type('midpoint '),
        // No delay to start next find
        cmd("groog.find"),
        type("[bB]"),
      ],
      quickPick: {
        expectedQuickPicks: [
          [
            " ",
            "Flags: []",
            "No results",
          ],
          [
            " ",
            "Flags: [W]",
            "No results",
          ],
          [
            " ",
            "Flags: [CW]",
            "No results",
          ],
          [
            " ",
            "Flags: [CWR]",
            "No results",
          ],
          // Toggle replace mode
          [
            {
              label: " ",
              detail: 'No replace text set',
            },
            "Flags: [CWR]",
            "No results",
          ],
          // Type [aA]
          [
            {
              label: " ",
              detail: '[aA]',
            },
            "Flags: [CWR]",
            "No results",
          ],
          // Restart find (with same flags)
          [
            " ",
            "Flags: [CWR]",
            "No results",
          ],
          [
            "[bB]",
            "Flags: [CWR]",
            "No results",
            findItem({
              label: 'Bcd2',
              pickable: true,
            }),
            findItem({
              label: 'bcd1',
              pickable: true,
            }),
          ],
        ],
      },
    },
    {
      name: "Clears all toggles if find is re-activated too late (with replace mode)",
      text: [
        "Alpha",
        "abcd",
        "bcd1",
        "Bcd2",
      ],
      expectedText: [
        "midpoint Alpha",
        "abcd",
        "bcd1",
        "Bcd2",
      ],
      expectedSelections: [selection(0, 9)],
      userInteractions: [
        cmd("groog.find"),
        cmd("groog.find.toggleWholeWord"),
        cmd("groog.find.toggleCaseSensitive"),
        cmd("groog.find.toggleRegex"),
        cmd("groog.find.toggleReplaceMode"),
        type("[aA]"),
        ctrlG,
        type('midpoint '),
        // Wait until memory is cleared
        delay(FIND_MEMORY_MS),
        cmd("groog.find"),
        type("[bB]"),
      ],
      quickPick: {
        expectedQuickPicks: [
          [
            " ",
            "Flags: []",
            "No results",
          ],
          [
            " ",
            "Flags: [W]",
            "No results",
          ],
          [
            " ",
            "Flags: [CW]",
            "No results",
          ],
          [
            " ",
            "Flags: [CWR]",
            "No results",
          ],
          // Toggle replace mode
          [
            {
              label: " ",
              detail: 'No replace text set',
            },
            "Flags: [CWR]",
            "No results",
          ],
          // Type [aA]
          [
            {
              label: " ",
              detail: '[aA]',
            },
            "Flags: [CWR]",
            "No results",
          ],
          // Restart find (with cleared flags)
          [
            " ",
            "Flags: []",
            "No results",
          ],
          [
            "[bB]",
            "Flags: []",
            "No results",
          ],
        ],
      },
    },
    // Replace tests
    {
      name: "Replace fails if match failure",
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
      quickPick: {
        expectedQuickPicks: [
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
      },
      errorMessage: {
        expectedMessages: [
          `Failed to get match info: Invalid regular expression: /?a/gim: Nothing to repeat`,
        ],
      },
    },
    {
      name: "Replace does nothing if no match",
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
      quickPick: {
        expectedQuickPicks: [
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
      quickPick: {
        expectedQuickPicks: [
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
      quickPick: {
        expectedQuickPicks: [
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
      quickPick: {
        expectedQuickPicks: [
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
      quickPick: {
        expectedQuickPicks: [
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
      quickPick: {
        expectedQuickPicks: [
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
      quickPick: {
        expectedQuickPicks: [
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
            findItem({
              label: "bcd",
              pickable: true,
            }),
          ],
        ],
      },
    },
    // Find context tests
    {
      name: "Find twice uses the previous find context",
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
      quickPick: {
        expectedQuickPicks: [
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
      quickPick: {
        expectedQuickPicks: [
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
      quickPick: {
        expectedQuickPicks: [
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
      quickPick: {
        expectedQuickPicks: [
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
      quickPick: {
        expectedQuickPicks: [
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
      text: [
        "abc",
      ],
      expectedText: [
        "abc",
      ],
      userInteractions: [
        cmd("groog.record.playRecording"),
      ],
      errorMessage: {
        expectedMessages: [
          `No recordings exist yet!`,
        ],
      },
    },
    {
      name: "Record playback repeatedly fails if no recording set",
      text: [
        "abc",
      ],
      expectedText: [
        "abc",
      ],
      userInteractions: [
        cmd("groog.record.playRecordingRepeatedly"),
      ],
      errorMessage: {
        expectedMessages: [
          `No recordings exist yet!`,
        ],
      },
    },
    {
      name: "Record playback n times fails if no recording set",
      text: [
        "abc",
      ],
      expectedText: [
        "abc",
      ],
      userInteractions: [
        cmd("groog.record.playRecordingNTimes"),
      ],
      errorMessage: {
        expectedMessages: [
          `No recordings exist yet!`,
        ],
      },
    },
    {
      name: "Save named recording fails if not recording",
      userInteractions: [
        cmd("groog.record.saveRecordingAs"),
      ],
      errorMessage: {
        expectedMessages: [
          `Not recording!`,
        ],
      },
    },
    {
      name: "End recording fails if not recording",
      userInteractions: [
        cmd("groog.record.endRecording"),
      ],
      errorMessage: {
        expectedMessages: [
          `Not recording!`,
        ],
      },
    },
    {
      name: "Handles nested startRecording commands",
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
      errorMessage: {
        expectedMessages: [
          `Already recording!`,
        ],
      },
    },
    {
      name: "groog.deleteRight eats text",
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
        new SelectItemQuickPickAction(["Recent recording 0"]),
      ],
      quickPick: {
        expectedQuickPicks: [[
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
      errorMessage: {
        expectedMessages: [
          `Still recording!`,
        ],
      },
    },
    {
      name: "Fails to playback named recording if actively recording",
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
      errorMessage: {
        expectedMessages: [
          `Still recording!`,
        ],
      },
    },
    {
      name: "Fails to playback if no named recording selected",
      text: [
        "abc",
      ],
      expectedText: [
        "abc",
      ],
      userInteractions: [
        cmd("groog.record.playNamedRecording"),
        new SelectItemQuickPickAction([]),
      ],
      quickPick: {
        expectedQuickPicks: [[]],
      },
      errorMessage: {
        expectedMessages: [
          `No named recording selection made`,
        ],
      },
    },
    {
      name: "Fails to delete recording if actively recording",
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
      errorMessage: {
        expectedMessages: [
          `Still recording!`,
        ],
      },
    },
    {
      name: "Fails to repeatedly playback if actively recording",
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
      errorMessage: {
        expectedMessages: [
          `Still recording!`,
        ],
      },
    },
    {
      name: "Fails to n-times playback if actively recording",
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
        cmd("groog.record.playRecordingNTimes"),
        type("y"),
        cmd("groog.record.endRecording"),
        type("\n"),
        cmd("groog.record.playRecording"),
      ],
      errorMessage: {
        expectedMessages: [
          `Still recording!`,
        ],
      },
    },
    {
      name: "Records and plays back empty recording",
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
    {
      name: "Records and plays back text and command recording",
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
    {
      name: "Records and plays back",
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
    {
      name: "Play back fails if no find match",
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
      quickPick: {
        expectedQuickPicks: [
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
      },
      errorMessage: {
        expectedMessages: [
          `No match found during recording playback`,
        ],
      },
    },
    {
      name: "Records and plays back when recording would be popped",
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
    {
      name: "Saves recording as and plays back",
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
      inputBox: {
        inputBoxResponses: ["some-name"],
        expectedInputBoxes: [
          {
            options: {
              placeHolder: "Recording name",
              title: "Save recording as:",
              validateInputProvided: true,
            },
          },
        ],
      },
      informationMessage: {
        expectedMessages: [
          `Recording saved as "some-name"!`,
        ],
      },
    },
    {
      name: "Fails to name recording if reserved prefix",
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
      inputBox: {
        inputBoxResponses: [
          "Recent recording bleh",
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
      errorMessage: {
        expectedMessages: [
          `No recording name provided`,
        ],
      },
    },
    {
      name: "Fails to name recording if recording name already exists",
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
      inputBox: {
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
      },
      informationMessage: {
        expectedMessages: [
          `Recording saved as "ABC Recording"!`,
        ],
      },
      errorMessage: {
        expectedMessages: [
          `No recording name provided`,
        ],
      },
    },
    {
      name: "Plays back named recording specified by name",
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
        new SelectItemQuickPickAction(["DEF Recording"]),
      ],
      inputBox: {
        inputBoxResponses: [
          "ABC Recording",
          "DEF Recording",
          "GHI Recording",
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
      quickPick: {
        expectedQuickPicks: [[
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
      },
      informationMessage: {
        expectedMessages: [
          `Recording saved as "ABC Recording"!`,
          `Recording saved as "DEF Recording"!`,
          `Recording saved as "GHI Recording"!`,
        ],
      },
    },
    {
      name: "Fails to play back named recording if multiple items are picked",
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
        new SelectItemQuickPickAction(["ABC Recording", "DEF Recording"]),
      ],
      inputBox: {
        inputBoxResponses: [
          "ABC Recording",
          "DEF Recording",
          "GHI Recording",
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
      quickPick: {
        expectedQuickPicks: [[
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
      },
      informationMessage: {
        expectedMessages: [
          `Recording saved as "ABC Recording"!`,
          `Recording saved as "DEF Recording"!`,
          `Recording saved as "GHI Recording"!`,
        ],
      },
      errorMessage: {
        expectedMessages: [
          "Multiple selections made somehow?!",
        ],
      },
    },
    {
      name: "Deletes recording",
      inputBox: {
        inputBoxResponses: [
          "ABC Recording",
          "DEF Recording",
          "GHI Recording",
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
      quickPick: {
        expectedQuickPicks: [
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
      },
      informationMessage: {
        expectedMessages: [
          `Recording saved as "ABC Recording"!`,
          `Recording saved as "DEF Recording"!`,
          `Recording saved as "GHI Recording"!`,
        ],
      },
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
        new SelectItemQuickPickAction(["DEF Recording"]),
        cmd("groog.record.deleteRecording"),
        new SelectItemQuickPickAction(["DEF Recording"]),
        cmd("groog.record.playNamedRecording"),
        new CloseQuickPickAction(),
      ],
    },
    {
      name: "Records kill and paste",
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
    {
      name: "Records maim and paste",
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
    {
      name: "Records mark and paste",
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
    {
      skipBecauseOfPaste: true,
      name: "Records vanilla copy and paste",
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
    {
      name: "Records with find",
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
      quickPick: {
        expectedQuickPicks: [
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
      errorMessage: {
        expectedMessages: [
          `This recording isn't repeatable`,
        ],
      },
    },
    {
      skipBecauseOfPaste: true,
      name: "Repeat record playback with decreasing find matches",
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
      quickPick: {
        expectedQuickPicks: [
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
      },
      errorMessage: {
        expectedMessages: [
          "No match found during recording playback",
        ],
      },
    },
    {
      name: "Repeat record playback fails if subsequent find fails",
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
      quickPick: {
        expectedQuickPicks: [
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
      },
      errorMessage: {
        expectedMessages: [
          "No match found during recording playback",
        ],
      },
    },
    {
      name: "Repeat record playback with non-decreasing find matches",
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
      quickPick: {
        expectedQuickPicks: [
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
      },
      informationMessage: {
        expectedMessages: [
          "Successfully ran recording on all matches",
        ],
      },
    },
    {
      name: "Record with skipped find executions",
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
      quickPick: {
        expectedQuickPicks: [
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
      },
      errorMessage: {
        expectedMessages: [
          "Landed on same match index, ending repeat playback",
        ],
      },
    },
    {
      name: "Record repeat playback ends if start in non-decrease mode and count changes",
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
      quickPick: {
        expectedQuickPicks: [
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
      },
      errorMessage: {
        expectedMessages: [
          "Number of matches changed (4 -> 3), ending repeat playback",
        ],
      },
    },
    {
      name: "Record repeat playback ends if start in decrease mode and count does not change",
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
      quickPick: {
        expectedQuickPicks: [
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
      },
      errorMessage: {
        expectedMessages: [
          "Number of matches did not decrease, ending repeat playback",
        ],
      },
    },
    // Repeat record playback with buttons
    {
      name: "Repeat named record playback with decreasing find matches",
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
        new PressItemButtonQuickPickAction("Recent recording 0", 1),
      ],
      quickPick: {
        expectedQuickPicks: [
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
                }, 1, 0),
                new CommandRecord("groog.deleteLeft"),
                new TypeRecord("xyz"),
              ]),
              savable: true,
              repeatable: true,
            }),
          ],
        ],
      },
      errorMessage: {
        expectedMessages: [
          `No match found during recording playback`,
        ],
      },
    },
    // Repeat recording N times
    {
      name: "Repeat n-times fails if no active editor",
      text: [
        "abc",
        " def_",
        "  ghi__",
        " def_",
        "abc",
      ],
      userInteractions: [
        cmd("groog.record.startRecording"),
        cmd("groog.find"),
        type("def"),
        ctrlG,
        type("XYZ"),
        cmd("groog.record.endRecording"),
        closeAllEditors,
        cmd("groog.record.playRecordingNTimes"),
      ],
      quickPick: {
        expectedQuickPicks: [
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
      },
      errorMessage: {
        expectedMessages: [
          "No active text editor",
        ],
      },
    },
    nTimesRecordValidationTestCase("Repeat n-times recording disallows empty input", ""),
    nTimesRecordValidationTestCase("Repeat n-times recording disallows string input", "x"),
    nTimesRecordValidationTestCase("Repeat n-times recording disallows negative number input", "-1"),
    nTimesRecordValidationTestCase("Repeat n-times recording disallows zero input", "0"),
    nTimesRecordValidationTestCase("Repeat n-times recording disallows leading zero input", "03"),
    {
      name: "Repeat n-times recording works",
      text: [
        "def",
      ],
      expectedText: [
        "abcabcdef",
      ],
      expectedSelections: [
        selection(0, 6),
      ],
      userInteractions: [
        cmd("groog.record.startRecording"),
        type("abc"),
        cmd("groog.record.endRecording"),
        cmd("groog.record.playRecordingNTimes"),
      ],
      inputBox: {
        inputBoxResponses: [
          "1",
        ],
        expectedInputBoxes: [
          {
            options: {
              prompt: "17",
              title: "Number of times to playback the recording",
              validateInputProvided: true,
            },
          },
        ],
      },
    },
    {
      name: "Repeat n-times recording works with larger value",
      text: [
        "def",
      ],
      expectedText: [
        "abcabcabcabcabcabcabcabcdef",
      ],
      expectedSelections: [
        selection(0, 24),
      ],
      userInteractions: [
        cmd("groog.record.startRecording"),
        type("abc"),
        cmd("groog.record.endRecording"),
        cmd("groog.record.playRecordingNTimes"),
      ],
      inputBox: {
        inputBoxResponses: [
          "7",
        ],
        expectedInputBoxes: [
          {
            options: {
              prompt: "17",
              title: "Number of times to playback the recording",
              validateInputProvided: true,
            },
          },
        ],
      },
    },
    {
      name: "Repeat n-times recording works with button",
      text: [
        "def",
      ],
      expectedText: [
        "abcabcabcabcdef",
      ],
      expectedSelections: [
        selection(0, 12),
      ],
      userInteractions: [
        cmd("groog.record.startRecording"),
        type("abc"),
        cmd("groog.record.endRecording"),
        cmd("groog.record.playNamedRecording"),
        new PressItemButtonQuickPickAction("Recent recording 0", 1),
      ],
      inputBox: {
        inputBoxResponses: [
          "3",
        ],
        expectedInputBoxes: [
          {
            options: {
              prompt: "17",
              title: "Number of times to playback the recording",
              validateInputProvided: true,
            },
          },
        ],
      },
      quickPick: {
        expectedQuickPicks: [
          [
            recordingQuickPick({
              label: "Recent recording 0",
              recordBook: recordBook([
                new TypeRecord("abc"),
              ]),
              savable: true,
            }),
          ],
        ],
      },
    },
    {
      name: "Repeat n-times recording works with button for saved recording",
      text: [
        "def",
      ],
      expectedText: [
        "abcabcabcabcabcabcabcabcabcabcabcabcdef",
      ],
      expectedSelections: [
        selection(0, 36),
      ],
      userInteractions: [
        cmd("groog.record.startRecording"),
        type("abc"),
        cmd("groog.record.saveRecordingAs"),
        cmd("groog.record.playNamedRecording"),
        new PressItemButtonQuickPickAction("some-recording", 0),
      ],
      informationMessage: {
        expectedMessages: [
          `Recording saved as "some-recording"!`,
        ],
      },
      inputBox: {
        inputBoxResponses: [
          "some-recording",
          "11",
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
              prompt: "17",
              title: "Number of times to playback the recording",
              validateInputProvided: true,
            },
          },
        ],
      },
      quickPick: {
        expectedQuickPicks: [
          [
            recordingQuickPick({
              label: "Recent recording 0",
              recordBook: recordBook([
                new TypeRecord("abc"),
              ]),
              savable: true,
            }),
            recordingQuickPick({
              label: "some-recording",
              recordBook: recordBook([
                new TypeRecord("abc"),
              ]),
            }),
          ],
        ],
      },
    },
    {
      name: "Repeat n-times recording works with button for repeatable recording",
      text: [
        "abc",
        "def",
        "ghi",
        "abc",
        "def",
        "ghi",
        "abc",
        "def",
        "ghi",
        "abc",
        "def",
        "ghi",
      ],
      expectedText: [
        "abc",
        "defxyzxyz",
        "ghi",
        "abc",
        "defxyzxyz",
        "ghi",
        "abc",
        "defxyz",
        "ghi",
        "abc",
        "defxyz",
        "ghi",
      ],
      expectedSelections: [
        selection(4, 6),
      ],
      userInteractions: [
        cmd("groog.record.startRecording"),
        cmd("groog.find"),
        type("def"),
        ctrlG,
        ctrlG,
        type("xyz"),
        cmd("groog.record.endRecording"),
        cmd("groog.record.playNamedRecording"),
        new PressItemButtonQuickPickAction("Recent recording 0", 2),
      ],
      inputBox: {
        inputBoxResponses: [
          "5",
        ],
        expectedInputBoxes: [
          {
            options: {
              title: "Number of times to playback the recording (4 matches found)",
              value: "4",
              prompt: undefined,
              validateInputProvided: true,
            },
          },
        ],
      },
      quickPick: {
        expectedQuickPicks: [
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
            "1 of 4",
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
                }, 4, 1),
                new CommandRecord("groog.ctrlG"),
                new TypeRecord("xyz"),
              ]),
              savable: true,
              repeatable: true,
            }),
          ],
        ],
      },
    },
    {
      name: "Repeat findable recording n times when n < numberOfMatches",
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
        ".xyzabc...abc.....",
      ],
      expectedSelections: [
        selection(4, 4),
      ],
      userInteractions: [
        cmd("groog.record.startRecording"),
        cmd("groog.find"),
        type("abc"),
        ctrlG,
        cmd("groog.deleteLeft"),
        type("xyz"),
        cmd("groog.record.endRecording"),
        cmd("groog.record.playRecordingNTimes"),
      ],
      quickPick: {
        expectedQuickPicks: [
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
      },
      inputBox: {
        inputBoxResponses: [
          "2",
        ],
        expectedInputBoxes: [
          {
            options: {
              prompt: undefined,
              title: "Number of times to playback the recording (4 matches found)",
              value: "4",
              validateInputProvided: true,
            },
          },
        ],
      },
    },
    {
      name: "Repeat findable recording n times when n == numberOfMatches",
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
        cmd("groog.record.playRecordingNTimes"),
      ],
      quickPick: {
        expectedQuickPicks: [
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
      },
      inputBox: {
        inputBoxResponses: [
          "4",
        ],
        expectedInputBoxes: [
          {
            options: {
              prompt: undefined,
              title: "Number of times to playback the recording (4 matches found)",
              value: "4",
              validateInputProvided: true,
            },
          },
        ],
      },
    },
    {
      name: "Repeat findable recording n times when n > numberOfMatches",
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
        cmd("groog.record.playRecordingNTimes"),
      ],
      quickPick: {
        expectedQuickPicks: [
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
      },
      inputBox: {
        inputBoxResponses: [
          "10",
        ],
        expectedInputBoxes: [
          {
            options: {
              prompt: undefined,
              title: "Number of times to playback the recording (4 matches found)",
              value: "4",
              validateInputProvided: true,
            },
          },
        ],
      },
      errorMessage: {
        expectedMessages: [
          "No match found during recording playback",
        ],
      },
    },
    // SaveRecentRecordingButton
    {
      name: "Fails if unknown button",
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
        // press unknown button on Recent recording 0
        new PressUnknownButtonQuickPickAction("Recent recording 0"),
      ],
      quickPick: {
        expectedQuickPicks: [
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
      },
      errorMessage: {
        expectedMessages: [
          `Unknown item button`,
        ],
      },
    },
    {
      name: "Save a recent recording",
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
        new PressItemButtonQuickPickAction("Recent recording 1", 0),
        cmd("groog.record.playNamedRecording"),
        new SelectItemQuickPickAction(["My favorite recording"]),
      ],
      expectedSelections: [selection(5, 4)],
      inputBox: {
        inputBoxResponses: [
          "My favorite recording",
        ],
        expectedInputBoxes: [
          {
            options: {
              placeHolder: "Recording name",
              title: "Save recording as:",
              validateInputProvided: true,
            },
          },
        ],
      },
      quickPick: {
        expectedQuickPicks: [
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
                }, 1, 0),
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
                }, 0, -1),
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
                }, 0, -1),
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
                }, 1, 0),
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
                }, 0, -1),
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
                }, 1, 0),
                new TypeRecord("deux"),
              ]),
              repeatable: true,
            }),
          ],
        ],
      },
      informationMessage: {
        expectedMessages: [
          `Recording saved as "My favorite recording"!`,
        ],
      },
    },
    {
      name: "Playback a recent recording",
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
        // Run second to last recording (ghi)
        new SelectItemQuickPickAction(["Recent recording 1"]),
      ],
      expectedSelections: [selection(0, 15)],
      quickPick: {
        expectedQuickPicks: [
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
      text: [
        "start text",
      ],
      expectedText: [
        "start text",
      ],
      userInteractions: [
        cmd("groog.record.undo"),
      ],
      errorMessage: {
        expectedMessages: [
          `No recordings exist yet!`,
        ],
      },
    },
    {
      name: "Record undo fails if recording is locked",
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
      errorMessage: {
        expectedMessages: [
          `Cannot undo a locked recording`,
        ],
      },
    },
    {
      name: "Record undo does nothing if empty record book",
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
    {
      name: "Record undo works if recording is locked",
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
    {
      name: "Record undo fails",
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
      informationMessage: {
        expectedMessages: [
          `Undo failed`,
        ],
      },
    },
    // Type-over tests
    {
      name: "Typing a bracket automatically adds a closing bracket",
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
    {
      name: "Typing a bracket at the end of a line automatically adds a closing bracket",
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
    {
      name: "Typing a bracket not at the end of a line automatically only adds opening bracket",
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
    {
      name: "Typing a bracket at the end of a line, ignoring whitespace characters, adds closing bracket",
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
    {
      name: "Typing a bracket over selection simply adds bracket",
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
    {
      name: "Typing a bracket over multiple selections only adds brackets to empty selections",
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
    {
      name: "Groog commands with multiple selections work",
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
    {
      name: "Types over type-overable characters",
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
    {
      name: "Does not type over when character not type-overable",
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
    {
      name: "Does not type over when next character is different",
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
    // Type over while recording tests
    {
      name: "Does not type over when recording or playing back",
      text: [
        "}",
        "",
        "}",
        "",
        "}",
        "",
        "}}}",
        "abcde",
        "012345",
      ],
      expectedText: [
        // Lines edited while not recording
        "}",
        "}",
        // Lines edited while recording
        "}}",
        "}",
        // Lines edited during first playback
        "end}}",
        "}",
        // Lines edited during second playback
        "}}}}",
        "a}bcde",
        "012345",
      ],
      expectedSelections: [selection(8, 0)],
      userInteractions: [
        // Type it without recording
        type("}"),
        cmd('groog.cursorDown'),
        type("}"),
        cmd('groog.cursorDown'),
        cmd('groog.cursorHome'),
        // Type it with recording
        cmd("groog.record.startRecording"),
        type("}"),
        cmd('groog.cursorDown'),
        type("}"),
        cmd('groog.cursorDown'),
        cmd('groog.cursorHome'),
        cmd("groog.record.endRecording"),
        // Type other stuff
        type("end"),
        // Playback the recording
        cmd("groog.record.playRecording"),
        cmd("groog.record.playRecording"),
      ],
    },
    // Delete right at end of line
    {
      name: "deleteRight removes single non-whitespace character if trailing characters aren't all whitespace",
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
    {
      name: "deleteWordRight removes single word if trailing characters aren't all whitespace",
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
    {
      name: "deleteRight removes single whitespace character if trailing characters aren't all whitespace",
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
    {
      name: "deleteWordRight removes single word if trailing characters aren't all whitespace",
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
    {
      name: "deleteRight removes newline",
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
    {
      name: "deleteRight removes trailing whitespace and newline",
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
    {
      name: "deleteRight removes preceding whitespace and newline",
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
    {
      name: "deleteRight removes trailing whitespace, preceding whitespace, and newline",
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
    {
      name: "deleteWordRight removes trailing whitespace, preceding whitespace, and newline",
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
    {
      name: "deleteRight does nothing if at the end of the document",
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
    {
      name: "deleteWordRight does nothing if at the end of the document",
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
    {
      name: "deleteRight deletes whitespace if at the end of the document",
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
    {
      name: "deleteWordRight deletes whitespace if at the end of the document",
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
    {
      name: "deleteRight deletes only one character if at the last line of the document and non-whitespace characters after",
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
    {
      name: "deleteWordRight deletes only one character if at the last line of the document and non-whitespace characters after",
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
    // Notification tests
    {
      name: "Notification fails if no args",
      userInteractions: [
        cmd("groog.message.info"),
      ],
      errorMessage: {
        expectedMessages: [
          "No message set",
        ],
      },
    },
    {
      name: "Notification fails if no message",
      userInteractions: [
        cmd("groog.message.info", {}),
      ],
      errorMessage: {
        expectedMessages: [
          "No message set",
        ],
      },
    },
    {
      name: "Notification fails if wrong args",
      userInteractions: [
        cmd("groog.message.info", {
          badKey: "hello there",
        }),
      ],
      errorMessage: {
        expectedMessages: [
          "No message set",
        ],
      },
    },
    {
      name: "Notification fails if empty message",
      userInteractions: [
        cmd("groog.message.info", {
          message: "",
        }),
      ],
      errorMessage: {
        expectedMessages: [
          "No message set",
        ],
      },
    },
    {
      name: "Notification is sent",
      userInteractions: [
        cmd("groog.message.info", {
          message: "Hello there",
        }),
      ],
      informationMessage: {
        expectedMessages: [
          "Hello there",
        ],
      },
    },
    {
      name: "Error notification is sent",
      userInteractions: [
        cmd("groog.message.info", {
          message: "General Kenobi",
          error: true,
        }),
      ],
      errorMessage: {
        expectedMessages: [
          "General Kenobi",
        ],
      },
    },
    // Copy file name/link tests
    {
      name: "Fails to copy file name if no editor",
      userInteractions: [
        cmd("groog.copyFilePath"),
      ],
      errorMessage: {
        expectedMessages: [
          "No active editor",
        ],
      },
    },
    {
      name: "Fails to copy file link if no editor",
      userInteractions: [
        cmd("groog.copyFileLink"),
      ],
      errorMessage: {
        expectedMessages: [
          "No active editor",
        ],
      },
    },
    {
      name: "Fails to copy file name if exec error",
      file: startingFile("empty.go"),
      expectedText: [
        "package main",
        "",
        "func main() {",
        "",
        "}",
        "",
      ],
      execStubs: [{
        wantArgs: `cd ${startingFile().replace(/^C/, 'c')} && git ls-remote --get-url`,
        err: "oops",
      }],
      errorMessage: {
        expectedMessages: [
          `Failed to get git repository info: oops; stderr:\n`,
        ],
      },
      userInteractions: [
        cmd("groog.copyFilePath"),
      ],
    },
    {
      name: "Fails to copy file link if exec error",
      file: startingFile("empty.go"),
      expectedText: [
        "package main",
        "",
        "func main() {",
        "",
        "}",
        "",
      ],
      execStubs: [{
        wantArgs: `cd ${startingFile().replace(/^C/, 'c')} && git ls-remote --get-url`,
        err: "oops",
      }],
      errorMessage: {
        expectedMessages: [
          `Failed to get git repository info: oops; stderr:\n`,
        ],
      },
      userInteractions: [
        cmd("groog.copyFileLink"),
      ],
    },
    {
      name: "Fails to copy file name if exec stderr",
      file: startingFile("empty.go"),
      expectedText: [
        "package main",
        "",
        "func main() {",
        "",
        "}",
        "",
      ],
      execStubs: [{
        wantArgs: `cd ${startingFile().replace(/^C/, 'c')} && git ls-remote --get-url`,
        stderr: "whoops",
      }],
      errorMessage: {
        expectedMessages: [
          `Failed to get git repository info: undefined; stderr:\nwhoops`,
        ],
      },
      userInteractions: [
        cmd("groog.copyFilePath"),
      ],
    },
    {
      name: "Fails to copy file link if exec stderr",
      file: startingFile("empty.go"),
      expectedText: [
        "package main",
        "",
        "func main() {",
        "",
        "}",
        "",
      ],
      execStubs: [{
        wantArgs: `cd ${startingFile().replace(/^C/, 'c')} && git ls-remote --get-url`,
        stderr: "whoops",
      }],
      errorMessage: {
        expectedMessages: [
          `Failed to get git repository info: undefined; stderr:\nwhoops`,
        ],
      },
      userInteractions: [
        cmd("groog.copyFileLink"),
      ],
    },
    {
      name: "Copies file path",
      file: startingFile("empty.go"),
      expectedText: [
        "package main",
        "src/test/test-workspace/empty.go",
        "func main() {",
        "",
        "}",
        "",
      ],
      selections: [selection(1, 0)],
      expectedSelections: [selection(1, 32)],
      execStubs: [{
        wantArgs: `cd ${startingFile().replace(/^C/, 'c')} && git ls-remote --get-url`,
        stdout: "git@github.com:some-user/arbitrary-repo/path.git",
      }],
      informationMessage: {
        expectedMessages: [
          `File path copied!`,
        ],
      },
      userInteractions: [
        cmd("groog.copyFilePath"),
        cmd("groog.paste"),
      ],
    },
    {
      name: "Copies file link for git",
      file: startingFile("empty.go"),
      expectedText: [
        "package main",
        "https://www.github.com/some-user/arbitrary-repo/path/blob/main/src/test/test-workspace/empty.go#L2",
        "func main() {",
        "",
        "}",
        "",
      ],
      selections: [selection(1, 0)],
      expectedSelections: [selection(1, 98)],
      execStubs: [{
        wantArgs: `cd ${startingFile().replace(/^C/, 'c')} && git ls-remote --get-url`,
        stdout: "git@github.com:some-user/arbitrary-repo/path.git",
      }],
      informationMessage: {
        expectedMessages: [
          `File link copied!`,
        ],
      },
      userInteractions: [
        cmd("groog.copyFileLink"),
        cmd("groog.paste"),
      ],
    },
    {
      name: "Copies file link for http",
      file: startingFile("empty.go"),
      expectedText: [
        "package main",
        "https://www.github.com/some-user/arbitrary-repo/path/blob/main/src/test/test-workspace/empty.go#L2",
        "func main() {",
        "",
        "}",
        "",
      ],
      selections: [selection(1, 0)],
      expectedSelections: [selection(1, 98)],
      execStubs: [{
        wantArgs: `cd ${startingFile().replace(/^C/, 'c')} && git ls-remote --get-url`,
        stdout: "https://www.github.com/some-user/arbitrary-repo/path.git",
      }],
      informationMessage: {
        expectedMessages: [
          `File link copied!`,
        ],
      },
      userInteractions: [
        cmd("groog.copyFileLink"),
        cmd("groog.paste"),
      ],
    },
    {
      name: "Copies file link from more nested directory",
      file: startingFile("copy-imports", "BlockComment.java"),
      expectedText: [
        `/* Block`,
        ` * comment`,
        ` */`,
        `package copy.imports.comment; /* Suffix block comment */`,
        `/* Another block comment */`,
        `https://www.github.com/some-user/arbitrary-repo/path/blob/main/src/test/test-workspace/copy-imports/BlockComment.java#L3-L5`,
      ],
      selections: [new vscode.Selection(2, 2, 4, 1)],
      expectedSelections: [selection(5, 123)],
      execStubs: [{
        wantArgs: `cd ${startingFile("copy-imports").replace(/^C/, 'c')} && git ls-remote --get-url`,
        stdout: "git@github.com:some-user/arbitrary-repo/path.git",
      }],
      informationMessage: {
        expectedMessages: [
          `File link copied!`,
        ],
      },
      userInteractions: [
        cmd("groog.copyFileLink"),
        cmd("groog.cursorBottom"),
        cmd("groog.paste"),
      ],
    },
    // Copy imports test
    {
      name: "Fails to copy import if no editor",
      userInteractions: [
        cmd("groog.copyImport"),
      ],
      errorMessage: {
        expectedMessages: [
          "No active editor",
        ],
      },
    },
    {
      name: "Fails to copy import if not a supported language",
      file: startingFile("empty.go"),
      expectedText: [
        "package main",
        "",
        "func main() {",
        "",
        "}",
        "",
      ],
      userInteractions: [
        cmd("groog.copyImport"),
      ],
      errorMessage: {
        expectedMessages: [
          'No import copy support for language (go)',
        ],
      },
    },
    {
      name: "Successfully copies import",
      file: startingFile("copy-imports", "SimplePackage.java"),
      expectedText: [
        "package copy.imports.simple;",
        // Added
        "import copy.imports.simple.SimplePackage;",
      ],
      selections: [selection(1, 0)],
      expectedSelections: [selection(1, 41)],
      userInteractions: [
        cmd("groog.copyImport"),
        cmd("groog.paste"),
      ],
    },
    {
      name: "Successfully copies import ignoring whitespace",
      file: startingFile("copy-imports", "Whitespace.java"),
      expectedText: [
        "package   copy.imports.ws    ;  ",
        // Added
        "import copy.imports.ws.Whitespace;",
      ],
      selections: [selection(1, 0)],
      expectedSelections: [selection(1, 34)],
      userInteractions: [
        cmd("groog.copyImport"),
        cmd("groog.paste"),
      ],
    },
    {
      name: "Successfully copies import ignoring comments",
      file: startingFile("copy-imports", "Comment.java"),
      expectedText: [
        "// Package comment",
        "package copy.imports.comment; // Hello there",
        "// More comments",
        // Added
        "import copy.imports.comment.Comment;",
      ],
      selections: [selection(3, 0)],
      expectedSelections: [selection(3, 36)],
      userInteractions: [
        cmd("groog.copyImport"),
        cmd("groog.paste"),
      ],
    },
    {
      name: "Successfully copies import ignoring block comments",
      file: startingFile("copy-imports", "BlockComment.java"),
      expectedText: [
        '/* Block',
        ' * comment',
        ` ${endCommentString}`,
        `package copy.imports.comment; /* Suffix block comment ${endCommentString}`,
        `/* Another block comment ${endCommentString}`,
        // Added
        "import copy.imports.comment.BlockComment;",
      ],
      selections: [selection(5, 0)],
      expectedSelections: [selection(5, 41)],
      userInteractions: [
        cmd("groog.copyImport"),
        cmd("groog.paste"),
      ],
    },
    {
      name: "Fails to copy import if no package",
      file: startingFile("copy-imports", "Missing.java"),
      expectedText: [
        'public class Missing {}',
        // Added
        '',
      ],
      userInteractions: [
        cmd("groog.copyImport"),
      ],
      errorMessage: {
        expectedMessages: [
          'No import statement found!',
        ],
      },
    },
    // groog.trimClipboard tests
    // Use `editor.action.clipboardPasteAction` instead of `groog.paste` because we're
    // testing the raw clipboard value (not groog.paste logic, e.g. whitespace indenting/custom trimming)
    {
      skipBecauseOfPaste: true,
      name: "Trims the clipboard of whitespace",
      text: [
        ' \t abc\t def\t \t',
        '',
      ],
      expectedText: [
        ' \t abc\t def\t \t',
        'abc\t def',
      ],
      expectedSelections: [selection(1, 8)],
      userInteractions: [
        cmd('groog.toggleMarkMode'),
        cmd('groog.cursorEnd'),
        cmd("editor.action.clipboardCopyAction"),
        ctrlG,
        cmd('groog.cursorEnd'),
        cmd('groog.cursorRight'),
        cmd("groog.trimClipboard"),
        cmd("editor.action.clipboardPasteAction"),
      ],
    },
    {
      skipBecauseOfPaste: true,
      name: "Trims the clipboard of whitespace and newlines",
      text: [
        'abc def\t \t',
        '\t \t ',
        '',
      ],
      expectedText: [
        'abc def\t \t',
        '\t \t ',
        '',
        'abc def\t \t',
        '\t \t ',
        '',
        'abc def',
      ],
      expectedSelections: [selection(6, 7)],
      userInteractions: [
        cmd('groog.toggleMarkMode'),
        cmd('groog.cursorDown'),
        cmd('groog.cursorDown'),
        cmd("editor.action.clipboardCopyAction"),
        ctrlG,
        type('\n'),
        cmd("editor.action.clipboardPasteAction"),
        type('\n'),
        cmd("groog.trimClipboard"),
        cmd("editor.action.clipboardPasteAction"),
      ],
    },
    // groog.clearRunSolo tests
    {
      name: "Fails to clear run solo if no editor",
      userInteractions: [
        cmd("groog.clearRunSolo"),
      ],
      errorMessage: {
        expectedMessages: [
          "No active editor",
        ],
      },
    },
    {
      name: "Clears all instancds of 'runSolo: true'",
      text: [
        'hello',
        // Minimal text
        'runSolo:true',
        'abc',
        // Minimal text with comma
        'runSolo:true,',
        'def',
        'ghi',
        // Regular
        '  runSolo: true,',
        // Lots of whitespace
        '\t \trunSolo\t \t: \t true \t ',
        'jkl',
        // Lots of whitespace with comma
        '\t \trunSolo\t \t: \t true \t , \t ',
      ],
      expectedText: [
        'hello',
        'abc',
        'def',
        'ghi',
        'jkl',
      ],
      userInteractions: [
        cmd("groog.clearRunSolo"),
      ],
    },
    // Multi-command tests
    {
      name: "Runs multi-command",
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
      informationMessage: {
        expectedMessages: [
          "hi",
        ],
      },
    },
    // Test file tests
    {
      name: "Fails to run test file if no previous file set",
      userInteractions: [
        cmd("groog.testFile"),
      ],
      errorMessage: {
        expectedMessages: [
          "Previous file not set",
        ],
      },
    },
    {
      name: "Fails to run test file if unsupported file suffix",
      userInteractions: [
        openFile(startingFile("greetings.txt")),
        cmd("groog.testFile"),
      ],
      expectedText: [
        "Hello there",
        "",
      ],
      errorMessage: {
        expectedMessages: [
          "Unknown file suffix: txt",
        ],
      },
    },
    {
      name: "Fails to run test file if unsupported file suffix (message displayed at part 0)",
      userInteractions: [
        openFile(startingFile("greetings.txt")),
        cmd("groog.testFile", { part: 0 }),
      ],
      expectedText: [
        "Hello there",
        "",
      ],
      errorMessage: {
        expectedMessages: [
          "Unknown file suffix: txt",
        ],
      },
    },
    {
      name: "Fails to run test file if unsupported file suffix (no message displayed at part 1)",
      userInteractions: [
        openFile(startingFile("greetings.txt")),
        cmd("groog.testFile", { part: 1 }),
      ],
      expectedText: [
        "Hello there",
        "",
      ],
    },
    {
      name: "Fails to run test file if go file suffix",
      userInteractions: [
        openFile(startingFile("empty.go")),
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
      errorMessage: {
        expectedMessages: [
          "go testing should be routed to custom command in keybindings.go",
        ],
      },
    },
    {
      name: "Doesn't toggle fixed test file if no file visited",
      userInteractions: [
        cmd("groog.toggleFixedTestFile"),
      ],
      errorMessage: {
        expectedMessages: [
          "No active file",
        ],
      },
    },
    {
      name: "Toggles fixed test file to current active file",
      expectedText: [""],
      userInteractions: [
        openFile(startingFile("bloop.java")),
        cmd("groog.toggleFixedTestFile"),
      ],
      informationMessage: {
        expectedMessages: [
          `Set fixed test file to bloop.java`,
        ],
      },
    },
    {
      name: "Toggles ignore test file to false",
      expectedText: [""],
      userInteractions: [
        openFile(startingFile("bloop.java")),
        cmd("groog.toggleFixedTestFile"),
        cmd("groog.toggleFixedTestFile"),
      ],
      informationMessage: {
        expectedMessages: [
          `Set fixed test file to bloop.java`,
          "Unset fixed test file",
        ],
      },
    },
    // Scripts tests
    {
      name: "Newline replacement fails if no editor",
      userInteractions: [
        cmd("groog.script.replaceNewlineStringsWithQuotes"),
      ],
      errorMessage: {
        expectedMessages: [
          "No active text editor.",
        ],
      },
    },
    {
      name: "Runs newline replacement with quotes",
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
    {
      name: "Runs newline replacement with ticks",
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
    {
      name: "Updates settings when can't find word separators",
      userInteractions: [
        cmd("groog.updateSettings"),
      ],
      informationMessage: {
        expectedMessages: [
          `Settings have been updated!`,
        ],
      },
      errorMessage: {
        expectedMessages: [
          `Failed to fetch editor.wordSeparators setting`,
        ],
      },
      workspaceConfiguration: {
        expectedWorkspaceConfiguration: {
          configuration: new Map<vscode.ConfigurationTarget, Map<string, any>>([
            [vscode.ConfigurationTarget.Global, new Map<string, any>([
              ['coverage-gutters', new Map<string, any>([
                ['showLineCoverage', true],
                ['showGutterCoverage', false],
                ['showRulerCoverage', true],
              ])],
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
                  ['scrollback', 10000],
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
                  ['copyOnSelection', true],
                  ['defaultProfile', new Map<string, any>([
                    ['windows', 'PowerShell'],
                  ])],
                  ['profiles', new Map<string, any>([
                    ['windows', {
                      MinGW: {
                        args: ['--login', '-i'],
                        color: 'terminal.ansiGreen',
                        env: {
                          GROOG_VSCODE: '1',
                        },
                        icon: 'hubot',
                        overrideName: true,
                        path: 'C:\\msys64\\usr\\bin\\bash.exe',
                      },
                    }],
                  ])],
                ])],
              ])],
              ['window', new Map<string, any>([
                ['newWindowDimensions', 'maximized'],
              ])],
              ['workbench', new Map<string, any>([
                ['colorCustomizations', {
                  'editor.lineHighlightBorder': '#707070',
                  'editorGutter.background': '#000000',
                  'editorLineNumber.activeForeground': '#00ffff',
                  'terminal.findMatchBackground': '#bb00bb',
                  'terminal.findMatchHighlightBackground': '#00bbbb',
                }],
                ['editor', new Map<string, any>([
                  ['limit', new Map<string, any>([
                    ['enabled', true],
                    ['perEditorGroup', true],
                    ['value', 1],
                  ])],
                  ['showTabs', false],
                ])],
                ['startupEditor', 'none'],
              ])],
            ])],
          ]),
          languageConfiguration: new Map<string, Map<vscode.ConfigurationTarget, Map<string, any>>>([
            ['typescript', new Map<vscode.ConfigurationTarget, Map<string, any>>([
              [vscode.ConfigurationTarget.Global, new Map<string, any>([
                ['editor', new Map<string, any>([
                  ['formatOnSave', true],
                ])],
              ])],
            ])],
          ]),
        },
      },
    },
    {
      name: "Updates settings when can find word separators (and adds underscore to the list)",
      userInteractions: [
        cmd("groog.updateSettings"),
      ],
      informationMessage: {
        expectedMessages: [
          `Settings have been updated!`,
        ],
      },
      workspaceConfiguration: {
        workspaceConfiguration: {
          configuration: new Map<vscode.ConfigurationTarget, Map<string, any>>([
            [vscode.ConfigurationTarget.Global, new Map<string, any>([
              ["editor", new Map<string, any>([
                ['wordSeparators', ' .?'],
              ])],
            ])],
          ]),
        },
        expectedWorkspaceConfiguration: {
          configuration: new Map<vscode.ConfigurationTarget, Map<string, any>>([
            [vscode.ConfigurationTarget.Global, new Map<string, any>([
              ['coverage-gutters', new Map<string, any>([
                ['showLineCoverage', true],
                ['showGutterCoverage', false],
                ['showRulerCoverage', true],
              ])],
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
                ['wordSeparators', ' .?_'],
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
                  ['scrollback', 10000],
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
                  ['copyOnSelection', true],
                  ['defaultProfile', new Map<string, any>([
                    ['windows', 'PowerShell'],
                  ])],
                  ['profiles', new Map<string, any>([
                    ['windows', {
                      MinGW: {
                        args: ['--login', '-i'],
                        color: 'terminal.ansiGreen',
                        env: {
                          GROOG_VSCODE: '1',
                        },
                        icon: 'hubot',
                        overrideName: true,
                        path: 'C:\\msys64\\usr\\bin\\bash.exe',
                      },
                    }],
                  ])],
                ])],
              ])],
              ['window', new Map<string, any>([
                ['newWindowDimensions', 'maximized'],
              ])],
              ['workbench', new Map<string, any>([
                ['colorCustomizations', {
                  'editor.lineHighlightBorder': '#707070',
                  'editorGutter.background': '#000000',
                  'editorLineNumber.activeForeground': '#00ffff',
                  'terminal.findMatchBackground': '#bb00bb',
                  'terminal.findMatchHighlightBackground': '#00bbbb',
                }],
                ['editor', new Map<string, any>([
                  ['limit', new Map<string, any>([
                    ['enabled', true],
                    ['perEditorGroup', true],
                    ['value', 1],
                  ])],
                  ['showTabs', false],
                ])],
                ['startupEditor', 'none'],
              ])],
            ])],
          ]),
          languageConfiguration: new Map<string, Map<vscode.ConfigurationTarget, Map<string, any>>>([
            ['typescript', new Map<vscode.ConfigurationTarget, Map<string, any>>([
              [vscode.ConfigurationTarget.Global, new Map<string, any>([
                ['editor', new Map<string, any>([
                  ['formatOnSave', true],
                ])],
              ])],
            ])],
          ]),
        },
      },
    },
    {
      name: "Updates settings when word separators already contains an underscore",
      userInteractions: [
        cmd("groog.updateSettings"),
      ],
      informationMessage: {
        expectedMessages: [
          `Settings have been updated!`,
        ],
      },
      workspaceConfiguration: {
        workspaceConfiguration: {
          configuration: new Map<vscode.ConfigurationTarget, Map<string, any>>([
            [vscode.ConfigurationTarget.Global, new Map<string, any>([
              ["editor", new Map<string, any>([
                ['wordSeparators', ' ._?'],
              ])],
            ])],
          ]),
        },
        expectedWorkspaceConfiguration: {
          configuration: new Map<vscode.ConfigurationTarget, Map<string, any>>([
            [vscode.ConfigurationTarget.Global, new Map<string, any>([
              ['coverage-gutters', new Map<string, any>([
                ['showLineCoverage', true],
                ['showGutterCoverage', false],
                ['showRulerCoverage', true],
              ])],
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
                ['wordSeparators', ' ._?'],
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
                  ['scrollback', 10000],
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
                  ['copyOnSelection', true],
                  ['defaultProfile', new Map<string, any>([
                    ['windows', 'PowerShell'],
                  ])],
                  ['profiles', new Map<string, any>([
                    ['windows', {
                      MinGW: {
                        args: ['--login', '-i'],
                        color: 'terminal.ansiGreen',
                        env: {
                          GROOG_VSCODE: '1',
                        },
                        icon: 'hubot',
                        overrideName: true,
                        path: 'C:\\msys64\\usr\\bin\\bash.exe',
                      },
                    }],
                  ])],
                ])],
              ])],
              ['window', new Map<string, any>([
                ['newWindowDimensions', 'maximized'],
              ])],
              ['workbench', new Map<string, any>([
                ['colorCustomizations', {
                  'editor.lineHighlightBorder': '#707070',
                  'editorGutter.background': '#000000',
                  'editorLineNumber.activeForeground': '#00ffff',
                  'terminal.findMatchBackground': '#bb00bb',
                  'terminal.findMatchHighlightBackground': '#00bbbb',
                }],
                ['editor', new Map<string, any>([
                  ['limit', new Map<string, any>([
                    ['enabled', true],
                    ['perEditorGroup', true],
                    ['value', 1],
                  ])],
                  ['showTabs', false],
                ])],
                ['startupEditor', 'none'],
              ])],
            ])],
          ]),
          languageConfiguration: new Map<string, Map<vscode.ConfigurationTarget, Map<string, any>>>([
            ['typescript', new Map<vscode.ConfigurationTarget, Map<string, any>>([
              [vscode.ConfigurationTarget.Global, new Map<string, any>([
                ['editor', new Map<string, any>([
                  ['formatOnSave', true],
                ])],
              ])],
            ])],
          ]),
        },
      },
    },
    // Jump and fall tests
    {
      name: "Jump jumps ten lines by default",
      text: fileGrid(20, 3),
      expectedText: fileGrid(20, 3),
      selections: [selection(17, 1)],
      expectedSelections: [selection(7, 1)],
      userInteractions: [
        cmd("groog.jump"),
      ],
    },
    {
      name: "Fall falls ten lines by default",
      text: fileGrid(20, 3),
      expectedText: fileGrid(20, 3),
      selections: [selection(7, 1)],
      expectedSelections: [selection(17, 1)],
      userInteractions: [
        cmd("groog.fall"),
      ],
    },
    {
      name: "Jump goes to beginning of line if too few lines above",
      text: fileGrid(15, 3),
      expectedText: fileGrid(15, 3),
      selections: [selection(4, 2)],
      expectedSelections: [selection(0, 0)],
      userInteractions: [
        cmd("groog.jump"),
      ],
    },
    {
      name: "Fall goes to end of line if too few lines below",
      text: fileGrid(15, 3),
      expectedText: fileGrid(15, 3),
      selections: [selection(11, 1)],
      expectedSelections: [selection(14, 3)],
      userInteractions: [
        cmd("groog.fall"),
      ],
    },
    {
      name: "Jump jumps a custom amount",
      text: fileGrid(15, 3),
      expectedText: fileGrid(15, 3),
      selections: [selection(9, 2)],
      expectedSelections: [selection(5, 2)],
      userInteractions: [
        cmd("groog.jump", {
          lines: 4,
        }),
      ],
    },
    {
      name: "Fall falls a custom amount",
      text: fileGrid(15, 3),
      expectedText: fileGrid(15, 3),
      selections: [selection(9, 2)],
      expectedSelections: [selection(13, 2)],
      userInteractions: [
        cmd("groog.fall", {
          lines: 4,
        }),
      ],
    },
    // Yank, tug, kill, and maim tests
    {
      name: "Yank when no editor does nothing",
      userInteractions: [
        cmd("groog.yank"),
      ],
    },
    {
      name: "Kill when no editor does nothing",
      userInteractions: [
        cmd("groog.kill"),
      ],
    },
    {
      name: "Kill when no text does nothing editor does nothing",
      text: [
        "abc",
      ],
      expectedText: [
        "abcdefabcghiabc",
      ],
      expectedSelections: [selection(0, 15)],
      userInteractions: [
        cmd("groog.kill"),
        cmd("groog.emacsPaste"),
        type("def"),
        cmd("groog.emacsPaste"),
        cmd("groog.kill"), // Kill at end of line so nothing to get
        type("ghi"),
        cmd("groog.emacsPaste"), // Should still paste 'abc'
      ],
    },
    {
      name: "Maim",
      text: [
        "abcdef",
      ],
      selections: [selection(0, 3)],
      expectedText: [
        "adefbcdef",
      ],
      expectedSelections: [selection(0, 4)],
      userInteractions: [
        cmd("groog.maim"),
        cmd("groog.cursorLeft"),
        cmd("groog.cursorLeft"),
        cmd("groog.emacsPaste"),
      ],
    },
    {
      name: "Tug",
      text: [
        "abcdef",
      ],
      selections: [new vscode.Selection(0, 2, 0, 4)],
      expectedText: [
        "cdabcdef",
      ],
      expectedSelections: [selection(0, 2)],
      userInteractions: [
        cmd("groog.tug"),
        cmd("groog.cursorHome"),
        cmd("groog.emacsPaste"),
      ],
    },
    {
      name: "Highlighting is ended after tugging when active cursor in front",
      text: [
        "abcdef",
      ],
      selections: [new vscode.Selection(0, 2, 0, 4)],
      expectedText: [
        "abcdef",
      ],
      expectedSelections: [selection(0, 4)],
      userInteractions: [
        cmd("groog.tug"),
      ],
    },
    {
      name: "Highlighting is ended after tugging when active cursor in back",
      text: [
        "abcdef",
      ],
      selections: [new vscode.Selection(0, 5, 0, 3)],
      expectedText: [
        "abcdef",
      ],
      expectedSelections: [selection(0, 3)],
      userInteractions: [
        cmd("groog.tug"),
      ],
    },
    // Yank/tug word tests
    {
      name: "Yanks empty string when not in a word",
      text: [
        "123 abc  def_ghi-jkl",
        "____________________",
      ],
      selections: [selection(0, 8)],
      userInteractions: [
        cmd("groog.yank"),
        cmd("groog.cursorDown"),
        cmd("groog.emacsPaste"),
      ],
      expectedText: [
        "123 abc  def_ghi-jkl",
        "____________________",
      ],
      expectedSelections: [selection(1, 8)],
    },
    {
      name: "Tugs empty string when not in a word",
      text: [
        "123 abc  def_ghi-jkl",
        "____________________",
      ],
      selections: [selection(0, 8)],
      userInteractions: [
        cmd("groog.tug"),
        cmd("groog.cursorDown"),
        cmd("groog.emacsPaste"),
      ],
      expectedText: [
        "123 abc  def_ghi-jkl",
        "____________________",
      ],
      expectedSelections: [selection(1, 8)],
    },
    {
      name: "Yanks word when at beginning of word",
      text: [
        "123 abc  def_ghi-jkl",
        "____________________",
      ],
      selections: [selection(0, 9)],
      userInteractions: [
        cmd("groog.yank"),
        cmd("groog.cursorDown"),
        cmd("groog.emacsPaste"),
      ],
      expectedText: [
        "123 abc  -jkl",
        "_________def_ghi___________",
      ],
      expectedSelections: [selection(1, 16)],
    },
    {
      name: "Tugs word when at beginning of word",
      text: [
        "123 abc  def_ghi-jkl",
        "____________________",
      ],
      selections: [selection(0, 9)],
      userInteractions: [
        cmd("groog.tug"),
        cmd("groog.cursorDown"),
        cmd("groog.emacsPaste"),
      ],
      expectedText: [
        "123 abc  def_ghi-jkl",
        "_________def_ghi___________",
      ],
      expectedSelections: [selection(1, 16)],
    },
    {
      name: "Yanks word when at end of word",
      text: [
        "123 abc  def_ghi-jkl",
        "____________________",
      ],
      selections: [selection(0, 7)],
      userInteractions: [
        cmd("groog.yank"),
        cmd("groog.cursorDown"),
        cmd("groog.emacsPaste"),
      ],
      expectedText: [
        "123   def_ghi-jkl",
        "____abc________________",
      ],
      expectedSelections: [selection(1, 7)],
    },
    {
      name: "Tugs word when at end of word",
      text: [
        "123 abc  def_ghi-jkl",
        "____________________",
      ],
      selections: [selection(0, 7)],
      userInteractions: [
        cmd("groog.tug"),
        cmd("groog.cursorDown"),
        cmd("groog.emacsPaste"),
      ],
      expectedText: [
        "123 abc  def_ghi-jkl",
        "_______abc_____________",
      ],
      expectedSelections: [selection(1, 10)],
    },
    {
      name: "Yanks word when at beginning of word, next to symbol",
      text: [
        "123 abc  def_ghi-jkl",
        "____________________",
      ],
      selections: [selection(0, 17)],
      userInteractions: [
        cmd("groog.yank"),
        cmd("groog.cursorDown"),
        cmd("groog.emacsPaste"),
      ],
      expectedText: [
        "123 abc  def_ghi-",
        "_________________jkl___",
      ],
      expectedSelections: [selection(1, 20)],
    },
    {
      name: "Tugs word when at beginning of word, next to symbol",
      text: [
        "123 abc  def_ghi-jkl",
        "____________________",
      ],
      selections: [selection(0, 17)],
      userInteractions: [
        cmd("groog.tug"),
        cmd("groog.cursorDown"),
        cmd("groog.emacsPaste"),
      ],
      expectedText: [
        "123 abc  def_ghi-jkl",
        "_________________jkl___",
      ],
      expectedSelections: [selection(1, 20)],
    },
    {
      name: "Yanks word when at end of word, next to symbol",
      text: [
        "123 abc  def_ghi-jkl",
        "____________________",
      ],
      selections: [selection(0, 16)],
      userInteractions: [
        cmd("groog.yank"),
        cmd("groog.cursorDown"),
        cmd("groog.emacsPaste"),
      ],
      expectedText: [
        "123 abc  -jkl",
        "_________def_ghi___________",
      ],
      expectedSelections: [selection(1, 16)],
    },
    {
      name: "Tugs word when at end of word, next to symbol",
      text: [
        "123 abc  def_ghi-jkl",
        "____________________",
      ],
      selections: [selection(0, 16)],
      userInteractions: [
        cmd("groog.tug"),
        cmd("groog.cursorDown"),
        cmd("groog.emacsPaste"),
      ],
      expectedText: [
        "123 abc  def_ghi-jkl",
        "________________def_ghi____",
      ],
      expectedSelections: [selection(1, 23)],
    },
    {
      name: "Yanks word when in the middle of a word",
      text: [
        "123 abc  def_ghi-jkl",
        "____________________",
      ],
      selections: [selection(0, 18)],
      userInteractions: [
        cmd("groog.yank"),
        cmd("groog.cursorDown"),
        cmd("groog.emacsPaste"),
      ],
      expectedText: [
        "123 abc  def_ghi-",
        "_________________jkl___",
      ],
      expectedSelections: [selection(1, 20)],
    },
    {
      name: "Tugs word when in the middle of a word",
      text: [
        "123 abc  def_ghi-jkl",
        "____________________",
      ],
      selections: [selection(0, 18)],
      userInteractions: [
        cmd("groog.tug"),
        cmd("groog.cursorDown"),
        cmd("groog.emacsPaste"),
      ],
      expectedText: [
        "123 abc  def_ghi-jkl",
        "__________________jkl__",
      ],
      expectedSelections: [selection(1, 21)],
    },
    ...getPasteTestCases(),
    // groog.testFile tests
    {
      name: "test file shows error message for go file",
      expectedText: [
        `package main`,
        ``,
        `func main() {`,
        ``,
        `}`,
        ``,
      ],
      userInteractions: [
        openFile(startingFile("empty.go")),
        cmd("groog.testFile"),
      ],
      errorMessage: {
        expectedMessages: [
          "go testing should be routed to custom command in keybindings.go",
        ],
      },
    },
    {
      name: "testFile works for typescript file",
      expectedText: [``],
      userInteractions: [
        openFile(startingFile('whitespace', 'twoSpaces.ts')),
        cmd("groog.testFile"),
      ],
      wantSendTerminalCommands: [
        [undefined, "npm run test"],
      ],
    },
    {
      name: "testFile works for python file",
      expectedText: [``],
      userInteractions: [
        openFile(startingFile("blank.py")),
        cmd("groog.testFile"),
      ],
      wantSendTerminalCommands: [
        [undefined, `prt ${startingFile("blank.py").replace(/^C/, 'c')}`],
      ],
    },
    {
      name: "testFile works for java file",
      expectedText: [
        `/* Block`,
        ` * comment`,
        ` */`,
        `package copy.imports.comment; /* Suffix block comment */`,
        `/* Another block comment */`,
        ``,
      ],
      expectedSelections: [selection(5, 0)],
      userInteractions: [
        openFile(startingFile("copy-imports", "BlockComment.java")),
        cmd("groog.testFile"),
      ],
      wantSendTerminalCommands: [
        [undefined, "zts BlockComment"],
      ],
    },
    {
      name: "test file fails if unsupported suffix",
      expectedText: [
        `Hello there`,
        ``,
      ],
      userInteractions: [
        openFile(startingFile("greetings.txt")),
        cmd("groog.testFile"),
      ],
      errorMessage: {
        expectedMessages: [
          "Unknown file suffix: txt",
        ],
      },
    },
    {
      name: "uses fixed test file",
      expectedText: [``],
      userInteractions: [
        openFile(startingFile("copy-imports", "BlockComment.java")),
        openFile(startingFile('whitespace', 'twoSpaces.ts')),
        cmd("groog.toggleFixedTestFile"),
        openFile(startingFile("greetings.txt")),
        openFile(startingFile("blank.py")),
        cmd("groog.testFile"),
        cmd("groog.toggleFixedTestFile"),
        cmd("groog.testFile"),
      ],
      wantSendTerminalCommands: [
        // typescript file
        [undefined, "npm run test"],
        // python file
        [undefined, `prt ${startingFile("blank.py").replace(/^C/, 'c')}`],
      ],
      informationMessage: {
        expectedMessages: [
          "Set fixed test file to twoSpaces.ts",
          "Unset fixed test file",
        ],
      },
    },
    /* Useful for commenting out tests. */
  ];
}

// Run `npm run test` to execute these tests.
suite('Groog commands', () => {
  for (let iteration = 0; iteration < TEST_ITERATIONS; iteration++) {
    let tcs = testCases();
    const requireRunSolo = tcs.some(tc => tc.runSolo);
    if (requireRunSolo) {
      tcs = tcs.filter((tc, idx) => tc.runSolo || idx === 0);
    }


    tcs.forEach((tc, idx) => {
      // Don't check for opening info message more than once
      if (idx === 0 && iteration !== 0) {
        return;
      }

      const testName = `[${idx + 1}/${tcs.length}] ${tc.name}`;
      test(TEST_ITERATIONS > 1 ? `{${iteration + 1}/${TEST_ITERATIONS}} ${testName}` : testName, async () => {

        if (idx) {
          const trArgs: TestResetArgs = {
            execStubs: tc.execStubs,
            wantSendTerminalCommandArgs: tc.wantSendTerminalCommands,
          };
          tc.userInteractions = [
            cmd("groog.test.reset", trArgs),
            ...(tc.userInteractions || []),
            cmd("groog.test.verify"),
          ];
        }

        if (tc.clipboard !== undefined) {
          await vscode.env.clipboard.writeText(tc.clipboard.join('\n'));
        }

        // Run the commands
        await new SimpleTestCase(tc).runTest().catch(e => {
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

function fileGrid(lines: number, chars: number): string[] {
  return Array(lines).fill("_".repeat(chars));
}
