/**
 * TO FIX:
 *     - Xor terms broke precedence     var1 = (var2 ^ var3)
 * 
 */
function sepBy(sep, rule) {
  return optional(sepBy1(sep, rule));
}
function sepBy1(sep, rule) {
  return seq(rule, repeat(seq(sep, rule)));
}
const META_IDENT = /_[A-Z][A-Z0-9_]*/;
module.exports = grammar({
  name: 'asl',
  extras: $ => [
    /\s/,       // Skip whitespace
    $._comment  // Skip comments
  ],
  rules: {
    SourceFile: $ => $.DefinitionBlockTerm,
    MetaVarIdent: $ => token(META_IDENT),
    DefinitionBlockTerm: $ => seq(
      field('Term', 'DefinitionBlock'),
      '(',
      field('AMLFileName', $.StringLiteral), ',',
      field('TableSignature', $.StringLiteral), ',',
      field('ComplianceRevision', $.IntegerLiteral), ',',
      field('OEMID', $.StringLiteral), ',',
      field('TableID', $.StringLiteral), ',',
      field('OEMRevision', $.IntegerLiteral),
      ')',
      '{',
      field("TermList", $._TermList),
      '}',
    ),
    _comment: $ => token(choice(
      seq('//', /[^\n]*/),
      seq(
        '/*',
        /[^*]*\*+([^/*][^*]*\*+)*/,
        '/'
      )
    )),
    NameSeg: $ => /[A-Za-z0-9_][A-Za-z0-9_]{0,3}/,
    NameString: $ => choice(
      prec(2, '\\'),                                  // bare root
      prec(3, seq(                                    // prefer this when a path follows
        optional(choice('\\', repeat1('^'))),
         sepBy1('.', $.NameSeg)
      )),
      prec(1, repeat1('^'))                           // bare '^', '^^', ...
    ),
    IntegerLiteral: $ => token(choice(
      /0[xX][0-9a-fA-F]+/, // hex
      /[0-9]+/,            // decimal
      /Zero/,
      /One/,
      /Ones/,
      /True/,
      /False/
    )),
    StringLiteral: $ => seq(
      '"',
      repeat(/[^"\\]|\\./),
      '"'
    ),
    _SuperName: $ => choice(
      $.NameString,                 
      $.ArgTerm,                    
      $.LocalTerm,                  
      $.DebugTerm,                  
      $._ReferenceTypeOpcode,        
    ),
    _Target: $ => seq(
      $._SuperName                   
    ),
    _TermArg: $ => choice(
      prec(2, $._SymbolicExpressionTerm),
      prec(1, $._ExpressionOpcode),
      $._DataObject,
      $.ArgTerm,
      $.LocalTerm,
      $.TimerTerm,
      $.NameString,
    ),
    MethodInvocationTerm: $ => prec.left(2, seq(
      field('Term', $.NameString),
      '(',
      optional(field('ArgList', $.ArgList)),
      ')'
    )),
    PLDKeywordList: $ => seq(
      $.PLDKeyword,
      '=',
      choice(
        $.StringLiteral,
        $.IntegerLiteral,
      ),
      optional(seq(',', $.PLDKeywordList))
    ),
    CaseTermList: $ => choice(
      seq($.DefaultTerm, optional($.DefaultTermList)),
      seq($.CaseTerm, optional($.CaseTermList)),
      $.CaseTerm,
      $.DefaultTerm,
    ),
    DefaultTermList: $ => choice(
      $.CaseTerm,
      seq($.CaseTerm, $.DefaultTermList)
    ),
    ArgList: $ => sepBy1(',', $._TermArg),
    _TermList: $ => repeat1($._Term),
    _Term: $ => choice(
      $._Object,
      $._StatementOpcode,
      $._ExpressionOpcode,
      $._SymbolicExpressionTerm
    ),
    _Object: $ => choice(
      $._CompilerDirective,          
      $._NamedObject,
      $._NameSpaceModifier,          
    ),
    ByteList: $ => seq(
      $.IntegerLiteral,
      repeat(seq(',', $.IntegerLiteral))
    ),
    PackageList: $ => repeat1(
      seq($.PackageElement, optional(','))
    ),
    PackageElement: $ => choice(
      $._DataObject,                 
      $.NameString                  
    ),
    FieldUnitEntry: $ => seq(
      optional($.NameSeg),
      ',',
      $.IntegerLiteral
    ),
    FieldUnit: $ => choice(
      $.FieldUnitEntry,            
      $.OffsetTerm,                
      $.AccessAsTerm,              
    ),
    FieldUnitList: $ => seq(
      sepBy1(',', $.FieldUnit),
    ),
    ParameterTypePackage: $ => prec(1, choice(
      $.ObjectTypeKeyword,
      seq('{', optional($.ParameterTypePackageList), '}')
    )),
    ParameterTypePackageList: $ => seq(
      $.ObjectTypeKeyword,
      repeat(seq(',', $.ObjectTypeKeyword))
    ),
    ParameterTypesPackage: $ => prec(2, choice(
      $.ObjectTypeKeyword,
      seq('{', optional($.ParameterTypesPackageList), '}')
    )),
    ParameterTypesPackageList: $ => seq(
      $.ParameterTypePackage,
      repeat(seq(',', $.ParameterTypePackage))
    ),
    IfElseTerm: $ => seq(
      $.IfTerm,
      optional($.ElseTerm)
    ),
    BufferData: $ => choice(
      $.BufferTypeOpcode,           
      $.BufferTerm                  
    ),
    ComputationalData: $ => choice(
      $.BufferData,                 
      $.IntegerData,                
      $.StringData                  
    ),
    _DataObject: $ => choice(
      $.IntegerLiteral,
      $.StringLiteral,
      $.BufferData,
      $.PackageData,
      $.EISAIDTerm,
    ),
    DataRefObject: $ => choice(
      $._DataObject,                 
      $.IntegerLiteral             
    ),
    IntegerData: $ => choice(
      $._IntegerTypeOpcode,          
      $.IntegerLiteral,             
    ),
    PackageData: $ => seq(
      $.PackageTerm                 
    ),
    StringData: $ => choice(
      $.StringTypeOpcode,           
      $.StringLiteral               
    ),
    _CompilerDirective: $ => choice(
      $.IncludeTerm,                
      $.ExternalTerm                
    ),
    _NamedObject: $ => choice(
      $.CreateBitFieldTerm,         
      $.CreateByteFieldTerm,        
      $.CreateDWordFieldTerm,       
      $.CreateFieldTerm,            
      $.CreateQWordFieldTerm,       
      $.CreateWordFieldTerm,        
      $.DataRegionTerm,             
      $.DeviceTerm,                 
      $.EventTerm,                  
      $.FieldTerm,                  
      $.IndexFieldTerm,             
      $.MethodTerm,
      $.MutexTerm,                  
      $.OpRegionTerm,               
      $.PowerResTerm,               
      $.ProcessorTerm,              
      $.ThermalZoneTerm             
    ),
    _NameSpaceModifier: $ => choice(
      $.AliasTerm,  
      $.NameTerm,   
      $.ScopeTerm   
    ),
    _StatementOpcode: $ => choice(
      $.BreakTerm,
      $.BreakPointTerm,
      $.ContinueTerm,
      $.FatalTerm,
      $.ForTerm,
      $.IfElseTerm,
      $.NoOpTerm,
      $.NotifyTerm,
      $.ReleaseTerm,
      $.ResetTerm,
      $.ReturnTerm,
      $.SignalTerm,
      $.SleepTerm,
      $.StallTerm,
      $.SwitchTerm,
      $.UnloadTerm,
      $.WhileTerm,
    ),
    _ExpressionOpcode: $ => prec(1, choice(
      $.AcquireTerm,
      $.AddTerm,
      $.AndTerm,
      $.ConcatTerm,
      $.ConcatResTerm,
      $.CondRefOfTerm,
      $.CopyObjectTerm,
      $.DecTerm,
      $.DerefOfTerm,
      $.DivideTerm,
      $.FindSetLeftBitTerm,
      $.FindSetRightBitTerm,
      $.FromBCDTerm,
      $.IncTerm,
      $.IndexTerm,
      $.LAndTerm,
      $.LEqualTerm,
      $.LGreaterTerm,
      $.LGreaterEqualTerm,
      $.LLessTerm,
      $.LLessEqualTerm,
      $.LNotTerm,
      $.LNotEqualTerm,
      $.LOrTerm,
      $.MatchTerm,
      $.MidTerm,
      $.ModTerm,
      $.MultiplyTerm,
      $.NAndTerm,
      $.NOrTerm,
      $.NotTerm,
      $.ObjectTypeTerm,
      $.OrTerm,
      $.RefOfTerm,
      $.ShiftLeftTerm,
      $.ShiftRightTerm,
      $.SizeOfTerm,
      $.LoadTerm,
      $.StoreTerm,
      $.SubtractTerm,
      $.TimerTerm,
      $.ToBCDTerm,
      $.ToBufferTerm,
      $.ToDecimalStringTerm,
      $.ToHexStringTerm,
      $.ToIntegerTerm,
      $.ToStringTerm,
      $.WaitTerm,
      $.XorTerm,
      $.MethodInvocationTerm,
      $._SymbolicExpressionTerm,
      $._SymbolicAssignmentTerm,
    )),
    _IntegerTypeOpcode: $ => prec(2, choice(
      $.AddTerm,
      $.AndTerm,
      $.DecTerm,
      $.DerefOfTerm,
      $.DivideTerm,
      $.EISAIDTerm,
      $.FindSetLeftBitTerm,
      $.FindSetRightBitTerm,
      $.FromBCDTerm,
      $.IncTerm,
      $.LAndTerm,
      $.LEqualTerm,
      $.LGreaterTerm,
      $.LGreaterEqualTerm,
      $.LLessTerm,
      $.LLessEqualTerm,
      $.LNotTerm,
      $.LNotEqualTerm,
      $.MatchTerm,
      $.ModTerm,
      $.MultiplyTerm,
      $.NAndTerm,
      $.NOrTerm,
      $.NotTerm,
      $.OrTerm,
      $.ShiftLeftTerm,
      $.ShiftRightTerm,
      $.SubtractTerm,
      $.ToBCDTerm,
      $.ToIntegerTerm,
      $._SymbolicExpressionTerm,
      $.XorTerm,
    )),
    StringTypeOpcode: $ => prec(3, choice(
      $.ConcatTerm,
      $.DerefOfTerm,
      $.MidTerm,
      $.ToDecimalStringTerm,
      $.ToHexStringTerm,
      $.ToStringTerm
    )),
    BufferTypeOpcode: $ => prec(4, choice(
      $.ConcatTerm,                 
      $.ConcatResTerm,                  
      $.DerefOfTerm,                
      $.MidTerm,   
      $.ResourceTemplateTerm,                 
      $.ToBufferTerm,
      $.ToPLDTerm,               
      $.ToUUIDTerm,                 
      $.UnicodeTerm                 
    )),
    _ReferenceTypeOpcode: $ => prec(5, choice(
      $.RefOfTerm,                    
      $.DerefOfTerm,                
      $.IndexTerm,                  
      $.IndexSymbolicTerm,          
    )),
    _SymbolicExpressionTerm: $ => choice(
      seq('(', $._TermArg, ')'),
      $.AddSymbolicTerm,
      $.AndSymbolicTerm,
      $.DecSymbolicTerm,
      $.DivideSymbolicTerm,
      $.IncSymbolicTerm,
      $.LAndSymbolicTerm,
      $.LEqualSymbolicTerm,
      $.LGreaterEqualSymbolicTerm,
      $.LGreaterSymbolicTerm,
      $.LLessEqualSymbolicTerm,
      $.LLessSymbolicTerm,
      $.LNotEqualSymbolicTerm,
      $.LNotSymbolicTerm,
      $.LOrSymbolicTerm,
      $.ModSymbolicTerm,
      $.MultiplySymbolicTerm,
      $.NotSymbolicTerm,
      $.OrSymbolicTerm,
      $.ShiftLeftSymbolicTerm,
      $.ShiftRightSymbolicTerm,
      $.SubtractSymbolicTerm,
    ),
    _SymbolicAssignmentTerm: $ => choice(
      $.StoreSymbolicTerm,
      $.AddCompoundTerm,
      $.AndCompoundTerm,
      $.DivideCompoundTerm,
      $.ModCompoundTerm,
      $.MultiplyCompoundTerm,
      $.OrCompoundTerm,
      $.XorCompoundTerm,
      $.ShiftLeftCompoundTerm,
      $.ShiftRightCompoundTerm,
      $.SubtractCompoundTerm,
    ),
    DefaultTerm: $ => seq(
      'Default',
      '{',
      optional(field('TermList', $._TermList)),
      '}'
    ),
    CaseTerm: $ => seq(
      'Case',
      '(',
      field('Value', $._DataObject),
      ')',
      '{',
      optional(field('TermList', $._TermList)),
      '}'
    ),
    SwitchTerm: $ => seq(
      'Switch',
      '(',
      field('Predicate', $._TermArg),
      ')',
      '{',
      field('CaseTermList', $.CaseTermList),
      '}'
    ),
    WhileTerm: $ => seq(
      field('Term', 'While'),
      '(',
      field('Predicate', $._TermArg),
      ')',
      '{',
      field('TermList', $._TermList),
      '}'
    ),
    SubtractCompoundTerm: $ => prec.left(10, seq(
      field('Minuend', $._TermArg),
      '-=',
      field('Subtrahend', $._TermArg)
    )),
    ShiftRightCompoundTerm: $ => prec.left(10, seq(
      field('Source', $._TermArg),
      '>>=',
      field('ShiftCount', $._TermArg)
    )),
    ShiftLeftCompoundTerm: $ => prec.left(10, seq(
      field('Source', $._TermArg),
      '<<=',
      field('ShiftCount', $._TermArg)
    )),
    OrCompoundTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '|=',
      field('Source2', $._TermArg)
    )),
    XorCompoundTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '^=',
      field('Source2', $._TermArg)
    )),
    MultiplyCompoundTerm: $ => prec.left(10, seq(
      field('Multiplicand', $._TermArg),
      '*=',
      field('Multiplier', $._TermArg)
    )),
    ModCompoundTerm: $ => prec.left(10, seq(
      field('Dividend', $._TermArg),
      '%=',
      field('Divisor', $._TermArg)
    )),
    DivideCompoundTerm: $ => prec.left(10, seq(
      field('Dividend', $._TermArg),
      '/=',
      field('Divisor', $._TermArg)
    )),
    AndCompoundTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '&=',
      field('Source2', $._TermArg)
    )),
    AddCompoundTerm: $ => prec.left(10, seq(
      field('Addend1', $._TermArg),
      '+=',
      field('Result', $._TermArg)
    )),
    StoreSymbolicTerm: $ => prec.left(10, seq(
      field('Destination', $._SuperName),
      '=',
      field('Source', $._TermArg)
    )),
    XorSymbolicTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '^',
      field('Source2', $._TermArg)
    )),
    SubtractSymbolicTerm: $ => prec.left(10, seq(
      field('Minuend', $._TermArg),
      '-',
      field('Subtrahend', $._TermArg)
    )),
    ShiftRightSymbolicTerm: $ => prec.left(10, seq(
      field('Source', $._TermArg),
      '>>',
      field('ShiftCount', $._TermArg)
    )),
    ShiftLeftSymbolicTerm: $ => prec.left(10, seq(
      field('Source', $._TermArg),
      '<<',
      field('ShiftCount', $._TermArg)
    )),
    OrSymbolicTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '|',
      field('Source2', $._TermArg)
    )),
    NotSymbolicTerm: $ => prec.left(10, seq(
      '~',
      field('Source', $._TermArg)
    )),
    MultiplySymbolicTerm: $ => prec.left(10, seq(
      field('Multiplicand', $._TermArg),
      '*',
      field('Multiplier', $._TermArg)
    )),
    ModSymbolicTerm: $ => prec.left(10, seq(
      field('Dividend', $._TermArg),
      '%',
      field('Divisor', $._TermArg)
    )),
    LOrSymbolicTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '||',
      field('Source2', $._TermArg)
    )),
    LNotSymbolicTerm: $ => prec.left(10, seq(
      '!',
      field('Source', $._TermArg)
    )),
    LNotEqualSymbolicTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '!=',
      field('Source2', $._TermArg)
    )),
    LLessSymbolicTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '<',
      field('Source2', $._TermArg)
    )),
    LLessEqualSymbolicTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '<=',
      field('Source2', $._TermArg)
    )),
    LGreaterSymbolicTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '>',
      field('Source2', $._TermArg)
    )),
    LGreaterEqualSymbolicTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '>=',
      field('Source2', $._TermArg)
    )),
    LEqualSymbolicTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '==',
      field('Source2', $._TermArg)
    )),
    LAndSymbolicTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '&&',
      field('Source2', $._TermArg)
    )),
    IncSymbolicTerm: $ => prec.left(10, seq(
      field('Addend', $._SuperName),
      '++',
    )),
    DivideSymbolicTerm: $ => prec.left(10, seq(
      field('Dividend', $._TermArg),
      '/',
      field('Divisor', $._TermArg)
    )),
    DecSymbolicTerm: $ => prec.left(10, seq(
      field('Minuend', $._SuperName),
      '--',
    )),
    AndSymbolicTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '&',
      field('Source2', $._TermArg)
    )),
    AddSymbolicTerm: $ => prec.left(10, seq(
      field('Addend1', $._TermArg),
      '+',
      field('Addend2', $._TermArg)
    )),
    ElseIfTerm: $ => seq(
      field('Term', 'ElseIf'),
      '(',
      field('Predicate', $._TermArg),
      ')',
      '{',
      optional(field('TermList', $._TermList)),
      '}',
      optional(field('ElseTerm', $.ElseTerm))
    ),
    ElseTerm: $ => choice(
      seq(
        field('Term', 'Else'),
        '{',
        optional(field('TermList', $._TermList)),
        '}'
      ),
      $.ElseIfTerm,
    ),
    IfTerm: $ => seq(
      field('Term', 'If'),
      '(',
      field('Predicate', $._TermArg),
      ')',
      '{',
      optional(field('TermList', $._TermList)),
      '}'
    ),
    ForTerm: $ => seq(
      field('Term', 'For'),
      '(',
      field('Initialize', $._TermArg), ',',
      field('Predicate', $._TermArg), ',',
      field('Update', $._TermArg),
      ')',
      '{',
      field('TermList', $._TermList),
      '}'
    ),
    LoadTerm: $ => seq(
      field('Term', 'Load'),
      '(',
      field('Object', $.NameString), ',',
      field('Result', $._SuperName),
      ')'
    ),
    StoreTerm: $ => seq(
      field('Term', 'Store'),
      '(',
      field('Source', $._TermArg), ',',
      field('Destination', $._SuperName),
      ')'
    ),
    SizeOfTerm: $ => seq(
      field('Term', 'SizeOf'),
      '(',
      field('DataObject', $._SuperName),
      ')',
    ),
    EISAIDTerm: $ => seq(
      field('Term', 'EisaId'),
      '(',
      field('EisaIdString', $.StringData),
      ')'
    ),
    WaitTerm: $ => seq(
      field('Term', 'Wait'),
      '(',
      field('SyncObject', $._SuperName), ',',
      field('TimeoutValue', $._TermArg),
      ')'
    ),
    XorTerm: $ => seq(
      field('Term', 'XOr'),
      '(',
      field('Source1', $._TermArg), ',',
      field('Source2', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),
    ToIntegerTerm: $ => seq(
      field('Term', 'ToInteger'),
      '(',
      field('Data', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),
    SubtractTerm: $ => seq(
      field('Term', 'Subtract'),
      '(',
      field('Minuend', $._TermArg), ',',
      field('Subtrahend', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),
    TimerTerm: $ => seq(
      field('Term', 'Timer')
    ),
    ToBCDTerm: $ => seq(
      field('Term', 'ToBCD'),
      '(',
      field('Value', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),
    ShiftLeftTerm: $ => seq(
      field('Term', 'ShiftLeft'),
      '(',
      field('Source', $._TermArg), ',',
      field('ShiftCount', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),
    ShiftRightTerm: $ => seq(
      field('Term', 'ShiftRight'),
      '(',
      field('Source', $._TermArg), ',',
      field('ShiftCount', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),
    OrTerm: $ => seq(
      field('Term', 'Or'),
      '(',
      field('Source1', $._TermArg), ',',
      field('Source2', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),
    NotTerm: $ => seq(
      field('Term', 'Not'),
      '(',
      field('Source', $._TermArg), ',',
      field('Result', $._Target),
      ')'
    ),
    ObjectTypeTerm: $ => seq(
      field('Term', 'ObjectType'),
      '(',
      field('Object', choice($.NameString, $.ArgTerm, $.LocalTerm, $.DebugTerm, $.RefOfTerm, $.DerefOfTerm, $.IndexTerm)),
      ')'
    ),
    NAndTerm: $ => seq(
      field('Term', 'NAnd'),
      '(',
      field('Source1', $._TermArg), ',',
      field('Source2', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),
    NOrTerm: $ => seq(
      field('Term', 'NOr'),
      '(',
      field('Source1', $._TermArg), ',',
      field('Source2', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),
    MultiplyTerm: $ => seq(
      field('Term', 'Multiply'),
      '(',
      field('Multiplicand', $._TermArg), ',',
      field('Multiplier', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),
    ModTerm: $ => seq(
      field('Term', 'Mod'),
      '(',
      field('Dividend', $.IntegerLiteral), ',',
      field('Divisor', $.IntegerLiteral),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),
    MatchTerm : $ => seq(
      field('Term', 'Match'),
      '(',
      field('SearchPackage', $._TermArg), ',',
      field('Op1', $.MatchOpKeyword), ',',
      field('MatchObject1', $.ComputationalData), ',',
      field('Op2', $.MatchOpKeyword), ',',
      field('MatchObject2', $.ComputationalData), ',',
      field('StartIndex', $.IntegerLiteral),
      ')'
    ),
    LOrTerm: $ => seq(
      field('Term', 'LOr'),
      '(',
      field('Source1', $.IntegerLiteral), ',',
      field('Source2', $.IntegerLiteral),
      ')'
    ),
    LNotEqualTerm: $ => seq(
      field('Term', 'LNotEqual'),
      '(',
      field('Source1', $.ComputationalData), ',',
      field('Source2', $.ComputationalData),
      ')'
    ),
    LNotTerm: $ => seq(
      field('Term', 'LNot'),
      '(',
      field('Source', $.IntegerLiteral),
      ')'
    ),
    LLessTerm: $ => seq(
      field('Term', 'LLess'),
      '(',
      field('Source1', $.ComputationalData), ',',
      field('Source2', $.ComputationalData),
      ')'
    ),
    LGreaterEqualTerm: $ => seq(
      field('Term', 'LGreaterEqual'),
      '(',
      field('Source1', $.ComputationalData), ',',
      field('Source2', $.ComputationalData),
      ')'
    ),
    LGreaterTerm: $ => seq(
      field('Term', 'LGreater'),
      '(',
      field('Source1', $.ComputationalData), ',',
      field('Source2', $.ComputationalData),
      ')'
    ),
    LLessEqualTerm: $ => seq(
      field('Term', 'LLessEqual'),
      '(',
      field('Source1', $.ComputationalData), ',',
      field('Source2', $.ComputationalData),
      ')'
    ),
    LAndTerm: $ => seq(
      field('Term', 'LAnd'),
      '(',
      field('Source1', $.IntegerLiteral), ',',
      field('Source2', $.IntegerLiteral),
      ')'
    ),
    LEqualTerm: $ => seq(
      field('Term', 'LEqual'),
      '(',
      field('Source1', $.ComputationalData), ',',
      field('Source2', $.ComputationalData),
      ')'
    ),
    ToDecimalStringTerm: $ => seq(
      field('Term', 'ToDecimalString'),
      '(',
      field('Data', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),
    ToHexStringTerm: $ => seq(
      field('Term', 'ToHexString'),
      '(',
      field('Data', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),
    ToStringTerm: $ => seq(
      field('Term', 'ToString'),
      '(',
      field('Source', $._TermArg), ',',
      field('Result', $._Target),
      ')'
    ),
    IncTerm: $ => seq(
      field('Term', 'Increment'),
      '(',
      field('Addend', $._SuperName),
      ')'
    ),
    FromBCDTerm: $ => seq(
      field('Term', 'FromBCD'),
      '(',
      field('BCDValue', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),
    FindSetLeftBitTerm: $ => seq(
      field('Term', 'FindSetLeftBit'),
      '(',
      field('Source', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),
    FindSetRightBitTerm: $ => seq(
      field('Term', 'FindSetRightBit'),
      '(',
      field('Source', $._TermArg), ',',
      field('Result', $._Target),
      ')'
    ),
    DivideTerm: $ => seq(
      field('Term', 'Divide'),
      '(',
      field('Dividend', $._TermArg), ',',
      field('Divisor', $._TermArg), ',',
      field('Remainder', $._Target), ',',
      field('Result', $._Target),
      ')'
    ),
    AndTerm: $ => seq(
      field('Term', 'And'),
      '(',
      field('Source1', $._TermArg), ',',
      field('Source2', $._TermArg), ',',
      field('Result', $._Target),
      ')'
    ),
    AddTerm: $ => seq(
      field('Term', 'Add'),
      '(',
      field('Addend1', $._TermArg), ',',
      field('Addend2', $._TermArg), ',',
      field('Result', $._Target),
      ')'
    ),
    CopyObjectTerm: $ => seq(
      field('Term', 'CopyObject'),
      '(',
      field('Source', $._TermArg), ',',
      field('Result', choice($.NameString, $.LocalTerm, $.ArgTerm)),
      ')'
    ),
    DecTerm: $ => seq(
      field('Term', 'Decrement'),
      '(',
      field('Minuend', $._SuperName),
      ')'
    ),
    UnloadTerm: $ => seq(
      field('Term', 'Unload'),
      '(',
      field('DDBHandle', $._SuperName),
      ')'
    ),
    SleepTerm: $ => seq(
      field('Term', 'Sleep'),
      '(',
      field('MilliSeconds', $._TermArg),
      ')'
    ),
    StallTerm: $ => seq(
      field('Term', 'Stall'),
      '(',
      field('MicroSeconds', $._TermArg),
      ')'
    ),
    SignalTerm: $ => seq(
      field('Term', 'Signal'),
      '(',
      field('SyncObject', $._SuperName),
      ')'
    ),
    ResetTerm: $ => seq(
      field('Term', 'Reset'),
      '(',
      field('SyncObject', $._SuperName),
      ')'
    ),
    ReleaseTerm: $ => seq(
      field('Term', 'Release'),
      '(',
      field('SyncObject', $._SuperName),
      ')'
    ),
    NotifyTerm: $ => seq(
      field('Term', 'Notify'),
      '(',
      field('Object', $._SuperName), ',',
      field('NotificationValue', $._TermArg),
      ')'
    ),
    FatalTerm: $ => seq(
      field('Term', 'Fatal'),
      '(',
      field('Type', $.IntegerLiteral), ',',
      field('Code', $.IntegerLiteral), ',',
      field('Arg', $._TermArg),
      ')'
    ),
    AcquireTerm: $ => seq(
      field('Term', 'Acquire'),
      '(',
      field('SyncObject', $._SuperName), ',',
      field('TimeoutValue', $.IntegerLiteral),
      ')'
    ),
    ReturnTerm: $ => seq(
      field('Term', 'Return'),
      '(',
      field('Arg', optional($._TermArg)),
      ')'
    ),
    AccessAsTerm: $ => seq(
      field('Term', 'AccessAs'),
      '(',
      field('AccessType', $.AccessTypeKeyword), ',',
      field('AccessAttribute', choice($.IntegerLiteral, $.AccessAttribKeyword)),
      ')'
    ),
    OffsetTerm: $ => seq(
      field('Term', 'Offset'),
      '(',
      field('ByteOffset', $.IntegerLiteral),
      ')'
    ),
    PackageTerm: $ => seq(
      field('Term', 'Package'),
      '(',
      field('NumElements', $.IntegerLiteral),
      ')',
      '{',
      field('Body', optional($.PackageList)),
      '}'
    ),
    BufferTerm: $ => seq(
      field('Term', 'Buffer'),
      '(',
      field('BuffSize', optional($._TermArg)),
      ')',
      '{',
      field('Body', optional(choice($.StringData, $.ByteList))),
      '}'
    ),
    UnicodeTerm: $ => seq(
      field('Term', 'Unicode'),
      '(',
      field('String', $.StringLiteral),
      ')'
    ),
    ToPLDTerm: $ => seq(
      field('Term', 'ToPLD'),
      '(',
      field('PLDKeywordList', $.PLDKeywordList),
      ')'
    ),
    ToUUIDTerm: $ => seq(
      field('Term', 'ToUUID'),
      '(',
      field('String', $.StringLiteral),
      ')'
    ),
    ToBufferTerm: $ => seq(
      field('Term', 'ToBuffer'),
      '(',
      field('Data', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),
    ResourceTemplateTerm: $ => seq(
      field('Term', 'ResourceTemplate'),
      '(',
      ')',
      '{',
      field('ResourceMacroList', $.ResourceMacroList),
      '}'
    ),
    MidTerm: $ => seq(
      field('Term', 'Mid'),
      '(',
      field('Source', $._TermArg), ',',
      field('Index', $._TermArg), ',',
      field('Length', $._TermArg), ',',
      field('Result', $._Target),
      ')'
    ),
    IndexSymbolicTerm: $ => seq(
      field('Source', $._TermArg),
      '[',
      field('Index', $._TermArg),
      ']'
    ),
    IndexTerm: $ => seq(
      field('Term', 'Index'),
      '(',
      field('Source', $._TermArg), ',',
      field('Index', $.IntegerLiteral), ',',
      field('Destination', $._Target),
      ')'
    ),
    CondRefOfTerm: $ => seq(
      field('Term', 'CondRefOf'),
      '(',
      field('Source', choice($.NameString, $.ArgTerm, $.LocalTerm, $.DerefOfTerm)),
      ')'
    ),
    RefOfTerm: $ => seq(
      field('Term', 'RefOf'),
      '(',
      field('Source', choice($.NameString, $.ArgTerm, $.LocalTerm, $.DerefOfTerm)),
      ')'
    ),
    DerefOfTerm: $ => seq(
      field('Term', 'DerefOf'),
      '(',
      field('Source', choice($.NameString, $.ArgTerm, $.LocalTerm, $.RefOfTerm, $.CondRefOfTerm, $.IndexSymbolicTerm)),
      ')'
    ),
    ConcatResTerm: $ => seq(
      field('Term', 'ConcatenateResTemplate'),
      '(',
      field('Source1', $._TermArg), ',',
      field('Source2', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')',
    ),
    ConcatTerm: $ => seq(
      field('Term', 'Concatenate'),
      '(',
      field('Source1', $._TermArg), ',',
      field('Source2', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')',
    ),
    IncludeTerm: $ => seq(
      field('Term', 'Include'),
      '(',
      field('FilePathName', $.StringData),
      ')',
    ),
    ExternalTerm: $ => seq(
      field('Term', 'External'),
      '(',
      field('ObjName', $.NameString), ',',
      field('ObjType', $.ObjectTypeKeyword),
      ')',
    ),
    CreateBitFieldTerm: $ => seq(
      field('Term', 'CreateBitField'),
      '(',
      field('SourceBuffer', $.NameSeg), ',',
      field('BitIndex', $._TermArg), ',',
      field('BitFieldName', $.NameString),
      ')'
    ),
    MethodTerm: $ => seq(
      field('Term', 'Method'),
      '(',
      field('MethodName', $.NameString),  ',',
      field('NumArgs', $.IntegerLiteral), ',',
      field('SerializeRule', $.SerializeRuleKeyword),
      ')',
      '{',
      optional(field('body', $._TermList)),
      '}'
    ),
    CreateByteFieldTerm: $ => seq(
      field('Term', 'CreateByteField'),
      '(',
      field('SourceBuffer', $._SuperName), ',',
      field('ByteIndex', $._TermArg), ',',
      field('ByteFieldName', $.NameString),
      ')'
    ),
    CreateDWordFieldTerm: $ => seq(
      field('Term', 'CreateDWordField'),
      '(',
      field('SourceBuffer', $._TermArg), ',',
      field('ByteIndex', $._TermArg), ',',
      field('DWordFieldName', $.NameString),
      ')'
    ),
    CreateFieldTerm: $ => seq(
      field('Term', 'CreateField'),
      '(',
      field('SourceBuffer', $._TermArg), ',',
      field('BitIndex', $._TermArg), ',',
      field('NumBits', $._TermArg), ',',
      field('FieldName', $.NameString),
      ')'
    ),
    CreateQWordFieldTerm: $ => seq(
      field('Term', 'CreateQWordField'),
      '(',
      field('SourceBuffer', $._TermArg), ',',
      field('ByteIndex', $._TermArg), ',',
      field('QWordFieldName', $.NameString),
      ')'
    ),
    CreateWordFieldTerm: $ => seq(
      field('Term', 'CreateWordField'),
      '(',
      field('SourceBuffer', $._TermArg), ',',
      field('ByteIndex', $._TermArg), ',',
      field('WordFieldName', $.NameString),
      ')'
    ),
    DataRegionTerm: $ => seq(
      field('Term', 'DataTableRegion'),
      '(',
      field('RegionName', $.NameString), ',',
      field('SignatureString', $.StringLiteral), ',',
      field('OemIDString', $.StringLiteral), ',',
      field('OemTableIDString', $.StringLiteral),
      ')'
    ),
    DeviceTerm: $ => seq(
      field('Term', 'Device'),
      '(',
      field('DeviceName', $.NameString),
      ')',
      '{',
      field("TermList", $._TermList),
      '}'
    ),
    EventTerm: $ => seq(
      field('Term', 'Event'),
      '(',
      field('EventName', $.NameString),
      ')'
    ),
    FieldTerm: $ => seq(
      field('Term', 'Field'),
      '(',
      field('RegionName', $.NameString), ',',
      field('AccessType', $.AccessTypeKeyword), ',',
      field('LockRule', $.LockRuleKeyword), ',',
      field('UpdateRule', $.UpdateRuleKeyword),
      ')',
      '{',
      optional(field("FieldUnitList", $.FieldUnitList)),
      '}'
    ),
    IndexFieldTerm: $ => seq(
      field('Term', 'IndexField'),
      '(',
      field('IndexName', $.NameString), ',',
      field('DataName', $.NameString), ',',
      field('AccessType', $.AccessTypeKeyword), ',',
      field('LockRule', $.LockRuleKeyword), ',',
      field('UpdateRule', $.UpdateRuleKeyword),
      ')',
      '{',
      field("FieldUnitList", $.FieldUnitList),
      '}'
    ),
    MutexTerm: $ => seq(
      field('Term', 'Mutex'),
      '(',
      field('MutexName', $.NameString), ',',
      field('SyncLevel', $.IntegerLiteral),
      ')'
    ),
    OpRegionTerm: $ => seq(
      field('Term', 'OperationRegion'),
      '(',
      field('RegionName', $.NameString), ',',
      field('RegionSpace', $.RegionSpaceKeyword), ',',
      field('Offset', $._TermArg), ',',
      field('Length', $._TermArg),
      ')'
    ),
    PowerResTerm: $ => seq(
      field('Term', 'PowerResource'),
      '(',
      field('ResourceName', $.NameString), ',',
      field('SystemLevel', $.IntegerLiteral), ',',
      field('ResourceOrder', $.IntegerLiteral),
      ')',
      '{',
      field("TermList", $._TermList),
      '}'
    ),
    ProcessorTerm: $ => seq(
      field('Term', 'Processor'),
      '(',
      field('ProcessorName', $.NameString), ',',
      field('ProcessorID', $.IntegerLiteral), ',',
      field('PBlockAddress', $.IntegerLiteral), ',',
      field('PblockLength', $.IntegerLiteral),
      ')',
      '{',
      optional(field("TermList", $._TermList)),
      '}'
    ),
    ThermalZoneTerm: $ => seq(
      field('Term', 'ThermalZone'),
      '(',
      field('ThermalZoneName', $.NameString),
      ')',
      '{',
      field("TermList", $._TermList),
      '}'
    ),
    AliasTerm: $ => seq(
      field('Term', 'Alias'),
      '(',
      field('SourceObject', $.NameString), ',',
      field('AliasObject', $.NameString),
      ')'
    ),
    NameTerm: $ => seq(
      field('Term', 'Name'),
      '(',
      field('ObjectName', $.NameString), ',',
      field('Object', $._DataObject),
      ')',
    ),
    ScopeTerm: $ => seq(
      field('Term', 'Scope'),
      '(',
      field('Location', $.NameString),
      ')',
      '{',
      optional(field("TermList", $._TermList)),
      '}'
    ),
    ResourceMacroList: $ => repeat1($.ResourceMacroTerm),
    ResourceMacroTerm: $ => choice(
      $.DMATerm,
      $.DWordIOTerm,
      $.DWordMemoryTerm,
      $.DWordSpaceTerm,
      $.EndDependentFnTerm,
      $.ExtendedIOTerm,
      $.ExtendedMemoryTerm,
      $.ExtendedSpaceTerm,
      $.FixedDMATerm,
      $.FixedIOTerm,
      $.GpioIntTerm,
      $.GpioIOTerm,
      $.I2CSerialBusTerm,
      $.InterruptTerm,
      $.IOTerm,
      $.IRQNoFlagsTerm,
      $.IRQTerm,
      $.Memory24Term,
      $.Memory32FixedTerm,
      $.Memory32Term,
      $.PinConfigTerm,
      $.PinFunctionTerm,
      $.PinGroupTerm,
      $.PinGroupConfigTerm,
      $.PinGroupFunctionTerm,
      $.QWordIOTerm,
      $.QWordMemoryTerm,
      $.QWordSpaceTerm,
      $.RegisterTerm,
      $.SPISerialBusTerm,
      $.StartDependentFnTerm,
      $.StartDependentFnNoPriTerm,
      $.UARTSerialBusTerm,
      $.VendorLongTerm,
      $.VendorShortTerm,
      $.WordBusNumberTerm,
      $.WordIOTerm,
      $.WordSpaceTerm
    ),
    EndDependentFnTerm: $ => seq(
      field('Term', 'EndDependentFn'),
      '(',
      ')'
    ),
    ExtendedIOTerm: $ => seq(
      field('Term', 'ExtendedIO'),
      '(',
      field('ResourceUsage', $.ResourceTypeKeyword), ',',
      field('MinType', optional($.MinKeyword)), ',',
      field('MaxType', optional($.MaxKeyword)), ',',
      field('Decode', optional($.DecodeKeyword)), ',',
      field('RangeType', optional($.RangeTypeKeyword)), ',',
      field('AddressGranularity', $.IntegerLiteral), ',',
      field('MinAddress', $.IntegerLiteral), ',',
      field('MaxAddress', $.IntegerLiteral), ',',
      field('AddressTranslation', $.IntegerLiteral), ',',
      field('AddressLength', $.IntegerLiteral), ',',
      field('TypeSpecificAttributes', optional($.IntegerLiteral)), ',',
      field('DescriptorName', optional($.NameString)), ',',
      field('TranslationType', optional($.TypeKeyword)), ',',
      field('TranslationDensity', optional($.TranslationKeyword)),
      ')',
    ),
    ExtendedMemoryTerm: $ => seq(
      field('Term', 'ExtendedMemory'),
      '(',
      field('ResourceUsage', $.ResourceTypeKeyword), ',',
      field('Decode', optional($.DecodeKeyword)), ',',
      field('MinType', optional($.MinKeyword)), ',',
      field('MaxType', optional($.MaxKeyword)), ',',
      field('MemType', optional($.MemTypeKeyword)), ',',
      field('ReadWriteType', optional($.ReadWriteKeyword)), ',',
      field('AddressGranularity', $.IntegerLiteral), ',',
      field('MinAddress', $.IntegerLiteral), ',',
      field('MaxAddress', $.IntegerLiteral), ',',
      field('AddressTranslation', $.IntegerLiteral), ',',
      field('AddressLength', $.IntegerLiteral), ',',
      field('TypeSpecificAttributes', optional($.IntegerLiteral)), ',',
      field('DescriptorName', optional($.NameString)), ',',
      field('MemoryRangeType', optional($.AddressKeyword)), ',',
      field('TranslationType', optional($.TypeKeyword)),
      ')',
    ),
    ExtendedSpaceTerm: $ => seq(
      field('Term', 'ExtendedSpace'),
      '(',
      field('ResourceType', $.IntegerLiteral), ',',
      field('ResourceUsage', optional($.ResourceTypeKeyword)), ',',
      field('Decode', optional($.DecodeKeyword)), ',',
      field('MinType', optional($.MinKeyword)), ',',
      field('MaxType', optional($.MaxKeyword)), ',',
      field('TypeSpecificFlags', $.IntegerLiteral), ',',
      field('AddressGranularity', $.IntegerLiteral), ',',
      field('MinAddress', $.IntegerLiteral), ',',
      field('MaxAddress', $.IntegerLiteral), ',',
      field('AddressTranslation', $.IntegerLiteral), ',',
      field('AddressLength', $.IntegerLiteral), ',',
      field('TypeSpecificAttributes', optional($.IntegerLiteral)), ',',
      field('DescriptorName', optional($.NameString)),
      ')',
    ),
    FixedDMATerm: $ => seq(
      field('Term', 'FixedDMA'),
      '(',
      field('DMAReq', $.IntegerLiteral), ',',
      field('Channel', $.IntegerLiteral), ',',
      field('XferWidth', optional($.TransferWidthKeyword)), ',',
      field('DescriptorName', optional($.NameString)),
      ')',
    ),
    FixedIOTerm: $ => seq(
      field('Term', 'FixedIO'),
      '(',
      field('AddressBase', $.IntegerLiteral), ',',
      field('RangeLength', $.IntegerLiteral), ',',
      field('DescriptorName', optional($.NameString)),
      ')',
    ),
    GpioIntTerm: $ => seq(
      field('Term', 'GpioInt'),
      '(',
      field('InterruptType', $.InterruptTypeKeyword), ',',
      field('InterruptLevel', $.InterruptLevelKeyword), ',',
      field('ShareType', optional($.ShareTypeKeyword)), ',',
      field('PinConfig', choice($.PinConfigKeyword, $.IntegerLiteral)), ',',
      field('DeBounceTime', optional($.IntegerLiteral)), ',',
      field('ResourceSource', $.StringData), ',',
      field('ResourceSourceIndex', optional($.IntegerLiteral)), ',',
      field('ResourceUsage', optional($.ResourceTypeKeyword)), ',',
      field('DescriptorName', optional($.NameString)), ',',
      field('VendorData', optional($._SuperName)),
      ')',
      '{',
      field('PinList', $.PackageList),
      '}',
    ),
    GpioIOTerm: $ => seq(
      field('Term', 'GpioIo'),
      '(',
      field('ShareType', optional($.ShareTypeKeyword)), ',',
      field('PinConfig', $.PinConfigKeyword), ',',
      field('DeBounceTime', optional($.IntegerLiteral)), ',',
      field('DriveStrength', optional($.IntegerLiteral)), ',',
      field('IORestriction', optional($.IORestrictionKeyword)), ',',
      field('ResourceSource', $.StringData), ',',
      field('ResourceSourceIndex', optional($.IntegerLiteral)), ',',
      field('ResourceUsage', optional($.ResourceTypeKeyword)), ',',
      field('DescriptorName', optional($.NameString)), ',',
      field('VendorData', optional($._SuperName)),
      ')',
      '{',
      field('PinList', $.PackageList),
      '}',
    ),
    I2CSerialBusTerm: $ => seq(
      field('Term', 'I2cSerialBusV2'),
      '(',
      field('SlaveAddress', $.IntegerLiteral), ',',
      field('SlaveMode', optional($.SlaveModeKeyword)), ',',
      field('ConnectionSpeed', $.IntegerLiteral), ',',
      field('AddressingMode', optional($.AddressingModeKeyword)), ',',
      field('ResourceSource', $.StringData), ',',
      field('ResourceSourceIndex', optional($.IntegerLiteral)), ',',
      field('ResourceUsage', optional($.ResourceTypeKeyword)), ',',
      field('DescriptorName', optional($.NameString)), ',',
      field('ShareType', optional($.ShareTypeKeyword)), ',',
      field('VendorData', optional($._SuperName)),
      ')',
    ),
    InterruptTerm: $ => seq(
      field('Term', 'Interrupt'),
      '(',
      field('ResourceType', optional($.ResourceTypeKeyword)), ',',
      field('InterruptType', $.InterruptTypeKeyword), ',',
      field('InterruptLevel', $.InterruptLevelKeyword), ',',
      field('ShareType', $.ShareTypeKeyword), ',',
      field('ResourceSourceIndex', optional($.IntegerLiteral)), ',',
      field('ResourceSource', optional($.StringData)), ',',
      field('DescriptorName', optional($.NameString)),
      ')',
      '{',
      field('Body', $.PackageList),
      '}'
    ),
    IOTerm: $ => seq(
      field('Term', 'IO'),
      '(',
      field('IODecode', $.IODecodeKeyword), ',',
      field('MinAddress', $.IntegerLiteral), ',',
      field('MaxAddress', $.IntegerLiteral), ',',
      field('Alignment', $.IntegerLiteral), ',',
      field('RangeLength', $.IntegerLiteral), ',',
      field('DescriptorName', optional($.NameString)),
      ')',
    ),
    IRQNoFlagsTerm: $ => seq(
      field('Term', 'IRQNoFlags'),
      '(',
      optional(field('DescriptorName', $.NameString)),
      ')',
      '{',
      field('InterruptList', $.ByteList),
      '}'
    ),
    IRQTerm: $ => seq(
      field('Term', 'IRQ'),
      '(',
      field('InterruptType', $.InterruptTypeKeyword), ',',
      field('InterruptLevel', $.InterruptLevelKeyword), ',',
      field('ShareType', $.ShareTypeKeyword), ',',
      field('DescriptorName', optional($.NameString)),
      ')',
      '{',
      field('InterruptList', $.ByteList),
      '}'
    ),
    Memory24Term: $ => seq(
      field('Term', 'Memory24'),
      '(',
      field('ReadWriteType', $.ReadWriteKeyword), ',',
      field('MinAddress', $.IntegerLiteral), ',',
      field('MaxAddress', $.IntegerLiteral), ',',
      field('Alignment', $.IntegerLiteral), ',',
      field('RangeLength', $.IntegerLiteral), ',',
      field('DescriptorName', optional($.NameString)),
      ')',
    ),
    Memory32FixedTerm: $ => seq(
      field('Term', 'Memory32Fixed'),
      '(',
      field('ReadWriteType', $.ReadWriteKeyword), ',',
      field('AddressBase', $.IntegerLiteral), ',',
      field('RangeLength', $.IntegerLiteral), ',',
      field('DescriptorName', optional($.NameString)),
      ')',
    ),
    Memory32Term: $ => seq(
      field('Term', 'Memory32'),
      '(',
      field('ReadWriteType', $.ReadWriteKeyword), ',',
      field('MinAddress', $.IntegerLiteral), ',',
      field('MaxAddress', $.IntegerLiteral), ',',
      field('Alignment', $.IntegerLiteral), ',',
      field('RangeLength', $.IntegerLiteral), ',',
      field('DescriptorName', optional($.NameString)),
      ')',
    ),
    PinConfigTerm: $ => seq(
      field('Term', 'PinConfig'),
      '(',
      field('ShareType', $.ShareTypeKeyword), ',',
      field('PinConfigType', $.IntegerLiteral), ',',
      field('PinConfigValue', $.IntegerLiteral), ',',
      field('ResourceSource', $.StringData), ',',
      field('ResourceSourceIndex', optional($.IntegerData)), ',',
      field('ResourceUsage', optional($.ResourceTypeKeyword)), ',',
      field('DescriptorName', optional($.NameString)), ',',
      field('VendorData', optional($._SuperName)),
      ')',
      '{',
      field('PinList', $.PackageList),
      '}'
    ),
    PinFunctionTerm: $ => seq(
      field('Term', 'PinFunction'),
      '(',
      field('ShareType', $.ShareTypeKeyword), ',',
      field('PinPullConfiguration', choice($.PinConfigKeyword, $.IntegerLiteral)), ',',
      field('FunctionNumber', $.IntegerLiteral), ',',
      field('ResourceSource', optional($.StringData)), ',',
      field('ResourceSourceIndex', optional($.IntegerData)), ',',
      field('ResourceUsage', optional($.ResourceTypeKeyword)), ',',
      field('DescriptorName', optional($.NameString)), ',',
      field('VendorData', optional($._SuperName)),
      ')',
      '{',
      field('PinList', $.PackageList),
      '}'
    ),
    PinGroupTerm: $ => seq(
      field('Term', 'PinGroup'),
      '(',
      field('ResourceLabel', $.NameString), ',',
      field('ResourceUsage', optional($.ResourceTypeKeyword)), ',',
      field('DescriptorName', optional($.NameString)), ',',
      field('VendorData', optional($._SuperName)),
      ')',
      '{',
      field('PinList', $.PackageList),
      '}'
    ),
    PinGroupConfigTerm: $ => seq(
      field('Term', 'PinGroupConfig'),
      '(',
      field('ShareType', $.ShareTypeKeyword), ',',
      field('PinConfigType', $.IntegerLiteral), ',',
      field('PinConfigValue', $.IntegerLiteral), ',',
      field('ResourceSource', $.StringData), ',',
      field('ResourceSourceIndex', optional($.IntegerData)), ',',
      field('ResourceSourceLabel', $.StringData), ',',
      field('ResourceUsage', optional($.ResourceTypeKeyword)), ',',
      field('DescriptorName', optional($.NameString)), ',',
      field('VendorData', optional($._SuperName)),
      ')',
    ),
    PinGroupFunctionTerm: $ => seq(
      field('Term', 'PinGroupFunction'),
      '(',
      field('ShareType', $.ShareTypeKeyword), ',',
      field('FunctionNumber', $.IntegerLiteral), ',',
      field('ResourceSource', $.StringData), ',',
      field('ResourceSourceIndex', optional($.IntegerData)), ',',
      field('ResourceSourceLabel', $.StringData), ',',
      field('ResourceUsage', optional($.ResourceTypeKeyword)), ',',
      field('DescriptorName', optional($.NameString)), ',',
      field('VendorData', optional($._SuperName)),
      ')',
    ),
    QWordIOTerm: $ => seq(
      field('Term', 'QWordIO'),
      '(',
      field('ResourceUsage', $.ResourceTypeKeyword), ',',
      field('MinType', optional($.MinKeyword)), ',',
      field('MaxType', optional($.MaxKeyword)), ',',
      field('Decode', optional($.DecodeKeyword)), ',',
      field('RangeType', optional($.RangeTypeKeyword)), ',',
      field('AddressGranularity', $.IntegerLiteral), ',',
      field('MinAddress', $.IntegerLiteral), ',',
      field('MaxAddress', $.IntegerLiteral), ',',
      field('AddressTranslation', $.IntegerLiteral), ',',
      field('AddressLength', $.IntegerLiteral), ',',
      field('ResourceSourceIndex', optional($.IntegerData)), ',',
      field('ResourceSource', optional($.StringData)), ',',
      field('DescriptorName', optional($.NameString)),
      ')',
    ),
    QWordMemoryTerm: $ => seq(
      field('Term', 'QWordMemory'),
      '(',
      field('ResourceUsage', optional($.ResourceTypeKeyword)), ',',
      field('Decode', optional($.DecodeKeyword)), ',',
      field('MinType', optional($.MinKeyword)), ',',
      field('MaxType', optional($.MaxKeyword)), ',',
      field('MemType', optional($.MemTypeKeyword)), ',',
      field('ReadWriteType', $.ReadWriteKeyword), ',',
      field('AddressGranularity', $.IntegerLiteral), ',',
      field('MinAddress', $.IntegerLiteral), ',',
      field('MaxAddress', $.IntegerLiteral), ',',
      field('AddressTranslation', $.IntegerLiteral), ',',
      field('AddressLength', $.IntegerLiteral), ',',
      field('ResourceSourceIndex', optional($.IntegerLiteral)), ',',
      field('ResourceSource', optional($.StringData)), ',',
      field('DescriptorName', optional($.NameString)),',',
      field('MemoryRangeType', optional($.AddressKeyword)), ',',
      field('TranslationType', optional($.TypeKeyword)),  
      ')',
    ),
    QWordSpaceTerm: $ => seq(
      field('Term', 'QWordSpace'),
      '(',
      field('ResourceType', $.IntegerLiteral), ',',
      field('ResourceUsage', optional($.ResourceTypeKeyword)), ',',
      field('Decode', optional($.DecodeKeyword)), ',',
      field('MinType', optional($.MinKeyword)), ',',
      field('MaxType', optional($.MaxKeyword)), ',',
      field('TypeSpecificFlags', $.IntegerLiteral), ',',
      field('AddressGranularity', $.IntegerLiteral), ',',
      field('MinAddress', $.IntegerLiteral), ',',
      field('MaxAddress', $.IntegerLiteral), ',',
      field('AddressTranslation', $.IntegerLiteral), ',',
      field('AddressLength', $.IntegerLiteral), ',',
      field('ResourceSourceIndex', optional($.IntegerData)), ',',
      field('ResourceSource', optional($.StringData)), ',',
      field('DescriptorName', optional($.NameString)),
      ')',
    ),
    RegisterTerm: $ => seq(
      field('Term', 'Register'),
      '(',
      field('AddressSpaceID', $.AddressSpaceKeyword), ',',
      field('RegisterBitWidth', $.IntegerLiteral), ',',
      field('RegisterOffset', $.IntegerLiteral), ',',
      field('RegisterAddress', $.IntegerLiteral), ',',
      field('AccessSize', optional($.IntegerLiteral)), ',',
      field('DescriptorName', optional($.NameString)),
      ')',
    ),
    SPISerialBusTerm: $ => seq(
      field('Term', 'SpiSerialBusV2'),
      '(',
      field('DeviceSelection', $.IntegerLiteral), ',',
      field('DeviceSelectionPolarity', $.PolarityKeyword), ',',
      field('WireMode', optional($.WireModeKeyword)), ',',
      field('DataBitLength', $.IntegerLiteral), ',',
      field('SlaveMode', optional($.SlaveModeKeyword)), ',',
      field('ConnectionSpeed', $.IntegerLiteral), ',',
      field('ClockPolarity', $.ClockPolarityKeyword), ',',
      field('ClockPhase', $.ClockPhaseKeyword), ',',
      field('ResourceSource', $.StringLiteral), ',',
      field('ResourceSourceIndex', optional($.IntegerLiteral)), ',',
      field('ResourceUsage', optional($.ResourceTypeKeyword)), ',',
      field('DescriptorName', optional($.NameString)), ',',
      field('ShareType', optional($.ShareTypeKeyword)), ',',
      field('VendorData', optional($._SuperName)),
      ')',
    ),
    StartDependentFnNoPriTerm: $ => seq(
      field('Term', 'StartDependentFnNoPri'),
      '(',
      ')',
      '{',
      field('ResourceMacroList', $.ResourceMacroList),
      '}'
    ),
    StartDependentFnTerm: $ => seq(
      field('Term', 'StartDependentFn'),
      '(',
      field('CompatPriority', $.IntegerLiteral), ',',
      field('PerfRobustPriority', $.IntegerLiteral),
      ')',
      '{',
      field('ResourceMacroList', $.ResourceMacroList),
      '}'
    ),
    UARTSerialBusTerm: $ => seq(
      field('Term', 'UartSerialBusV2'),
      '(',
      field('InitialBaudRate', $.IntegerLiteral), ',',
      field('BitsPerByte', optional($.DataBitsKeyword)), ',',
      field('StopBits', optional($.StopBitsKeyword)), ',',
      field('LinesInUse', $.IntegerLiteral), ',',
      field('IsBigEndian', optional($.EndianessKeyword)), ',',
      field('Parity', optional($.ParityTypeKeyword)), ',',
      field('FlowControl', optional($.FlowControlKeyword)), ',',
      field('ReceiveBufferSize', $.IntegerLiteral), ',',
      field('TransmitBufferSize', $.IntegerLiteral), ',',
      field('ResourceSource', $.StringData), ',',
      field('ResourceSourceIndex', optional($.IntegerLiteral)), ',',
      field('ResourceUsage', optional($.ResourceTypeKeyword)), ',',
      field('DescriptorName', optional($.NameString)), ',',
      field('ShareType', optional($.ShareTypeKeyword)), ',',
      field('VendorData', optional($._SuperName)),
      ')',
    ),
    VendorLongTerm: $ => seq(
      field('Term', 'VendorLong'),
      '(',
      field('DescriptorName', optional($.NameString)),
      ')',
      '{',
      field('Body', $.ByteList),
      '}'
    ),
    VendorShortTerm: $ => seq(
      field('Term', 'VendorShort'),
      '(',
      field('DescriptorName', optional($.NameString)),
      ')',
      '{',
      field('Body', $.ByteList),
      '}'
    ),
    WordBusNumberTerm: $ => seq(
      field('Term', 'WordBusNumber'),
      '(',
      field('ResourceUsage', optional($.ResourceTypeKeyword)), ',',
      field('MinType', optional($.MinKeyword)), ',',
      field('MaxType', optional($.MaxKeyword)), ',',
      field('Decode', optional($.DecodeKeyword)), ',',
      field('AddressGranularity', $.IntegerData), ',',
      field('MinAddress', $.IntegerData), ',',
      field('MaxAddress', $.IntegerData), ',',
      field('AddressTranslation', $.IntegerData), ',',
      field('AddressLength', $.IntegerData), ',',
      field('ResourceSourceIndex', optional($.IntegerData)), ',',
      field('ResourceSource', optional($.StringData)), ',',
      field('DescriptorName', optional($.NameString)),
      ')'
    ),
    WordIOTerm: $ => seq(
      field('Term', 'WordIO'),
      '(',
      field('ResourceUsage', $.ResourceTypeKeyword), ',',
      field('MinType', optional($.MinKeyword)), ',',
      field('MaxType', optional($.MaxKeyword)), ',',
      field('Decode', optional($.DecodeKeyword)), ',',
      field('RangeType', optional($.RangeTypeKeyword)), ',',
      field('AddressGranularity', $.IntegerData), ',',
      field('MinAddress', $.IntegerData), ',',
      field('MaxAddress', $.IntegerData), ',',
      field('AddressTranslation', $.IntegerData), ',',
      field('AddressLength', $.IntegerData), ',',
      field('ResourceSourceIndex', optional($.IntegerData)), ',',
      field('ResourceSource', optional($.StringData)), ',',
      field('DescriptorName', optional($.NameString)), ',',
      field('TranslationType', optional($.TypeKeyword)), ',',
      field('TranslationDensity', optional($.TranslationKeyword)),
      ')'
    ),
    WordSpaceTerm: $ => seq(
      field('Term', 'WordSpace'),
      '(',
      field('ResourceType', $.IntegerLiteral), ',',
      field('ResourceUsage', optional($.ResourceTypeKeyword)), ',',
      field('Decode', optional($.DecodeKeyword)), ',',
      field('MinType', optional($.MinKeyword)), ',',
      field('MaxType', optional($.MaxKeyword)), ',',
      field('TypeSpecificFlags', $.IntegerLiteral), ',',
      field('AddressGranularity', $.IntegerLiteral), ',',
      field('MinAddress', $.IntegerLiteral), ',',
      field('MaxAddress', $.IntegerLiteral), ',',
      field('AddressTranslation', $.IntegerLiteral), ',',
      field('AddressLength', $.IntegerLiteral), ',',
      field('ResourceSourceIndex', optional($.IntegerData)), ',',
      field('ResourceSource', optional($.StringData)), ',',
      field('DescriptorName', optional($.NameString)),
      ')'
    ),
    DMATerm: $ => seq(
      field('Term', 'DMA'),
      '(',
      field('DMAType', $.NameString), ',',
      field('BusMaster', $.BusMasterKeyword), ',',
      field('XferType', $.XferTypeKeyword), ',',
      field('DescriptorName', optional($.NameString)),
      ')',
      '{',
      field('Body', $.ByteList),
      '}'
    ),
    DWordIOTerm: $ => seq(
      field('Term', 'DWordIO'),
      '(',
      field('ResourceUsage', optional($.ResourceTypeKeyword)), ',',
      field('MinType', optional($.MinKeyword)), ',',
      field('MaxType', optional($.MaxKeyword)), ',',
      field('Decode', optional($.DecodeKeyword)), ',',
      field('RangeType', optional($.RangeTypeKeyword)), ',',
      field('AddressGranularity', $.IntegerData), ',',
      field('MinAddress', $.IntegerData), ',',
      field('MaxAddress', $.IntegerData), ',',
      field('AddressTranslation', $.IntegerData), ',',
      field('AddressLength', $.IntegerData), ',',
      field('ResourceSourceIndex', optional($.IntegerData)), ',',
      field('ResourceSource', optional($.StringData)), ',',
      field('DescriptorName', optional($.NameString)), ',',
      field('TranslationType', optional($.TypeKeyword)), ',',
      field('TranslationDensity', optional($.TranslationKeyword)),
      ')',
    ),
    DWordMemoryTerm: $ => seq(
      field('Term', 'DWordMemory'),
      '(',
      field('ResourceUsage', $.ResourceTypeKeyword), ',',
      field('Decode', optional($.DecodeKeyword)), ',',
      field('MinType', optional($.MinKeyword)), ',',
      field('MaxType', optional($.MaxKeyword)), ',',
      field('MemType', optional($.MemTypeKeyword)), ',',
      field('ReadWriteType', $.ReadWriteKeyword), ',',
      field('AddressGranularity', $.IntegerData), ',',
      field('MinAddress', $.IntegerData), ',',
      field('MaxAddress', $.IntegerData), ',',
      field('AddressTranslation', $.IntegerData), ',',
      field('AddressLength', $.IntegerData), ',',
      field('ResourceSourceIndex', optional($.IntegerData)), ',',
      field('ResourceSource', optional($.StringData)), ',',
      field('DescriptorName', optional($.NameString)), ',',
      field('MemoryRangeType', optional($.AddressKeyword)), ',',
      field('TranslationType', optional($.TypeKeyword)),
      ')',
    ),
    DWordSpaceTerm: $ => seq(
      field('Term', 'DWordSpace'),
      '(',
      field('ResourceType', $.IntegerLiteral),
      ')',
    ),
    DebugTerm: $ => 'Debug',
    AccessAttribKeyword: $ => choice(
      'AttribQuick',
      'AttribSendReceive',
      'AttribByte',
      'AttribWord',
      'AttribBlock',
      'AttribProcessCall',
      'AttribBlockProcessCall'
    ),
    AccessTypeKeyword: $ => choice(
      'AnyAcc',
      'ByteAcc',
      'WordAcc',
      'DWordAcc',
      'QWordAcc',
      'BufferAcc'
    ),
    AddressKeyword: $ => choice(
      'AddressRangeMemory',
      'AddressRangeReserved',
      'AddressRangeNVS',
      'AddressRangeACPI'
    ),
    AddressSpaceKeyword: $ => choice(
      $.RegionSpaceKeyword,
      'FFixedHW'
    ),
    AddressingModeKeyword: $ => choice(
      'AddressingMode7Bit',
      'AddressingMode10Bit'
    ),
    ByteLengthKeyword: $ => choice(
      'DataBitsFive',
      'DataBitsSix',
      'DataBitsSeven',
      'DataBitsEight',
      'DataBitsNine'
    ),
    BusMasterKeyword: $ => choice(
      'BusMaster',
      'NotBusMaster'
    ),
    ClockPhaseKeyword: $ => choice(
      'ClockPhaseFirst',
      'ClockPhaseSecond'
    ),
    ClockPolarityKeyword: $ => choice(
      'ClockPolarityLow',
      'ClockPolarityHigh'
    ),
    DecodeKeyword: $ => choice(
      'SubDecode',
      'PosDecode'
    ),
    EndianKeyword: $ => choice(
      'BigEndianing',
      'LittleEndian'
    ),
    ExtendedAccessAttribKeyword: $ => choice(
      'AttribBytes',
      'AttribRawBytes',
      'AttribRawProcessBytes'
    ),
    FlowControlKeyword: $ => choice(
      'FlowControlNone',
      'FlowControlXon',
      'FlowControlHardware'
    ),
    InterruptTypeKeyword: $ => choice(
      'Edge',
      'Level'
    ),
    InterruptLevel: $ => choice(
      'ActiveHigh',
      'ActiveLow'
    ),
    InterruptLevelKeyword: $ => choice(
      'ActiveHigh',
      'ActiveLow',
      'ActiveBoth'
    ),
    IODecodeKeyword: $ => choice(
      'Decode16',
      'Decode10'
    ),
    IoRestrictionKeyword: $ => choice(
      'IoRestrictionNone',
      'IoRestrictionInputOnly',
      'IoRestrictionOutputOnly',
      'IoRestrictionNoneAndPreserve'
    ),
    LockRuleKeyword: $ => choice(
      'Lock',
      'NoLock'
    ),
    MatchOpKeyword: $ => choice(
      'MTR',
      'MEQ',
      'MLE',
      'MLT',
      'MGE',
      'MGT'
    ),
    MaxKeyword: $ => choice(
      'MaxFixed',
      'MaxNotFixed'
    ),
    MemTypeKeyword: $ => choice(
      'Cacheable',
      'WriteCombining',
      'Prefetchable',
      'NonCacheable'
    ),
    MinKeyword: $ => choice(
      'MinFixed',
      'MinNotFixed'
    ),
    ObjectTypeKeyword: $ => choice(
      'UnknownObj',
      'IntObj',
      'StrObj',
      'BuffObj',
      'PkgObj',
      'FieldUnitObj',
      'DeviceObj',
      'EventObj',
      'MethodObj',
      'MutexObj',
      'OpRegionObj',
      'PowerResObj',
      'ThermalZoneObj',
      'BuffFieldObj',
      'ProcessorObj'
    ),
    ParityKeyword: $ => choice(
      'ParityTypeNone',
      'ParityTypeSpace',
      'ParityTypeMark',
      'ParityTypeOdd',
      'ParityTypeEven'
    ),
    PinConfigKeyword: $ => choice(
      'PullDefault',
      'PullUp',
      'PullDown',
      'PullNone'
    ),
    PolarityKeyword: $ => choice(
      'PolarityHigh',
      'PolarityLow'
    ),
    RangeTypeKeyword: $ => choice(
      'ISAOnlyRanges',
      'NonISAOnlyRanges',
      'EntireRange'
    ),
    ReadWriteKeyword: $ => choice(
      'ReadWrite',
      'ReadOnly'
    ),
    RegionSpaceKeyword: $ => choice(
      'SystemIO',
      'SystemMemory',
      'PCI_Config',
      'EmbeddedControl',
      'SMBus',
      'SystemCMOS',
      'PciBarTarget',
      'IPMI',
      'GeneralPurposeIO',
      'GenericSerialBus',
      'PCC',
      alias($.MetaVarIdent, $.RegionSpaceKeyword),
    ),
    ResourceTypeKeyword: $ => choice(
      'ResourceConsumer',
      'ResourceProducer'
    ),
    SerializeRuleKeyword: $ => choice(
      'Serialized',
      'NotSerialized'
    ),
    ShareTypeKeyword: $ => choice(
      'Shared',
      'Exclusive',
      'SharedAndWake',
      'ExclusiveAndWake'
    ),
    SlaveModeKeyword: $ => choice(
      'ControllerInitiated',
      'DeviceInitiated'
    ),
    StopBitsKeyword: $ => choice(
      'StopBitsZero',
      'StopBitsOne',
      'StopBitsOnePlusHalf',
      'StopBitsTwo'
    ),
    TransferWidthKeyword: $ => choice(
      'Width8Bit',
      'Width16Bit',
      'Width32Bit',
      'Width64Bit',
      'Width128Bit',
      'Width256Bit'
    ),
    TranslationKeyword: $ => choice(
      'SparseTranslation',
      'DenseTranslation'
    ),
    TypeKeyword: $ => choice(
      'TypeTranslation',
      'TypeStatic'
    ),
    UpdateRuleKeyword: $ => choice(
      'Preserve',
      'WriteAsOnes',
      'WriteAsZeros'
    ),
    XferTypeKeyword: $ => choice(
      'Transfer8',
      'Transfer16',
      'Transfer8_16'
    ),
    WireModeKeyword: $ => choice(
      'ThreeWireMode',
      'FourWireMode'
    ),
    LocalTerm: $ => choice(
      'Local0',
      'Local1',
      'Local2',
      'Local3',
      'Local4',
      'Local5',
      'Local6',
      'Local7'
    ),
    ArgTerm: $ => choice(
      'Arg0',
      'Arg1',
      'Arg2',
      'Arg3',
      'Arg4',
      'Arg5',
      'Arg6'
    ),
    Operators: $ => choice(
      '+',
      '-',
      '*',
      '/',
      '%',
      '&',
      '|',
      '^',
      '~',
      '<',
      '>',
      '!',
      '='
    ),
    CompoundOperators: $ => choice(
      '<<',
      '>>',
      '++',
      '--',
      '==',
      '!=',
      '<=',
      '>=',
      '&&',
      '||',
      '+=',
      '-=',
      '*=',
      '/=',
      '%=',
      '<<=',
      '>>=',
      '&=',
      '|=',
      '^='
    ),  
    BreakPointTerm: $ => 'BreakPoint',
    BreakTerm: $ => 'Break',
    ContinueTerm: $ => 'Continue',
    NoOpTerm: $ => 'Noop',
    DataBitsKeyword: $ => choice(
      'DataBitsFive',
      'DataBitsSix',
      'DataBitsSeven',
      'DataBitsEight',
      'DataBitsNine'
    ),
    EndianessKeyword: $ => choice(
      'BigEndianing',
      'LittleEndian'
    ),
    ParityTypeKeyword: $ => choice(
      'ParityTypeNone',
      'ParityTypeSpace',
      'ParityTypeMark',
      'ParityTypeOdd',
      'ParityTypeEven'
    ),
    IORestrictionKeyword: $ => choice(
      'IoRestrictionNone',
      'IoRestrictionInputOnly',
      'IoRestrictionOutputOnly',
      'IoRestrictionNoneAndPreserve'
    ),
    PLDKeyword: $ => choice(
      'PLD_Revision',
      'PLD_IgnoreColor',
      'PLD_Red',
      'PLD_Green',
      'PLD_Blue',
      'PLD_Width',
      'PLD_Height',
      'PLD_UserVisible',
      'PLD_Dock',
      'PLD_Lid',
      'PLD_Panel',              
      'PLD_VerticalPosition',   
      'PLD_HorizontalPosition', 
      'PLD_Shape',              
      'PLD_GroupOrientation',
      'PLD_GroupToken',
      'PLD_GroupPosition',
      'PLD_Bay',
      'PLD_Ejectable',
      'PLD_EjectRequired',
      'PLD_CabinetNumber',
      'PLD_CardCageNumber',
      'PLD_Reference',
      'PLD_Rotation',
      'PLD_Order',
      'PLD_VerticalOffset',
      'PLD_HorizontalOffset',
    ),
  }
});
