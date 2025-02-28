from acpi_tables_dumper import AcpiTablesDumper
from acpi_tables_extractor import AcpiTablesExtractor
from acpi_tables_disassembler import AcpiTablesDisassembler

def main() -> None:
    dumper:         AcpiTablesDumper        = AcpiTablesDumper()
    extractor:      AcpiTablesExtractor     = AcpiTablesExtractor()
    disassembler:   AcpiTablesDisassembler  = AcpiTablesDisassembler()

    dumper.dump_tables()
    extractor.extract_tables()
    disassembler.disassemble_all_tables()

if __name__ == '__main__':
    main()
