package com.aslam.mediareminder.library

import org.junit.Assert.*
import org.junit.Test

class FolderRulesTest {
    @Test fun normalizesNamesWithoutLosingUnicode() {
        assertEquals("Café days", FolderRules.name("  Cafe\u0301   days  "))
        assertEquals("photos", FolderRules.key(" Photos "))
        assertEquals("😀".repeat(60), FolderRules.name("😀".repeat(60)))
        assertThrows(IllegalArgumentException::class.java) { FolderRules.name("😀".repeat(61)) }
        assertThrows(IllegalArgumentException::class.java) { FolderRules.name("  ") }
    }
    @Test fun permitsOnlyOneLevelOfSubfolders() {
        val root = FolderRules.Folder("a", null, "Trips")
        val child = FolderRules.Folder("b", "a", "Japan")
        FolderRules.validate(listOf(root, child))
        assertThrows(IllegalArgumentException::class.java) {
            FolderRules.validate(listOf(root, child, FolderRules.Folder("c", "b", "Tokyo")))
        }
        assertThrows(IllegalArgumentException::class.java) { FolderRules.validate(listOf(child)) }
        assertThrows(IllegalArgumentException::class.java) { FolderRules.validate(listOf(root.copy(parentId = "a"))) }
    }
    @Test fun siblingsHaveUniqueNamesButDifferentParentsMayReuseThem() {
        val root = FolderRules.Folder("a", null, "Trips")
        assertThrows(IllegalArgumentException::class.java) {
            FolderRules.validate(listOf(root, FolderRules.Folder("b", null, " TRIPS ")))
        }
        FolderRules.validate(listOf(root, FolderRules.Folder("b", "a", "Trips")))
        assertThrows(IllegalArgumentException::class.java) { FolderRules.validate(listOf(root, root)) }
    }
    @Test fun boundsFolderAndPinCounts() {
        assertThrows(IllegalArgumentException::class.java) {
            FolderRules.validate((1..501).map { FolderRules.Folder("$it", null, "$it") })
        }
        assertThrows(IllegalArgumentException::class.java) {
            FolderRules.validate((1..9).map { FolderRules.Folder("$it", null, "$it", true) })
        }
    }
}
