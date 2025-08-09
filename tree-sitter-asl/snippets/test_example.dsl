DefinitionBlock ("", "DSDT", 2, "LENOVO", "CB-01   ", 0x00000001)
{
    Notify (^^PC00.PEG2.PEGP, 0xC0) // Hardware-Specific
    Return (^^PD00)
    ^^^CNVW.RSTT = CMDP
}

