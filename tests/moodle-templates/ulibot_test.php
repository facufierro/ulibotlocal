<?php
// TEMPLATE — copy to plugin-uli/tests/ulibot_test.php to run (see ../README.md).
//
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify it under the terms of the GNU
// General Public License as published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.

namespace local_ulibot;

/**
 * Tests for the widget label + JWT auth contract.
 *
 * The widget flow hinges on: the injected JWT is signed with `tokenulibot`, which the backend
 * verifies against the site's stored token. This pins that contract in code.
 *
 * @package    local_ulibot
 * @covers     \local_ulibot\ulibot
 */
final class ulibot_test extends \advanced_testcase {

    public function test_get_label_injects_widget_and_signs_jwt(): void {
        global $CFG;
        $this->resetAfterTest();
        $this->setAdminUser();

        require_once($CFG->dirroot . '/local/ulibot/lib.php');

        $token = 'local-test-token';
        set_config('urlulibot', 'http://localhost:3000', 'local_ulibot');
        set_config('urlbackulibot', 'http://localhost:8000/ulibot', 'local_ulibot');
        set_config('tokenulibot', $token, 'local_ulibot');

        $label = ulibot::get_label();

        // The loader is injected from the configured front URL and calls the mount function.
        $this->assertStringContainsString('http://localhost:3000/widget.js', $label);
        $this->assertStringContainsString('insertUliBotWidget(', $label);

        // Pull out the JSON payload handed to insertUliBotWidget(...).
        $this->assertSame(1, preg_match('/insertUliBotWidget\((\{.*\})\)/s', $label, $m));
        $data = json_decode($m[1]);
        $this->assertNotEmpty($data->token);
        $this->assertSame('http://localhost:8000/ulibot', $data->backurl);

        // The JWT must verify with tokenulibot (the exact secret the backend uses as site.token),
        // and its host claim must match the site host.
        $expectedhost = (new \moodle_url('/'))->get_host();
        $payload = \Firebase\JWT\JWT::decode($data->token, new \Firebase\JWT\Key($token, 'HS256'));
        $this->assertSame($expectedhost, $payload->host);
    }
}
