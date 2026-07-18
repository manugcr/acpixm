import acpixm
from acpixm.cli import app


def test_package_importable():
    assert acpixm is not None


def test_cli_app_exists():
    assert app is not None


def test_rule_files_exist(rule_files):
    assert len(rule_files) > 0


def test_rootkit_fixture_exists(rootkit_asl):
    assert rootkit_asl.exists()
