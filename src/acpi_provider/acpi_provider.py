"""ACPI Provider module for dumping, extracting, and disassembling ACPI tables."""

# pylint: disable=too-few-public-methods
import subprocess
from pathlib import Path
from typing import List
import os
import shutil
import logging

logger = logging.getLogger(__name__)


class Dumper:
    """Handles the dumping of ACPI tables using acpidump."""

    def __init__(self, output_dir: Path) -> None:
        self.output_dir = output_dir
        if os.path.exists(self.output_dir):
            shutil.rmtree(self.output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def dump_acpi(self, output_file: str = "acpidump.bin") -> Path:
        """Dumps the ACPI tables to a binary file."""
        dump_path = self.output_dir / output_file
        command = ["sudo", "acpidump", "-o", str(dump_path)]
        logger.debug("Running: %s", " ".join(command))

        try:
            subprocess.run(command, check=True)
        except subprocess.CalledProcessError as e:
            logger.error("acpidump failed: %s", e)
            raise
        return dump_path


class Extractor:
    """Handles the extraction of ACPI tables from a dumped file."""

    def __init__(self, output_dir: Path) -> None:
        self.output_dir = output_dir

    def extract_tables(self, dump_file: Path) -> List[Path]:
        """Extracts ACPI tables from the dumped file using acpixtract."""
        command = ["sudo", "acpixtract", "-a", str(dump_file)]
        logger.debug("Running: %s", " ".join(command))
        try:
            subprocess.run(command,
                           check=True,
                           cwd=self.output_dir,
                           stdout=subprocess.DEVNULL)
        except subprocess.CalledProcessError as e:
            logger.error("acpixtract failed: %s", e)
            raise
        return list(self.output_dir.glob("*.dat"))


class Disassembler:
    """Handles the disassembly of ACPI tables into DSL files."""

    def __init__(self, output_dir: Path) -> None:
        self.output_dir = output_dir

    def disassemble_tables(self, table_files: List[Path]) -> List[Path]:
        """Disassembles extracted ACPI tables into DSL files using iasl."""
        dsl_files = []
        for table in table_files:
            command = ["iasl", "-d", str(table)]
            logger.debug("Running: %s", " ".join(command))
            try:
                subprocess.run(command,
                               check=True,
                               cwd=self.output_dir,
                               stdout=subprocess.DEVNULL,
                               stderr=subprocess.DEVNULL)
                dsl_files.append(self.output_dir / (table.stem + ".dsl"))
            except subprocess.CalledProcessError as e:
                logger.error("iasl disassembly failed for %s: %s", table.name,
                             e)
                continue  # Skip broken tables
        return dsl_files


class ProviderPipeline:
    """Orchestrates the ACPI dump, extraction, and disassembly processes."""

    def __init__(self, output_dir: Path) -> None:
        self.dumper = Dumper(output_dir)
        self.extractor = Extractor(output_dir)
        self.disassembler = Disassembler(output_dir)

    def run(self) -> List[Path]:
        """Executes the full pipeline: dump -> extract -> disassemble."""
        logger.info("Starting ACPI provider pipeline.")
        dump_file = self.dumper.dump_acpi()
        table_files = self.extractor.extract_tables(dump_file)
        dsl_files = self.disassembler.disassemble_tables(table_files)
        logger.debug(" ACPI provider complete: %d DSL file(s)", len(dsl_files))
        return dsl_files
