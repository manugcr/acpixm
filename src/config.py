from pathlib import Path

# Define the output directory and regenerate it if it exists
script_dir = Path(__file__).parent
OUTPUT_DIR = script_dir / 'output'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Set global variables
ACPI_TABLES_NAME = 'acpi_tables.dat'
