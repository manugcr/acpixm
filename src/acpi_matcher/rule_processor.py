from typing import Any, Dict, List, Optional
from pathlib import Path
from dataclasses import dataclass

from .yaml_processor import YamlProcessor
from .enhanced_logic_engine import EnhancedLogicEngine, LogicResult
from .return_processor import ReturnProcessor, ReturnResult
from .json_transform import JsonNormalizer


@dataclass
class ProcessingResult:
    """Complete result of rule processing."""
    rule_info: Dict[str, Any]
    ast_matches: List[Dict[str, Any]]
    logic_results: Optional[List[LogicResult]]
    return_result: ReturnResult
    success: bool
    error_message: Optional[str] = None


class RuleProcessor:
    """
    Main orchestrator for processing ACPI rootkit detection rules.
    Coordinates YamlProcessor, EnhancedLogicEngine, and ReturnProcessor.
    """

    def __init__(self, rule_file: Path, tmp_dir: Path):
        self.rule_file = rule_file
        self.tmp_dir = tmp_dir
        self.yaml_processor = YamlProcessor(rule_file)
        self.logic_engine = None
        self.return_processor = None
        self._setup_components()

    def _setup_components(self) -> None:
        """Setup logic engine and return processor based on YAML configuration."""
        # Setup logic engine if logic section exists
        if self.yaml_processor.logic_section:
            self.logic_engine = EnhancedLogicEngine(
                self.yaml_processor.logic_section)

        # Setup return processor
        self.return_processor = ReturnProcessor(
            self.yaml_processor.return_section)

    def get_ast_tempfile(self) -> Path:
        """Get the temporary AST rule file for ast-grep."""
        return self.yaml_processor.get_ast_tempfile(self.tmp_dir)

    def process_ast_results(self,
                            ast_results_file: Path) -> List[Dict[str, Any]]:
        """Process and normalize AST results from ast-grep."""
        normalizer = JsonNormalizer(ast_results_file)
        return normalizer.normalize()

    def process_logic(
            self, ast_matches: List[Dict[str,
                                         Any]]) -> Optional[List[LogicResult]]:
        """Process logic evaluation if logic engine is configured."""
        if not self.logic_engine:
            return None

        return self.logic_engine.evaluate_all(ast_matches)

    def process_return(
            self,
            ast_matches: List[Dict[str, Any]],
            logic_results: Optional[List[LogicResult]] = None) -> ReturnResult:
        """Process return results."""
        # Convert LogicResult objects to boolean values for return processing
        logic_bool_results = None
        if logic_results:
            logic_bool_results = [
                result.success and bool(result.value)
                for result in logic_results
            ]

        return self.return_processor.process(
            ast_matches=ast_matches,
            logic_results=logic_bool_results,
            rule_info=self.yaml_processor.get_rule_info())

    def process_rule(self, ast_results_file: Path) -> ProcessingResult:
        """
        Complete rule processing pipeline.
        
        Args:
            ast_results_file: Path to the JSON file containing ast-grep results
            
        Returns:
            ProcessingResult with complete processing information
        """
        try:
            # Get rule information
            rule_info = self.yaml_processor.get_rule_info()

            # Process AST results
            ast_matches = self.process_ast_results(ast_results_file)

            # Process logic if configured
            logic_results = self.process_logic(ast_matches)

            # Process return results
            return_result = self.process_return(ast_matches, logic_results)

            return ProcessingResult(rule_info=rule_info,
                                    ast_matches=ast_matches,
                                    logic_results=logic_results,
                                    return_result=return_result,
                                    success=True)

        except Exception as e:
            return ProcessingResult(
                rule_info=self.yaml_processor.get_rule_info(),
                ast_matches=[],
                logic_results=None,
                return_result=ReturnResult(
                    found=False,
                    message=f"Error processing rule: {str(e)}",
                    details={"error": str(e)},
                    matches_count=0),
                success=False,
                error_message=str(e))

    def get_processing_summary(self, result: ProcessingResult) -> str:
        """Get a human-readable summary of the processing result."""
        summary = []
        summary.append("=" * 60)
        summary.append(f"Rule: {result.rule_info.get('id', 'Unknown')}")
        summary.append(
            f"Message: {result.rule_info.get('message', 'No message')}")
        summary.append(
            f"Severity: {result.rule_info.get('severity', 'Unknown')}")
        summary.append("-" * 60)
        summary.append(f"AST Matches: {len(result.ast_matches)}")

        if result.logic_results:
            logic_success_count = sum(1 for r in result.logic_results
                                      if r.success)
            summary.append(f"Logic Evaluations: {len(result.logic_results)}")
            summary.append(f"Logic Success: {logic_success_count}")

        summary.append("-" * 60)
        summary.append(
            f"Final Result: {'FOUND' if result.return_result.found else 'NOT FOUND'}"
        )
        summary.append(f"Result Message: {result.return_result.message}")

        if not result.success:
            summary.append(f"ERROR: {result.error_message}")

        summary.append("=" * 60)
        return "\n".join(summary)

    def save_detailed_results(self, result: ProcessingResult,
                              output_file: Path) -> None:
        """Save detailed processing results to a file."""
        detailed_result = {
            "rule_info":
            result.rule_info,
            "ast_matches":
            result.ast_matches,
            "logic_results": [{
                "success": lr.success,
                "value": lr.value,
                "operation_id": lr.operation_id
            } for lr in (result.logic_results or [])],
            "return_result": {
                "found": result.return_result.found,
                "message": result.return_result.message,
                "severity": result.return_result.severity,
                "matches_count": result.return_result.matches_count,
                "details": result.return_result.details
            },
            "processing_success":
            result.success,
            "error_message":
            result.error_message
        }

        import json
        output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(detailed_result, f, indent=2)

    def register_custom_logic_operation(self, name: str, operation) -> None:
        """Register a custom operation in the logic engine."""
        if self.logic_engine:
            self.logic_engine.register_custom_operation(name, operation)

    def reload_rule(self) -> None:
        """Reload the rule from disk and reinitialize components."""
        self.yaml_processor.reload()
        self._setup_components()
