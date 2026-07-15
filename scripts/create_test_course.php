<?php
// Creates a ready-to-use test course so you can add a Lia activity and test file upload in the UI.
// Run inside the moodle container:  php /tmp/create_test_course.php   (see ALLINONE.md)
// Idempotent: re-running just reports the existing course.

define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->dirroot . '/course/lib.php');

$shortname = 'TC1';

if ($existing = $DB->get_record('course', ['shortname' => $shortname])) {
    echo "Course already exists: id={$existing->id}  ({$CFG->wwwroot}/course/view.php?id={$existing->id})\n";
    exit(0);
}

$catid = $DB->get_field_sql('SELECT MIN(id) FROM {course_categories}');
if (!$catid) {
    $cat = core_course_category::create(['name' => 'Miscellaneous']);
    $catid = $cat->id;
}

$data = (object) [
    'fullname'      => 'Test Course',
    'shortname'     => $shortname,
    'category'      => $catid,
    'summary'       => 'Course for testing the Lia activity and file upload.',
    'summaryformat' => FORMAT_HTML,
    'format'        => 'topics',
    'numsections'   => 3,
    'visible'       => 1,
];

$course = create_course($data);
echo "Created course id={$course->id}  ({$CFG->wwwroot}/course/view.php?id={$course->id})\n";
