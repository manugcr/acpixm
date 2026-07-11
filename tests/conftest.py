from pathlib import Path
import pytest

REPO_ROOT = Path(__file__).parents[1]

@pytest.fixture
def dsl_files():
    return sorted((REPO_ROOT / "output").glob("*.dsl"))

@pytest.fixture
def rule_files():
    return sorted((REPO_ROOT / "examples").glob("*.yml"))
