import { defineConfig } from '@vscode/test-cli';
import path from 'path';

const USE_LOCAL = true;

export default defineConfig({
	files: 'out/test/**/*.test.js',
  workspaceFolder: path.resolve("src", "test", "test-workspace"),
  env: {
    TEST_MODE: true,
  },
  useInstallation: USE_LOCAL ? {
    fromMachine: true,
    fromPath: path.resolve(".vscode-test", "vscode-win32-x64-archive-1.99.0", "Code.exe"),
  } : undefined,
  mocha: {
    timeout: 60000,
    slow: 1000,
  },
});
