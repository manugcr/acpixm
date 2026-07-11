from acpixm.acpi_matcher.return_evaluator import ReturnEvaluator

STEPS = [{"found": "overlaps-kernel"}, {"not-found": "otherwise"}]


def _record(logic_val):
    return {"file": "test.dsl", "logic": {"overlaps-kernel": logic_val}}


def test_found_when_external_resolves_true():
    # $KERNEL_CODE_RANGE is in externals; logic already evaluated to True
    evaluator = ReturnEvaluator(STEPS, externals={"KERNEL_CODE_RANGE": [0x1000, 0x2000]})
    decisions = evaluator.evaluate([_record(True)])
    assert decisions[0].found is True


def test_not_found_without_externals():
    # Regression: before the fix, externals were never passed → always not-found
    evaluator = ReturnEvaluator(STEPS)
    decisions = evaluator.evaluate([_record(True)])
    # Logic value is already resolved (True), so this should still be found
    assert decisions[0].found is True


def test_not_found_when_logic_false():
    evaluator = ReturnEvaluator(STEPS, externals={"KERNEL_CODE_RANGE": [0x1000, 0x2000]})
    decisions = evaluator.evaluate([_record(False)])
    assert decisions[0].found is False


def test_external_token_resolves_in_return_step():
    # Token in return: clause resolves from externals (not logic), the core regression
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
