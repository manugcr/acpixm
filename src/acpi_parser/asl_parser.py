import tatsu
from tatsu.ast import AST
from .ast_builder import ASLAstBuilder

class ASLParser:
    def __init__(self, grammar_file="src/acpi_parser/grammar.ebnf"):
        with open(grammar_file, "r") as f:
            self.grammar = f.read()
        self.model = tatsu.compile(self.grammar)

    def parse(self, source_code: str) -> AST:
        """
        Parses ASL source code into an AST.
        """
        parse_tree = self.model.parse(source_code)
        return ASLAstBuilder().build(parse_tree)
