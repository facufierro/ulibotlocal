<?php
// TEMPLATE — copy to plugin-lia/tests/lib_test.php to run (see ../README.md).
//
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify it under the terms of the GNU
// General Public License as published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.

namespace mod_lia;

/**
 * Install / schema smoke test for mod_lia.
 *
 * Full lia_add_instance() coverage needs \mod_lia\liaclient (the HTTP backend) mocked, out of scope
 * here — this just proves the module installs cleanly and its schema is present.
 *
 * @package mod_lia
 * @covers  \mod_lia
 */
final class lib_test extends \advanced_testcase {

    public function test_module_installed_and_schema_present(): void {
        global $DB;
        $this->resetAfterTest();

        $this->assertNotEmpty(get_config('mod_lia', 'version'));
        $this->assertTrue($DB->get_manager()->table_exists('lia'));
    }
}
