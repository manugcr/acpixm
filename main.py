from pathlib import Path
from src.utils.yamlhelper import RuleYAMLHelper
from src.acpi_toolchain.toolchain import ACPIToolchain
from src.acpi_astmatcher.astmatcher import ASTGrepMatcher
from src.utils.json_transform import JsonNormalizer
from src.utils.logic_engine import LogicEngine


def main() -> None:
    root                    = Path(__file__).parent
    tmp_dir                 = root / "tmp"
    output_dir              = root / "output"
    grammar_path            = root / "tree-sitter-asl" / "asl.so"
    rule_file               = root / "examples" / "LoadStore.yml"
    target_file             = root / "examples" / "snippets" / "rootkit3.asl"
    output_file             = root / "tmp" / "output.json"
    output_normalized_file  = root / "tmp" / "output_normalized.json"


    # Save ast section to temp file for ast-grep
    rule_helper = RuleYAMLHelper(rule_file)
    ast_rule_tmp = rule_helper.get_ast_tempfile(tmp_dir=tmp_dir)

    # 1. Dump ACPI tables.
    toolchain = ACPIToolchain(output_dir=output_dir)
    toolchain.run()

    # 2. Execute ast-grep matcher.
    matcher = ASTGrepMatcher(grammar_path=grammar_path)
    matcher_results = matcher.run(rule=ast_rule_tmp,
                                  target=target_file)
    matcher.write_results(matcher_results, output_file=output_file)

    # 3. Normalize the results.
    normalizer = JsonNormalizer(input_file=output_file)
    normalizer_results = normalizer.normalize()
    normalizer.write_results(normalizer_results,
                             output_file=output_normalized_file)

    # 4. Evaluate logic rules if needed.
    if rule_helper.logic_section:
        logic = LogicEngine(rule_helper.logic_section)
        logic_results = [m for m in normalizer_results if logic.evaluate(m)]
        if logic_results:
            print("-------------------------------------------")
            print("[*][*] Pattern Found.")
            print("-------------------------------------------")
        else:
            print("-------------------------------------------")
            print("[*][*] Pattern Not Found.")
            print("-------------------------------------------")
    else:
        if normalizer_results:
            print("-------------------------------------------")
            print("[*][*] Pattern Found.")
            print("-------------------------------------------")
        else:
            print("-------------------------------------------")
            print("[*][*] Pattern Not Found.")
            print("-------------------------------------------")

if __name__ == "__main__":
    main()
