import * as vscode from 'vscode';
import { GlobalBoolTracker, GlobalStateTracker } from './emacs';
import path = require('path');
import { open, readFileSync, writeFileSync } from 'fs';

const stubbableTestFilePath = process.env.VSCODE_STUBBABLE_TEST_FILE;

export interface StubbablesConfig {
  // If a value is undefined, then return undefined.
  quickPickActions?: QuickPickAction[];
  wantQuickPickOptions?: string[][];
  changed?: boolean;
  error?: string;
}

export const TEST_MODE: boolean = !!stubbableTestFilePath;

export const stubbables = {
  showQuickPick: runStubbableMethod<vscode.QuickPick<vscode.QuickPickItem>, Thenable<void>>(
    async (qp: vscode.QuickPick<vscode.QuickPickItem>) => qp.show(),
    async (qp: vscode.QuickPick<vscode.QuickPickItem>, sc: StubbablesConfig) => {
      sc.changed = true;
      if (sc.wantQuickPickOptions === undefined) {
        sc.wantQuickPickOptions = [];
      }
      sc.wantQuickPickOptions.push(qp.items.map(item => item.label));

      const genericQuickPickAction = sc.quickPickActions?.shift();
      if (!genericQuickPickAction) {
        sc.error = "Ran out of quickPickSelections";
        return vscode.commands.executeCommand("workbench.action.closeQuickOpen");
      }

      const handlerGenerator = quickPickActionHandlers.get(genericQuickPickAction.kind);;
      if (!handlerGenerator) {
        sc.error = `Unsupported QuickPickActionKind: ${genericQuickPickAction.kind}`;
        return vscode.commands.executeCommand("workbench.action.closeQuickOpen");
      }

      const handler = handlerGenerator();

      const errorMessage = await handler.run(qp, genericQuickPickAction.props);
      if (errorMessage) {
        sc.error = errorMessage;
      }
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

/*******************
 * QuickPickAction *
 *******************/

// All this rigmarole is needed since we serialize to and from JSON (which causes method info to be lost (i.e. the `run`method)).
// That is why we need the separation of the QuickPickAction types and the QuickPickActionHandler types.

enum QuickPickActionKind {
  close,
  selectItem,
}

export interface QuickPickAction {
  readonly kind: QuickPickActionKind;
  readonly props: Record<string, any>;
}

interface QuickPickActionHandler {
  // Run the quick pick action, or return an error
  run(qp: vscode.QuickPick<vscode.QuickPickItem>, props: Record<string, any>): Promise<string | undefined>;
}

const quickPickActionHandlers = new Map<QuickPickActionKind, () => QuickPickActionHandler>([
  [QuickPickActionKind.selectItem, () => new SelectItemQuickPickActionHandler()],
  [QuickPickActionKind.close, () => new CloseQuickPickActionHandler()],
]);

/*****************************
 * SelectItemQuickPickAction *
 *****************************/

interface SelectItemQuickPickActionProps {
  textSelection: string;
}

export class SelectItemQuickPickAction implements QuickPickAction {
  readonly kind: QuickPickActionKind = QuickPickActionKind.selectItem;
  readonly props: SelectItemQuickPickActionProps;
  constructor(textSelection: string) {
    this.props = {
      textSelection: textSelection,
    };
  }
}

class SelectItemQuickPickActionHandler implements QuickPickActionHandler {
  async run(qp: vscode.QuickPick<vscode.QuickPickItem>, genericProps: Record<string, any>): Promise<string | undefined> {
    const props = genericProps as SelectItemQuickPickActionProps;
    for (const item of qp.items) {
      if (item.label !== props.textSelection) {
        continue;
      }

      qp.selectedItems = [item];
      qp.activeItems = [item];
      qp.show();
      return vscode.commands.executeCommand("workbench.action.acceptSelectedQuickOpenItem");
    }

    return `No items matched the provided text selection`;
  }
}

/************************
 * CloseQuickPickAction *
 ************************/

interface CloseQuickPickActionProps {}

export class CloseQuickPickAction implements QuickPickAction {
  readonly kind: QuickPickActionKind = QuickPickActionKind.selectItem;
  readonly props: CloseQuickPickActionProps;
  constructor() {
    this.props = {};
  }
}

class CloseQuickPickActionHandler implements QuickPickActionHandler {
  async run(): Promise<string | undefined> {
    return vscode.commands.executeCommand("workbench.action.closeQuickOpen");
  }
}
