# ACPI Source Language (ASL)

---

## ASL Guidelines

ACPI Source Language (ASL) is a specialized programming language, resembling C, used to describe and manage a system's hardware configuration and power management. Its primary purpose is to bridge the gap between an operating system (OS) and hardware components that cannot be easily discovered or configured natively by the OS. Developers write ASL code based on hardware specifications, which is then compiled into ACPI Machine Language (AML) bytecode. This AML is stored in the system's firmware (BIOS/UEFI), making platform-specific information accessible to the OS

The fundamental construct in ASL is the ACPI Namespace, a hierarchical tree-like data structure that represents the system's hardware and its associated programmatic interfaces. Within this namespace, you define objects, which are the building blocks of ACPI functionality. These objects can be:

- **Devices**: Representing physical or logical hardware components (e.g., CPU, PCI devices, thermal zones, embedded controllers).
- **Methods**: These are analogous to functions or subroutines in traditional programming languages. They contain AML bytecode that performs specific operations, such as configuring hardware registers, retrieving device status, or changing power states. Methods can accept arguments and return values.
- **Named Objects/Variables**: ASL supports the definition of named variables to store data. These can hold various data types, including integers, strings, buffers, and packages (arrays).
- **Operation Regions**: These define contiguous blocks of memory, I/O ports, or PCI configuration space that ACPI methods can access to interact directly with hardware.

---

### DefinitionBlock

This is the fundamental construct of ASL, all ASL code must reside inside the DefinitionBlock declaration, code outside of any DefinitionBlock declaration will be invalid

```c
DefinitionBlock (AMLFileName, TableSignature, ComplianceRevision
                 OEMID, OEMTableID, OEMRevision)
{
    // ...
}

DefinitionBlock ("", "SSDT", 2, "Hack", "CpuPlug", 0x00000000)
{
	// ...
}
```

- **AMLFileName**: Name of the AML file. Can be null string. Usually left empty.
- **TableSignature**: Signature of the AML file (can be `DSDT` or `SSDT`). 4 character-string.
- **ComplianceRevision**: Defines whether to use the 32-bit or 64-bit arithmetic. A value of `1` or less if for 32-bit, while a value of `2` or greater is for 64-bit systems.
- **OEM ID**: ID of the original equipment manufacturer (OEM) developing the ACPI table. 6 character-string
- **OEM Table ID**: A specific identifier for the table. 8 character-string.
- **OEMRevision**: Revision number set by the OEM. 32-bit number

### ACPI Namespace

ACPI specification referes to `variable names` as `object names` and the variables called by those object names can be referred as `named objects`.

The simples way to add a named object to the namespace is by using `Name()` keyword:

```c
DefinitionBlock ("", DSDT, 2, "", "", 0x0)
{
    Name (OBJ0, 0x1234)
    Name (OBJ1, "Hello World")
}
```

This DefinitionBlock adds a named object called `OBJ0` and `OBJ1` to the ACPI namespace, these are bound to an object with value `0x1234` and the string `Hello World`.

The ObjectName is a four-letter variable name also called `NameSeg` that starts with a letter or an underscore.

```c
Name (lowr, 0x0)    Name (UPPR, 0x0)
Name (___A, 0x0)    Name (_AB_, 0x0)
```

#### Buffer and Package declarations

The syntax for defining `Buffer` and `Package` objects are similar to Integer and String but requiere additional keywords:

```c
Name (BUF1, Buffer (3){0x00, 0x01, 0x02})
Name (BUF2, Buffer (){0x00, 0x01, 0x02, 0x03})
```

This describes two buffer objects `BUF1` and `BUF2`, indicating that the contents inside `{}` are encoded as a buffer. Each element of the comma-separated list is a value between 0x00 and 0xFF. There is an optional parameter that can determine the lenght of the buffer, if the length is not there it is automatically inserted during compilation.

A `Package` is an array containing ASL objects. The elements of packages can include Integer, Strings, Buffer, Packages or other namespace objects.

```c
Name (PKG1, Package(3){0x1234, "Hello world", INT1})
Name (PKG2, Package(){INT1, "Good bye"})

Name (PKG3,
    Package(){
        Package() {0x00, 0x01, 0x02},
        Package() {0x03, 0x04, 0x05}
    }
)

Name (PKG4,
    Package(){
        "ASL is fun",
        Package() {0xff, 0xfe, 0xfd, 0xfc, fb}
    }
)

Name (PKG5,
    Package(){
        0x4321,
        Buffer() {0x1}
    }
)
```

---

### Operation Regions and Fields

There may be a need for ASL code to access system memory or hardware registers. These regions and registers can be defined with `OperationRegion` keyword with the `Field` keyword.

`OperationRegion` defines a named object as a certain type and gives the starting address and length. The `Field` keyword defines individual bit fields inside of an `OperationRegion`. The individual field units that are used in control methods to access data in this operation region reside at a particular offset.

The addressable spaces can be `SystemMemory`, `SystemIO`, `PCI_Config`, `EmbeddedControl` or `SMBus`.

```c
DefinitionBlock ("", "DSDT", 2, "", "", 0x1)
{
    OperationRegion(OPR1, SystemMemory, 0x1000, 0x5)
    Field (OPR1)
    {
        FLD1, 8,
        FLD2, 8,
        Offset (3),
        FLD3, 4,
        FLD4, 12
    }
}
```

---

### Scopes

The `Scope` operator defines a namespace context where objects are declared. It navigates to a specific location in the ACPI namespace but does not create a new object itself. Is like telling the compiler go to that location for subsequent declarations.

```c
DefinitionBlock ("", "DSDT", 2, "", "", 0x1)
{
    Scope (\_SB.PCI0)
    {
        Name (TEMP, 0x50)
        Method (DIAG, 0)
        {
            Return (TEMP)
        }
    }
}
```

### Devices

Device is an object that represents a hardware entity in the system. It creates an actual namespace object and establishes a presence for hardware components that the OS can interact with. `Scope` provices the organizational structure while `Device` creates the actual hardware objects within that structure.

```c
DefinitionBlock ("", "DSDT", 2, "", "", 0x1)
{
    Scope (\_SB)
    {
        Device (PCI0)
        {
            Name (_HID, "PNP0A03")
            
            Method (_STA, 0)
            {
                Return (0x0F)
            }
            
            Device (GFX0)
            {
                Name (_ADR, 0x00020000)
            }
        }
    }
}
```

### Methods

A `Method` is a fundamental executable object in ASL. It is essentially a subroutine or function that are invoked by the OS to query information, perform configuration or execute power managment routines.


```c
DefinitionBlock ("", "DSDT", 2, "", "", 0x1)
{
    Scope (\_SB)
    {
        Device (EC0)
        {
            Method (_TMP, 0, NotSerialized)
            {
                Return (TEMP_REG)
            }

            Method (SETF, 1, Serialized)
            {
                If (LE (Arg0, 100))
                {
                    Store (Arg0, FAN_SPD)
                    Return (One)
                }
                Return (Zero)
            }
        }
    }
}
```

---

### Data Types and Operators

---

### Control Flow

---

### Synchronization Objects

---


