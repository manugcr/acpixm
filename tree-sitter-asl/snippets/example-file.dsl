/*
 * Intel ACPI Component Architecture
 * AML/ASL+ Disassembler version 20230628 (64-bit version)
 * Copyright (c) 2000 - 2023 Intel Corporation
 * 
 * Disassembling to symbolic ASL+ operators
 *
 * Disassembly of /home/eclypsium/Desktop/utils/acpixm/output/dsdt.dat, Fri Mar 14 23:29:04 2025
 *
 * Original Table Header:
 *     Signature        "DSDT"
 *     Length           0x0009A8E4 (633060)
 *     Revision         0x02
 *     Checksum         0xAF
 *     OEM ID           "DELL  "
 *     OEM Table ID     "Dell Inc"
 *     OEM Revision     0x00000002 (2)
 *     Compiler ID      "    "
 *     Compiler Version 0x01000013 (16777235)
 */
DefinitionBlock ("", "DSDT", 2, "", "", 0x0)
{
    External (_SB_.PC00, DeviceObj)
    External (_SB_.PC00.CNIP, MethodObj) // Comment Here
    External (_SB_.PC00.CNVW.BOFC, UnknownObj) /* Comment Here */
    Scope (\_SB)
    {
        Device (PCI0)
        {
            Name (INT1, 0x1234)
            Name (_HID, EisaId ("PNP0A08") /* PCI Express Bus */)
            Name (_UID, 0x00) // _UID: Unique ID
            OperationRegion (MCHT, SystemMemory, 0xFED10000, 0x6000)
            Field (MCHT, ByteAcc, NoLock, Preserve)
            {
                Offset (0x5994),
                RPSL, 8,
                Offset (0x5998),
                RP0C, 8,
                RP1C, 8,
                RPNC, 8
            }
        }
    }
}
