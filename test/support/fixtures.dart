import 'dart:convert';
import 'dart:io';

/// Reads a shared wire fixture from `contract/fixtures/`. The same files are
/// checked by the Swift kernel's tests, so both sides agree on one shape.
Object? fixture(String name) => jsonDecode(File('contract/fixtures/$name.json').readAsStringSync());

Map<String, Object?> fixtureMap(String name) => Map<String, Object?>.from(fixture(name)! as Map);
