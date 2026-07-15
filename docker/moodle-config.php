<?php
// Moodle config for the all-in-one LOCAL test stack. Bind-mounted to /var/www/html/config.php.
// NOT for production. Browse the site at http://localhost:8080 (always "localhost", never
// "127.0.0.1" — the widget's JWT host check keys on it).

unset($CFG);
global $CFG;
$CFG = new stdClass();

// ── Database (the "moodledb" service in compose.yml) ────────────────────────
$CFG->dbtype    = 'mariadb';
$CFG->dblibrary = 'native';
$CFG->dbhost    = 'moodledb';
$CFG->dbname    = 'moodle';
$CFG->dbuser    = 'moodle';
$CFG->dbpass    = 'moodle';
$CFG->prefix    = 'mdl_';
$CFG->dboptions = ['dbcollation' => 'utf8mb4_unicode_ci'];

// ── Site ────────────────────────────────────────────────────────────────────
$CFG->wwwroot   = 'http://localhost:8080';
$CFG->dataroot  = '/var/www/moodledata';
$CFG->admin     = 'admin';
$CFG->directorypermissions = 0777;

// ── PHPUnit (php admin/tool/phpunit/cli/init.php) ───────────────────────────
$CFG->phpunit_prefix   = 'phpu_';
$CFG->phpunit_dataroot = '/var/www/phpunitdata';

// ── Behat (php admin/tool/behat/cli/init.php + the "selenium" service) ───────
// behat_wwwroot is the URL the selenium/chrome container uses, so it must be the
// internal service name, not localhost.
$CFG->behat_wwwroot      = 'http://moodle';
$CFG->behat_prefix       = 'bht_';
$CFG->behat_dataroot     = '/var/www/behatdata';
$CFG->behat_faildump_path = '/var/www/behatfaildumps';
$CFG->behat_profiles = [
    'default' => [
        'browser' => 'chrome',
        'wd_host' => 'http://selenium:4444/wd/hub',
    ],
];

require_once(__DIR__ . '/lib/setup.php');
