import subprocess
from pathlib import Path
from config import OUTPUT_DIR, ACPI_TABLES_NAME

# -----------------------------------
# ACPI TABLES EXTRACTOR
# -----------------------------------
class AcpiTablesExtractor:
    def __init__(self) -> None:
        self.input_file: Path = OUTPUT_DIR / ACPI_TABLES_NAME
        self.acpixtract_cmd: list[str] = ['acpixtract', '-a', str(self.input_file)]

    def extract_tables(self) -> None:
        try:
            subprocess.run(self.acpixtract_cmd, cwd=OUTPUT_DIR, stdout=False, check=True)
            print(f" [D] ACPI tables extracted to {OUTPUT_DIR}")
        except subprocess.CalledProcessError as e:
            print(f" [E] Error extracting ACPI tables: {e}")
