from pathlib import Path

import pytest

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def fixtures_dir():
    return FIXTURES_DIR


@pytest.fixture
def rule_files():
    return sorted(FIXTURES_DIR.glob("*.yml"))


@pytest.fixture
def rootkit_asl():
    return FIXTURES_DIR / "rootkit1.asl"
