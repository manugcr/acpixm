import subprocess
from pathlib import Path
from config import OUTPUT_DIR, ACPI_TABLES_NAME

# -----------------------------------
# ACPI TABLES DISASSEMBLER
# -----------------------------------
class AcpiTablesDisassembler:
    def __init__(self) -> None:
        self.output_dir: Path = OUTPUT_DIR
        self.iasl_cmd: list[str] = ['iasl', '-d']  

    def disassemble_table(self, table_file: str) -> None:
        table_path: Path = self.output_dir / table_file

        try:
            subprocess.run(self.iasl_cmd + [str(table_path)], cwd=self.output_dir, stdout=False, check=True)
            print(f" [D] Disassembled table saved to {self.output_dir}")
        except Exception as e:
            print(f" [E] Error disassembling the table: {e}")

    def disassemble_all_tables(self) -> None:
        try:
            # List all .dat tables except 'acpi_tables.dat'
            tables = [f.name for f in self.output_dir.iterdir() if f.suffix == '.dat' and f.name != ACPI_TABLES_NAME]
            if not tables:
                print(" [D] No ACPI tables found to disassemble.")
                return

            for table in tables:
                self.disassemble_table(table)
        except Exception as e:
            print(f" [E] Error disassembling all tables: {e}")