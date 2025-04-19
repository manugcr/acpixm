from src.acpi_toolchain.toolchain import ACPIToolchain
from src.acpi_parser.asl_parser import ASLParser
from pprint import pprint


def main():
    # 1. Extract, dump and disassemble the ASL code.
    # toolchain = ACPIToolchain()
    # toolchain.run()
    
    # 2. Parse the ASL code with custom grammar.
    parser = ASLParser()
    parsed_asl = parser.parse("./test_files/basic.dsl")
    pprint(parsed_asl, width=120, sort_dicts=False)

if __name__ == "__main__":
    main()
