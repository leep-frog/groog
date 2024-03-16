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
      const [errorMessage, promise] = handler.run(qp, genericQuickPickAction.props);
      if (errorMessage) {
        sc.error = errorMessage;
      }
      return promise;
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
  pressItemButton,
}

interface QuickPickAction {
  readonly kind: QuickPickActionKind;
  readonly props: any;
  // Run the quick pick action, or return an error
  // It returns [string|undefined, Thenable<any>] because when initially had Thenable<string | undefined>,
  // the error wasn't being set properly in the stubbables method.
  //
  // NOTE: the run method should use the provided props, *NOT* the props field
  run(qp: vscode.QuickPick<vscode.QuickPickItem>, props: any): [string | undefined, Thenable<any>];
}

const quickPickActionHandlers = new Map<QuickPickActionKind, () => QuickPickAction>([
  [QuickPickActionKind.selectItem, () => new SelectItemQuickPickAction("")],
  [QuickPickActionKind.close, () => new CloseQuickPickAction()],
]);

/*****************************
 * SelectItemQuickPickAction *
 *****************************/

interface SelectItemQuickPickActionProps {
  itemLabels: string[];
}

export class SelectItemQuickPickAction implements QuickPickAction {
  readonly kind: QuickPickActionKind = QuickPickActionKind.selectItem;
  readonly props: SelectItemQuickPickActionProps;
  constructor(itemLabel: string) {
    this.props = {
      itemLabels: [itemLabel],
    };
  }

  run(qp: vscode.QuickPick<vscode.QuickPickItem>, props: SelectItemQuickPickActionProps): [string | undefined, Thenable<any>] {
    const matchedItems: vscode.QuickPickItem[] = [];
    for (const item of qp.items) {
      if (props.itemLabels.includes(item.label)) {
        matchedItems.push(item);
      }
    }

    if (matchedItems.length !== props.itemLabels.length) {
      return [`All item labels were not matched. Found [${matchedItems.map(item => item.label)}]; wanted [${props.itemLabels}]`, Promise.resolve()];
    }

    qp.selectedItems = matchedItems;
    qp.activeItems = matchedItems;
    qp.show();
    return [undefined, vscode.commands.executeCommand("workbench.action.acceptSelectedQuickOpenItem")];
  }
}

/************************
 * CloseQuickPickAction *
 ************************/

interface CloseQuickPickActionProps {}

export class CloseQuickPickAction implements QuickPickAction {
  kind = QuickPickActionKind.close;
  readonly props: CloseQuickPickActionProps;
  constructor() {
    this.props = {};
  }

  run(): [string | undefined, Thenable<any>] {
    return [undefined, vscode.commands.executeCommand("workbench.action.closeQuickOpen")];
  }
}

/**********************************
 * PressItemButtonQuickPickAction *
 **********************************/

/*interface PressItemButtonQuickPickActionProps {
  itemLabel: string;
  buttonIndex: number;
}

export class PressItemButtonQuickPickAction implements QuickPickAction {
  readonly kind: QuickPickActionKind = QuickPickActionKind.pressItemButton;
  readonly props: CloseQuickPickActionProps;
  constructor() {
    this.props = {};
  }
}

class PressItemButtonQuickPickActionHandler implements QuickPickActionHandler {
  run(qp: vscode.QuickPick<vscode.QuickPickItem>, props: PressItemButtonQuickPickActionProps): [string | undefined, Thenable<any>] {
    for (const item of qp.items) {
      if (item.label !== props.itemLabel) {
        continue;
      }

      qp.show();

      const button = item.buttons?.at(props.buttonIndex);
      if (!button) {
        return [`Item only has ${item.buttons?.length}, but needed at least ${props.buttonIndex+1}`, Promise.resolve()];
      }
      const event: vscode.QuickPickItemButtonEvent<vscode.QuickPickItem> = {
        button,
        item,
      };
      // qp.onDidTriggerItemButton(
      // qp.;
      return [undefined, vscode.commands.executeCommand("workbench.action.acceptSelectedQuickOpenItem")];
    }

    return [`No items matched the provided text selection`, Promise.resolve()];
  }
}*/

// const quickPickActionHandlers: QuickPickActionHandler[] = [
//   new SelectItemQuickPickActionHandler(),
//   new CloseQuickPickActionHandler(),
// ];

// // TODO: Generate this from a list to ensure Kind type isn't duplicated (and all enum Kinds are covered);
// const quickPickActionHandlersByKind = new Map<QuickPickActionKind, QuickPickActionHandler>();

// for (const handler of quickPickActionHandlers) {
//   // const kind = handler.k
//   // if (quickPickActionHandlersByKind.
// }


// [QuickPickActionKind.selectItem, () => new SelectItemQuickPickActionHandler()],
// [QuickPickActionKind.close, () => new CloseQuickPickActionHandler()],
// [QuickPickActionKind.pressItemButton, () => new PressItemButtonQuickPickActionHandler()]],);
