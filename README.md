# acpixm
Absolutely Critical Pattern Identifier for Malware

#### Notes:

```bash
tree-sitter generate
tree-sitter parse snippets/example-file.dsl
tree-sitter test

ast-grep scan -r rules/rule.yml snippets/example-file.dsl
```
