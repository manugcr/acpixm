module.exports = grammar({
  name: 'asl',

  extras: $ => [
    /\s/,  // Skip whitespace
    $._comment  // Skip comments
  ],

  rules: {

    // ------------------------------------------------
    // Start here
    // ------------------------------------------------
    source_file: $ => repeat($.definition_block),

    // ------------------------------------------------
    // Tokens
    // ------------------------------------------------
    number: $ => /0x[0-9A-Fa-f]+|\d+/,                      // 0x1234, 0xABCD, 1234
    identifier: $ => /[A-Za-z]+/,                           // Any method name, object name, etc.
    string: $ => /"[^"]*"/,                                 // "Hello, World!"                   
    name_segs: $ => /([A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*)/,    // _ABC, _A12, _A12.ABC, _SB.PCI0.LPCB.EC0
    path_name: $ => /(\\[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*)/,  // \_SB, \_TZ.TZ00, \_SB.PCI0.LPCB.EC0
  
    // ------------------------------------------------
    // Comment handling
    // ------------------------------------------------
    _comment: $ => token(choice(
      seq('//', /[^\n]*/),
      seq(
        '/*',
        /[^*]*\*+([^/*][^*]*\*+)*/,
        '/'
      )
    )),

    // ------------------------------------------------
    // Code Structure
    // ------------------------------------------------
    definition_block: $ => seq(                             // DefinitionBlock ("", "SSDT", 2, "Hack", "CpuPlug", 0x00000000)
      'DefinitionBlock',
      $.parameters_list,
      $.block
    ),

    parameters_list: $ => seq(
      '(',
      field("params", optional(sepBy(',', $._expression))),
      ')'
    ),

    block: $ => seq(
      '{',
      repeat($._statement),
      '}'
    ),

    // ------------------------------------------------
    // Expressions
    // ------------------------------------------------
    _expression: $ => choice(
      $.number,
      $.string,
      $.name_segs,
      $.path_name,
      $.identifier,
      $.function_call
    ),

    function_call: $ => seq(
      $.identifier,
      $.parameters_list
    ),

    // ------------------------------------------------
    // Basic Statements
    // ------------------------------------------------
    _statement: $ => choice(
      $.block_statement,
      $.simple_statement,
      $.field_statement
    ),

    block_statement: $ => seq(
      field("keyword", $.identifier),
      field("arguments", $.parameters_list),
      $.block
    ),

    simple_statement: $ => seq(
      field("keyword", $.identifier),
      field("arguments", $.parameters_list)
    ),

    // ------------------------------------------------
    // Special Statements
    // ------------------------------------------------
    field_statement: $ => seq(
      field("keyword", 'Field'),
      field("arguments", $.parameters_list),
      $.field_block
    ),

    field_block: $ => seq(
      '{',
      repeat($.field_element),
      '}'
    ),

    field_element: $ => choice(
      seq('Offset', '(', $.number, ')', ','),
      seq($.name_segs, ',', $.number, optional(',')) // e.g., RP0C, 8,
    ),

  }
});

function sepBy(sep, rule) {
  return optional(seq(rule, repeat(seq(sep, rule))));
}
