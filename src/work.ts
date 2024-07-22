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

  const lineInfoSuffix = editor.selections.map((sel: vscode.Selection) => {
    const startLine = sel.start.line + 1;
    const endLine = sel.end.line + 1;

    if (startLine === endLine) {
      return `L${startLine}`;
    }
    return `L${startLine}-L${endLine}`;
  }).join(",");

  const link = `https://code.amazon.com/packages/${pkg}/blobs/mainline/--/${pth}#${lineInfoSuffix}`;
  return vscode.env.clipboard.writeText(link);
}
