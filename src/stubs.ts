import * as vscode from 'vscode';
import { readFileSync, writeFileSync } from 'fs';
import { jsonIgnoreReplacer } from 'json-ignore';

const stubbableTestFilePath = process.env.VSCODE_STUBBABLE_TEST_FILE;

export interface StubbablesConfig {
  // If a value is undefined, then return undefined.
  quickPickActions?: QuickPickAction[];
  gotQuickPickOptions?: vscode.QuickPickItem[][];
  changed?: boolean;
  error?: string;
}

export const TEST_MODE: boolean = !!stubbableTestFilePath;

export const stubbables = {
  // Stubbable command to create a quick pick controllable in tests
  createQuickPick: <T extends vscode.QuickPickItem> () => {
    return runStubbableMethodNoInput<vscode.QuickPick<T>>(
      vscode.window.createQuickPick,
      () => new FakeQuickPick(vscode.window.createQuickPick()),
    )();
  },
  // Stubbable command to show a quick pick controllable in tests
  showQuickPick: runStubbableMethod<vscode.QuickPick<vscode.QuickPickItem>, Thenable<void>>(
    async (qp: vscode.QuickPick<vscode.QuickPickItem>) => qp.show(),
    async (qp: vscode.QuickPick<vscode.QuickPickItem>, sc: StubbablesConfig) => {
      sc.changed = true;
      if (sc.gotQuickPickOptions === undefined) {
        sc.gotQuickPickOptions = [];
      }
      sc.gotQuickPickOptions.push(qp.items.map(item => {
        return {
          // Copy the item elements in case the reference is updated elsewhere.
          ...item,
        };
      }));

      const genericQuickPickAction = sc.quickPickActions?.shift();
      if (!genericQuickPickAction) {
        sc.error = "Ran out of quickPickSelections";
        return vscode.commands.executeCommand("workbench.action.closeQuickOpen");
      }

      const actionHandler = quickPickActionHandlers.get(genericQuickPickAction.kind);
      if (!actionHandler) {
        sc.error = `Unsupported QuickPickActionKind: ${genericQuickPickAction.kind}`;
        return vscode.commands.executeCommand("workbench.action.closeQuickOpen");
      }

      const action = actionHandler(genericQuickPickAction);
      const [errorMessage, promise] = action.run(qp);
      if (errorMessage) {
        sc.error = errorMessage;
      }
      return promise;
    },
  ),
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
        // jsonIgnoreReplacer ensures that relevant @jsonIgnore() annotated fields aren't included
        writeFileSync(stubbableTestFilePath, JSON.stringify(stubbableConfig, jsonIgnoreReplacer));
      }
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to write stubbables config back test file: ${e}`);
    }

    return ret;
  };
}

/*******************
 * QuickPickAction *
********************/

// All this rigmarole is needed since we serialize to and from JSON (which causes method info to be lost (i.e. the `run`method)).
// That is why we need the separation of the QuickPickAction types and the QuickPickActionHandler types.

enum QuickPickActionKind {
  Close,
  SelectItem,
  PressItemButton,
  NoOp,
}

interface QuickPickAction {
  readonly kind: QuickPickActionKind;
  // Run the quick pick action, or return an error
  // It returns [string|undefined, Thenable<any>] because when initially had Thenable<string | undefined>,
  // the error wasn't being set properly in the stubbables method.
  run(qp: vscode.QuickPick<vscode.QuickPickItem>): [string | undefined, Thenable<any>];
}

/*****************************
 * SelectItemQuickPickAction *
******************************/

export class SelectItemQuickPickAction implements QuickPickAction {
  readonly kind: QuickPickActionKind = QuickPickActionKind.SelectItem;
  readonly itemLabels: string[];

  constructor(itemLabels: string[]) {
    this.itemLabels = itemLabels;
  }

  static fromJsonifiedObject(action: SelectItemQuickPickAction): SelectItemQuickPickAction {
    return new SelectItemQuickPickAction(action.itemLabels);
  }

  run(qp: vscode.QuickPick<vscode.QuickPickItem>): [string | undefined, Thenable<any>] {
    const matchedItems: vscode.QuickPickItem[] = [];
    for (const item of qp.items) {
      if (this.itemLabels.includes(item.label)) {
        matchedItems.push(item);
      }
    }

    if (matchedItems.length !== this.itemLabels.length) {
      return [`All item labels were not matched. Found [${matchedItems.map(item => item.label)}]; wanted [${this.itemLabels}]`, Promise.resolve()];
    }

    qp.show();
    const fqp = qp as FakeQuickPick<vscode.QuickPickItem>;
    try {
      const promise = fqp.acceptItems(matchedItems);
      return [undefined, promise];
    } catch (e) {
      throw new Error(`An error occurred. The most likely cause is that you're creating your QuickPick with vscode.window.createQuickPick() instead of stubbables.createQuickPick(). Actual error is below:\n\n${e}`);
    }
  }
}

/************************
 * CloseQuickPickAction *
*************************/

export class CloseQuickPickAction implements QuickPickAction {
  kind = QuickPickActionKind.Close;

  run(): [string | undefined, Thenable<any>] {
    return [undefined, vscode.commands.executeCommand("workbench.action.closeQuickOpen")];
  }

  static fromJsonifiedObject(action: CloseQuickPickAction): CloseQuickPickAction {
    return new CloseQuickPickAction();
  }
}

/************************
 * NoOpQuickPickAction *
*************************/

export class NoOpQuickPickAction implements QuickPickAction {
  kind = QuickPickActionKind.NoOp;

