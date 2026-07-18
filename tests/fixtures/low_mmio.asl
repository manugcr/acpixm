/*
 * Fixture: MMIO region at a low physical address (0x5000).
 * Used by tests exercising in_range logic — this region should be flagged
 * by rules checking for SystemMemory access in the low-address range.
 */
DefinitionBlock ("SSDT", "SSDT", 1, "OEMID", "TABLEID", 0x00000001)
{
    OperationRegion (MMIO, SystemMemory, 0x5000, 0x100)
    Field (MMIO, AnyAcc, NoLock, Preserve)
    {
        REG0,   8
    }

    Method (_INI, 1, NotSerialized)
    {
        Store (0x00, REG0)
    }
}
