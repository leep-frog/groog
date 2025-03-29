import * as vscode from 'vscode';
import { Registerable } from './handler';
import { Recorder } from './record';
import path = require('path');

export function colorCustomizationSetting(color?: string, workspaceTarget?: boolean): GroogSetting {
  const value = color === undefined ? undefined : {
    "editorGutter.background": "#000000",
    "editorLineNumber.activeForeground": "#00ffff",
    "editor.lineHighlightBorder": color,
    "terminal.findMatchHighlightBackground": "#00bbbb",
    "terminal.findMatchBackground": "#bb00bb",
  };
  return new GroogSetting("workbench", "colorCustomizations", value, workspaceTarget);
}

export class Settings implements Registerable {

  // In order to work on Windows Remote Desktop (with QMK specifically),
  // you need to modify some settings. See the below links for more details:
  // https://docs.qmk.fm/#/mod_tap?id=caveats
  // https://www.reddit.com/r/olkb/comments/125kjh0/qmk_issues_on_remote_desktop_protocol/

  private static settings(): Setting[] {
    let ics = [
      "workbench.action.terminal.sendSequence",
      "groog.message.info",
      "workbench.action.closePanel",
      "workbench.action.terminal.focusNext",
      "workbench.action.terminal.focusPrevious",
      "workbench.action.terminal.newWithProfile",
      "groog.terminal.find",
      "groog.terminal.reverseFind",
      "workbench.action.terminal.focusFind",
      "workbench.action.terminal.findNext",
      "workbench.action.terminal.findPrevious",
      "groog.ctrlG",
      "groog.multiCommand.execute",
      "termin-all-or-nothing.closePanel",
    ];
    const settings = [
      new GroogSetting("editor", "autoClosingQuotes", "never"),
      // My preference is to only auto-close curly brackets, but this auto-closes (), [], and {}.
      // So, we disable this, and manually implement auto-close for curly brackets ourselves.
      // See keybindings.json behavior for the "{" character for implementation details.
      new GroogSetting("editor", "autoClosingBrackets", "never"),
      new GroogSetting("editor", "codeActionsOnSave", {
        "source.organizeImports": true,
        "source.fixAll.eslint": true,
      }),
      new GroogSetting("window", "newWindowDimensions", "maximized"),
      new GroogSetting("editor", "cursorSurroundingLines", 6),
      new GroogSetting("editor", "detectIndentation", false),
      new GroogSetting("editor", "insertSpaces", true),
      new GroogSetting("editor", "rulers", [80, 200]),
      new GroogSetting("editor", "tabSize", 2),
      new GroogSetting("files", "eol", "\n"),
      new GroogSetting("files", "insertFinalNewline", true),
      new GroogSetting("files", "trimFinalNewlines", true),
      new GroogSetting("files", "trimTrailingWhitespace", true),
      // true is the default, but explicilty set it here to avoid potential issues.
      new GroogSetting("terminal", "integrated.allowChords", true),
      new GroogSetting("terminal", "integrated.commandsToSkipShell", ics),
      new GroogSetting("terminal", "integrated.copyOnSelection", true),
      new GroogSetting("terminal", "integrated.scrollback", 10_000),
      colorCustomizationSetting("#707070"),
      new GroogSetting("workbench", "editor.limit.enabled", true),
      new GroogSetting("workbench", "editor.limit.perEditorGroup", true),
      new GroogSetting("workbench", "editor.limit.value", 1),
      new GroogSetting("workbench", "editor.showTabs", false),
      new GroogSetting("workbench", "startupEditor", "none"),
      // TODO: How is this not set in linux (i.e. work computer)?
      new GroogSetting("terminal", "integrated.defaultProfile.windows", "PowerShell"),
      new GroogSetting("powershell", "startAutomatically", false), // Don't start a powershell terminal when opening a powershell script
      new GroogSetting("terminal", "integrated.automationProfile.windows", {
        "path": "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      }),
      // https://github.com/golang/vscode-go/issues/217
      new GroogSetting("gopls", "analyses", { "composites": false }),
      new WordSeparatorSetting("_"),
      new LanguageSetting("typescript", "editor", "formatOnSave", true),
      // MinGW terminal
      // https://dev.to/yumetodo/make-the-integrated-shell-of-visual-studio-code-to-bash-of-msys2-5eao
      // https://code.visualstudio.com/docs/terminal/basics#_terminal-profiles
      new GroogSetting("terminal", "integrated.profiles.windows", {
        // Add the following to settings to make this the default terminal
        // "terminal.integrated.defaultProfile.windows": "MinGW",
        "MinGW": {
          // Follow the instructions in this link to have VS Code open MINGW
          // in the proper directory. Otherwise, will be opened in home directory.
          // https://stackoverflow.com/a/43812298/18162937
          "path": "C:\\msys64\\usr\\bin\\bash.exe",
          "overrideName": true,
          "color": "terminal.ansiGreen",
          // See below link for a list of icons
          // https://code.visualstudio.com/api/references/icons-in-labels
          "icon": "hubot",
          "args": [
            "--login",
            "-i",
          ],
          "env": {
            // See the below link for variables you can use here.
            // https://code.visualstudio.com/docs/editor/variables-reference
            "GROOG_VSCODE": "1",
          },
        },
      }),

      // Coverage Gutters settings
      new GroogSetting("coverage-gutters", "showLineCoverage", true),
      new GroogSetting("coverage-gutters", "showGutterCoverage", false),
      new GroogSetting("coverage-gutters", "showRulerCoverage", true),
    ];

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length === 1) {
      const coverageFile = path.join(workspaceFolders[0].uri.fsPath, "coverage.lcov");
      settings.push(new GroogSetting("coverage-gutters", "manualCoverageFilePaths", [coverageFile], true))
    }
    return settings;
  }

  private static async updateSettings(): Promise<void> {
    const missingConfigs: string[] = [];
    for (const setting of this.settings()) {
      const missingConfig = await setting.update();
      if (missingConfig) {
        missingConfigs.push(missingConfig);
      }
    }

    if (missingConfigs.length > 0) {
      vscode.window.showErrorMessage(`The following errors occurred while updating settings: ${missingConfigs.join(", ")}`);
    } else {
      vscode.window.showInformationMessage("Settings have been updated!");
    }
  }

  register(context: vscode.ExtensionContext, recorder: Recorder): void {
    recorder.registerUnrecordableCommand(context, "updateSettings", () => Settings.updateSettings());
  }
}

interface Setting {
  update(): Promise<string | undefined>;
}

export class GroogSetting implements Setting {

