import tatsu
from tatsu.ast import AST
from .ast_builder import ASLAstBuilder

class ASLParser:
    def __init__(self, grammar_file="src/acpi_parser/grammar.ebnf"):
        with open(grammar_file, "r") as f:
            self.grammar = f.read()
        self.model = tatsu.compile(self.grammar)

    def parse(self, file_path: str) -> AST:
        """
        Parses ASL source code into an AST.
        """
        with open(file_path, "r") as f:
            source_code = f.read()
        
        parse_tree = self.model.parse(source_code)
        return parse_tree
