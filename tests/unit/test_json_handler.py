"""Unit tests for json_handler — normalize() and integer parsing."""

from acpixm.acpi_matcher.json_handler import normalize


def _match(file: str = "test.dsl", line: int = 1, text: str = "", single=None, multi=None):
    return {
        "file": file,
        "text": text,
        "range": {"start": {"line": line}},
        "metaVariables": {
            "single": single or {},
            "multi": multi or {},
        },
    }


class TestNormalizeSingle:
    def test_hex_parsed_to_int(self):
        record = normalize([_match(single={"OFFSET": {"text": "0x1000"}})])[0]
        assert record["OFFSET"] == 0x1000

    def test_uppercase_hex_parsed(self):
        record = normalize([_match(single={"OFFSET": {"text": "0X41AA00000"}})])[0]
        assert record["OFFSET"] == 0x41AA00000

    def test_decimal_parsed_to_int(self):
        record = normalize([_match(single={"LENGTH": {"text": "128"}})])[0]
        assert record["LENGTH"] == 128

    def test_non_numeric_kept_as_string(self):
        record = normalize([_match(single={"REGNAME": {"text": "KMEM"}})])[0]
        assert record["REGNAME"] == "KMEM"

    def test_file_line_text_extracted(self):
        record = normalize([_match(file="foo.dsl", line=9, text="OperationRegion ...")])[0]
        assert record["file"] == "foo.dsl"
        assert record["line"] == 9
        assert record["text"] == "OperationRegion ..."

    def test_all_three_captures(self):
        record = normalize([_match(single={
            "REGNAME": {"text": "KMEM"},
            "OFFSET": {"text": "0x41AA00000"},
            "LENGTH": {"text": "0x80"},
        })])[0]
        assert record["REGNAME"] == "KMEM"
        assert record["OFFSET"] == 0x41AA00000
        assert record["LENGTH"] == 0x80


class TestNormalizeMulti:
    def test_multi_capture_indexed(self):
        record = normalize([_match(multi={"ARGS": [{"text": "0x1"}, {"text": "0x2"}]})])[0]
        assert record["ARGS_0"] == 1
        assert record["ARGS_1"] == 2

    def test_multi_empty_list_no_keys(self):
        record = normalize([_match(multi={"ARGS": []})])[0]
        assert "ARGS_0" not in record

    def test_multi_string_value(self):
        record = normalize([_match(multi={"NAMES": [{"text": "foo"}, {"text": "bar"}]})])[0]
        assert record["NAMES_0"] == "foo"
        assert record["NAMES_1"] == "bar"


class TestNormalizeEdgeCases:
    def test_empty_input(self):
        assert normalize([]) == []

    def test_no_single_or_multi_section(self):
        m = {"file": "test.dsl", "text": "", "range": {"start": {"line": 0}}, "metaVariables": {}}
        record = normalize([m])[0]
        assert record["file"] == "test.dsl"

    def test_multiple_matches_preserved_in_order(self):
        m1 = _match(file="a.dsl", single={"OFFSET": {"text": "0x100"}})
        m2 = _match(file="b.dsl", single={"OFFSET": {"text": "0x200"}})
        records = normalize([m1, m2])
        assert len(records) == 2
        assert records[0]["OFFSET"] == 0x100
        assert records[1]["OFFSET"] == 0x200