  run(): [string | undefined, Thenable<any>] {
    return [undefined, Promise.resolve()];
  }

  static fromJsonifiedObject(action: NoOpQuickPickAction): NoOpQuickPickAction {
    return new NoOpQuickPickAction();
  }
}

/**********************************
 * PressItemButtonQuickPickAction *
***********************************/

export class PressItemButtonQuickPickAction implements QuickPickAction {
  kind = QuickPickActionKind.PressItemButton;
  itemLabel: string;
  buttonIndex: number;
  constructor(itemLabel: string, buttonIndex: number) {
    this.itemLabel = itemLabel;
    this.buttonIndex = buttonIndex;
  }

  static fromJsonifiedObject(action: PressItemButtonQuickPickAction): PressItemButtonQuickPickAction {
    return new PressItemButtonQuickPickAction(action.itemLabel, action.buttonIndex);
  }

  run(qp: vscode.QuickPick<vscode.QuickPickItem>): [string | undefined, Thenable<any>] {
    for (const item of qp.items) {
      if (item.label !== this.itemLabel) {
        continue;
      }

      const button = item.buttons?.at(this.buttonIndex);
      if (!button) {
        return [`Item only has ${item.buttons?.length}, but needed at least ${this.buttonIndex+1}`, Promise.resolve()];
      }

      qp.show();
      const fqp = qp as FakeQuickPick<vscode.QuickPickItem>;
      try {
        const promise = fqp.pressItemButton(item, button);
        return [undefined, promise];
      } catch (e) {
        throw new Error(`An error occurred. The most likely cause is that you're creating your QuickPick with vscode.window.createQuickPick() instead of stubbables.createQuickPick(). Actual error is below:\n\n${e}`);
      }
    }

    return [`No items matched the provided text selection`, Promise.resolve()];
  }
}

/*****************************
 * Handler Aggregation Types *
******************************/

const quickPickActionHandlers = new Map<QuickPickActionKind, (props: any) => QuickPickAction>([
  [QuickPickActionKind.SelectItem, SelectItemQuickPickAction.fromJsonifiedObject],
  [QuickPickActionKind.Close, CloseQuickPickAction.fromJsonifiedObject],
  [QuickPickActionKind.NoOp, NoOpQuickPickAction.fromJsonifiedObject],
  [QuickPickActionKind.PressItemButton, PressItemButtonQuickPickAction.fromJsonifiedObject],
]);

/*********************
 * QuickPick Wrapper *
**********************/

class FakeQuickPick<T extends vscode.QuickPickItem> implements vscode.QuickPick<T> {

  private readonly realQuickPick: vscode.QuickPick<T>;

  private readonly acceptHandlers: ((e: void) => Promise<any>)[];
  private readonly buttonHandlers: ((e: vscode.QuickInputButton) => Promise<any>)[];
  private readonly itemButtonHandlers: ((e: vscode.QuickPickItemButtonEvent<T>) => Promise<any>)[];

  constructor(realQuickPick: vscode.QuickPick<T>) {
    this.realQuickPick = realQuickPick;
    this.acceptHandlers = [];
    this.buttonHandlers = [];
    this.itemButtonHandlers = [];
  }

  // Custom methods
  public async acceptItems(items: T[]): Promise<any> {
    this.activeItems = items;
    this.selectedItems = items;
    await this.runAsyncsInSequence(undefined, this.acceptHandlers);
  }

  public async pressButton(button: vscode.QuickInputButton): Promise<any> {
    await this.runAsyncsInSequence(button, this.buttonHandlers);
  }

  public async pressItemButton(item: T, button: vscode.QuickInputButton): Promise<any> {
    await this.runAsyncsInSequence({item, button}, this.itemButtonHandlers);
  }

  private async runAsyncsInSequence<T>(t: T, handlers: ((t: T) => Promise<any>)[]): Promise<any> {
    for (const handler of handlers) {
      await handler(t);
    }
  }

  // QuickPick overridden fields/methods below
  public onDidTriggerButton(listener: (e: vscode.QuickInputButton) => Promise<any>, thisArgs?: any, disposables?: vscode.Disposable[]) : vscode.Disposable {
    this.buttonHandlers.push(listener);
    return this.realQuickPick.onDidTriggerButton(listener, thisArgs, disposables);
  }

  public onDidTriggerItemButton(listener: (e: vscode.QuickPickItemButtonEvent<T>) => Promise<any>, thisArgs?: any, disposables?: vscode.Disposable[]) : vscode.Disposable {
    this.itemButtonHandlers.push(listener);
    return this.realQuickPick.onDidTriggerItemButton(listener, thisArgs, disposables);
  }

  public onDidAccept(listener: (e: void) => Promise<any>, thisArgs?: any, disposables?: vscode.Disposable[]) : vscode.Disposable {
    this.acceptHandlers.push(listener);
    return this.realQuickPick.onDidAccept(listener, thisArgs, disposables);
  }

  // QuickPick simple forwarding fields/methods below

  public get value(): string { return this.realQuickPick.value; }
  public set value(s: string) { this.realQuickPick.value = s; }

  public get placeholder(): string | undefined { return this.realQuickPick.placeholder; }
  public set placeholder(s: string | undefined) { this.realQuickPick.placeholder = s; }

  public get onDidChangeValue(): vscode.Event<string> { return this.realQuickPick.onDidChangeValue; }

  public get buttons(): readonly vscode.QuickInputButton[] { return this.realQuickPick.buttons; }
  public set buttons(bs: vscode.QuickInputButton[]) { this.realQuickPick.buttons = bs; }

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
