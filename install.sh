#!/bin/bash
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

info "Installing acpixm CLI tool..."
uv tool install . --force
success "acpixm installed successfully!"

echo ""
echo "Usage:"
echo "  acpixm --help"
echo "  acpixm collect --output ./output"
echo "  acpixm analyze --rule rule.yml --files ."
echo ""
echo "Note: Some operations require sudo."
