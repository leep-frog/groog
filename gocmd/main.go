package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"

	"github.com/leep-frog/command/command"
	"github.com/leep-frog/command/commander"
	"github.com/leep-frog/command/sourcerer"
)

func main() {
	os.Exit(sourcerer.RunCLI(&cli{}))

	// _, file, _, _ := runtime.Caller(0)
	// os.Exit(sourcerer.Source([]sourcerer.CLI{&cli{}})) // Since the actual go files contain the extension configuration (and change frequently),
	// rather than just directly calling this package, we call `goleep` to ensure all
	// go file updates are included (without needing to reload the cli explicitly).
	// sourcerer.NewAliaser("v", "goleep", "-d", filepath.Dir(file), "vs-package"),
	// sourcerer.NewAliaser("vu", "goleep", "-d", filepath.Dir(file), "vs-package", "u"),

}

type cli struct{}

func (*cli) Name() string    { return "vs-package" }
func (*cli) Setup() []string { return nil }
func (*cli) Changed() bool   { return false }

var (
	versionRegex = regexp.MustCompile("^(\\s*Version:\\s*[\"`])([0-9\\.]+)([\"`],)$")
	runtimeNode  = commander.RuntimeCaller()
)

func (c *cli) Node() command.Node {
	versionSectionArg := commander.OptionalArg[int]("VERSION", "Version section offset (0 for smallest, 1 for middle, 2 for major)", commander.Default(0), commander.Between(0, 2, true))

	return commander.SerialNodes(
		runtimeNode,
		&commander.BranchNode{
			Branches: map[string]command.Node{
				"update u": commander.SerialNodes(
					versionSectionArg,
					&commander.ExecutorProcessor{func(o command.Output, d *command.Data) error {
						_, fileName, _, ok := runtime.Caller(0)
						if !ok {
							return o.Stderrf("failed to get runtime.Caller")
						}

						// Go two directories up (to groog root)
						packageFile := filepath.Join(filepath.Dir(fileName), "package.go")

						b, err := os.ReadFile(packageFile)
						if err != nil {
							return o.Annotatef(err, "failed to read package.go")
						}

						contents := strings.Split(string(b), "\n")
						var newContents []string
						var replaced int
						var newVersion string
						for _, line := range contents {
							m := versionRegex.FindStringSubmatch(line)
							if len(m) > 0 {
								replaced++
								prefix, version, suffix := m[1], m[2], m[3]
								versionParts := strings.Split(version, ".")

								indexToChange := len(versionParts) - 1 - versionSectionArg.Get(d)

								vNum, err := strconv.Atoi(versionParts[indexToChange])
								if err != nil {
									return o.Annotatef(err, "failed to convert version")
								}

								// Clear out smaller versions
								for i := indexToChange; i < len(versionParts); i++ {
									versionParts[i] = "0"
								}
								versionParts[indexToChange] = fmt.Sprintf("%d", vNum+1)
								newVersion = strings.Join(versionParts, ".")
								line = fmt.Sprintf("%s%s%s", prefix, newVersion, suffix)
							}
							newContents = append(newContents, line)
						}

						if replaced == 0 {
							return o.Stderrf("Made no replacements")
						}

						if err := os.WriteFile(packageFile, []byte(strings.Join(newContents, "\n")), 0644); err != nil {
							return o.Annotatef(err, "failed to write new contents to package.go")
						}

						o.Stdoutln("Successfully updated to new version:", newVersion)

						return c.regeneratePackageJson(o, d, newVersion)
					}},
				),
			},
			Default: commander.SerialNodes(
				&commander.ExecutorProcessor{func(o command.Output, d *command.Data) error {
					return c.regeneratePackageJson(o, d, "")
				}},
			),
		},
	)
}

func (c *cli) regeneratePackageJson(o command.Output, d *command.Data, versionOverride string) error {
	filename := filepath.Join(filepath.Dir(filepath.Dir(runtimeNode.Get(d))), "package.json")

	p := groogPackage(versionOverride)

	j, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal json: %v", err)
	}

	// For some reason, sometimes go writes u0026 and sometimes it writes `&`.
	// This line ensures we always write the actual ampersand character.
	fileContents := strings.ReplaceAll(string(j)+"\n", `\u0026`, "&")
	if err := os.WriteFile(filename, []byte(fileContents), 0644); err != nil {
		return fmt.Errorf("failed to write json to output file: %v", err)
	}

	o.Stdoutln("Successfully updated package.json")
	return nil
}
