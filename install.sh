#!/bin/bash

set -e  # Exit on any error

echo "[*] Installing ACPIXM CLI tool..."

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}


# Build the package
print_status "Building the package..."
uv build

if [[ $? -eq 0 ]]; then
    print_success "Package built successfully"
else
    print_error "Failed to build package"
    exit 1
fi

# Install the package
print_status "Installing acpixm CLI tool..."

# Find the built wheel file
WHEEL_FILE=$(find dist -name "*.whl" | head -n 1)
if [[ -z "$WHEEL_FILE" ]]; then
    print_error "No wheel file found in dist/ directory"
    exit 1
fi

print_status "Installing from $WHEEL_FILE..."
uv tool install "$WHEEL_FILE" --force

if [[ $? -eq 0 ]]; then
    print_success "acpixm installed successfully!"
    echo ""
    echo "[*] Installation complete!"
    echo ""
    echo "Usage examples:"
    echo "  acpixm --help"
    echo "  acpixm collect --output ./output"
    echo "  acpixm analyze --rule rule.yml --files ."
    echo ""
    echo "Note: Some operations may require sudo privileges."
else
    print_error "Failed to install acpixm"
    exit 1
fi