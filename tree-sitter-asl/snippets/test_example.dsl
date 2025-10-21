/*
 * Suspicious ACPI Code Example.
 */
DefinitionBlock ("", "DSDT", 2, "TEST", "LOADCHK", 0x00000001)
{
    // 1. Critical: Addresses range overlaps with kernel space
    Scope (\_SB)
    {
        OperationRegion (KRNL, SystemMemory, 0xC0000000, 0x1000)
        Field (KRNL, ByteAcc, NoLock, Preserve)
        {
            KDAT, 8
        }
    }

    // 2. Suspicious: Dynamic code loading
    Scope (\_SB)
    {
        Method (_INI, 0, NotSerialized)
        {
            Load (\_SB.LOD1, \_SB.MEM1)
            LoadTable ("OEMID", "TABLEID", "OEMTBLID", 0x12345678, \BUF)
            Unload (\_SB.LOD1)
            Store (\BUF, \_SB.MEM1)
        }
    }

    // 3. Suspicious: Using uncommon regions like IPMI, CMOS, and SMBus
    Scope (\_SB)
    {
        Device (MEM1)
        {
            // suspicious: uncommon IPMI region — baseboard mgmt. chip
            OperationRegion (IPMI, IPMI, 0x00000000, 0x20)
            Field (IPMI, ByteAcc, NoLock, Preserve)
            {
                DATA, 8
            }

            // suspicious: access to CMOS (RTC config) — rarely used
            OperationRegion (CMOS, SystemCMOS, 0x70, 0x2)
            Field (CMOS, ByteAcc, NoLock, Preserve)
            {
                _RTC, 8
            }

            // suspicious: use of GeneralPurposeIO — potential for I/O port manipulation
            OperationRegion (SMIC, GeneralPurposeIO, 0xEFA0, 0x10)
            Field (SMIC, ByteAcc, NoLock, Preserve)
            {
                GPIO, 8
            }
        }
    }

    // 4. Suspicious: Declares multiple keyboard devices — may be fake
    Scope (\_SB)
    {
        Device (KBD0)
        {
            Name (_HID, EisaId ("PNP0303"))   // Standard PS/2 Keyboard
        }
    }
    Scope (\_SB)
    {
        Device (KBD0)
        {
            Name (_HID, EisaId ("PNP0303"))   // Standard PS/2 Keyboard
        }
    }
}
