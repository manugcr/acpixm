/*
 * Benign SSDT fixture.
 * Has a SystemMemory OperationRegion, but at a low MMIO address that does NOT
 * overlap the kernel code range — so OpRegionCritical must NOT flag it.
 * This exercises the logic engine's overlap check returning false (a stronger
 * negative than "no pattern at all").
 */
DefinitionBlock ("SSDT", "SSDT", 1, "OEMID", "TABLEID", 0x00000001)
{
    OperationRegion (GPIO, SystemMemory, 0x1000, 0x10)
    Field (GPIO, AnyAcc, NoLock, Preserve)
    {
        REG0,   8
    }

    Method (_INI, 1, NotSerialized)
    {
        Store (0x00, REG0)
    }
}
