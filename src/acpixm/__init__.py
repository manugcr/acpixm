"""ACPI Rootkit Detection Tool (acpixm).

A comprehensive tool for collecting and analyzing ACPI tables to detect
potential security indicators and rootkit activity.
"""

__version__ = "0.1.0"
__author__ = "Your Name"
__email__ = "your.email@example.com"

# Export main functions for programmatic use
from .acpi_analyzer import analyze, collect

__all__ = ["analyze", "collect", "__version__"]