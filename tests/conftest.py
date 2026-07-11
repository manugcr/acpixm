from pathlib import Path
import pytest

REPO_ROOT = Path(__file__).parents[1]
FIXTURES_DIR = Path(__file__).parent / "fixtures"

@pytest.fixture
def dsl_files():
    return sorted((REPO_ROOT / "output").glob("*.dsl"))

@pytest.fixture
def rule_files():
    return sorted((REPO_ROOT / "examples").glob("*.yml"))

@pytest.fixture
def rootkit_asl():
    return FIXTURES_DIR / "rootkit1.asl"
