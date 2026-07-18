from acpixm.acpi_matcher.return_evaluator import ReturnEvaluator

STEPS = [{"found": "overlaps_kernel"}, {"not-found": "otherwise"}]


def _record(logic_val):
    return {"file": "test.dsl", "logic": {"overlaps_kernel": logic_val}}


def test_found_when_logic_value_true():
    evaluator = ReturnEvaluator(
        STEPS, externals={"KERNEL_CODE_RANGE": [0x1000, 0x2000]}
    )
    decisions = evaluator.evaluate([_record(True)])
    assert decisions[0].found is True


def test_not_found_when_logic_value_false():
    evaluator = ReturnEvaluator(
        STEPS, externals={"KERNEL_CODE_RANGE": [0x1000, 0x2000]}
    )
    decisions = evaluator.evaluate([_record(False)])
    assert decisions[0].found is False


def test_found_works_without_externals():
    # Logic value already resolved; externals not needed for the return clause.
    evaluator = ReturnEvaluator(STEPS)
    decisions = evaluator.evaluate([_record(True)])
    assert decisions[0].found is True


def test_external_token_resolves_in_return_step():
    # $FLAG in the found: clause resolves from externals.
    steps = [{"found": "$FLAG"}, {"not-found": "otherwise"}]
    evaluator = ReturnEvaluator(steps, externals={"FLAG": True})
    record = {"file": "test.dsl", "logic": {}}
    decisions = evaluator.evaluate([record])
    assert decisions[0].found is True


def test_external_token_missing_returns_not_found():
    steps = [{"found": "$FLAG"}, {"not-found": "otherwise"}]
    evaluator = ReturnEvaluator(steps, externals={})
    record = {"file": "test.dsl", "logic": {}}
    decisions = evaluator.evaluate([record])
    assert decisions[0].found is False


def test_found_ast_always_true():
    # Special token: any ast-grep match is a finding.
    steps = [{"found": "ast"}]
    evaluator = ReturnEvaluator(steps)
    record = {"file": "test.dsl", "logic": {}}
    decisions = evaluator.evaluate([record])
    assert decisions[0].found is True


def test_expression_in_found_clause():
    # found: clause can be a compound expression.
    steps = [{"found": "kern_code and LENGTH > 0"}, {"not-found": "otherwise"}]
    evaluator = ReturnEvaluator(steps)
    record = {"file": "test.dsl", "LENGTH": 128, "logic": {"kern_code": True}}
    decisions = evaluator.evaluate([record])
    assert decisions[0].found is True
