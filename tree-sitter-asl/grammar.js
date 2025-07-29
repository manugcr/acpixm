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
    source_file: $ => $.DefinitionBlockTerm,

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
      field("TermList", $.TermList),
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
    NameString: $ => seq(
      optional(choice('\\', repeat1('^'))),
      sepBy1('.', $.NameSeg)
    ),

    // Integer := DecimalConst | OctalConst | HexConst
    IntegerLiteral: $ => token(choice(
      /0[xX][0-9a-fA-F]+/, // hex
      /[0-9]+/,            // decimal
      /Zero/,
      /One/,
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
    SuperName: $ => choice(
      $.NameString,                 
      $.ArgTerm,                    
      $.LocalTerm,                  
      $.DebugTerm,                  
      $.ReferenceTypeOpcode,        
    ),

    // Target                      :=	Nothing | SuperName
    Target: $ => seq(
      $.SuperName                   
    ),
    
    // TermArg                     :=	ExpressionOpcode | DataObject | ArgTerm | LocalTerm | NameString | SymbolicExpression
    TermArg: $ => choice(
      $.ExpressionOpcode,
      $.DataObject,
      $.ArgTerm,
      $.LocalTerm,
      $.NameString,
    ),

    // MethodInvocationTerm        :=	NameString ( // NameString => Method
    //                                     ArgList
    //                                 ) => Nothing | DataRefObject
    MethodInvocationTerm: $ => seq(
      field('Term', $.NameString),
      '(',
      optional(field('ArgList', $.ArgList)),
      ')'
    ),



    // ------------------------------------------------
    // 4. List Terms
    // ------------------------------------------------
    // ArgList                     :=	Nothing | <TermArg ArgListTail>
    ArgList: $ => sepBy1(',', $.TermArg),

    // TermList                    := Nothing | <Term SemiColonDelimiter TermList>
    TermList: $ => repeat1($.Term),

    // Term                        := Object | StatementOpcode | ExpressionOpcode | SymbolicExpression
    Term: $ => choice(
      $.Object,
      $.StatementOpcode,
      $.ExpressionOpcode,
    ),

    // Object                      := CompilerDirective | NamedObject | NameSpaceModifier
    Object: $ => choice(
      $.CompilerDirective,          
      $.NamedObject,
      $.NameSpaceModifier,          
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
      $.DataObject,                 
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
    DataObject: $ => choice(
      $.IntegerLiteral,
      $.StringLiteral,
      $.BufferData,
      $.PackageData,
      $.EISAIDTerm,
    ),

    // DataRefObject               :=	DataObject | ObjectReference
    DataRefObject: $ => choice(
      $.DataObject,                 
      $.IntegerLiteral             
    ),

    // IntegerData                 :=	IntegerTypeOpcode | Integer | ConstTerm
    IntegerData: $ => choice(
      $.IntegerTypeOpcode,          
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
    CompilerDirective: $ => choice(
      $.IncludeTerm,                
      $.ExternalTerm                
    ),

    // NamedObject                 :=	BankFieldTerm | CreateBitFieldTerm | CreateByteFieldTerm | CreateDWordFieldTerm | CreateFieldTerm | CreateQWordFieldTerm | CreateWordFieldTerm | DataRegionTerm | DeviceTerm | EventTerm | FieldTerm | FunctionTerm | IndexFieldTerm | MethodTerm | MutexTerm | OpRegionTerm | PowerResTerm | ProcessorTerm | ThermalZoneTerm
    NamedObject: $ => choice(
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
    NameSpaceModifier: $ => choice(
      $.AliasTerm,  
      $.NameTerm,   
      $.ScopeTerm   
    ),

    // StatementOpcode             :=	BreakTerm | BreakPointTerm | ContinueTerm | FatalTerm | ForTerm | IfElseTerm | NoOpTerm | NotifyTerm | ReleaseTerm | ResetTerm | ReturnTerm | SignalTerm | SleepTerm | StallTerm | SwitchTerm | UnloadTerm | WhileTerm
    StatementOpcode: $ => choice(
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
      // $.SwitchTerm,
      $.UnloadTerm,
      // $.WhileTerm
    ),

    // ExpressionOpcode            :=	AcquireTerm | AddTerm | AndTerm | ConcatTerm | ConcatResTerm | CondRefOfTerm | CopyObjectTerm | DecTerm | DerefOfTerm | DivideTerm | FindSetLeftBitTerm | FindSetRightBitTerm | FprintfTerm | FromBCDTerm | IncTerm | IndexTerm | LAndTerm | LEqualTerm | LGreaterTerm | LGreaterEqualTerm | LLessTerm | LLessEqualTerm | LNotTerm | LNotEqualTerm | LOrTerm | MatchTerm | MidTerm | ModTerm | MultiplyTerm | NAndTerm | NOrTerm | NotTerm | ObjectTypeTerm | OrTerm | PrintfTerm | RefOfTerm | ShiftLeftTerm | ShiftRightTerm | SizeOfTerm | StoreTerm | SubtractTerm | TimerTerm | ToBCDTerm | ToBufferTerm | ToDecimalStringTerm | ToHexStringTerm | ToIntegerTerm | ToStringTerm | WaitTerm | XorTerm | MethodInvocationTerm | SymbolicExpressionTerm | SymbolicAssignmentTerm
    ExpressionOpcode: $ => prec(1, choice(
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
      // $.XorTerm,
      $.MethodInvocationTerm,
    )),

    // IntegerTypeOpcode           :=	AddTerm | AndTerm | DecTerm | DerefOfTerm | DivideTerm | EISAIDTerm | FindSetLeftBitTerm | FindSetRightBitTerm | FromBCDTerm | IncTerm | LAndTerm | LEqualTerm | LGreaterTerm | LGreaterEqualTerm | LLessTerm | LLessEqualTerm | LNotTerm | LNotEqualTerm | MatchTerm | ModTerm | MultiplyTerm | NAndTerm | NOrTerm | NotTerm | OrTerm | ShiftLeftTerm | ShiftRightTerm | SubtractTerm | ToBCDTerm | ToIntegerTerm | XorTerm | SymbolicExpressionTerm
    IntegerTypeOpcode: $ => prec(2, choice(
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
      // $.XorTerm,
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
      $.ToBufferTerm,               
      $.ToUUIDTerm,                 
      $.UnicodeTerm                 
    )),

    // ReferenceTypeOpcode         :=	RefOfTerm | DerefOfTerm | IndexTerm | IndexSymbolicTerm | UserTermObj
    ReferenceTypeOpcode: $ => prec(5, choice(
      $.RefOfTerm,                    
      $.DerefOfTerm,                
      $.IndexTerm,                  
      $.IndexSymbolicTerm,          
      // $.UserTermObj
    )),

    // ------------------------------------------------
    // 7. ASL Primary (Terminal) Terms
    // ------------------------------------------------
    // ElseIfTerm                  :=	ElseIf (
    //                                     Predicate // TermArg => Integer
    //                                 ) {TermList} ElseTerm
    ElseIfTerm: $ => seq(
      field('Term', 'ElseIf'),
      '(',
      field('Predicate', $.TermArg),
      ')',
      '{',
      field('TermList', $.TermList),
      '}',
      field('ElseTerm', $.ElseTerm)
    ),

    // ElseTerm                    :=	Else {TermList} | ElseIfTerm | Nothing
    ElseTerm: $ => choice(
      seq(
        field('Term', 'Else'),
        '{',
        field('TermList', $.TermList),
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
      field('Predicate', $.TermArg),
      ')',
      '{',
      field('TermList', $.TermList),
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
      field('Initialize', $.TermArg), ',',
      field('Predicate', $.TermArg), ',',
      field('Update', $.TermArg),
      ')',
      '{',
      field('TermList', $.TermList),
      '}'
    ),

    // StoreTerm                   :=	Store (
    //                                     Source, // TermArg => DataRefObject
    //                                     Destination // SuperName
    //                                 ) => DataRefObject
    StoreTerm: $ => seq(
      field('Term', 'Store'),
      '(',
      field('Source', $.TermArg), ',',
      field('Destination', $.SuperName),
      ')'
    ),

    // SizeOfTerm                  :=	SizeOf (
    //                                     DataObject // SuperName => <string | buffer | package>
    //                                 ) => Integer
    SizeOfTerm: $ => seq(
      field('Term', 'SizeOf'),
      '(',
      field('DataObject', $.SuperName),
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
      field('SyncObject', $.SuperName), ',',
      field('TimeoutValue', $.TermArg),
      ')'
    ),

    // XOrTerm                     :=	XOr (
    //                                     Source1, // TermArg => Integer
    //                                     Source2, // TermArg => Integer
    //                                     Result // Target
    //                                 ) => Integer
    XOrTerm: $ => seq(
      field('Term', 'XOr'),
      '(',
      field('Source1', $.TermArg), ',',
      field('Source2', $.TermArg), ',',
      field('Result', $.Target),
      ')'
    ),

    // ToIntegerTerm               :=	ToInteger (
    //                                 Data, // TermArg => ComputationalData
    //                                 Result // Target
    //                             ) => Integer
    ToIntegerTerm: $ => seq(
      field('Term', 'ToInteger'),
      '(',
      field('Data', $.ComputationalData), ',',
      field('Result', $.Target),
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
      field('Minuend', $.TermArg), ',',
      field('Subtrahend', $.TermArg), ',',
      field('Result', $.Target),
      ')'
    ),

    // TimerTerm                   :=	Timer => Integer
    TimerTerm: $ => seq(
      field('Term', 'Timer'),
      '=>',
      field('Result', $.IntegerLiteral)
    ),

    // ToBCDTerm                   :=	ToBCD (
    //                                     Value, // TermArg => Integer
    //                                     Result // Target
    //                                 ) => Integer
    ToBCDTerm: $ => seq(
      field('Term', 'ToBCD'),
      '(',
      field('Value', $.TermArg), ',',
      field('Result', $.Target),
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
      field('Source', $.TermArg), ',',
      field('ShiftCount', $.TermArg), ',',
      field('Result', $.Target),
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
      field('Source', $.TermArg), ',',
      field('ShiftCount', $.TermArg), ',',
      field('Result', $.Target),
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
      field('Source1', $.TermArg), ',',
      field('Source2', $.TermArg), ',',
      field('Result', $.Target),
      ')'
    ),

    // NotTerm                     :=	Not (
    //                                     Source, // TermArg => Integer
    //                                     Result // Target
    //                                 ) => Integer
    NotTerm: $ => seq(
      field('Term', 'Not'),
      '(',
      field('Source', $.TermArg), ',',
      field('Result', $.Target),
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
      field('Source1', $.TermArg), ',',
      field('Source2', $.TermArg), ',',
      field('Result', $.Target),
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
      field('Source1', $.TermArg), ',',
      field('Source2', $.TermArg), ',',
      field('Result', $.Target),
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
      field('Multiplicand', $.TermArg), ',',
      field('Multiplier', $.TermArg), ',',
      field('Result', $.Target),
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
      field('Divisor', $.IntegerLiteral), ',',
      field('Result', $.Target),
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
      field('SearchPackage', $.TermArg), ',',
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
      field('Data', $.TermArg), ',',
      field('Result', $.Target),
      ')'
    ),

    // ToHexStringTerm             :=	ToHexString (
    //                                     Data, // TermArg => ComputationalData
    //                                     Result // Target
    //                                 ) => String
    ToHexStringTerm: $ => seq(
      field('Term', 'ToHexString'),
      '(',
      field('Data', $.TermArg), ',',
      field('Result', $.Target),
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
      field('Source', $.TermArg), ',',
      field('Result', $.Target),
      ')'
    ),

    // IncTerm                     :=	Increment (
    //                                     Addend // SuperName
    //                                 ) => Integer
    IncTerm: $ => seq(
      field('Term', 'Increment'),
      '(',
      field('Addend', $.SuperName),
      ')'
    ),

    // FromBCDTerm                 :=	FromBCD (
    //                                     BCDValue, // TermArg => Integer
    //                                     Result // Target
    //                                 ) => Integer
    FromBCDTerm: $ => seq(
      field('Term', 'FromBCD'),
      '(',
      field('BCDValue', $.TermArg), ',',
      field('Result', $.Target),
      ')'
    ),

    // FindSetLeftBitTerm          :=	FindSetLeftBit (
    //                                     Source, // TermArg => Integer
    //                                     Result // Target
    //                                 ) => Integer
    FindSetLeftBitTerm: $ => seq(
      field('Term', 'FindSetLeftBit'),
      '(',
      field('Source', $.TermArg), ',',
      field('Result', $.Target),
      ')'
    ),
    
    // FindSetRightBitTerm         :=	FindSetRightBit (
    //                                     Source, // TermArg => Integer
    //                                     Result // Target
    //                                 ) => Integer
    FindSetRightBitTerm: $ => seq(
      field('Term', 'FindSetRightBit'),
      '(',
      field('Source', $.TermArg), ',',
      field('Result', $.Target),
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
      field('Dividend', $.TermArg), ',',
      field('Divisor', $.TermArg), ',',
      field('Remainder', $.Target), ',',
      field('Result', $.Target),
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
      field('Source1', $.TermArg), ',',
      field('Source2', $.TermArg), ',',
      field('Result', $.Target),
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
      field('Addend1', $.TermArg), ',',
      field('Addend2', $.TermArg), ',',
      field('Result', $.Target),
      ')'
    ),

    // CopyObjectTerm              :=	CopyObject (
    //                                     Source, // TermArg => DataRefObject
    //                                     Result, // NameString | LocalTerm | ArgTerm
    //                                 ) => DataRefObject
    CopyObjectTerm: $ => seq(
      field('Term', 'CopyObject'),
      '(',
      field('Source', $.TermArg), ',',
      field('Result', choice($.NameString, $.LocalTerm, $.ArgTerm)),
      ')'
    ),

    // DecTerm                     :=	Decrement (
    //                                     Minuend // SuperName
    //                                 ) => Integer
    DecTerm: $ => seq(
      field('Term', 'Decrement'),
      '(',
      field('Minuend', $.SuperName),
      ')'
    ),

    // UnloadTerm                  :=	Unload (
    //                                     DDBHandle // SuperName
    //                                 )
    UnloadTerm: $ => seq(
      field('Term', 'Unload'),
      '(',
      field('DDBHandle', $.SuperName),
      ')'
    ),

    // SleepTerm                   :=	Sleep (
    //                                     MilliSeconds // TermArg => Integer
    //                                 )
    SleepTerm: $ => seq(
      field('Term', 'Sleep'),
      '(',
      field('MilliSeconds', $.TermArg),
      ')'
    ),

    // StallTerm                   :=	Stall (
    //                                     MicroSeconds // TermArg => Integer
    //                                 )
    StallTerm: $ => seq(
      field('Term', 'Stall'),
      '(',
      field('MicroSeconds', $.TermArg),
      ')'
    ),

    // SignalTerm                  :=	Signal (
    //                                     SyncObject // SuperName
    //                                 )
    SignalTerm: $ => seq(
      field('Term', 'Signal'),
      '(',
      field('SyncObject', $.SuperName),
      ')'
    ),

    // ResetTerm                   :=	Reset (
    //                                     SyncObject // SuperName
    //                                 )
    ResetTerm: $ => seq(
      field('Term', 'Reset'),
      '(',
      field('SyncObject', $.SuperName),
      ')'
    ),

    // ReleaseTerm                 :=	Release (
    //                                     SyncObject // SuperName
    //                                 )
    ReleaseTerm: $ => seq(
      field('Term', 'Release'),
      '(',
      field('SyncObject', $.SuperName),
      ')'
    ),

    // NotifyTerm                  :=	Notify (
    //                                     Object, // SuperName => <thermalzone | processor | device>
    //                                     NotificationValue // TermArg => Integer
    //                                 )
    NotifyTerm: $ => seq(
      field('Term', 'Notify'),
      '(',
      field('Object', $.SuperName), ',',
      field('NotificationValue', $.TermArg),
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
      field('Arg', $.TermArg),
      ')'
    ),

    // AcquireTerm                 :=	Acquire (
    //                                     SyncObject, // SuperName => Mutex
    //                                     TimeoutValue // WordConstExpr
    //                                 ) => Boolean // True means the operation timed out and the Mutex was not acquired
    AcquireTerm: $ => seq(
      field('Term', 'Acquire'),
      '(',
      field('SyncObject', $.SuperName), ',',
      field('TimeoutValue', $.IntegerLiteral),
      ')'
    ),

    // ReturnTerm                  :=	Return (
    //                                     Arg // Nothing | TermArg => DataRefObject
    //                                 )
    ReturnTerm: $ => seq(
      field('Term', 'Return'),
      '(',
      field('Arg', optional($.TermArg)),
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
      field('Body', $.PackageList),
      '}'
    ),

    // BufferTerm                  :=	Buffer (
    //                                     BuffSize // Nothing | TermArg => Integer
    //                                 ) {StringData | ByteList} => Buffer
    BufferTerm: $ => seq(
      field('Term', 'Buffer'),
      '(',
      field('BuffSize', optional($.TermArg)),
      ')',
      '{',
      field('Body', choice($.StringLiteral, $.ByteList)),
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
      field('Data', $.TermArg), ',',
      field('Result', $.Target),
      ')'
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
      field('Source', $.TermArg), ',',
      field('Index', $.TermArg), ',',
      field('Length', $.TermArg), ',',
      field('Result', $.Target),
      ')'
    ),

    // IndexSymbolicTerm           :=	Source // TermArg => <string | buffer | packageterm>
    //                                 [Index] // TermArg => Integer
    //                                 => ObjectReference
    IndexSymbolicTerm: $ => seq(
      field('Source', $.TermArg),
      '[',
      field('Index', $.TermArg),
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
      field('Source', $.TermArg), ',',
      field('Index', $.IntegerLiteral), ',',
      field('Destination', $.Target),
      ')'
    ),

    // CondRefOfTerm               :=	CondRefOf (
    //                                     Source // NameString | ArgTerm | LocalTerm | DerefOfTerm
    //                                     Destination // Target
    //                                 ) => Boolean
    CondRefOfTerm: $ => seq(
      field('Term', 'CondRefOf'),
      '(',
      field('Source', choice($.NameString, $.ArgTerm, $.LocalTerm, $.DerefOfTerm)), ',',
      field('Destination', $.Target),
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
      field('Source', choice($.NameString, $.ArgTerm, $.LocalTerm, $.RefOfTerm, $.CondRefOfTerm)),
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
      field('Source1', $.TermArg), ',',
      field('Source2', $.TermArg), ',',
      field('Result', $.Target),
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
      field('Source1', $.SuperName), ',',
      field('Source2', $.SuperName), ',',
      field('Result', $.Target),
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
      field('BitIndex', $.IntegerLiteral), ',',
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
      field('num_args', $.IntegerLiteral), ',',
      field('serialize_rule', $.SerializeRuleKeyword),
      ')',
      '{',
      field('body', $.TermList),
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
      field('SourceBuffer', $.NameSeg), ',',
      field('ByteIndex', $.IntegerLiteral), ',',
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
      field('SourceBuffer', $.NameSeg), ',',
      field('ByteIndex', $.IntegerLiteral), ',',
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
      field('SourceBuffer', $.NameSeg), ',',
      field('BitIndex', $.IntegerLiteral), ',',
      field('NumBits', $.IntegerLiteral), ',',
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
      field('SourceBuffer', $.NameSeg), ',',
      field('ByteIndex', $.IntegerLiteral), ',',
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
      field('SourceBuffer', $.NameSeg), ',',
      field('ByteIndex', $.IntegerLiteral), ',',
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
      field("TermList", $.TermList),
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
      field("FieldUnitList", $.FieldUnitList),
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
      field('Offset', $.TermArg), ',',
      field('Length', $.TermArg),
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
      field("TermList", $.TermList),
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
      field("TermList", $.TermList),
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
      field("TermList", $.TermList),
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
      field('Object', $.DataObject),
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
      field("TermList", $.TermList),
      '}'
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
      'BuffFieldObj'
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
    NoOpTerm: $ => 'NoOp',

  }
});
