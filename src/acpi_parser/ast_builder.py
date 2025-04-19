class ASLAstBuilder:
    def build(self, parse_tree):
        """
        Converts the Tatsu parse tree into a structured AST (Python dict).
        """
        return self._build_node(parse_tree)

    def _build_node(self, node):
        try:
            if isinstance(node, list):
                return [self._build_node(n) for n in node]

            if isinstance(node, dict):
                # Identify node type from its first key
                node_type = next(iter(node.keys()), "unknown")

                # Recursively process children
                return {
                    "type": node_type,
                    **{key: self._build_node(value) for key, value in node.items()},
                }

            return node  # Base case: return raw values (e.g., strings, numbers)

        except Exception as e:
            print(f"Error occurred while processing node: {node}")
            raise e
