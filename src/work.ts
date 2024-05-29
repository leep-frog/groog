import * as vscode from 'vscode';
import { MiscCommand, miscEditorFunc } from "./misc-command";

export const workCommands: MiscCommand[] = [
  {
    name: "work.copyLink",
    f: miscEditorFunc(copyLink),
  },
];

async function copyLink(editor: vscode.TextEditor) {
  // pathParts is [{empty} / workspace / gleeper / {workspace} / src / {package} / {path}]
  const pathParts = editor.document.uri.path.split('/');
  const pkg = pathParts[5];
  const pth = pathParts.slice(6).join('/');

  const link = `https://code.amazon.com/packages/${pkg}/blobs/mainline/--/${pth}`;
  return vscode.env.clipboard.writeText(link);
}