  private configSection: string;
  private subsection: string;
  private value: string;
  private configurationTarget: vscode.ConfigurationTarget;

  constructor(configSection: string, subsection: string, value: any, workspaceTarget?: boolean) {
    this.configSection = configSection;
    this.subsection = subsection;
    this.value = value;
    this.configurationTarget = workspaceTarget ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
  }

  async update(): Promise<string | undefined> {
    const vsConfig = vscode.workspace.getConfiguration(this.configSection);
    try {
      await vsConfig.update(this.subsection, this.value, this.configurationTarget);
    } catch (e) {
      return `${e}`;
    }
  }
}

// WordSeparatorSetting *adds* the provided characters to the list of editor word-separators.
export class WordSeparatorSetting implements Setting {

  static readonly configSection: string = "editor";
  static readonly configSubsection: string = "wordSeparators";

  private addCharacters: string;

  constructor(addCharacters: string) {
    this.addCharacters = addCharacters;
  }

  async update(): Promise<string | undefined> {
    let [configuration, existing] = WordSeparatorSetting.getWordSeparators();
    if (!existing) {
      vscode.window.showErrorMessage(`Failed to fetch ${WordSeparatorSetting.configSection}.${WordSeparatorSetting.configSubsection} setting`);
      return;
    }
    for (const char of this.addCharacters) {
      if (!existing.includes(char)) {
        existing += char;
      }
    }
    await configuration.update(WordSeparatorSetting.configSubsection, existing, vscode.ConfigurationTarget.Global);
    return;
  }

  public static getWordSeparators(): [vscode.WorkspaceConfiguration, string | undefined] {
    const configuration = vscode.workspace.getConfiguration(this.configSection);
    return [configuration, configuration.get(this.configSubsection)];
  }
}

class LanguageSetting implements Setting {

  private languageId: string;
  private configSection: string;
  private subsection: string;
  private value: string;

  constructor(languageId: string, configSection: string, subsection: string, value: any) {
    this.languageId = languageId;
    this.configSection = configSection;
    this.subsection = subsection;
    this.value = value;
  }

  async update(): Promise<string | undefined> {
    await vscode.workspace.getConfiguration(this.configSection, { languageId: this.languageId }).update(this.subsection, this.value, vscode.ConfigurationTarget.Global, true);
    return;
  }
}
