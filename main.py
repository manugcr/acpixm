from pathlib import Path
from src.utils.yaml_processor import YamlProcessor
from src.acpi_toolchain.toolchain import ACPIToolchain
from src.acpi_astmatcher.astmatcher import ASTGrepMatcher
from src.utils.json_transform import JsonNormalizer


def main() -> None:
    root                    = Path(__file__).parent
    tmp_dir                 = root / "tmp"
    output_dir              = root / "output"
    grammar_path            = root / "tree-sitter-asl" / "asl.so"
    rule_file               = root / "examples" / "OpRegionCritical.yml"
    target_file             = root / "examples" / "snippets" / "example-file.dsl"
    ast_output_file         = root / "tmp" / "output.json"
    output_normalized_file  = root / "tmp" / "output_normalized.json"


    print("\n[*] Step 1: Loading and validating rule...")
    try:
        yaml_processor = YamlProcessor(rule_file)
    except Exception as e:
        print(f"\t[!] Error loading rule: {e}")
        return

    print("\n[*] Step 2: Dumping ACPI tables...")
    try:
        toolchain = ACPIToolchain(output_dir=output_dir)
        toolchain.run()
    except Exception as e:
        print(f"\t[!] Error dumping ACPI tables: {e}")
        return

    print("\n[*] Step 3: Executing AST matching...")
    try:
        ast_rule_tmp = yaml_processor.get_ast_tempfile(tmp_dir=tmp_dir)
        matcher = ASTGrepMatcher(grammar_path=grammar_path)
        matcher_results = matcher.run(rule=ast_rule_tmp, target=target_file)
        matcher.write_results(matcher_results, output_file=ast_output_file)
    except Exception as e:
        print(f"   [!] Error in AST matching: {e}")
        return

    print("\n[*] Step 4: Normalizing JSON results...")
    try:
        normalizer = JsonNormalizer(input_file=ast_output_file)
        normalized_results = normalizer.normalize()
        normalizer.write_results(normalized_results,
                                 output_file=output_normalized_file)
    except Exception as e:
        print(f"   [!] Error normalizing results: {e}")
        return

if __name__ == "__main__":
    main()
