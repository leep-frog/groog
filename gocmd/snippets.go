package main

type Snippet struct {
	Path     string `json:"path"`
	Language string `json:"language"`
}

var (
	Snippets = []*Snippet{
		{
			"snippets/go-test.json",
			"go",
		},
		{
			"snippets/java-parameterized-test.json",
			"java",
		},
	}
)
