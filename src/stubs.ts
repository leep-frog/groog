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

export const stubbables = {
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
