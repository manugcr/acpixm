DefinitionBlock ("", "DSDT", 2, "LENOVO", "CB-01   ", 0x00000001)
{
    OperationRegion (GNVS, SystemMemory, 0x2BB77018, 0x07D4)
    OperationRegion (GNVS, SystemMemory, 0x1234, 0x5678)
    Method (DISP, 1, NotSerialized)
    {
        Return (Zero)
    }
}

