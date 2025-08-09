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


module.exports = grammar({
  name: 'asl',

  extras: $ => [
    /\s/,       // Skip whitespace
    $._comment  // Skip comments
  ],
  
  rules: {

    // ------------------------------------------------
    // 1. Root Terms
    // ------------------------------------------------
    // RootTerm                    := DefinitionBlockTerm
    SourceFile: $ => $.DefinitionBlockTerm,

    // DefinitionBlockTerm         := DefinitionBlock (...) {TermList}
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

    // Comment handling (make them private to skip them in the tree)
    _comment: $ => token(choice(
      seq('//', /[^\n]*/),
      seq(
        '/*',
        /[^*]*\*+([^/*][^*]*\*+)*/,
        '/'
      )
    )),


    // ------------------------------------------------
    // 2. Names and Paths
    // ------------------------------------------------
    // NameSeg:= <LeadNameChar> | <LeadNameChar NameChar> | <LeadNameChar NameChar NameChar> | <LeadNameChar NameChar NameChar NameChar>
    NameSeg: $ => /[A-Za-z0-9_][A-Za-z0-9_]{0,3}/,

    // NameString := <RootChar NamePath> | <ParentPrefixChar PrefixPath NamePath> | NonEmptyNamePath
    // NameString: $ => choice(
    //   prec(2, seq(
    //     optional(choice('\\', repeat1('^'))),
    //     sepBy1('.', $.NameSeg)
    //   )),
    //   prec(1, '\\') // standalone root
    // ),
    // NameString: $ => choice(
    //   // Highest priority: root or parent prefix + NameSeg (actual named path)
    //   prec(2, seq(
    //     optional(choice('\\', repeat1('^'))),
    //     sepBy1('.', $.NameSeg)
    //   )),

    //   // Medium priority: just one or more '^'s (like ^ or ^^)
    //   prec(1, repeat1('^')),

    //   // Lowest priority: just root '\'
    //   prec(0, '\\'),
    // ),
    NameString: $ => choice(
      prec(2, '\\'),                                  // bare root
      prec(3, seq(                                    // prefer this when a path follows
        optional(choice('\\', repeat1('^'))),
         sepBy1('.', $.NameSeg)
      )),
      prec(1, repeat1('^'))                           // bare '^', '^^', ...
    ),

    // Integer := DecimalConst | OctalConst | HexConst
    IntegerLiteral: $ => token(choice(
      /0[xX][0-9a-fA-F]+/, // hex
      /[0-9]+/,            // decimal
      /Zero/,
      /One/,
      /Ones/,
      /True/,
      /False/
    )),

    // String :=  '"' Utf8CharList '"'
    StringLiteral: $ => seq(
      '"',
      repeat(/[^"\\]|\\./),
      '"'
    ),


    // ------------------------------------------------
    // 3. Major Terms
    // ------------------------------------------------
    // SuperName                   :=	NameString | ArgTerm | LocalTerm | DebugTerm | ReferenceTypeOpcode | MethodInvocationTerm
    _SuperName: $ => choice(
      $.NameString,                 
      $.ArgTerm,                    
      $.LocalTerm,                  
      $.DebugTerm,                  
      $._ReferenceTypeOpcode,        
    ),

    // Target                      :=	Nothing | SuperName
    _Target: $ => seq(
      $._SuperName                   
    ),
    
    // TermArg                     :=	ExpressionOpcode | DataObject | ArgTerm | LocalTerm | NameString | SymbolicExpression
    _TermArg: $ => choice(
      prec(2, $._SymbolicExpressionTerm),
      prec(1, $._ExpressionOpcode),
      $._DataObject,
      $.ArgTerm,
      $.LocalTerm,
      $.TimerTerm,
      $.NameString,
    ),

    // MethodInvocationTerm        :=	NameString ( // NameString => Method
    //                                     ArgList
    //                                 ) => Nothing | DataRefObject
    MethodInvocationTerm: $ => prec.left(2, seq(
      field('Term', $.NameString),
      '(',
      optional(field('ArgList', $.ArgList)),
      ')'
    )),



    // ------------------------------------------------
    // 4. List Terms
    // ------------------------------------------------
    // PLDKeywordList              :=	PLDKeyword = StringDataPLD_Revision | PLDKeyword = IntegerDataPLD_Revision | PLDKeyword = StringDataPLD_Revision, PLDKeywordListPLD_Revision, PLDKeyword = IntegerDataPLD_Revision, PLDKeywordListPLD_Revision
    PLDKeywordList: $ => seq(
      $.PLDKeyword,
      '=',
      choice(
        $.StringLiteral,
        $.IntegerLiteral,
      ),
      optional(seq(',', $.PLDKeywordList))
    ),

    // CaseTermList                :=	Nothing | CaseTerm | DefaultTerm DefaultTermList | CaseTerm CaseTermList
    CaseTermList: $ => choice(
      seq($.DefaultTerm, optional($.DefaultTermList)),
      seq($.CaseTerm, optional($.CaseTermList)),
      $.CaseTerm,
      $.DefaultTerm,
    ),

    // DefaultTermList             :=	Nothing | CaseTerm | CaseTerm DefaultTermList
    DefaultTermList: $ => choice(
      $.CaseTerm,
      seq($.CaseTerm, $.DefaultTermList)
    ),

    // ArgList                     :=	Nothing | <TermArg ArgListTail>
    ArgList: $ => sepBy1(',', $._TermArg),

    // TermList                    := Nothing | <Term SemiColonDelimiter TermList>
    _TermList: $ => repeat1($._Term),

    // Term                        := Object | StatementOpcode | ExpressionOpcode | SymbolicExpression
    _Term: $ => choice(
      $._Object,
      $._StatementOpcode,
      $._ExpressionOpcode,
      $._SymbolicExpressionTerm
    ),

    // Object                      := CompilerDirective | NamedObject | NameSpaceModifier
    _Object: $ => choice(
      $._CompilerDirective,          
      $._NamedObject,
      $._NameSpaceModifier,          
    ),
    
    // ByteList                    :=	Nothing | <ByteConstExpr ByteListTail>
    ByteList: $ => seq(
      $.IntegerLiteral,
      repeat(seq(',', $.IntegerLiteral))
    ),

    // PackageList                 :=	Nothing | <PackageElement PackageListTail>
    PackageList: $ => repeat1(
      seq($.PackageElement, optional(','))
    ),

    // PackageElement              :=	DataObject | NameString
    PackageElement: $ => choice(
      $._DataObject,                 
      $.NameString                  
    ),

    // FieldUnitEntry              :=	<Nothing | NameSeg> CommaChar Integer
    FieldUnitEntry: $ => seq(
      optional($.NameSeg),
      ',',
      $.IntegerLiteral
    ),

    // FieldUnit                   :=	FieldUnitEntry | OffsetTerm | AccessAsTerm | ConnectionTerm
    FieldUnit: $ => choice(
      $.FieldUnitEntry,            
      $.OffsetTerm,                
      $.AccessAsTerm,              
      // $.ConnectionTerm              
    ),

    // FieldUnitList               :=	Nothing | <FieldUnit FieldUnitListTail>
    FieldUnitList: $ => seq(
      sepBy1(',', $.FieldUnit),
    ),

    // ParameterTypePackage        :=	ObjectTypeKeyword | {Nothing | ParameterTypePackageList}
    ParameterTypePackage: $ => prec(1, choice(
      $.ObjectTypeKeyword,
      seq('{', optional($.ParameterTypePackageList), '}')
    )),

    // ParameterTypePackageList    :=	ObjectTypeKeyword | <ObjectTypeKeyword CommaChar ParameterTypePackageList>
    ParameterTypePackageList: $ => seq(
      $.ObjectTypeKeyword,
      repeat(seq(',', $.ObjectTypeKeyword))
    ),

    // ParameterTypesPackage       :=	ObjectTypeKeyword | {Nothing | ParameterTypesPackageList}
    ParameterTypesPackage: $ => prec(2, choice(
      $.ObjectTypeKeyword,
      seq('{', optional($.ParameterTypesPackageList), '}')
    )),

    // ParameterTypesPackageList   :=	ParameterTypePackage | <ParameterTypePackage CommaChar ParameterTypesPackageList>
    ParameterTypesPackageList: $ => seq(
      $.ParameterTypePackage,
      repeat(seq(',', $.ParameterTypePackage))
    ),

    // IfElseTerm                  :=	IfTerm ElseTerm
    IfElseTerm: $ => seq(
      $.IfTerm,
      optional($.ElseTerm)
    ),


    // ------------------------------------------------
    // 5. Data Terms
    // ------------------------------------------------
    // BufferData                  :=	BufferTypeOpcode | BufferTerm
    BufferData: $ => choice(
      $.BufferTypeOpcode,           
      $.BufferTerm                  
    ),

    // ComputationalData           :=	BufferData | IntegerData | StringData
    ComputationalData: $ => choice(
      $.BufferData,                 
      $.IntegerData,                
      $.StringData                  
    ),

    // DataObject                  :=	BufferData | PackageData | IntegerData | StringData
    _DataObject: $ => choice(
      $.IntegerLiteral,
      $.StringLiteral,
      $.BufferData,
      $.PackageData,
      $.EISAIDTerm,
    ),

    // DataRefObject               :=	DataObject | ObjectReference
    DataRefObject: $ => choice(
      $._DataObject,                 
      $.IntegerLiteral             
    ),

    // IntegerData                 :=	IntegerTypeOpcode | Integer | ConstTerm
    IntegerData: $ => choice(
      $._IntegerTypeOpcode,          
      $.IntegerLiteral,             
    ),

    // PackageData                 :=	PackageTerm
    PackageData: $ => seq(
      $.PackageTerm                 
    ),

    // StringData                  :=	StringTypeOpcode | String
    StringData: $ => choice(
      $.StringTypeOpcode,           
      $.StringLiteral               
    ),


    // ------------------------------------------------
    // 6. ASL Opcode Terms
    // ------------------------------------------------
    // CompilerDirective           :=	IncludeTerm | ExternalTerm
    _CompilerDirective: $ => choice(
      $.IncludeTerm,                
      $.ExternalTerm                
    ),

    // NamedObject                 :=	BankFieldTerm | CreateBitFieldTerm | CreateByteFieldTerm | CreateDWordFieldTerm | CreateFieldTerm | CreateQWordFieldTerm | CreateWordFieldTerm | DataRegionTerm | DeviceTerm | EventTerm | FieldTerm | FunctionTerm | IndexFieldTerm | MethodTerm | MutexTerm | OpRegionTerm | PowerResTerm | ProcessorTerm | ThermalZoneTerm
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
      // $.FunctionTerm,
      $.IndexFieldTerm,             
      $.MethodTerm,
      $.MutexTerm,                  
      $.OpRegionTerm,               
      $.PowerResTerm,               
      $.ProcessorTerm,              
      $.ThermalZoneTerm             
    ),

    // NameSpaceModifier           :=	AliasTerm | NameTerm | ScopeTerm
    _NameSpaceModifier: $ => choice(
      $.AliasTerm,  
      $.NameTerm,   
      $.ScopeTerm   
    ),

    // StatementOpcode             :=	BreakTerm | BreakPointTerm | ContinueTerm | FatalTerm | ForTerm | IfElseTerm | NoOpTerm | NotifyTerm | ReleaseTerm | ResetTerm | ReturnTerm | SignalTerm | SleepTerm | StallTerm | SwitchTerm | UnloadTerm | WhileTerm
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

    // ExpressionOpcode            :=	AcquireTerm | AddTerm | AndTerm | ConcatTerm | ConcatResTerm | CondRefOfTerm | CopyObjectTerm | DecTerm | DerefOfTerm | DivideTerm | FindSetLeftBitTerm | FindSetRightBitTerm | FprintfTerm | FromBCDTerm | IncTerm | IndexTerm | LAndTerm | LEqualTerm | LGreaterTerm | LGreaterEqualTerm | LLessTerm | LLessEqualTerm | LNotTerm | LNotEqualTerm | LOrTerm | MatchTerm | MidTerm | ModTerm | MultiplyTerm | NAndTerm | NOrTerm | NotTerm | ObjectTypeTerm | OrTerm | PrintfTerm | RefOfTerm | ShiftLeftTerm | ShiftRightTerm | SizeOfTerm | StoreTerm | SubtractTerm | TimerTerm | ToBCDTerm | ToBufferTerm | ToDecimalStringTerm | ToHexStringTerm | ToIntegerTerm | ToStringTerm | WaitTerm | XorTerm | MethodInvocationTerm | SymbolicExpressionTerm | SymbolicAssignmentTerm
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
      // $.FprintfTerm,
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
      // $.PrintfTerm,
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

    // IntegerTypeOpcode           :=	AddTerm | AndTerm | DecTerm | DerefOfTerm | DivideTerm | EISAIDTerm | FindSetLeftBitTerm | FindSetRightBitTerm | FromBCDTerm | IncTerm | LAndTerm | LEqualTerm | LGreaterTerm | LGreaterEqualTerm | LLessTerm | LLessEqualTerm | LNotTerm | LNotEqualTerm | MatchTerm | ModTerm | MultiplyTerm | NAndTerm | NOrTerm | NotTerm | OrTerm | ShiftLeftTerm | ShiftRightTerm | SubtractTerm | ToBCDTerm | ToIntegerTerm | XorTerm | SymbolicExpressionTerm
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

    // StringTypeOpcode            :=	ConcatTerm | DerefOfTerm | FprintfTerm | MidTerm | PrintfTerm | ToDecimalStringTerm | ToHexStringTerm | ToStringTerm
    StringTypeOpcode: $ => prec(3, choice(
      $.ConcatTerm,
      $.DerefOfTerm,
      // $.FprintfTerm,
      $.MidTerm,
      // $.PrintfTerm,
      $.ToDecimalStringTerm,
      $.ToHexStringTerm,
      $.ToStringTerm
    )),

    // BufferTypeOpcode            :=	ConcatTerm | ConcatResTerm | DerefOfTerm | MidTerm | ResourceTemplateTerm | ToBufferTerm | ToPLDTerm | ToUUIDTerm | UnicodeTerm
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

    // ReferenceTypeOpcode         :=	RefOfTerm | DerefOfTerm | IndexTerm | IndexSymbolicTerm | UserTermObj
    _ReferenceTypeOpcode: $ => prec(5, choice(
      $.RefOfTerm,                    
      $.DerefOfTerm,                
      $.IndexTerm,                  
      $.IndexSymbolicTerm,          
      // $.UserTermObj
    )),

    // SymbolicExpressionTerm      :=	( TermArg ) | AddSymbolicTerm | AndSymbolicTerm | DecSymbolicTerm | DivideSymbolicTerm | IncSymbolicTerm | LAndSymbolicTerm | LEqualSymbolicTerm | LGreaterEqualSymbolicTerm | LGreaterSymbolicTerm | LLessEqualSymbolicTerm | LLessSymbolicTerm | LNotEqualSymbolicTerm | LNotSymbolicTerm | LOrSymbolicTerm | ModSymbolicTerm | MultiplySymbolicTerm | NotSymbolicTerm | OrSymbolicTerm | ShiftLeftSymbolicTerm | ShiftRightSymbolicTerm | SubtractSymbolicTerm | XorSymbolicTerm
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
      // $.XorSymbolicTerm,
    ),

    // SymbolicAssignmentTerm      :=	StoreSymbolicTerm | AddCompoundTerm | AndCompoundTerm | DivideCompoundTerm | ModCompoundTerm | MultiplyCompoundTerm | OrCompoundTerm | ShiftLeftCompoundTerm | ShiftRightCompoundTerm | SubtractCompoundTerm | XorCompoundTerm
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

    // ------------------------------------------------
    // 7. ASL Primary (Terminal) Terms
    // ------------------------------------------------
    // DefaultTerm                 :=	Default {TermList}    
    DefaultTerm: $ => seq(
      'Default',
      '{',
      optional(field('TermList', $._TermList)),
      '}'
    ),

    // CaseTerm                    :=	Case (
    //                                     Value // DataObject
    //                                 ) {TermList}
    CaseTerm: $ => seq(
      'Case',
      '(',
      field('Value', $._DataObject),
      ')',
      '{',
      optional(field('TermList', $._TermList)),
      '}'
    ),

    // SwitchTerm                  :=	Switch (
    //                                     Predicate // TermArg => ComputationalData
    //                                 ) {CaseTermList}
    SwitchTerm: $ => seq(
      'Switch',
      '(',
      field('Predicate', $._TermArg),
      ')',
      '{',
      field('CaseTermList', $.CaseTermList),
      '}'
    ),

    // WhileTerm                   :=	While (
    //                                     Predicate // TermArg => Integer
    //                                 ) {TermList}
    WhileTerm: $ => seq(
      field('Term', 'While'),
      '(',
      field('Predicate', $._TermArg),
      ')',
      '{',
      field('TermList', $._TermList),
      '}'
    ),

    // SubtractCompoundTerm        :=	Minuend-Result // TermArg => Integer => Target
    //                                 -= 
    //                                 Subtrahend // TermArg => Integer
    //                                 => Integer
    SubtractCompoundTerm: $ => prec.left(10, seq(
      field('Minuend', $._TermArg),
      '-=',
      field('Subtrahend', $._TermArg)
    )),

    // ShiftRightCompoundTerm      :=	Source-Result // TermArg => Integer => Target
    //                                 >>=
    //                                 ShiftCount // TermArg => Integer
    //                                 => Integer
    ShiftRightCompoundTerm: $ => prec.left(10, seq(
      field('Source', $._TermArg),
      '>>=',
      field('ShiftCount', $._TermArg)
    )),

    // ShiftLeftCompoundTerm       :=	Source-Result // TermArg => Integer => Target
    //                                 <<=
    //                                 ShiftCount // TermArg => Integer
    //                                 => Integer
    ShiftLeftCompoundTerm: $ => prec.left(10, seq(
      field('Source', $._TermArg),
      '<<=',
      field('ShiftCount', $._TermArg)
    )),

    // OrCompoundTerm              :=	Source1-Result // TermArg => Integer => Target
    //                                 |= 
    //                                 Source2 // TermArg => Integer
    //                                 => Integer
    OrCompoundTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '|=',
      field('Source2', $._TermArg)
    )),

    // XorCompoundTerm              :=	Source1-Result // TermArg => Integer => Target
    //                                 ^=
    //                                 Source2 // TermArg => Integer
    //                                 => Integer
    XorCompoundTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '^=',
      field('Source2', $._TermArg)
    )),

    // MultiplyCompoundTerm        :=	Multiplicand-Result // TermArg => Integer => Target
    //                             *=
    //                             Multiplier // TermArg => Integer
    //                             => Integer
    MultiplyCompoundTerm: $ => prec.left(10, seq(
      field('Multiplicand', $._TermArg),
      '*=',
      field('Multiplier', $._TermArg)
    )),

    // ModCompoundTerm             :=	Dividend-Result // TermArg => Integer => Target
    //                                 %= 
    //                                 Divisor // TermArg => Integer
    //                                 => Integer
    ModCompoundTerm: $ => prec.left(10, seq(
      field('Dividend', $._TermArg),
      '%=',
      field('Divisor', $._TermArg)
    )),

    // DivideCompoundTerm          := | Dividend-Result // TermArg => Integer => Target | /= | Divisor // TermArg => Integer | => Integer
    DivideCompoundTerm: $ => prec.left(10, seq(
      field('Dividend', $._TermArg),
      '/=',
      field('Divisor', $._TermArg)
    )),

    // AndCompoundTerm             :=	Source1-Result // TermArg => Integer => Target
    //                                 &= 
    //                                 Source2 // TermArg => Integer
    //                                 => Integer
    AndCompoundTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '&=',
      field('Source2', $._TermArg)
    )),

    // AddCompoundTerm             :=	Addend1-Result // TermArg => Integer => Target += Addend2 // TermArg => Integer => Integer
    AddCompoundTerm: $ => prec.left(10, seq(
      field('Addend1', $._TermArg),
      '+=',
      field('Result', $._TermArg)
    )),

    // StoreSymbolicTerm           :=	Destination // SuperName
    //                                 = 
    //                                 Source // TermArg => DataRefObject
    //                                 => DataRefObject
    StoreSymbolicTerm: $ => prec.left(10, seq(
      field('Destination', $._SuperName),
      '=',
      field('Source', $._TermArg)
    )),

    // XorSymbolicTerm             :=	Source1 // TermArg => Integer
    //                                 ^
    //                                 Source2 // TermArg => Integer
    //                                 => Integer
    XorSymbolicTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '^',
      field('Source2', $._TermArg)
    )),

    // SubtractSymbolicTerm        :=	Minuend // TermArg => Integer
    //                                 Subtrahend // TermArg => Integer
    //                                 => Integer
    SubtractSymbolicTerm: $ => prec.left(10, seq(
      field('Minuend', $._TermArg),
      '-',
      field('Subtrahend', $._TermArg)
    )),

    // ShiftRightSymbolicTerm      :=	Source // TermArg => Integer
    //                             >>
    //                             ShiftCount // TermArg => Integer
    //                             => Integer
    ShiftRightSymbolicTerm: $ => prec.left(10, seq(
      field('Source', $._TermArg),
      '>>',
      field('ShiftCount', $._TermArg)
    )),

    // ShiftLeftSymbolicTerm       :=	Source // TermArg => Integer
    //                                 <<
    //                                 ShiftCount // TermArg => Integer
    //                                 => Integer
    ShiftLeftSymbolicTerm: $ => prec.left(10, seq(
      field('Source', $._TermArg),
      '<<',
      field('ShiftCount', $._TermArg)
    )),

    // OrSymbolicTerm              :=	Source1 // TermArg => Integer
    //                                 |
    //                                 Source2 // TermArg => Integer
    //                                 => Integer
    OrSymbolicTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '|',
      field('Source2', $._TermArg)
    )),

    // NotSymbolicTerm             :=	~
    //                                 Source // TermArg => Integer
    //                                 => Integer
    NotSymbolicTerm: $ => prec.left(10, seq(
      '~',
      field('Source', $._TermArg)
    )),

    // MultiplySymbolicTerm        :=	Multiplicand // TermArg => Integer
    //                                 *
    //                                 Multiplier // TermArg => Integer
    //                                 => Integer
    MultiplySymbolicTerm: $ => prec.left(10, seq(
      field('Multiplicand', $._TermArg),
      '*',
      field('Multiplier', $._TermArg)
    )),

    // ModSymbolicTerm             :=	Dividend // TermArg => Integer
    //                                 %
    //                                 Divisor // TermArg => Integer
    //                                 => Integer
    ModSymbolicTerm: $ => prec.left(10, seq(
      field('Dividend', $._TermArg),
      '%',
      field('Divisor', $._TermArg)
    )),

    // LOrSymbolicTerm             :=	Source1 // TermArg => Integer
    //                                 ||
    //                                 Source2 // TermArg => Integer
    //                                 => Boolean
    LOrSymbolicTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '||',
      field('Source2', $._TermArg)
    )),

    // LNotSymbolicTerm            :=	!
    //                                 Source // TermArg => Integer
    //                                 => Boolean
    LNotSymbolicTerm: $ => prec.left(10, seq(
      '!',
      field('Source', $._TermArg)
    )),

    // LNotEqualSymbolicTerm       :=	Source1 // TermArg => ComputationalData
    //                                 !=
    //                                 Source2 // TermArg => ComputationalData
    //                                 => Boolean
    LNotEqualSymbolicTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '!=',
      field('Source2', $._TermArg)
    )),

    // LLessSymbolicTerm           :=	Source1 // TermArg => ComputationalData
    //                                 <
    //                                 Source2 // TermArg => ComputationalData
    //                                 => Boolean
    LLessSymbolicTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '<',
      field('Source2', $._TermArg)
    )),

    // LLessEqualSymbolicTerm      :=	Source1 // TermArg => ComputationalData
    //                                 <=
    //                                 Source2 // TermArg => ComputationalData
    //                                 => Boolean
    LLessEqualSymbolicTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '<=',
      field('Source2', $._TermArg)
    )),

    // LGreaterSymbolicTerm        :=	Source1 // TermArg => ComputationalData
    //                                 >
    //                                 Source2 // TermArg => ComputationalData
    //                                 => Boolean
    LGreaterSymbolicTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '>',
      field('Source2', $._TermArg)
    )),

    // LGreaterEqualSymbolicTerm   :=	Source1 // TermArg => ComputationalData
    //                                 >=
    //                                 Source2 // TermArg => ComputationalData
    //                                 => Boolean
    LGreaterEqualSymbolicTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '>=',
      field('Source2', $._TermArg)
    )),

    // LEqualSymbolicTerm          :=	Source1 // TermArg => ComputationalData
    //                                 ==
    //                                 Source2 // TermArg => ComputationalData
    //                                 => Boolean
    LEqualSymbolicTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '==',
      field('Source2', $._TermArg)
    )),

    // LAndSymbolicTerm            :=	Source1 // TermArg => Integer
    //                                 &&
    //                                 Source2 // TermArg => Integer
    //                                 => Boolean
    LAndSymbolicTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '&&',
      field('Source2', $._TermArg)
    )),

    // IncSymbolicTerm             :=	Addend // SuperName => Integer
    //                                 ++
    //                                 => Integer
    IncSymbolicTerm: $ => prec.left(10, seq(
      field('Addend', $._SuperName),
      '++',
    )),

    // DivideSymbolicTerm          :=	Dividend // TermArg => Integer
    //                                 /
    //                                 Divisor // TermArg => Integer
    //                                 => Integer
    DivideSymbolicTerm: $ => prec.left(10, seq(
      field('Dividend', $._TermArg),
      '/',
      field('Divisor', $._TermArg)
    )),

    // DecSymbolicTerm             :=	Minuend // SuperName => Integer
    //                             –
    //                             => Integer
    DecSymbolicTerm: $ => prec.left(10, seq(
      field('Minuend', $._SuperName),
      '--',
    )),

    // AndSymbolicTerm             :=	Source1 // TermArg => Integer
    //                                 &
    //                                 Source2 // TermArg => Integer
    //                                 => Integer
    AndSymbolicTerm: $ => prec.left(10, seq(
      field('Source1', $._TermArg),
      '&',
      field('Source2', $._TermArg)
    )),

    // AddSymbolicTerm             :=	Addend1 // TermArg => Integer + Addend2 // TermArg => Integer => Integer
    AddSymbolicTerm: $ => prec.left(10, seq(
      field('Addend1', $._TermArg),
      '+',
      field('Addend2', $._TermArg)
    )),

    // ElseIfTerm                  :=	ElseIf (
    //                                     Predicate // TermArg => Integer
    //                                 ) {TermList} ElseTerm
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

    // ElseTerm                    :=	Else {TermList} | ElseIfTerm | Nothing
    ElseTerm: $ => choice(
      seq(
        field('Term', 'Else'),
        '{',
        optional(field('TermList', $._TermList)),
        '}'
      ),
      $.ElseIfTerm,
    ),

    // IfTerm                      :=	If (
    //                                     Predicate // TermArg => Integer
    //                                 ) {TermList}
    IfTerm: $ => seq(
      field('Term', 'If'),
      '(',
      field('Predicate', $._TermArg),
      ')',
      '{',
      optional(field('TermList', $._TermList)),
      '}'
    ),

    // ForTerm                     :=	For (
    //                                     Initialize, // Nothing | TermArg => ComputationalData
    //                                     Predicate, // Nothing | TermArg => ComputationalData
    //                                     Update // Nothing | TermArg => ComputationalData
    //                                 ) {TermList}
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

    // LoadTerm                    :=	Load (
    //                                     Object, // NameString
    //                                     Result // SuperName => Boolean - True (non-zero) // means the table was successfully loaded
    //                                 ) => Boolean // True (Ones) means the table was successfully loaded
    LoadTerm: $ => seq(
      field('Term', 'Load'),
      '(',
      field('Object', $.NameString), ',',
      field('Result', $._SuperName),
      ')'
    ),

    // StoreTerm                   :=	Store (
    //                                     Source, // TermArg => DataRefObject
    //                                     Destination // SuperName
    //                                 ) => DataRefObject
    StoreTerm: $ => seq(
      field('Term', 'Store'),
      '(',
      field('Source', $._TermArg), ',',
      field('Destination', $._SuperName),
      ')'
    ),

    // SizeOfTerm                  :=	SizeOf (
    //                                     DataObject // SuperName => <string | buffer | package>
    //                                 ) => Integer
    SizeOfTerm: $ => seq(
      field('Term', 'SizeOf'),
      '(',
      field('DataObject', $._SuperName),
      ')',
    ),

    // EISAIDTerm                  :=	EISAID (
    //                                 EisaIdString // StringData
    //                             ) => DWordConst
    EISAIDTerm: $ => seq(
      field('Term', 'EisaId'),
      '(',
      field('EisaIdString', $.StringData),
      ')'
    ),

    // WaitTerm                    :=	Wait (
    //                                     SyncObject, // SuperName => Event
    //                                     TimeoutValue // TermArg => Integer
    //                                 ) => Boolean // True means timed-out
    WaitTerm: $ => seq(
      field('Term', 'Wait'),
      '(',
      field('SyncObject', $._SuperName), ',',
      field('TimeoutValue', $._TermArg),
      ')'
    ),

    // XOrTerm                     :=	XOr (
    //                                     Source1, // TermArg => Integer
    //                                     Source2, // TermArg => Integer
    //                                     Result // Target
    //                                 ) => Integer
    XorTerm: $ => seq(
      field('Term', 'XOr'),
      '(',
      field('Source1', $._TermArg), ',',
      field('Source2', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),

    // ToIntegerTerm               :=	ToInteger (
    //                                 Data, // TermArg => ComputationalData
    //                                 Result // Target
    //                             ) => Integer
    ToIntegerTerm: $ => seq(
      field('Term', 'ToInteger'),
      '(',
      field('Data', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),

    // SubtractTerm                :=	Subtract (
    //                                     Minuend, // TermArg => Integer
    //                                     Subtrahend, // TermArg => Integer
    //                                     Result // Target
    //                                 ) => Integer
    SubtractTerm: $ => seq(
      field('Term', 'Subtract'),
      '(',
      field('Minuend', $._TermArg), ',',
      field('Subtrahend', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),

    // TimerTerm                   :=	Timer => Integer
    TimerTerm: $ => seq(
      field('Term', 'Timer')
    ),

    // ToBCDTerm                   :=	ToBCD (
    //                                     Value, // TermArg => Integer
    //                                     Result // Target
    //                                 ) => Integer
    ToBCDTerm: $ => seq(
      field('Term', 'ToBCD'),
      '(',
      field('Value', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),

    // ShiftLeftTerm               :=	ShiftLeft (
    //                                     Source, // TermArg => Integer
    //                                     ShiftCount, // TermArg => Integer
    //                                     Result // Target
    //                                 ) => Integer
    ShiftLeftTerm: $ => seq(
      field('Term', 'ShiftLeft'),
      '(',
      field('Source', $._TermArg), ',',
      field('ShiftCount', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),

    // ShiftRightTerm              :=	ShiftRight (
    //                                     Source, // TermArg => Integer
    //                                     ShiftCount, // TermArg => Integer
    //                                     Result // Target
    //                                 ) => Integer
    ShiftRightTerm: $ => seq(
      field('Term', 'ShiftRight'),
      '(',
      field('Source', $._TermArg), ',',
      field('ShiftCount', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),

    // OrTerm                      :=	Or (
    //                                     Source1, // TermArg => Integer
    //                                     Source2, // TermArg => Integer
    //                                     Result // Target
    //                                 ) => Integer
    OrTerm: $ => seq(
      field('Term', 'Or'),
      '(',
      field('Source1', $._TermArg), ',',
      field('Source2', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),

    // NotTerm                     :=	Not (
    //                                     Source, // TermArg => Integer
    //                                     Result // Target
    //                                 ) => Integer
    NotTerm: $ => seq(
      field('Term', 'Not'),
      '(',
      field('Source', $._TermArg), ',',
      field('Result', $._Target),
      ')'
    ),

    // ObjectTypeTerm              :=	ObjectType (
    //                                     Object // NameString | ArgTerm | LocalTerm | DebugTerm | RefOfTerm | DerefOfTerm | IndexTerm
    //                                 ) => Integer
    ObjectTypeTerm: $ => seq(
      field('Term', 'ObjectType'),
      '(',
      field('Object', choice($.NameString, $.ArgTerm, $.LocalTerm, $.DebugTerm, $.RefOfTerm, $.DerefOfTerm, $.IndexTerm)),
      ')'
    ),

    // NAndTerm                    :=	NAnd (
    //                                     Source1, // TermArg => Integer
    //                                     Source2, // TermArg => Integer
    //                                     Result // Target
    //                                 ) => Integer
    NAndTerm: $ => seq(
      field('Term', 'NAnd'),
      '(',
      field('Source1', $._TermArg), ',',
      field('Source2', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),

    // NOrTerm                     :=	NOr (
    //                                     Source1, // TermArg => Integer
    //                                     Source2, // TermArg => Integer
    //                                     Result // Target
    //                                 ) => Integer
    NOrTerm: $ => seq(
      field('Term', 'NOr'),
      '(',
      field('Source1', $._TermArg), ',',
      field('Source2', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),

    // MultiplyTerm                :=	Multiply (
    //                                     Multiplicand, // TermArg => Integer
    //                                     Multiplier, // TermArg => Integer
    //                                     Result // Target
    //                                 ) => Integer
    MultiplyTerm: $ => seq(
      field('Term', 'Multiply'),
      '(',
      field('Multiplicand', $._TermArg), ',',
      field('Multiplier', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),

    // ModTerm                     :=	Mod (
    //                                     Dividend, // TermArg => Integer
    //                                     Divisor, // TermArg => Integer
    //                                     Result // Target
    //                                 ) => Integer // Returns Result
    ModTerm: $ => seq(
      field('Term', 'Mod'),
      '(',
      field('Dividend', $.IntegerLiteral), ',',
      field('Divisor', $.IntegerLiteral),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),

    // MatchTerm                   :=	Match (
    //                                     SearchPackage, // TermArg => Package
    //                                     Op1, // MatchOpKeyword
    //                                     MatchObject1, // TermArg => ComputationalData
    //                                     Op2, // MatchOpKeyword
    //                                     MatchObject2, // TermArg => ComputationalData
    //                                     StartIndex // TermArg => Integer
    //                                 ) => <ones | integer>
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

    // LOrTerm                     :=	LOr (
    //                                     Source1, // TermArg => Integer
    //                                     Source2 // TermArg => Integer
    //                                 ) => Boolean
    LOrTerm: $ => seq(
      field('Term', 'LOr'),
      '(',
      field('Source1', $.IntegerLiteral), ',',
      field('Source2', $.IntegerLiteral),
      ')'
    ),

    // LNotEqualTerm               :=	LNotEqual (
    //                                     Source1, // TermArg => ComputationalData
    //                                     Source2 // TermArg => ComputationalData
    //                                 ) => Boolean
    LNotEqualTerm: $ => seq(
      field('Term', 'LNotEqual'),
      '(',
      field('Source1', $.ComputationalData), ',',
      field('Source2', $.ComputationalData),
      ')'
    ),

    // LNotTerm                    :=	LNot (
    //                                     Source, // TermArg => Integer
    //                                 ) => Boolean
    LNotTerm: $ => seq(
      field('Term', 'LNot'),
      '(',
      field('Source', $.IntegerLiteral),
      ')'
    ),

    // LLessTerm                   :=	LLess (
    //                                     Source1, // TermArg => ComputationalData
    //                                     Source2 // TermArg => ComputationalData
    //                                 ) => Boolean
    LLessTerm: $ => seq(
      field('Term', 'LLess'),
      '(',
      field('Source1', $.ComputationalData), ',',
      field('Source2', $.ComputationalData),
      ')'
    ),

    // LGreaterEqualTerm           :=	LGreaterEqual (
    //                                 Source1, // TermArg => ComputationalData
    //                                 Source2 // TermArg => ComputationalData
    //                             ) => Boolean
    LGreaterEqualTerm: $ => seq(
      field('Term', 'LGreaterEqual'),
      '(',
      field('Source1', $.ComputationalData), ',',
      field('Source2', $.ComputationalData),
      ')'
    ),

    // LGreaterTerm                :=	LGreater (
    //                                     Source1, // TermArg => ComputationalData
    //                                     Source2 // TermArg => ComputationalData
    //                                 ) => Boolean
    LGreaterTerm: $ => seq(
      field('Term', 'LGreater'),
      '(',
      field('Source1', $.ComputationalData), ',',
      field('Source2', $.ComputationalData),
      ')'
    ),

    // LLessEqualTerm              :=	LLessEqual (
    //                                     Source1, // TermArg => ComputationalData
    //                                     Source2 // TermArg => ComputationalData
    //                                 ) => Boolean
    LLessEqualTerm: $ => seq(
      field('Term', 'LLessEqual'),
      '(',
      field('Source1', $.ComputationalData), ',',
      field('Source2', $.ComputationalData),
      ')'
    ),

    // LAndTerm                    :=	LAnd (
    //                                     Source1, // TermArg => Integer
    //                                     Source2 // TermArg => Integer
    //                                 ) => Boolean
    LAndTerm: $ => seq(
      field('Term', 'LAnd'),
      '(',
      field('Source1', $.IntegerLiteral), ',',
      field('Source2', $.IntegerLiteral),
      ')'
    ),

    // LEqualTerm                  :=	LEqual (
    //                                     Source1, // TermArg => ComputationalData
    //                                     Source2 // TermArg => ComputationalData
    //                                 ) => Boolean
    LEqualTerm: $ => seq(
      field('Term', 'LEqual'),
      '(',
      field('Source1', $.ComputationalData), ',',
      field('Source2', $.ComputationalData),
      ')'
    ),



    // ToDecimalStringTerm         :=	ToDecimalString (
    //                                     Data, // TermArg => ComputationalData
    //                                     Result // Target
    //                                 ) => String
    ToDecimalStringTerm: $ => seq(
      field('Term', 'ToDecimalString'),
      '(',
      field('Data', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),

    // ToHexStringTerm             :=	ToHexString (
    //                                     Data, // TermArg => ComputationalData
    //                                     Result // Target
    //                                 ) => String
    ToHexStringTerm: $ => seq(
      field('Term', 'ToHexString'),
      '(',
      field('Data', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),

    // ToStringTerm                :=	ToString (
    //                                     Source, // TermArg => Buffer
    //                                     Length, // Nothing | TermArg => Integer
    //                                     Result // Target
    //                                 ) => String
    ToStringTerm: $ => seq(
      field('Term', 'ToString'),
      '(',
      field('Source', $._TermArg), ',',
      field('Result', $._Target),
      ')'
    ),

    // IncTerm                     :=	Increment (
    //                                     Addend // SuperName
    //                                 ) => Integer
    IncTerm: $ => seq(
      field('Term', 'Increment'),
      '(',
      field('Addend', $._SuperName),
      ')'
    ),

    // FromBCDTerm                 :=	FromBCD (
    //                                     BCDValue, // TermArg => Integer
    //                                     Result // Target
    //                                 ) => Integer
    FromBCDTerm: $ => seq(
      field('Term', 'FromBCD'),
      '(',
      field('BCDValue', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),

    // FindSetLeftBitTerm          :=	FindSetLeftBit (
    //                                     Source, // TermArg => Integer
    //                                     Result // Target
    //                                 ) => Integer
    FindSetLeftBitTerm: $ => seq(
      field('Term', 'FindSetLeftBit'),
      '(',
      field('Source', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),
    
    // FindSetRightBitTerm         :=	FindSetRightBit (
    //                                     Source, // TermArg => Integer
    //                                     Result // Target
    //                                 ) => Integer
    FindSetRightBitTerm: $ => seq(
      field('Term', 'FindSetRightBit'),
      '(',
      field('Source', $._TermArg), ',',
      field('Result', $._Target),
      ')'
    ),

    // DivideTerm                  :=	Divide (
    //                                     Dividend, // TermArg => Integer
    //                                     Divisor, // TermArg => Integer
    //                                     Remainder, // Target
    //                                     Result // Target
    //                                 ) => Integer // Returns Result
    DivideTerm: $ => seq(
      field('Term', 'Divide'),
      '(',
      field('Dividend', $._TermArg), ',',
      field('Divisor', $._TermArg), ',',
      field('Remainder', $._Target), ',',
      field('Result', $._Target),
      ')'
    ),

    // AndTerm                     :=	And (
    //                                     Source1, // TermArg => Integer
    //                                     Source2, // TermArg => Integer
    //                                     Result // Target
    //                                 ) => Integer
    AndTerm: $ => seq(
      field('Term', 'And'),
      '(',
      field('Source1', $._TermArg), ',',
      field('Source2', $._TermArg), ',',
      field('Result', $._Target),
      ')'
    ),

    // AddTerm                     :=	Add (
    //                                     Addend1, // TermArg => Integer
    //                                     Addend2, // TermArg => Integer
    //                                     Result // Target
    //                                 ) => Integer
    AddTerm: $ => seq(
      field('Term', 'Add'),
      '(',
      field('Addend1', $._TermArg), ',',
      field('Addend2', $._TermArg), ',',
      field('Result', $._Target),
      ')'
    ),

    // CopyObjectTerm              :=	CopyObject (
    //                                     Source, // TermArg => DataRefObject
    //                                     Result, // NameString | LocalTerm | ArgTerm
    //                                 ) => DataRefObject
    CopyObjectTerm: $ => seq(
      field('Term', 'CopyObject'),
      '(',
      field('Source', $._TermArg), ',',
      field('Result', choice($.NameString, $.LocalTerm, $.ArgTerm)),
      ')'
    ),

    // DecTerm                     :=	Decrement (
    //                                     Minuend // SuperName
    //                                 ) => Integer
    DecTerm: $ => seq(
      field('Term', 'Decrement'),
      '(',
      field('Minuend', $._SuperName),
      ')'
    ),

    // UnloadTerm                  :=	Unload (
    //                                     DDBHandle // SuperName
    //                                 )
    UnloadTerm: $ => seq(
      field('Term', 'Unload'),
      '(',
      field('DDBHandle', $._SuperName),
      ')'
    ),

    // SleepTerm                   :=	Sleep (
    //                                     MilliSeconds // TermArg => Integer
    //                                 )
    SleepTerm: $ => seq(
      field('Term', 'Sleep'),
      '(',
      field('MilliSeconds', $._TermArg),
      ')'
    ),

    // StallTerm                   :=	Stall (
    //                                     MicroSeconds // TermArg => Integer
    //                                 )
    StallTerm: $ => seq(
      field('Term', 'Stall'),
      '(',
      field('MicroSeconds', $._TermArg),
      ')'
    ),

    // SignalTerm                  :=	Signal (
    //                                     SyncObject // SuperName
    //                                 )
    SignalTerm: $ => seq(
      field('Term', 'Signal'),
      '(',
      field('SyncObject', $._SuperName),
      ')'
    ),

    // ResetTerm                   :=	Reset (
    //                                     SyncObject // SuperName
    //                                 )
    ResetTerm: $ => seq(
      field('Term', 'Reset'),
      '(',
      field('SyncObject', $._SuperName),
      ')'
    ),

    // ReleaseTerm                 :=	Release (
    //                                     SyncObject // SuperName
    //                                 )
    ReleaseTerm: $ => seq(
      field('Term', 'Release'),
      '(',
      field('SyncObject', $._SuperName),
      ')'
    ),

    // NotifyTerm                  :=	Notify (
    //                                     Object, // SuperName => <thermalzone | processor | device>
    //                                     NotificationValue // TermArg => Integer
    //                                 )
    NotifyTerm: $ => seq(
      field('Term', 'Notify'),
      '(',
      field('Object', $._SuperName), ',',
      field('NotificationValue', $._TermArg),
      ')'
    ),

    // FatalTerm                   :=	Fatal (
    //                                     Type, // ByteConstExpr
    //                                     Code, // DWordConstExpr
    //                                     Arg // TermArg => Integer
    //                                 )
    FatalTerm: $ => seq(
      field('Term', 'Fatal'),
      '(',
      field('Type', $.IntegerLiteral), ',',
      field('Code', $.IntegerLiteral), ',',
      field('Arg', $._TermArg),
      ')'
    ),

    // AcquireTerm                 :=	Acquire (
    //                                     SyncObject, // SuperName => Mutex
    //                                     TimeoutValue // WordConstExpr
    //                                 ) => Boolean // True means the operation timed out and the Mutex was not acquired
    AcquireTerm: $ => seq(
      field('Term', 'Acquire'),
      '(',
      field('SyncObject', $._SuperName), ',',
      field('TimeoutValue', $.IntegerLiteral),
      ')'
    ),

    // ReturnTerm                  :=	Return (
    //                                     Arg // Nothing | TermArg => DataRefObject
    //                                 )
    ReturnTerm: $ => seq(
      field('Term', 'Return'),
      '(',
      field('Arg', optional($._TermArg)),
      ')'
    ),

    // AccessAsTerm                :=	AccessAs (
    //                                     AccessType, // AccessTypeKeyword
    //                                     AccessAttribute // Nothing | ByteConstExpr | AccessAttribKeyword | ExtendedAccessAttribTerm
    //                                 )
    AccessAsTerm: $ => seq(
      field('Term', 'AccessAs'),
      '(',
      field('AccessType', $.AccessTypeKeyword), ',',
      field('AccessAttribute', choice($.IntegerLiteral, $.AccessAttribKeyword)),
      ')'
    ),

    // OffsetTerm                  :=	Offset (
    //                                     ByteOffset // IntegerData
    //                                 )
    OffsetTerm: $ => seq(
      field('Term', 'Offset'),
      '(',
      field('ByteOffset', $.IntegerLiteral),
      ')'
    ),

    // PackageTerm                 :=	Package (
    //                                     NumElements // Nothing | ByteConstExpr | TermArg => Integer
    //                                 ) {PackageList} => Package
    PackageTerm: $ => seq(
      field('Term', 'Package'),
      '(',
      field('NumElements', $.IntegerLiteral),
      ')',
      '{',
      field('Body', optional($.PackageList)),
      '}'
    ),

    // BufferTerm                  :=	Buffer (
    //                                     BuffSize // Nothing | TermArg => Integer
    //                                 ) {StringData | ByteList} => Buffer
    BufferTerm: $ => seq(
      field('Term', 'Buffer'),
      '(',
      field('BuffSize', optional($._TermArg)),
      ')',
      '{',
      field('Body', optional(choice($.StringData, $.ByteList))),
      '}'
    ),

    // UnicodeTerm                 :=	Unicode (
    //                                     String // StringData
    //                                 ) => Buffer
    UnicodeTerm: $ => seq(
      field('Term', 'Unicode'),
      '(',
      field('String', $.StringLiteral),
      ')'
    ),

    // ToPLDTerm                   :=	ToPLD (
    //                                     PLDKeywordList
    //                                 ) => Buffer
    ToPLDTerm: $ => seq(
      field('Term', 'ToPLD'),
      '(',
      field('PLDKeywordList', $.PLDKeywordList),
      ')'
    ),

    // ToUUIDTerm                  :=	ToUUID (
    //                                 String // StringData
    //                             ) => Buffer
    ToUUIDTerm: $ => seq(
      field('Term', 'ToUUID'),
      '(',
      field('String', $.StringLiteral),
      ')'
    ),

    // ToBufferTerm                :=	ToBuffer (
    //                                     Data, // TermArg => ComputationalData
    //                                     Result // Target
    //                                 ) => ComputationalData
    ToBufferTerm: $ => seq(
      field('Term', 'ToBuffer'),
      '(',
      field('Data', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')'
    ),

    // ResourceTemplateTerm := ResourceTemplate() {ResourceMacroList} => BufferTerm
    ResourceTemplateTerm: $ => seq(
      field('Term', 'ResourceTemplate'),
      '(',
      ')',
      '{',
      field('ResourceMacroList', $.ResourceMacroList),
      '}'
    ),

    // MidTerm                     :=	Mid (
    //                                     Source, // TermArg => <buffer | String>
    //                                     Index, // TermArg => Integer
    //                                     Length, // TermArg => Integer
    //                                     Result // Target
    //                                 ) => <buffer | string>
    MidTerm: $ => seq(
      field('Term', 'Mid'),
      '(',
      field('Source', $._TermArg), ',',
      field('Index', $._TermArg), ',',
      field('Length', $._TermArg), ',',
      field('Result', $._Target),
      ')'
    ),

    // IndexSymbolicTerm           :=	Source // TermArg => <string | buffer | packageterm>
    //                                 [Index] // TermArg => Integer
    //                                 => ObjectReference
    IndexSymbolicTerm: $ => seq(
      field('Source', $._TermArg),
      '[',
      field('Index', $._TermArg),
      ']'
    ),

    // IndexTerm                   :=	Index (
    //                                     Source, // TermArg => <string | buffer | packageterm>
    //                                     Index, // TermArg => Integer
    //                                     Destination // Target
    //                                 ) => ObjectReference
    IndexTerm: $ => seq(
      field('Term', 'Index'),
      '(',
      field('Source', $._TermArg), ',',
      field('Index', $.IntegerLiteral), ',',
      field('Destination', $._Target),
      ')'
    ),

    // CondRefOfTerm               :=	CondRefOf (
    //                                     Source // NameString | ArgTerm | LocalTerm | DerefOfTerm
    //                                     Destination // Target
    //                                 ) => Boolean
    CondRefOfTerm: $ => seq(
      field('Term', 'CondRefOf'),
      '(',
      field('Source', choice($.NameString, $.ArgTerm, $.LocalTerm, $.DerefOfTerm)),
      ')'
    ),

    // RefOfTerm                   :=	RefOf (
    //                                     Source // NameString | ArgTerm | LocalTerm | DerefOfTerm
    //                                 ) => ObjectReference
    RefOfTerm: $ => seq(
      field('Term', 'RefOf'),
      '(',
      field('Source', choice($.NameString, $.ArgTerm, $.LocalTerm, $.DerefOfTerm)),
      ')'
    ),

    // DerefOfTerm                 := | DerefOf (
    //                                     | Source // NameString
    //                                     | ArgTerm
    //                                     | LocalTerm
    //                                     | RefOfTerm
    //                                     | CondRefOfTerm
    //                                     | // IndexTerm
    //                                     | MethodInvocationTerm
    //                                 | ) => DataRefObject
    DerefOfTerm: $ => seq(
      field('Term', 'DerefOf'),
      '(',
      field('Source', choice($.NameString, $.ArgTerm, $.LocalTerm, $.RefOfTerm, $.CondRefOfTerm, $.IndexSymbolicTerm)),
      ')'
    ),

    // ConcatResTerm               :=	ConcatenateResTemplate (
    //                                 Source1, // TermArg => Buffer
    //                                 Source2, // TermArg => Buffer
    //                                 Result // Target
    //                             ) => Buffer
    ConcatResTerm: $ => seq(
      field('Term', 'ConcatenateResTemplate'),
      '(',
      field('Source1', $._TermArg), ',',
      field('Source2', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')',
    ),

    // ConcatTerm                  :=	Concatenate (
    //                                 Source1, // TermArg => SuperName
    //                                 Source2, // TermArg => SuperName
    //                                 Result // Target
    //                             ) => Buffer | String
    ConcatTerm: $ => seq(
      field('Term', 'Concatenate'),
      '(',
      field('Source1', $._TermArg), ',',
      field('Source2', $._TermArg),
      optional(seq(',', field('Result', $._Target))),
      ')',
    ),

    // IncludeTerm                 :=	Include (
    //                                 FilePathName // StringData
    //                             )
    IncludeTerm: $ => seq(
      field('Term', 'Include'),
      '(',
      field('FilePathName', $.StringData),
      ')',
    ),

    // ExternalTerm                :=	External (
    //                                 ObjName, // NameString
    //                                 ObjType, // Nothing | ObjectTypeKeyword
    //                                 ResultType, // Nothing | ParameterTypePackage
    //                                 ParameterTypes // Nothing | ParameterTypesPackage
    //                             )
    ExternalTerm: $ => seq(
      field('Term', 'External'),
      '(',
      field('ObjName', $.NameString), ',',
      field('ObjType', $.ObjectTypeKeyword),
      ')',
    ),

    // CreateBitFieldTerm          :=	CreateBitField (
    //                                 SourceBuffer, // TermArg => Buffer
    //                                 BitIndex, // TermArg => Integer
    //                                 BitFieldName // NameString
    //                             )
    CreateBitFieldTerm: $ => seq(
      field('Term', 'CreateBitField'),
      '(',
      field('SourceBuffer', $.NameSeg), ',',
      field('BitIndex', $._TermArg), ',',
      field('BitFieldName', $.NameString),
      ')'
    ),

    // MethodTerm                  :=	Method (
    //                                     MethodName, // NameString
    //                                     NumArgs, // Nothing | ByteConstExpr
    //                                     SerializeRule, // Nothing | SerializeRuleKeyword
    //                                     SyncLevel, // Nothing | ByteConstExpr
    //                                     ReturnType, // Nothing | ParameterTypePackage
    //                                     ParameterTypes // Nothing | ParameterTypesPackage
    //                                 ) {TermList}
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

    // CreateByteFieldTerm         :=	CreateByteField (
    //                                     SourceBuffer, // TermArg => Buffer
    //                                     ByteIndex, // TermArg => Integer
    //                                     ByteFieldName // NameString
    //                                 )
    CreateByteFieldTerm: $ => seq(
      field('Term', 'CreateByteField'),
      '(',
      field('SourceBuffer', $._SuperName), ',',
      field('ByteIndex', $._TermArg), ',',
      field('ByteFieldName', $.NameString),
      ')'
    ),

    // CreateDWordFieldTerm        :=	CreateDWordField (
    //                                     SourceBuffer, // TermArg => Buffer
    //                                     ByteIndex, // TermArg => Integer
    //                                     DWordFieldName // NameString
    //                                 )
    CreateDWordFieldTerm: $ => seq(
      field('Term', 'CreateDWordField'),
      '(',
      field('SourceBuffer', $._TermArg), ',',
      field('ByteIndex', $._TermArg), ',',
      field('DWordFieldName', $.NameString),
      ')'
    ),

    // CreateFieldTerm             :=	CreateField (
    //                                     SourceBuffer, // TermArg => Buffer
    //                                     BitIndex, // TermArg => Integer
    //                                     NumBits, // TermArg => Integer
    //                                     FieldName // NameString
    //                                 )
    CreateFieldTerm: $ => seq(
      field('Term', 'CreateField'),
      '(',
      field('SourceBuffer', $._TermArg), ',',
      field('BitIndex', $._TermArg), ',',
      field('NumBits', $._TermArg), ',',
      field('FieldName', $.NameString),
      ')'
    ),

    // CreateQWordFieldTerm        :=	CreateQWordField (
    //                                     SourceBuffer, // TermArg => Buffer
    //                                     ByteIndex, // TermArg => Integer
    //                                     QWordFieldName // NameString
    //                                 )
    CreateQWordFieldTerm: $ => seq(
      field('Term', 'CreateQWordField'),
      '(',
      field('SourceBuffer', $._TermArg), ',',
      field('ByteIndex', $._TermArg), ',',
      field('QWordFieldName', $.NameString),
      ')'
    ),

    // CreateWordFieldTerm         :=	CreateWordField (
    //                                     SourceBuffer, // TermArg => Buffer
    //                                     ByteIndex, // TermArg => Integer
    //                                     WordFieldName // NameString
    //                                 )
    CreateWordFieldTerm: $ => seq(
      field('Term', 'CreateWordField'),
      '(',
      field('SourceBuffer', $._TermArg), ',',
      field('ByteIndex', $._TermArg), ',',
      field('WordFieldName', $.NameString),
      ')'
    ),

    // DataRegionTerm              :=	DataTableRegion (
    //                                     RegionName, // NameString
    //                                     SignatureString, // TermArg => String
    //                                     OemIDString, // TermArg => String
    //                                     OemTableIDString // TermArg => String
    //                                 )
    DataRegionTerm: $ => seq(
      field('Term', 'DataTableRegion'),
      '(',
      field('RegionName', $.NameString), ',',
      field('SignatureString', $.StringLiteral), ',',
      field('OemIDString', $.StringLiteral), ',',
      field('OemTableIDString', $.StringLiteral),
      ')'
    ),

    // DeviceTerm                  := | Device (
    //                                     | DeviceName // NameString 
    //                                 | ) {TermList}
    DeviceTerm: $ => seq(
      field('Term', 'Device'),
      '(',
      field('DeviceName', $.NameString),
      ')',
      '{',
      field("TermList", $._TermList),
      '}'
    ),

    // EventTerm                   :=	Event (
    //                                     EventName // NameString
    //                                 )
    EventTerm: $ => seq(
      field('Term', 'Event'),
      '(',
      field('EventName', $.NameString),
      ')'
    ),

    // FieldTerm                   :=	Field (
    //                                     RegionName, // NameString => OperationRegion
    //                                     AccessType, // AccessTypeKeyword
    //                                     LockRule, // LockRuleKeyword
    //                                     UpdateRule // UpdateRuleKeyword
    //                                 ) {FieldUnitList}
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

    // IndexFieldTerm              :=	IndexField (
    //                                     IndexName, // NameString => FieldUnit
    //                                     DataName, // NameString => FieldUnit
    //                                     AccessType, // AccessTypeKeyword
    //                                     LockRule, // LockRuleKeyword
    //                                     UpdateRule // UpdateRuleKeyword
    //                                 ) {FieldUnitList}
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

    // MutexTerm                   :=	Mutex (
    //                                 MutexName, // NameString
    //                                 SyncLevel // ByteConstExpr
    //                             )
    MutexTerm: $ => seq(
      field('Term', 'Mutex'),
      '(',
      field('MutexName', $.NameString), ',',
      field('SyncLevel', $.IntegerLiteral),
      ')'
    ),

    // OpRegionTerm                :=	OperationRegion (
    //                                     RegionName, // NameString
    //                                     RegionSpace, // RegionSpaceKeyword
    //                                     Offset, // TermArg => Integer
    //                                     Length // TermArg => Integer
    //                                 )
    OpRegionTerm: $ => seq(
      field('Term', 'OperationRegion'),
      '(',
      field('RegionName', $.NameString), ',',
      field('RegionSpace', $.RegionSpaceKeyword), ',',
      field('Offset', $._TermArg), ',',
      field('Length', $._TermArg),
      ')'
    ),

    // PowerResTerm                :=	PowerResource (
    //                                     ResourceName, // NameString
    //                                     SystemLevel, // ByteConstExpr
    //                                     ResourceOrder // WordConstExpr
    //                                 ) {TermList}
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

    // ProcessorTerm               :=	Processor (
    //                                     ProcessorName, // NameString
    //                                     ProcessorID, // ByteConstExpr
    //                                     PBlockAddress, // DWordConstExpr | Nothing (=0)
    //                                     PblockLength // ByteConstExpr | Nothing (=0)
    //                                 ) {TermList}
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

    // ThermalZoneTerm             :=	ThermalZone (
    //                                     ThermalZoneName // NameString
    //                                 ) {TermList}
    ThermalZoneTerm: $ => seq(
      field('Term', 'ThermalZone'),
      '(',
      field('ThermalZoneName', $.NameString),
      ')',
      '{',
      field("TermList", $._TermList),
      '}'
    ),


    // AliasTerm                   :=	Alias (
    //                                 SourceObject, // NameString
    //                                 AliasObject // NameString
    //                             )
    AliasTerm: $ => seq(
      field('Term', 'Alias'),
      '(',
      field('SourceObject', $.NameString), ',',
      field('AliasObject', $.NameString),
      ')'
    ),

    // NameTerm                    :=	Name (
    //                                     ObjectName, // NameString
    //                                     Object // DataObject
    //                                 )
    NameTerm: $ => seq(
      field('Term', 'Name'),
      '(',
      field('ObjectName', $.NameString), ',',
      field('Object', $._DataObject),
      ')',
    ),

    // ScopeTerm                   :=	Scope (
    //                                 Location // NameString
    //                             ) {TermList}
    ScopeTerm: $ => seq(
      field('Term', 'Scope'),
      '(',
      field('Location', $.NameString),
      ')',
      '{',
      optional(field("TermList", $._TermList)),
      '}'
    ),



    // ------------------------------------------------
    // 7. ASL Resource Template Terms
    // ------------------------------------------------
    // ResourceMacroList           :=	Nothing | <resourcemacroterm resourcemacrolist>
    ResourceMacroList: $ => repeat1($.ResourceMacroTerm),

    // ResourceMacroTerm           :=	DMATerm | DWordIOTerm | DWordMemoryTerm | DWordSpaceTerm | EndDependentFnTerm | ExtendedIOTerm | ExtendedMemoryTerm | ExtendedSpaceTerm | FixedDMATerm | FixedIOTerm | GpioIntTerm | GpioIOTerm | I2CSerialBusTerm | InterruptTerm | IOTerm | IRQNoFlagsTerm | IRQTerm | Memory24Term | Memory32FixedTerm | Memory32Term | PinConfigTerm | PinFunctionTerm | PinGroupTerm | PinGroupConfigTerm | PinGroupFunctionTerm | QWordIOTerm | QWordMemoryTerm | QWordSpaceTerm | RegisterTerm | SPISerialBusTerm | StartDependentFnTerm | StartDependentFnNoPriTerm | UARTSerialBusTerm | VendorLongTerm | VendorShortTerm | WordBusNumberTerm | WordIOTerm | WordSpaceTerm
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
    // EndDependentFnTerm          :=	EndDependentFn ()
    EndDependentFnTerm: $ => seq(
      field('Term', 'EndDependentFn'),
      '(',
      ')'
    ),

    // ExtendedIOTerm              :=	ExtendedIO (
    //                                     ResourceUsage, // Nothing (ResourceConsumer)| ResourceTypeKeyword
    //                                     MinType, // Nothing (MinNotFixed) | MinKeyword (_MIF)
    //                                     MaxType, // Nothing (MaxNotFixed) | MaxKeyword (_MAF)
    //                                     Decode, // Nothing (PosDecode) | DecodeKeyword (_DEC)
    //                                     RangeType, // Nothing (EntireRange) | RangeTypeKeyword (_RNG)
    //                                     AddressGranularity, // QWordConstExpr (_GRA)
    //                                     MinAddress, // QWordConstExpr (_MIN)
    //                                     MaxAddress, // QWordConstExpr (_MAX)
    //                                     AddressTranslation, // QWordConstExpr (_TRA)
    //                                     AddressLength, // QWordConstExpr (_LEN)
    //                                     TypeSpecificAttributes, // Nothing | QWordConstExpr
    //                                     DescriptorName, // Nothing | NameString
    //                                     TranslationType, // Nothing | TypeKeyword (_TTP)
    //                                     TranslationDensity // Nothing | TranslationKeyword (_TRS)
    //                                 )
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

    // ExtendedMemoryTerm          :=	ExtendedMemory (
    //                                     ResourceUsage, // Nothing (ResourceConsumer)| ResourceTypeKeyword
    //                                     Decode, // Nothing (PosDecode) | DecodeKeyword (_DEC)
    //                                     MinType, // Nothing (MinNotFixed) | MinKeyword (_MIF)
    //                                     MaxType, // Nothing (MaxNotFixed) | MaxKeyword (_MAF)
    //                                     MemType, // Nothing (NonCacheable) | MemTypeKeyword (_MEM)
    //                                     ReadWriteType, // ReadWriteKeyword (_RW)
    //                                     AddressGranularity, // QWordConstExpr (_GRA)
    //                                     MinAddress, // QWordConstExpr (_MIN)
    //                                     MaxAddress, // QWordConstExpr (_MAX)
    //                                     AddressTranslation, // QWordConstExpr (_TRA)
    //                                     AddressLength, // QWordConstExpr (_LEN)
    //                                     TypeSpecificAttributes, // Nothing | QWordConstExpr
    //                                     DescriptorName, // Nothing | NameString
    //                                     MemoryRangeType, // Nothing | AddressKeyword (_MTP)
    //                                     TranslationType // Nothing | TypeKeyword (_TTP)
    //                                 )
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

    // ExtendedSpaceTerm           :=	ExtendedSpace (
    //                                     ResourceType, // ByteConstExpr (_RT), 0xC0 - 0xFF
    //                                     ResourceUsage, // Nothing (ResourceConsumer)| ResourceTypeKeyword
    //                                     Decode, // Nothing (PosDecode) | DecodeKeyword (_DEC)
    //                                     MinType, // Nothing (MinNotFixed) | MinKeyword (_MIF)
    //                                     MaxType, // Nothing (MaxNotFixed) | MaxKeyword (_MAF)
    //                                     TypeSpecificFlags, // ByteConstExpr (_TSF)
    //                                     AddressGranularity, // QWordConstExpr (_GRA)
    //                                     MinAddress, // QWordConstExpr (_MIN)
    //                                     MaxAddress, // QWordConstExpr (_MAX)
    //                                     AddressTranslation, // QWordConstExpr (_TRA)
    //                                     AddressLength, // QWordConstExpr (_LEN)
    //                                     TypeSpecificAttributes, // Nothing | QWordConstExpr (_ATT)
    //                                     DescriptorName // Nothing | NameString
    //                                 )
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

    // FixedDMATerm                :=	FixedDMA (
    //                                     DMAReq, // WordConstExpr (_DMA)
    //                                     Channel, // WordConstExpr (_TYP)
    //                                     XferWidth, // Nothing (Width32Bit) | TransferWidthKeyword (_SIZ)
    //                                     DescriptorName, // Nothing | NameString
    //                                 )
    FixedDMATerm: $ => seq(
      field('Term', 'FixedDMA'),
      '(',
      field('DMAReq', $.IntegerLiteral), ',',
      field('Channel', $.IntegerLiteral), ',',
      field('XferWidth', optional($.TransferWidthKeyword)), ',',
      field('DescriptorName', optional($.NameString)),
      ')',
    ),

    // FixedIOTerm                 :=	FixedIO (
    //                                     AddressBase, // WordConstExpr (_BAS)
    //                                     RangeLength, // ByteConstExpr (_LEN)
    //                                     DescriptorName // Nothing | NameString
    //                                 )
    FixedIOTerm: $ => seq(
      field('Term', 'FixedIO'),
      '(',
      field('AddressBase', $.IntegerLiteral), ',',
      field('RangeLength', $.IntegerLiteral), ',',
      field('DescriptorName', optional($.NameString)),
      ')',
    ),

    // GpioIntTerm                 :=	GpioInt (
    //                                     InterruptType, // InterruptTypeKeyword (_MOD)
    //                                     InterruptLevel, // InterruptLevelKeyword (_POL)
    //                                     ShareType, // Nothing (Exclusive) | ShareTypeKeyword (_SHR)
    //                                     PinConfig, // PinConfigKeyword | ByteConstExpr (_PPI)
    //                                     DeBounceTime // Nothing | WordConstExpr (_DBT)
    //                                     ResourceSource, // StringData
    //                                     ResourceSourceIndex, // Nothing (0) | ByteConstExpr
    //                                     ResourceUsage, // Nothing (ResourceConsumer)| ResourceTypeKeyword
    //                                     DescriptorName, // Nothing | NameString
    //                                     VendorData // Nothing | RawDataBuffer (_VEN)
    //                                 ) {DWordList} // List of GPIO pins (_PIN)
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
    
    // GpioIOTerm                  :=	GpioIO (
    //                                     ShareType, // Nothing (Exclusive) | ShareTypeKeyword (_SHR)
    //                                     PinConfig, // PinConfigKeyword | ByteConstExpr (_PPIC)
    //                                     DeBounceTime // Nothing | WordConstExpr (_DBT)
    //                                     DriveStrength // Nothing | WordConstExpr (_DRS)
    //                                     IORestriction // Nothing (None) | IORestrictionKeyword (_IOR)
    //                                     ResourceSource, // StringData
    //                                     ResourceSourceIndex, // Nothing (0) | ByteConstExpr
    //                                     ResourceUsage, // Nothing (ResourceConsumer)| ResourceTypeKeyword
    //                                     DescriptorName, // Nothing | NameString
    //                                     VendorData // Nothing | RawDataBuffer (_VEN)
    //                                 ) {DWordList} // List of GPIO pins (_PIN)
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

    // I2CSerialBusTerm            :=	I2CSerialBusV2 (
    //                                     SlaveAddress, // WordConstExpr (_ADR)
    //                                     SlaveMode, // Nothing (ControllerInitiated) | SlaveModeKeyword (_SLV)
    //                                     ConnectionSpeed, // DWordConstExpr (_SPE)
    //                                     AddressingMode, // Nothing (AddressingMode7Bit) | AddressModeKeyword (_MOD)
    //                                     ResourceSource, // StringData
    //                                     ResourceSourceIndex, // Nothing | ByteConstExpr
    //                                     ResourceUsage, // Nothing (ResourceConsumer)| ResourceTypeKeyword
    //                                     DescriptorName, // Nothing | NameString
    //                                     ShareType, // Nothing (Exclusive) | ShareTypeKeyword (_SHR)
    //                                     VendorData // Nothing | RawDataBuffer (_VEN)
    //                                 )
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

    // InterruptTerm               :=	Interrupt (
    //                                     ResourceType, // Nothing (ResourceConsumer)| ResourceTypeKeyword
    //                                     InterruptType, // InterruptTypeKeyword (_LL, _HE)
    //                                     InterruptLevel, // InterruptLevelKeyword (_LL, _HE)
    //                                     ShareType, // Nothing (Exclusive) ShareTypeKeyword (_SHR)
    //                                     ResourceSourceIndex, // Nothing | ByteConstExpr
    //                                     ResourceSource, // Nothing | StringData
    //                                     DescriptorName // Nothing | NameString
    //                                 ) {DWordList} // list of interrupts (_INT)
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

    // IOTerm                      :=	IO (
    //                                     IODecode, // IODecodeKeyword (_DEC)
    //                                     MinAddress, // WordConstExpr (_MIN)
    //                                     MaxAddress, // WordConstExpr (_MAX)
    //                                     Alignment, // ByteConstExpr (_ALN)
    //                                     RangeLength, // ByteConstExpr (_LEN)
    //                                     DescriptorName // Nothing | NameString
    //                                 )
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

    // IRQNoFlagsTerm              :=	IRQNoFlags (
    //                                     DescriptorName // Nothing | NameString
    //                                 ) {ByteList} // list of interrupts (0-15 bytes)
    IRQNoFlagsTerm: $ => seq(
      field('Term', 'IRQNoFlags'),
      '(',
      optional(field('DescriptorName', $.NameString)),
      ')',
      '{',
      field('InterruptList', $.ByteList),
      '}'
    ),

    // IRQTerm                     :=	IRQ (
    //                                     InterruptType, // InterruptTypeKeyword (_LL, _HE)
    //                                     InterruptLevel, // InterruptLevelKeyword (_LL, _HE)
    //                                     ShareType, // Nothing (Exclusive) | ShareTypeKeyword (_SHR)
    //                                     DescriptorName // Nothing | NameString
    //                                 ) {ByteList} // list of interrupts (0-15 bytes)
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

    // Memory24Term                :=	Memory24 (
    //                                     ReadWriteType, // ReadWriteKeyword (_RW)
    //                                     MinAddress[23       : 8], // WordConstExpr (_MIN)
    //                                     MaxAddress[23       : 8], // WordConstExpr (_MAX)
    //                                     Alignment, // WordConstExpr (_ALN)
    //                                     RangeLength, // WordConstExpr (_LEN)
    //                                     DescriptorName // Nothing | NameString
    //                                 )
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

    // Memory32FixedTerm           :=	Memory32Fixed (
    //                                     ReadWriteType, // ReadWriteKeyword (_RW)
    //                                     AddressBase, // DWordConstExpr (_BAS)
    //                                     RangeLength, // DWordConstExpr (_LEN)
    //                                     DescriptorName // Nothing | NameString
    //                                 )
    Memory32FixedTerm: $ => seq(
      field('Term', 'Memory32Fixed'),
      '(',
      field('ReadWriteType', $.ReadWriteKeyword), ',',
      field('AddressBase', $.IntegerLiteral), ',',
      field('RangeLength', $.IntegerLiteral), ',',
      field('DescriptorName', optional($.NameString)),
      ')',
    ),

    // Memory32Term                :=	Memory32 (
    //                                     ReadWriteType, // ReadWriteKeyword (_RW)
    //                                     MinAddress, // DWordConstExpr (_MIN)
    //                                     MaxAddress, // DWordConstExpr (_MAX)
    //                                     Alignment, // DWordConstExpr (_ALN)
    //                                     RangeLength, // DWordConstExpr (_LEN)
    //                                     DescriptorName // Nothing | NameString
    //                                 )
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

    // PinConfigTerm               :=	PinConfig (
    //                                     ShareType, // Nothing (Exclusive) | ShareTypeKeyword (_SHR)
    //                                     PinConfigType, // ByteData (_TYP)
    //                                     PinConfigValue, // ByteData (_VAL)
    //                                     ResourceSource, // StringData
    //                                     ResourceSourceIndex, // Nothing (0) | ByteConstExpr
    //                                     ResourceUsage, // Nothing (ResourceConsumer)| ResourceTypeKeyword
    //                                     DescriptorName, // Nothing | NameString
    //                                     VendorData // Nothing | RawDataBuffer (_VEN)
    //                                 ) {DWordList} (_PIN)
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

    // PinFunctionTerm             :=	PinFunction (
    //                                     ShareType, // Nothing (Exclusive) | ShareTypeKeyword (_SHR)
    //                                     PinPullConfiguration, // PinConfigKeyword | ByteConstExpr (_PPI)
    //                                     FunctionNumber, // WordData
    //                                     ResourceSource, // StringData
    //                                     ResourceSourceIndex, // Nothing (0) | ByteConstExpr
    //                                     ResourceUsage, // Nothing (ResourceConsumer)| ResourceTypeKeyword
    //                                     DescriptorName, // Nothing | NameString
    //                                     VendorData // Nothing | RawDataBuffer (_VEN)
    //                                 ) {DWordList} (_PIN)
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

    // PinGroupTerm                :=	PinGroup (
    //                                     ResourceLabel, // StringData
    //                                     ResourceUsage, // Nothing (ResourceConsumer)| ResourceTypeKeyword
    //                                     DescriptorName, // Nothing | NameString
    //                                     VendorData // Nothing | RawDataBuffer (_VEN)
    //                                 ) {DWordList} (_PIN)
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

    // PinGroupConfigTerm          :=	PinGroupConfig (
    //                                     ShareType, // Nothing (Exclusive) | ShareTypeKeyword (_SHR)
    //                                     PinConfigType, // ByteData (_TYP)
    //                                     PinConfigValue, // ByteData (_VAL)
    //                                     ResourceSource, // StringData
    //                                     ResourceSourceIndex, // Nothing (0) | ByteConstExpr
    //                                     ResourceSourceLabel, // StringData
    //                                     ResourceUsage, // Nothing (ResourceConsumer)| ResourceTypeKeyword
    //                                     DescriptorName, // Nothing | NameString
    //                                     VendorData // Nothing | RawDataBuffer (_VEN)
    //                                 )
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

    // PinGroupFunctionTerm        :=	PinGroupFunction (
    //                                     ShareType, // Nothing (Exclusive) | ShareTypeKeyword (_SHR)
    //                                     FunctionNumber, // WordData (_FUN)
    //                                     ResourceSource, // StringData
    //                                     ResourceSourceIndex, // Nothing (0) | ByteConstExpr
    //                                     ResourceSourceLabel, // StringData
    //                                     ResourceUsage, // Nothing (ResourceConsumer)| ResourceTypeKeyword
    //                                     DescriptorName, // Nothing | NameString
    //                                     VendorData // Nothing | RawDataBuffer (_VEN)
    //                                 )
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

    // QWordIOTerm                 :=	QWordIO (
    //                                     ResourceUsage, // Nothing (ResourceConsumer)| ResourceTypeKeyword
    //                                     MinType, // Nothing (MinNotFixed) | MinKeyword (_MIF)
    //                                     MaxType, // Nothing (MaxNotFixed) | MaxKeyword (_MAF)
    //                                     Decode, // Nothing (PosDecode) | DecodeKeyword (_DEC)
    //                                     RangeType, // Nothing (EntireRange) | RangeTypeKeyword (_RNG)
    //                                     AddressGranularity, // QWordConstExpr (_GRA)
    //                                     MinAddress, // QWordConstExpr (_MIN)
    //                                     MaxAddress, // QWordConstExpr (_MAX)
    //                                     AddressTranslation, // QWordConstExpr (_TRA)
    //                                     AddressLength, // QWordConstExpr (_LEN)
    //                                     ResourceSourceIndex, // Nothing | ByteConstExpr
    //                                     ResourceSource, // Nothing | StringData
    //                                     DescriptorName, // Nothing | NameString
    //                                     TranslationType, // Nothing | TypeKeyword (_TTP)
    //                                     TranslationDensity // Nothing | TranslationKeyword (_TRS)
    //                                 )
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

    // QWordMemoryTerm             :=	QWordMemory (
    //                                     ResourceUsage, // Nothing (ResourceConsumer)| ResourceTypeKeyword
    //                                     Decode, // Nothing (PosDecode) | DecodeKeyword (_DEC)
    //                                     MinType, // Nothing (MinNotFixed) | MinKeyword (_MIF)
    //                                     MaxType, // Nothing (MaxNotFixed) | MaxKeyword (_MAF)
    //                                     MemType, // Nothing (NonCacheable) | MemTypeKeyword (_MEM)
    //                                     ReadWriteType, // ReadWriteKeyword (_RW)
    //                                     AddressGranularity, // QWordConstExpr (_GRA)
    //                                     MinAddress, // QWordConstExpr (_MIN)
    //                                     MaxAddress, // QWordConstExpr (_MAX)
    //                                     AddressTranslation, // QWordConstExpr (_TRA)
    //                                     AddressLength, // QWordConstExpr (_LEN)
    //                                     ResourceSourceIndex, // Nothing | ByteConstExpr
    //                                     ResourceSource, // Nothing | StringData
    //                                     DescriptorName, // Nothing | NameString
    //                                     MemoryRangeType, // Nothing | AddressKeyword (_MTP)
    //                                     TranslationType // Nothing | TypeKeyword (_TTP)
    //                                 )
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

    // QWordSpaceTerm              :=	QWordSpace (
    //                                     ResourceType, // ByteConstExpr (_RT), 0xC0 - 0xFF
    //                                     ResourceUsage, // Nothing (ResourceConsumer)| ResourceTypeKeyword
    //                                     Decode, // Nothing (PosDecode) | DecodeKeyword (_DEC)
    //                                     MinType, // Nothing (MinNotFixed) | MinKeyword (_MIF)
    //                                     MaxType, // Nothing (MaxNotFixed) | MaxKeyword (_MAF)
    //                                     TypeSpecificFlags, // ByteConstExpr (_TSF)
    //                                     AddressGranularity, // QWordConstExpr (_GRA)
    //                                     MinAddress, // QWordConstExpr (_MIN)
    //                                     MaxAddress, // QWordConstExpr (_MAX)
    //                                     AddressTranslation, // QWordConstExpr (_TRA)
    //                                     AddressLength, // QWordConstExpr (_LEN)
    //                                     ResourceSourceIndex, // Nothing | ByteConstExpr
    //                                     ResourceSource, // Nothing | StringData
    //                                     DescriptorName // Nothing | NameString
    //                                 )
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

    // RegisterTerm                :=	Register (
    //                                     AddressSpaceID, // AddressSpaceKeyword (_ASI)
    //                                     RegisterBitWidth, // ByteConstExpr (_RBW)
    //                                     RegisterOffset, // ByteConstExpr (_RBO)
    //                                     RegisterAddress, // QWordConstExpr (_ADR)
    //                                     AccessSize, // ByteConstExpr (_ASZ)
    //                                     DescriptorName // Nothing | NameString
    //                                 )
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

    // SPISerialBusTerm            :=	SPISerialBusV2 (
    //                                     DeviceSelection, // WordConstExpr (_ADR)
    //                                     DeviceSelectionPolarity, // Nothing (PolarityLow) |
    //                                     DevicePolarityKeyword (_DPL)
    //                                     WireMode, // Nothing (FourWireMode) | WireModeKeyword (_MOD)
    //                                     DataBitLength, // ByteConstExpr (_LEN)
    //                                     SlaveMode, // Nothing (ControllerInitiated) | SlaveModeKeyword (_SLV)
    //                                     ConnectionSpeed, // DWordConstExpr (_SPE)
    //                                     ClockPolarity, // ClockPolarityKeyword (_POL)
    //                                     ClockPhase, // ClockPhaseKeyword (_PHA)
    //                                     ResourceSource, // StringData
    //                                     ResourceSourceIndex, // Nothing | ByteConstExpr
    //                                     ResourceUsage, // Nothing (ResourceConsumer)| ResourceTypeKeyword
    //                                     DescriptorName, // Nothing | NameString
    //                                     ShareType, // Nothing (Exclusive) | ShareTypeKeyword (_SHR)
    //                                     VendorData // Nothing | RawDataBuffer (_VEN)
    //                                 )
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

    // StartDependentFnNoPriTerm   :=	StartDependentFnNoPri () {ResourceMacroList}
    StartDependentFnNoPriTerm: $ => seq(
      field('Term', 'StartDependentFnNoPri'),
      '(',
      ')',
      '{',
      field('ResourceMacroList', $.ResourceMacroList),
      '}'
    ),

    // StartDependentFnTerm        :=	StartDependentFn (
    //                                     CompatPriority, // ByteConstExpr (0-2)
    //                                     PerfRobustPriority // ByteConstExpr (0-2)
    //                                 ) {ResourceMacroList}
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

    // UARTSerialBusTerm           :=	UARTSerialBusV2 (
    //                                     Initial BaudRate, // DwordConstExpr (_SPE)
    //                                     BitsPerByte, // Nothing (DataBitsEight) | DataBitsKeyword (_LEN)
    //                                     StopBits, // Nothing (StopBitsOne) | StopBitsKeyword (_STB)
    //                                     LinesInUse, // ByteConstExpr (_LIN)
    //                                     IsBigEndian, // Nothing (LittleEndian) | EndianessKeyword (_END)
    //                                     Parity, // Nothing (ParityTypeNone) | ParityTypeKeyword (_PAR)
    //                                     FlowControl, // Nothing (FlowControlNone) | FlowControlKeyword (_FLC)
    //                                     ReceiveBufferSize, // WordConstExpr (_RXL)
    //                                     TransmitBufferSize, // WordConstExpr (_TXL)
    //                                     ResourceSource, // StringData
    //                                     ResourceSourceIndex, // Nothing | ByteConstExpr
    //                                     ResourceUsage, // Nothing (ResourceConsumer)| ResourceTypeKeyword
    //                                     DescriptorName, // Nothing | NameString
    //                                     ShareType, // Nothing (Exclusive) | ShareTypeKeyword (_SHR)
    //                                     VendorData // Nothing | Object (_VEN)
    //                                 )
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

    // VendorLongTerm              :=	VendorLong (
    //                                     DescriptorName // Nothing | NameString
    //                                 ) {ByteList}
    VendorLongTerm: $ => seq(
      field('Term', 'VendorLong'),
      '(',
      field('DescriptorName', optional($.NameString)),
      ')',
      '{',
      field('Body', $.ByteList),
      '}'
    ),

    // VendorShortTerm             :=	VendorShort (
    //                                     DescriptorName // Nothing | NameString
    //                                 ) {ByteList} // Up to 7 bytes
    VendorShortTerm: $ => seq(
      field('Term', 'VendorShort'),
      '(',
      field('DescriptorName', optional($.NameString)),
      ')',
      '{',
      field('Body', $.ByteList),
      '}'
    ),

    // WordBusNumberTerm           :=	WordBusNumber (
    //                                     ResourceUsage, // Nothing (ResourceConsumer)| ResourceTypeKeyword
    //                                     MinType, // Nothing (MinNotFixed) | MinKeyword (_MIF)
    //                                     MaxType, // Nothing (MaxNotFixed) | MaxKeyword (_MAF)
    //                                     Decode, // Nothing (PosDecode) | DecodeKeyword (_DEC)
    //                                     AddressGranularity, // WordConstExpr (_GRA)
    //                                     MinAddress, // WordConstExpr (_MIN)
    //                                     MaxAddress, // WordConstExpr (_MAX)
    //                                     AddressTranslation, // WordConstExpr (_TRA)
    //                                     AddressLength, // WordConstExpr (_LEN)
    //                                     ResourceSourceIndex, // Nothing | ByteConstExpr
    //                                     ResourceSource, // Nothing | StringData
    //                                     DescriptorName // Nothing | NameString
    //                                 )
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

    // WordIOTerm                  :=	WordIO (
    //                                     ResourceUsage, // Nothing (ResourceConsumer)| ResourceTypeKeyword
    //                                     MinType, // Nothing (MinNotFixed) | MinKeyword (_MIF)
    //                                     MaxType, // Nothing (MaxNotFixed) | MaxKeyword (_MAF)
    //                                     Decode, // Nothing (PosDecode) | DecodeKeyword (_DEC)
    //                                     RangeType, // Nothing (EntireRange) | RangeTypeKeyword (_RNG)
    //                                     AddressGranularity, // WordConstExpr (_GRA)
    //                                     MinAddress, // WordConstExpr (_MIN)
    //                                     MaxAddress, // WordConstExpr (_MAX)
    //                                     AddressTranslation, // WordConstExpr (_TRA)
    //                                     AddressLength, // WordConstExpr (_LEN)
    //                                     ResourceSourceIndex, // Nothing | ByteConstExpr
    //                                     ResourceSource, // Nothing | StringData
    //                                     DescriptorName, // Nothing | NameString
    //                                     TranslationType, // Nothing | TypeKeyword (_TTP)
    //                                     TranslationDensity // Nothing | TranslationKeyword (_TRS)
    //                                 )
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

    // WordSpaceTerm               :=	WordSpace (
    //                                     ResourceType, // ByteConstExpr (_RT), 0xC0 - 0xFF
    //                                     ResourceUsage, // Nothing (ResourceConsumer)| ResourceTypeKeyword
    //                                     Decode, // Nothing (PosDecode) | DecodeKeyword (_DEC)
    //                                     MinType, // Nothing (MinNotFixed) | MinKeyword (_MIF)
    //                                     MaxType, // Nothing (MaxNotFixed) | MaxKeyword (_MAF)
    //                                     TypeSpecificFlags, // ByteConstExpr (_TSF)
    //                                     AddressGranularity, // WordConstExpr (_GRA)
    //                                     MinAddress, // WordConstExpr (_MIN)
    //                                     MaxAddress, // WordConstExpr (_MAX)
    //                                     AddressTranslation, // WordConstExpr (_TRA)
    //                                     AddressLength, // WordConstExpr (_LEN)
    //                                     ResourceSourceIndex, // Nothing | ByteConstExpr
    //                                     ResourceSource, // Nothing | StringData
    //                                     DescriptorName // Nothing | NameString
    //                                 )
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

    // DMATerm                     :=	DMA (
    //                                     DMAType, // DMATypeKeyword (_TYP)
    //                                     BusMaster, // BusMasterKeyword (_BM)
    //                                     XferType, // XferTypeKeyword (_SIZ)
    //                                     DescriptorName // Nothing | NameString
    //                                 ) {ByteList} // List of channels (0-7 bytes)
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

    // DWordIOTerm                 :=	DWordIO (
    //                                     ResourceUsage, // Nothing (ResourceConsumer)| ResourceTypeKeyword
    //                                     MinType, // Nothing (MinNotFixed) | MinKeyword (_MIF)
    //                                     MaxType, // Nothing (MaxNotFixed) | MaxKeyword (_MAF)
    //                                     Decode, // Nothing (PosDecode) | DecodeKeyword (_DEC)
    //                                     RangeType, // Nothing (EntireRange) | RangeTypeKeyword (_RNG)
    //                                     AddressGranularity, // DWordConstExpr (_GRA)
    //                                     MinAddress, // DWordConstExpr (_MIN)
    //                                     MaxAddress, // DWordConstExpr (_MAX)
    //                                     AddressTranslation, // DWordConstExpr (_TRA)
    //                                     AddressLength, // DWordConstExpr (_LEN)
    //                                     ResourceSourceIndex, // Nothing | ByteConstExpr
    //                                     ResourceSource, // Nothing | StringData
    //                                     DescriptorName, // Nothing | NameString
    //                                     TranslationType, // Nothing | TypeKeyword (_TTP)
    //                                     TranslationDensity // Nothing | TranslationKeyword (_TRS)
    //                                 )
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

    // DWordMemoryTerm             :=	DWordMemory (
    //                                     ResourceUsage, // Nothing (ResourceConsumer)| ResourceTypeKeyword
    //                                     Decode, // Nothing (PosDecode) | DecodeKeyword (_DEC)
    //                                     MinType, // Nothing (MinNotFixed) | MinKeyword (_MIF)
    //                                     MaxType, // Nothing (MaxNotFixed) | MaxKeyword (_MAF)
    //                                     MemType, // Nothing (NonCacheable) | MemTypeKeyword (_MEM)
    //                                     ReadWriteType, // ReadWriteKeyword (_RW)
    //                                     AddressGranularity, // DWordConstExpr (_GRA)
    //                                     MinAddress, // DWordConstExpr (_MIN)
    //                                     MaxAddress, // DWordConstExpr (_MAX)
    //                                     AddressTranslation, // DWordConstExpr (_TRA)
    //                                     AddressLength, // DWordConstExpr (_LEN)
    //                                     ResourceSourceIndex, // Nothing | ByteConstExpr
    //                                     ResourceSource, // Nothing | StringData
    //                                     DescriptorName, // Nothing | NameString
    //                                     MemoryRangeType, // Nothing | AddressKeyword (_MTP)
    //                                     TranslationType // Nothing | TypeKeyword (_TTP)
    //                                 )
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

    // DWordSpaceTerm              :=	DWordSpace (
    //                                     ResourceType, // ByteConstExpr (_RT), 0xC0 - 0xFF
    //                                     ResourceUsage, // Nothing (ResourceConsumer)| ResourceTypeKeyword
    //                                     Decode, // Nothing (PosDecode) | DecodeKeyword (_DEC)
    //                                     MinType, // Nothing (MinNotFixed) | MinKeyword (_MIF)
    //                                     MaxType, // Nothing (MaxNotFixed) | MaxKeyword (_MAF)
    //                                     TypeSpecificFlags, // ByteConstExpr (_TSF)
    //                                     AddressGranularity, // DWordConstExpr (_GRA)
    //                                     MinAddress, // DWordConstExpr (_MIN)
    //                                     MaxAddress, // DWordConstExpr (_MAX)
    //                                     AddressTranslation, // DWordConstExpr (_TRA)
    //                                     AddressLength, // DWordConstExpr (_LEN)
    //                                     ResourceSourceIndex, // Nothing | ByteConstExpr
    //                                     ResourceSource, // Nothing | StringData
    //                                     DescriptorName // Nothing | NameString
    //                                 )
    DWordSpaceTerm: $ => seq(
      field('Term', 'DWordSpace'),
      '(',
      field('ResourceType', $.IntegerLiteral),
      ')',
    ),


    // ------------------------------------------------
    // 8. ASL Parameter Keyword Terms
    // ------------------------------------------------
    // DebugTerm                   :=	Debug
    DebugTerm: $ => 'Debug',

    // AccessAttribKeyword         :=	AttribQuick | AttribSendReceive | AttribByte | AttribBytes (n) | AttribRawBytes (n) | AttribRawProcessBytes (n) | AttribWord | AttribBlock |AttribProcessCall | AttribBlockProcessCall
    AccessAttribKeyword: $ => choice(
      'AttribQuick',
      'AttribSendReceive',
      'AttribByte',
      'AttribWord',
      'AttribBlock',
      'AttribProcessCall',
      'AttribBlockProcessCall'
    ),

    // AccessTypeKeyword           :=	AnyAcc | ByteAcc | WordAcc | DWordAcc | QWordAcc | BufferAcc
    AccessTypeKeyword: $ => choice(
      'AnyAcc',
      'ByteAcc',
      'WordAcc',
      'DWordAcc',
      'QWordAcc',
      'BufferAcc'
    ),

    // AddressKeyword              :=	AddressRangeMemory | AddressRangeReserved | AddressRangeNVS | AddressRangeACPI
    AddressKeyword: $ => choice(
      'AddressRangeMemory',
      'AddressRangeReserved',
      'AddressRangeNVS',
      'AddressRangeACPI'
    ),

    // AddressSpaceKeyword         :=	RegionSpaceKeyword | FFixedHW
    AddressSpaceKeyword: $ => choice(
      $.RegionSpaceKeyword,
      'FFixedHW'
    ),

    // AddressingModeKeyword       :=	AddressingMode7Bit | AddressingMode10Bit
    AddressingModeKeyword: $ => choice(
      'AddressingMode7Bit',
      'AddressingMode10Bit'
    ),

    // ByteLengthKeyword           :=	DataBitsFive | DataBitsSix | DataBitsSeven | DataBitsEight | DataBitsNine
    ByteLengthKeyword: $ => choice(
      'DataBitsFive',
      'DataBitsSix',
      'DataBitsSeven',
      'DataBitsEight',
      'DataBitsNine'
    ),

    // BusMasterKeyword            :=	BusMaster | NotBusMaster
    BusMasterKeyword: $ => choice(
      'BusMaster',
      'NotBusMaster'
    ),

    // ClockPhaseKeyword           :=	ClockPhaseFirst | ClockPhaseSecond
    ClockPhaseKeyword: $ => choice(
      'ClockPhaseFirst',
      'ClockPhaseSecond'
    ),

    // ClockPolarityKeyword        :=	ClockPolarityLow | ClockPolarityHigh
    ClockPolarityKeyword: $ => choice(
      'ClockPolarityLow',
      'ClockPolarityHigh'
    ),

    // DecodeKeyword               :=	SubDecode | PosDecode
    DecodeKeyword: $ => choice(
      'SubDecode',
      'PosDecode'
    ),

    // EndianKeyword               :=	BigEndianing | LittleEndian
    EndianKeyword: $ => choice(
      'BigEndianing',
      'LittleEndian'
    ),

    // ExtendedAccessAttribKeyword :=	AttribBytes | AttribRawBytes | AttribRawProcessBytes // Note: Used for GenericSerialBus BufferAcc only.
    ExtendedAccessAttribKeyword: $ => choice(
      'AttribBytes',
      'AttribRawBytes',
      'AttribRawProcessBytes'
    ),

    // FlowControlKeyword          :=	FlowControlNone | FlowControlXon | FlowControlHardware
    FlowControlKeyword: $ => choice(
      'FlowControlNone',
      'FlowControlXon',
      'FlowControlHardware'
    ),

    // InterruptTypeKeyword        :=	Edge | Level
    InterruptTypeKeyword: $ => choice(
      'Edge',
      'Level'
    ),

    // InterruptLevel              :=	ActiveHigh | ActiveLow
    InterruptLevel: $ => choice(
      'ActiveHigh',
      'ActiveLow'
    ),

    // InterruptLevelKeyword       :=	ActiveHigh | ActiveLow | ActiveBoth
    InterruptLevelKeyword: $ => choice(
      'ActiveHigh',
      'ActiveLow',
      'ActiveBoth'
    ),

    // IODecodeKeyword             :=	Decode16 | Decode10
    IODecodeKeyword: $ => choice(
      'Decode16',
      'Decode10'
    ),

    // IoRestrictionKeyword        :=	IoRestrictionNone | IoRestrictionInputOnly | IoRestrictionOutputOnly | IoRestrictionNoneAndPreserve
    IoRestrictionKeyword: $ => choice(
      'IoRestrictionNone',
      'IoRestrictionInputOnly',
      'IoRestrictionOutputOnly',
      'IoRestrictionNoneAndPreserve'
    ),
    // LockRuleKeyword             :=	Lock | NoLock
    LockRuleKeyword: $ => choice(
      'Lock',
      'NoLock'
    ),

    // MatchOpKeyword              :=	MTR | MEQ | MLE | MLT | MGE | MGT
    MatchOpKeyword: $ => choice(
      'MTR',
      'MEQ',
      'MLE',
      'MLT',
      'MGE',
      'MGT'
    ),

    // MaxKeyword                  :=	MaxFixed | MaxNotFixed
    MaxKeyword: $ => choice(
      'MaxFixed',
      'MaxNotFixed'
    ),

    // MemTypeKeyword              :=	Cacheable | WriteCombining | Prefetchable | NonCacheable
    MemTypeKeyword: $ => choice(
      'Cacheable',
      'WriteCombining',
      'Prefetchable',
      'NonCacheable'
    ),

    // MinKeyword                  :=	MinFixed | MinNotFixed
    MinKeyword: $ => choice(
      'MinFixed',
      'MinNotFixed'
    ),

    // ObjectTypeKeyword           :=	UnknownObj | IntObj | StrObj | BuffObj | PkgObj | FieldUnitObj | DeviceObj | EventObj | MethodObj | MutexObj | OpRegionObj | PowerResObj | ThermalZoneObj | BuffFieldObj
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

    // ParityKeyword               :=	ParityTypeNone | ParityTypeSpace | ParityTypeMark | ParityTypeOdd | ParityTypeEven
    ParityKeyword: $ => choice(
      'ParityTypeNone',
      'ParityTypeSpace',
      'ParityTypeMark',
      'ParityTypeOdd',
      'ParityTypeEven'
    ),

    // PinConfigKeyword            :=	PullDefault | PullUp | PullDown | PullNone
    PinConfigKeyword: $ => choice(
      'PullDefault',
      'PullUp',
      'PullDown',
      'PullNone'
    ),

    // PolarityKeyword             :=	PolarityHigh | PolarityLow
    PolarityKeyword: $ => choice(
      'PolarityHigh',
      'PolarityLow'
    ),

    // RangeTypeKeyword            :=	ISAOnlyRanges | NonISAOnlyRanges | EntireRange
    RangeTypeKeyword: $ => choice(
      'ISAOnlyRanges',
      'NonISAOnlyRanges',
      'EntireRange'
    ),

    // ReadWriteKeyword            :=	ReadWrite | ReadOnly
    ReadWriteKeyword: $ => choice(
      'ReadWrite',
      'ReadOnly'
    ),

    // RegionSpaceKeyword          :=	SystemIO | SystemMemory | PCI_Config | EmbeddedControl | SMBus | SystemCMOS | PciBarTarget | IPMI | GeneralPurposeIO | GenericSerialBus | PCC
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
      'PCC'
    ),

    // ResourceTypeKeyword         :=	ResourceConsumer | ResourceProducer
    ResourceTypeKeyword: $ => choice(
      'ResourceConsumer',
      'ResourceProducer'
    ),

    // SerializeRuleKeyword        :=	Serialized | NotSerialized
    SerializeRuleKeyword: $ => choice(
      'Serialized',
      'NotSerialized'
    ),

    // ShareTypeKeyword            :=	Shared | Exclusive | SharedAndWake | ExclusiveAndWake
    ShareTypeKeyword: $ => choice(
      'Shared',
      'Exclusive',
      'SharedAndWake',
      'ExclusiveAndWake'
    ),

    // SlaveModeKeyword            :=	ControllerInitiated | DeviceInitiated
    SlaveModeKeyword: $ => choice(
      'ControllerInitiated',
      'DeviceInitiated'
    ),

    // StopBitsKeyword             :=	StopBitsZero | StopBitsOne | StopBitsOnePlusHalf | StopBitsTwo
    StopBitsKeyword: $ => choice(
      'StopBitsZero',
      'StopBitsOne',
      'StopBitsOnePlusHalf',
      'StopBitsTwo'
    ),

    // TransferWidthKeyword        :=	Width8Bit | Width16Bit | Width32Bit | Width64Bit | Width128Bit | Width256Bit
    TransferWidthKeyword: $ => choice(
      'Width8Bit',
      'Width16Bit',
      'Width32Bit',
      'Width64Bit',
      'Width128Bit',
      'Width256Bit'
    ),

    // TranslationKeyword          :=	SparseTranslation | DenseTranslation
    TranslationKeyword: $ => choice(
      'SparseTranslation',
      'DenseTranslation'
    ),

    // TypeKeyword                 :=	TypeTranslation | TypeStatic
    TypeKeyword: $ => choice(
      'TypeTranslation',
      'TypeStatic'
    ),

    // UpdateRuleKeyword           :=	Preserve | WriteAsOnes | WriteAsZeros
    UpdateRuleKeyword: $ => choice(
      'Preserve',
      'WriteAsOnes',
      'WriteAsZeros'
    ),

    // XferTypeKeyword             :=	Transfer8 | Transfer16 | Transfer8_16
    XferTypeKeyword: $ => choice(
      'Transfer8',
      'Transfer16',
      'Transfer8_16'
    ),

    // WireModeKeyword             :=	ThreeWireMode | FourWireMode
    WireModeKeyword: $ => choice(
      'ThreeWireMode',
      'FourWireMode'
    ),

    // LocalTerm                   :=	Local0 | Local1 | Local2 | Local3 | Local4 | Local5 | Local6 | Local7
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

    // ArgTerm                     :=	Arg0 | Arg1 | Arg2 | Arg3 | Arg4 | Arg5 | Arg6
    ArgTerm: $ => choice(
      'Arg0',
      'Arg1',
      'Arg2',
      'Arg3',
      'Arg4',
      'Arg5',
      'Arg6'
    ),

    // Operators                   :=	'+' | '-' | '*' | '/' | '%' | '&' | '|' | '^' | '~' | '<' | '>' | '!' | '='
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

    // CompoundOperators           :=	'<<' | '>>' | '++' | '-' | '==' | '!=' | '<=' | '>=' | '&&' | '||' | '+=' | '-=' | '*=' | '/=' | '%=' | '<<=' | '>>=' | '&=' | '|=' | '^='
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

    // BreakPointTerm              :=	BreakPoint
    BreakPointTerm: $ => 'BreakPoint',

    // BreakTerm                   :=	Break
    BreakTerm: $ => 'Break',

    // ContinueTerm                :=	Continue
    ContinueTerm: $ => 'Continue',

    // NoOpTerm                    :=	NoOp
    NoOpTerm: $ => 'Noop',

    // DataBitsKeyword            :=	DataBitsFive | DataBitsSix | DataBitsSeven | DataBitsEight | DataBitsNine
    DataBitsKeyword: $ => choice(
      'DataBitsFive',
      'DataBitsSix',
      'DataBitsSeven',
      'DataBitsEight',
      'DataBitsNine'
    ),

    // EndianessKeyword            :=	BigEndianing | LittleEndian
    EndianessKeyword: $ => choice(
      'BigEndianing',
      'LittleEndian'
    ),

    // ParityTypeKeyword          :=	ParityTypeNone | ParityTypeSpace | ParityTypeMark | ParityTypeOdd | ParityTypeEven
    ParityTypeKeyword: $ => choice(
      'ParityTypeNone',
      'ParityTypeSpace',
      'ParityTypeMark',
      'ParityTypeOdd',
      'ParityTypeEven'
    ),

    // IORestrictionKeyword
    IORestrictionKeyword: $ => choice(
      'IoRestrictionNone',
      'IoRestrictionInputOnly',
      'IoRestrictionOutputOnly',
      'IoRestrictionNoneAndPreserve'
    ),

    // PLDKeyword
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
