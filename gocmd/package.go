package main

import "golang.org/x/exp/slices"

type Package struct {
	Name             string            `json:"name"`
	DisplayName      string            `json:"displayName"`
	Description      string            `json:"description"`
	Version          string            `json:"version"`
	Publisher        string            `json:"publisher"`
	Browser          string            `json:"browser"`
	Engines          map[string]string `json:"engines"`
	Repository       *Repository       `json:"repository"`
	Categories       []string          `json:"categories"`
	Scripts          map[string]string `json:"scripts"`
	DevDependencies  map[string]string `json:"devDependencies"`
	ActivationEvents []string          `json:"activationEvents"`
	Contributes      *Contribution     `json:"contributes"`
}

func (p *Package) sort() {
	slices.Sort(p.ActivationEvents)

	slices.SortFunc(p.Contributes.Commands, func(a, b *Command) bool {
		return a.Title < b.Title
	})

	slices.SortFunc(p.Contributes.Keybindings, func(a, b *Keybinding) bool {
		if a.Key != b.Key {
			return a.Key < b.Key
		}
		if a.When != b.When {
			return a.When < b.When
		}
		if a.Command != b.Command {
			return a.Command < b.Command
		}
		return len(a.Args) < len(b.Args)
	})
}

type Repository struct {
	Type string `json:"type"`
	URL  string `json:"url"`
}

type Contribution struct {
	Commands    []*Command    `json:"commands"`
	Keybindings []*Keybinding `json:"keybindings"`
}

type Keybinding struct {
	Key     string                 `json:"key,omitempty"`
	Command string                 `json:"command,omitempty"`
	When    string                 `json:"when,omitempty"`
	Args    map[string]interface{} `json:"args,omitempty"`
}