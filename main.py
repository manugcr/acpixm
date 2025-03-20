from src.acpi_toolchain.toolchain import ACPIToolchain
from src.acpi_parser.asl_parser import ASLParser
from pprint import pprint

with open("test/snippet2.asl", "r", encoding="utf-8") as f:
    asl_code = f.read()

def main():
    # # Extract, dump and disassemble the ASL code.
    # toolchain = ACPIToolchain()
    # toolchain.run()
    
    # Parse the ASL code.
    parser = ASLParser()
    parsed_asl = parser.parse(asl_code)
    
    pprint(parsed_asl, width=80, sort_dicts=False)
    

if __name__ == "__main__":
    main()
