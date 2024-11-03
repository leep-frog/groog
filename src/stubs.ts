import * as assert from 'assert';
import { exec } from "child_process";
import * as vscode from 'vscode';

export interface TestResetArgs {
  execStubs?: ExecStub[];
}

export interface ExecStub {
  wantArgs: string;
  err?: any;
  stdout?: string;
  stderr?: string;
}

export class Stubbers {
  execFunc: (cmd: string, f: (err: any, stdout: string, stderr: string) => any) => any;
  gotExecArgs: string[];
  wantExecArgs: string[];

  constructor(execFunc: (cmd: string, f: (err: any, stdout: string, stderr: string) => any) => any) {
    this.execFunc = execFunc;
    this.gotExecArgs = [];
    this.wantExecArgs = [];
  };

  configureForTest(stubs: ExecStub[]) {
    this.gotExecArgs = [];
    this.wantExecArgs = stubs.map(es => es.wantArgs);
    this.execFunc = (cmd: string, f: (err: any, stdout: string, stderr: string) => any): any => {
      this.gotExecArgs.push(cmd);

      const resp = stubs.shift();
      if (!resp) {
        vscode.window.showErrorMessage(`Ran out of exec responses`);
        return;
      }

      return f(resp.err, resp.stdout || "", resp.stderr || "");
    };
  }

  verify() {
    assert.deepStrictEqual(this.gotExecArgs, this.wantExecArgs, "Expected exec executions to be equal");
  }
}

export const stubs: Stubbers = new Stubbers(exec);
