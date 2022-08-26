package main

import (
	"encoding/json"

	"github.com/leep-frog/command"
	"golang.org/x/exp/slices"
)

func main() {
	command.RunNodes(node())
}

func node() *command.Node {
	return command.SerialNodes(command.ExecuteErrNode(func(o command.Output, d *command.Data) error {
		p := &Package{
			Name:        "groog",
			DisplayName: "groog",
			Description: "",
			Version:     "0.0.56",
			Publisher:   "groogle",
			Browser:     "./dist/web/extension.js",
			Engines: map[string]string{
				"vscode": "^1.64.0",
			},
			Repository: &Repository{
				Type: "git",
				URL:  "https://github.com/leep-frog/vs-code",
			},
			Categories: []string{
				"Other",
			},
			Scripts: map[string]string{
				"test":              "vscode-test-web --browserType=chromium --extensionDevelopmentPath=. --extensionTestsPath=dist/web/test/suite/index.js",
				"pretest":           "npm run compile-web",
				"vscode:prepublish": "npm run package-web",
				"compile-web":       "webpack",
				"watch-web":         "webpack --watch",
				"package-web":       "webpack --mode production --devtool hidden-source-map",
				"lint":              "eslint src --ext ts",
				"run-in-browser":    "vscode-test-web --browserType=chromium --extensionDevelopmentPath=. .",
			},
			DevDependencies: map[string]string{
				"@types/vscode":                    "^1.64.0",
				"@types/mocha":                     "^9.0.0",
				"eslint":                           "^8.6.0",
				"@typescript-eslint/eslint-plugin": "^5.9.1",
				"@typescript-eslint/parser":        "^5.9.1",
				"mocha":                            "^9.1.3",
				"typescript":                       "^4.5.4",
				"@vscode/test-web":                 "^0.0.15",
				"ts-loader":                        "^9.2.6",
				"webpack":                          "^5.66.0",
				"webpack-cli":                      "^4.9.1",
				"@types/webpack-env":               "^1.16.3",
				"assert":                           "^2.0.0",
				"process":                          "^0.11.10",
			},
		}

		for _, cc := range CustomCommands {
			p.ActivationEvents = append(p.ActivationEvents, cc.activationEvent())
		}
		slices.Sort(p.ActivationEvents)

		p.Contributes = &Contribution{
			Commands:    CustomCommands,
			Keybindings: kbDefsToBindings(),
		}
		slices.SortFunc(p.Contributes.Commands, func(a, b *Command) bool {
			return a.Command < b.Command
		})

		j, err := json.MarshalIndent(p, "", "  ")
		if err != nil {
			return o.Annotatef(err, "failed to marshal json")
		}

		o.Stdoutln(string(j))
		return nil
	}))
}
