from src.acpi_toolchain.toolchain import ACPIToolchain

def main():
     # Extract, dump and disassemble the ASL code.
    toolchain = ACPIToolchain()
    toolchain.run()

if __name__ == "__main__":
    main()
