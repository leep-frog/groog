import { readFileSync, writeFileSync } from 'fs';
import parse, { HTMLElement } from 'node-html-parser';
import { dirname, resolve } from 'path';
import { argv } from 'process';

const indexHtml = argv[2];

const contents = readFileSync(indexHtml).toString();

const root = parse(contents);

const fileMap = new Map<string, HTMLElement>();

const popped = [];

for (const fileEl of root.querySelectorAll(".file")) {
  const filename = fileEl.text;
  if (fileMap.has(filename)) {
    console.log(`Removing duplicate element for ${filename}`);
    const oldElement = fileMap.get(filename)!;
    popped.push(oldElement.parentNode);
    oldElement.parentNode.remove();
  }
  fileMap.set(filename, fileEl);
}

if (popped.length > 0) {
  const table = root.querySelector("table.coverage-summary")!;
  const wrapperDiv = table.parentNode.parentNode;

  // Create the new table
  const poppedTable = new HTMLElement("table", {class: table.classNames});
  for (const p of popped) {
    poppedTable.appendChild(p);
  }

  // Create the parent/uncle elements for the table.
  const statusLine = new HTMLElement("div", { class: "status-line" });
  const pad = new HTMLElement("div", { class: "pad1" });
  pad.appendChild(poppedTable);

  // Add the newly created elements to the html
  wrapperDiv.appendChild(statusLine);
  wrapperDiv.appendChild(pad);

  // Move the buffer spacing to the end of the list
  wrapperDiv.appendChild(wrapperDiv.querySelector("div.push")!.remove());
}

writeFileSync(resolve(dirname(indexHtml), "index.html"), root.toString());
