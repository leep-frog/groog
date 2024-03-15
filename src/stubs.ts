import * as vscode from 'vscode';
import { GlobalBoolTracker, GlobalStateTracker } from './emacs';
import path = require('path');
import { open, readFileSync, writeFileSync } from 'fs';

const stubbableTestFilePath = process.env.VSCODE_STUBBABLE_TEST_FILE;

export interface StubbablesConfig {
  // If a value is undefined, then return undefined.
  quickPickSelections?: (string | undefined)[];
  wantQuickPickOptions?: string[][];
  changed?: boolean;
  error?: string;
}

export const TEST_MODE: boolean = !!stubbableTestFilePath;

interface Stubbables {
  createQuickPick: <K extends vscode.QuickPickItem> () => vscode.QuickPick<K>;
  showQuickPick: (qp: vscode.QuickPick<vscode.QuickPickItem>) => void;
}

export const stubbables: Stubbables = {
  createQuickPick: <T extends vscode.QuickPickItem> () => createQuickPickClosure<T>()(),
  showQuickPick: runStubbableMethod<vscode.QuickPick<vscode.QuickPickItem>, Thenable<void>>(
    async (qp: vscode.QuickPick<vscode.QuickPickItem>) => qp.show(),
    async (qp: vscode.QuickPick<vscode.QuickPickItem>, sc: StubbablesConfig) => {
      sc.changed = true;
      if (sc.wantQuickPickOptions === undefined) {
        sc.wantQuickPickOptions = [];
      }
      sc.wantQuickPickOptions.push(qp.items.map(item => item.label));

      if (!sc.quickPickSelections?.length) {
        sc.error = "Ran out of quickPickSelections";
        return vscode.commands.executeCommand("workbench.action.closeQuickOpen");
      }

      const textSelection = sc.quickPickSelections?.shift();
      // json mapping makes textSelection populate as null, hence why we check that and not undefined.
      if (textSelection === null) {
        // Don't make any selection, just use this to populate wantQuickPickOptions
        return vscode.commands.executeCommand("workbench.action.closeQuickOpen");
      }

      for (const item of qp.items) {
        if (item.label !== textSelection) {
          continue;
        }

        qp.selectedItems = [item];
        qp.activeItems = [item];
        qp.show();
        return vscode.commands.executeCommand("workbench.action.acceptSelectedQuickOpenItem");
      }

      sc.error = `No items matched the provided text selection ${textSelection}`;
    },
  )
};

function runStubbableMethodNoInput<O>(nonTestLogic: () => O, testLogic: (config: StubbablesConfig) => O): () => O {
  return runStubbableMethod<void, O>(
    (input: void) => nonTestLogic(),
    (input: void, sc: StubbablesConfig) => testLogic(sc),
  );
}

function runStubbableMethod<I, O>(nonTestLogic: (input: I) => O, testLogic: (input: I, config: StubbablesConfig) => O): (input: I) => O {
  return (input: I) => {
    if (!stubbableTestFilePath) {
      return nonTestLogic(input);
    }

    let stubbableConfig: StubbablesConfig;
    try {
      stubbableConfig = JSON.parse(readFileSync(stubbableTestFilePath).toString());
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to read/parse stubbables test file: ${e}`);
      return nonTestLogic(input);
    }
    stubbableConfig.changed = undefined;

    const ret = testLogic(input, stubbableConfig);

    try {
      if (stubbableConfig.changed) {
        writeFileSync(stubbableTestFilePath, JSON.stringify(stubbableConfig));
      }
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to write stubbables config back test file: ${e}`);
    }

    return ret;
  };
}

function createQuickPickClosure<T extends vscode.QuickPickItem>(): () => vscode.QuickPick<T> {
  return runStubbableMethodNoInput<vscode.QuickPick<T>>(
    vscode.window.createQuickPick<T>,
    () => new FakeQuickPick(vscode.window.createQuickPick<T>()),
  );
}

class FakeQuickPick<T extends vscode.QuickPickItem> implements vscode.QuickPick<T> {
  // onDidChangeValue: vscode.Event<string>;

  private readonly realQuickPick: vscode.QuickPick<T>;

  constructor(realQuickPick: vscode.QuickPick<T>) {
    this.realQuickPick = realQuickPick;
  }

  // QuickPick fields/methods
  public get value(): string { return this.realQuickPick.value; }
  public set value(s: string) { this.realQuickPick.value = s; }

  public get placeholder(): string | undefined { return this.realQuickPick.placeholder; }
  public set placeholder(s: string | undefined) { this.realQuickPick.placeholder = s; }

  public get onDidChangeValue(): vscode.Event<string> { return this.realQuickPick.onDidChangeValue; }

  public get onDidAccept(): vscode.Event<void> { return this.realQuickPick.onDidAccept; }

  public get buttons(): readonly vscode.QuickInputButton[] { return this.realQuickPick.buttons; }
  public set buttons(bs: vscode.QuickInputButton[]) { this.realQuickPick.buttons = bs; }

  public get onDidTriggerButton(): vscode.Event<vscode.QuickInputButton> { return this.realQuickPick.onDidTriggerButton; }

  public get onDidTriggerItemButton(): vscode.Event<vscode.QuickPickItemButtonEvent<T>> { return this.realQuickPick.onDidTriggerItemButton; }

  public get items(): readonly T[] { return this.realQuickPick.items; }
  public set items(ts: readonly T[]) { this.realQuickPick.items = ts; }

  public get canSelectMany(): boolean { return this.realQuickPick.canSelectMany; }

  public get matchOnDescription(): boolean { return this.realQuickPick.matchOnDescription; }
  public set matchOnDescription(b: boolean) { this.realQuickPick.matchOnDescription = b; }

  public get matchOnDetail(): boolean { return this.realQuickPick.matchOnDetail; }
  public set matchOnDetail(b: boolean) { this.realQuickPick.matchOnDetail = b; }

  public get keepScrollPosition(): boolean | undefined { return this.realQuickPick.keepScrollPosition; }
  public set keepScrollPosition(b: boolean | undefined) { this.realQuickPick.keepScrollPosition = b; }

  public get activeItems(): readonly T[] { return this.realQuickPick.activeItems; }
  public set activeItems(ts: T[]) { this.realQuickPick.activeItems = ts; }

  public get onDidChangeActive(): vscode.Event<readonly T[]> { return this.realQuickPick.onDidChangeActive; }

  public get selectedItems(): readonly T[] { return this.realQuickPick.selectedItems; }
  public set selectedItems(ts: T[]) { this.realQuickPick.selectedItems = ts; }

  public get onDidChangeSelection(): vscode.Event<readonly T[]> { return this.realQuickPick.onDidChangeSelection; }

  // QuickInput fields/methods
  public get title(): string | undefined { return this.realQuickPick.title; }
  public set title(t: string | undefined) { this.realQuickPick.title = t; }

  public get step(): number | undefined { return this.realQuickPick.step; }

  public get totalSteps(): number | undefined { return this.realQuickPick.totalSteps; }

  public get enabled(): boolean { return this.realQuickPick.enabled; }

  public get busy(): boolean { return this.realQuickPick.busy; }

  public get ignoreFocusOut(): boolean { return this.realQuickPick.ignoreFocusOut; }

  public show(): void { this.realQuickPick.show(); }

  public hide(): void { this.realQuickPick.hide(); }

  public get onDidHide(): vscode.Event<void> { return this.realQuickPick.onDidHide; }

  public dispose(): void { this.realQuickPick.dispose(); }
}
