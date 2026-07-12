from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parents[1]
FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def fixtures_dir():
    return FIXTURES_DIR


@pytest.fixture
def rule_files():
    # The shipped example rules — these are product artifacts under test.
    return sorted((REPO_ROOT / "examples").glob("*.yml"))


@pytest.fixture
def rootkit_asl():
    return FIXTURES_DIR / "rootkit1.asl"
