import * as assert from 'assert';
import { exec } from "child_process";
import * as vscode from 'vscode';
import { API as GitAPI, GitExtension, Repository } from '../typings/git';
import { sendTerminalCommand, TestFileArgs } from './misc-command';

export interface TestResetArgs {
  execStubs?: ExecStub[];
  wantSendTerminalCommandArgs?: [TestFileArgs | undefined, string][];
  gitStub?: ScopedGitAPI;
}

export interface ExecStub {
  wantArgs: string;
  err?: any;
  stdout?: string;
  stderr?: string;
}

// This interface just contains parts of the GitAPI we care about
export interface ScopedGitAPI {
  repositories?: Repository[];
}

function gitApi(): GitAPI | undefined {
  const gitExt = vscode.extensions.getExtension<GitExtension>('vscode.git')?.exports;
  return gitExt?.getAPI(1);
}

export class Stubbers {
  execFunc: (cmd: string, f: (err: any, stdout: string, stderr: string) => any) => any;
  gotExecArgs: string[];
  wantExecArgs: string[];

  sendTerminalCommandFunc: (args: TestFileArgs, command: string) => any;
  gotTerminalArgs: [TestFileArgs | undefined, string][];
  wantTerminalArgs: [TestFileArgs | undefined, string][];

  gitApi: () => ScopedGitAPI | undefined;

  constructor(execFunc: (cmd: string, f: (err: any, stdout: string, stderr: string) => any) => any, sendTerminalCommandFunc: (args: TestFileArgs, command: string) => any, gitAPI: () => GitAPI | undefined) {
    this.execFunc = execFunc;
    this.gotExecArgs = [];
    this.wantExecArgs = [];

    this.sendTerminalCommandFunc = sendTerminalCommandFunc;
    this.gotTerminalArgs = [];
    this.wantTerminalArgs = [];

    this.gitApi = gitAPI;
  };

  configureForTest(stubs: ExecStub[], wantSendTerminalCommandArgs: [TestFileArgs | undefined, string][], gitStub?: ScopedGitAPI) {
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

    this.gotTerminalArgs = [];
    this.wantTerminalArgs = wantSendTerminalCommandArgs;
    this.sendTerminalCommandFunc = (args: TestFileArgs, command: string) => {
      this.gotTerminalArgs.push([args, command]);
    };
    this.gitApi = () => {
      return gitStub;
    }
  }

  verify() {
    assert.deepStrictEqual(this.wantExecArgs, this.gotExecArgs, "Expected exec executions to be equal");
    assert.deepStrictEqual(this.wantTerminalArgs, this.gotTerminalArgs, "Expected sendTerminalCommand executions to be equal");
  }
}

export const stubs: Stubbers = new Stubbers(exec, sendTerminalCommand, gitApi);
