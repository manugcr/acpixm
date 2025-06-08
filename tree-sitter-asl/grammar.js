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
      field("function", 'DefinitionBlock'),
      field("parameters", $.parameters_list),
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
    // Statements
    // ------------------------------------------------
    _statement: $ => choice(
      $.external_stmt,
      $.scope_stmt,
      $.device_stmt,
      $.method_stmt,
      $.return_stmt,
      $.field_stmt,
      $.name_stmt,
      $.assignment_stmt,
      $.generic_call,
      $.if_stmt
    ),

    external_stmt: $ => seq(
      field("function", 'External'),
      field("parameters", $.parameters_list)
    ),

    scope_stmt: $ => seq(
      field("function", 'Scope'),
      field("parameters", $.parameters_list),
      $.block
    ),

    device_stmt: $ => seq(
      field("function", 'Device'),
      field("parameters", $.parameters_list),
      $.block
    ),

    return_stmt: $ => seq(
      field("function", 'Return'),
      field("parameters", $.parameters_list),
    ),

    method_stmt: $ => seq(
      field("function", 'Method'),
      field("parameters", $.parameters_list),
      $.block
    ),

    // ------------------------------------------------
    field_stmt: $ => seq(
      'Field',
      $.parameters_list,
      '{',
      repeat($.field_element),
      '}'
    ),

    field_element: $ => seq(
      choice(
      $.field_offset,
      $.field_named_entry
      ),
      optional(',')
    ),

    field_offset: $ => seq(
      'Offset',
      $.parameters_list
    ),

    field_named_entry: $ => seq(
      field("name", $.name_segs),
      ',',
      field("size", $.number)
    ),
    // ------------------------------------------------

    // ------------------------------------------------
    name_stmt: $ => seq(
      field("function", 'Name'),
      field("parameters", $.name_parameters),
    ),

    name_parameters: $ => seq(
      '(',
      field("variable", $.name_segs),
      ',',
      field("expression", $._name_expression),
      ')'
    ),

    _name_expression: $ => choice(
      $._expression,
      $.package_initializer,
      $.buffer_initializer
    ),

    package_initializer: $ => seq(
      field("function", 'Package'),
      field("parameters", $.parameters_list),
      $._comma_list_block
    ),

    buffer_initializer: $ => seq(
      field("function", 'Buffer'),
      field("parameters", $.parameters_list),
      $._comma_list_block
    ),

    _comma_list_block: $ => seq(
      '{',
      sepBy(',', $._name_expression),
      optional(','),
      '}'
    ),
    // ------------------------------------------------

    generic_call: $ => seq(
      field("function", choice($.identifier, $.name_segs)),
      field("arguments", $.parameters_list)
    ),

    assignment_stmt: $ => seq(
      field("left", $.identifier),
      '=',
      field("right", $._expression)
    ),
    
    if_stmt: $ => seq(
      'If',
      field("condition", $.parameters_list),
      field("consequence", $.block),
      optional(field("alternative", $.else_clause))
    ),

    else_clause: $ => seq(
      'Else',
      $.block
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
      $.binary_expression,
      $.generic_call,
    ),

    binary_expression: $ => prec.left(1, seq(
      field("left", $._expression),
      field("operator", choice('+', '-', '*', '/', '<<', '>>', '==', '!=')),
      field("right", $._expression)
    )),

    // ------------------------------------------------
    // Tokens
    // ------------------------------------------------
    number: $ => /0x[0-9A-Fa-f]+|\d+/,                      // 0x1234, 0xABCD, 1234
    identifier: $ => /[A-Za-z]+/,                           // Any method name, object name, etc.
    string: $ => /"[^"]*"/,                                 // "Hello, World!"                   
    name_segs: $ => /([\^A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*)/,    // _ABC, _A12, _A12.ABC, _SB.PCI0.LPCB.EC0
    path_name: $ => /(\\[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*)/,  // \_SB, \_TZ.TZ00, \_SB.PCI0.LPCB.EC0
  
  }
});

function sepBy(sep, rule) {
  return optional(seq(rule, repeat(seq(sep, rule))));
}
