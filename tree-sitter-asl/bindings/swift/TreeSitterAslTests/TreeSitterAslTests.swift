import XCTest
import SwiftTreeSitter
import TreeSitterAsl

final class TreeSitterAslTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_asl())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading ACPI Source Language grammar")
    }
}
