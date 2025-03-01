import subprocess
from pathlib import Path
from typing import List

BASE_DIR = Path(__file__).parent
DUMP_DIR = BASE_DIR / "output"

class ACPIDumper:
    """Handles the dumping of ACPI tables using acpidump."""
    def __init__(self, output_dir: Path = DUMP_DIR) -> None:
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def dump_acpi(self, output_file: str = "acpidump.bin") -> Path:
        """Dumps the ACPI tables to a binary file."""
        dump_path = self.output_dir / output_file
        command = ["sudo", "acpidump", "-o", str(dump_path)]
        subprocess.run(command, check=True)
        return dump_path

class ACPIExtractor:
    """Handles the extraction of ACPI tables from a dumped file."""
    def __init__(self, output_dir: Path = DUMP_DIR) -> None:
        self.output_dir = output_dir

    def extract_tables(self, dump_file: Path) -> List[Path]:
        """Extracts ACPI tables from the dumped file using acpixtract."""
        command = ["sudo", "acpixtract", "-a", str(dump_file)]
        subprocess.run(command, check=True, cwd=self.output_dir)
        return list(self.output_dir.glob("*.dat"))

class ACPIDisassembler:
    """Handles the disassembly of ACPI tables into DSL files."""
    def __init__(self, output_dir: Path = DUMP_DIR) -> None:
        self.output_dir = output_dir

    def disassemble_tables(self, table_files: List[Path]) -> List[Path]:
        """Disassembles extracted ACPI tables into DSL files using iasl."""
        dsl_files = []
        for table in table_files:
            command = ["iasl", "-d", str(table)]
            subprocess.run(command, check=True, cwd=self.output_dir)
            dsl_files.append(self.output_dir / (table.stem + ".dsl"))
        return dsl_files

class ACPIToolchain:
    """Orchestrates the ACPI dump, extraction, and disassembly processes."""
    def __init__(self, output_dir: Path = DUMP_DIR) -> None:
        self.dumper = ACPIDumper(output_dir)
        self.extractor = ACPIExtractor(output_dir)
        self.disassembler = ACPIDisassembler(output_dir)

    def run(self) -> None:
        """Executes the full pipeline: dump -> extract -> disassemble."""
        dump_file = self.dumper.dump_acpi()
        table_files = self.extractor.extract_tables(dump_file)
        self.disassembler.disassemble_tables(table_files)
        print("\nACPI processing complete.")

if __name__ == "__main__":
    toolchain = ACPIToolchain()
    toolchain.run()
