import subprocess
from pathlib import Path
from config import OUTPUT_DIR, ACPI_TABLES_NAME

# -----------------------------------
# ACPI TABLES DUMPER
# -----------------------------------
class AcpiTablesDumper:
    def __init__(self) -> None:
        self.output_file: Path = OUTPUT_DIR / ACPI_TABLES_NAME
        self.acpidump_cmd: list[str] = ['sudo', 'acpidump']

    def dump_tables(self) -> None:
        try:
            with open(self.output_file, 'wb') as f:
                subprocess.run(self.acpidump_cmd, stdout=f, check=True)
            print(f" [D] ACPI tables dumped to {self.output_file}")
        except subprocess.CalledProcessError as e:
            print(f" [E] Error dumping ACPI tables: {e}")
