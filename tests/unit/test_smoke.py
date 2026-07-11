import acpixm
from acpixm.cli import app


def test_package_importable():
    assert acpixm is not None


def test_cli_app_exists():
    assert app is not None


def test_fixtures_non_empty(dsl_files, rule_files):
    assert len(dsl_files) > 0
    assert len(rule_files) > 0
