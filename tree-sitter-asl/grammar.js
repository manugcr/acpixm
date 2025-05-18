/**
 * @file Grammar for ACPI (ASL) code
 * @author Manuel Gil Cernich
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: "asl",

  rules: {
    source_file: $ => $.definition_block,

    definition_block: $ => seq(
      "DefinitionBlock",
      $.parameter_list,
      $.code_block
    ),

    parameter_list: $ => seq(
      "(",
      optional(commaSep($.expression)),
      ")"
    ),

    code_block: $ => seq(
      "{",
      repeat($.statement),
      "}"
    ),

    // Generic expression handling
    expression: $ => choice(
      $.arithmetic_expression,
      $.number_literal,
      $.string_literal,
      $.identifier,
      $.function_call
    ),

    // General statement rule to handle any type of statement
    statement: $ => choice(
      $.named_object,
      $.field_object
    ),
    
    // Generic named object pattern (handles Device, Method, Name, etc.)
    named_object: $ => seq(
      $.identifier,  // Matches any ASL object type (Device, Method, Name, etc.)
      $.parameter_list,
      optional($.code_block)
    ),

    // Function calls (e.g., EisaId("PNP0A08"))
    function_call: $ => seq(
      field('function', $.identifier),
      $.parameter_list
    ),

    arithmetic_expression: $ => prec.left(seq(
      $.expression,
      choice("+", "-", "*", "/", "%"),
      $.expression
    )),

    field_object: $ => seq(
      "Field",
      $.parameter_list,
      "{",
      commaSep($.field_element),
      "}"
    ),

    field_element: $ => choice(
      seq("Offset", $.parameter_list),
      seq($.identifier, ",", $.number_literal),
    ),

    // Basic tokens
    identifier: $ => /[a-zA-Z_\\\^][a-zA-Z0-9_]*/,
    string_literal: $ => /"([^"\\]|\\.)*"/,
    number_literal: $ => /0x[0-9a-fA-F]+|[0-9]+/
  }
});

// Helper function for comma-separated lists
function commaSep(rule) {
  return optional(seq(rule, repeat(seq(",", rule))));
}