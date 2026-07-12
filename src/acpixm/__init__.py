"""ACPI Rootkit Detection Tool (acpixm).

A comprehensive tool for collecting and analyzing ACPI tables to detect
potential security indicators and rootkit activity.
"""

from importlib.metadata import version

__version__ = version("acpixm")
__author__ = "Manuel Gil Cernich"
__email__ = "mgilcernich@gmail.com"

# Export main functions for programmatic use
from .acpi_analyzer import analyze, collect

__all__ = ["analyze", "collect", "__version__"]
