<?php
// Integration checks against the existing local lab; no fixture credentials or site secrets are emitted.
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->dirroot . '/mod/chateabc/locallib.php');
require_once($CFG->libdir . '/filelib.php');

$options = getopt('', ['chat:', 'user:', 'group:', 'other-group:']);
$cm = get_coursemodule_from_id('chateabc', (int)$options['chat'], 0, false, MUST_EXIST);
$course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
$chat = $DB->get_record('chateabc', ['id' => $cm->instance], '*', MUST_EXIST);
$user = $DB->get_record('user', ['username' => $options['user']], '*', MUST_EXIST);
\core\session\manager::set_user($user);
$claims = chateabc_lia_claims($course, $cm, $chat, (int)$options['group']);
if ($claims['userid'] != $user->id || $claims['name'] !== fullname($user)
        || $claims['group_chat']['roomid'] != $cm->id
        || $claims['group_chat']['contextinstance'] != $chat->liacmid) {
    throw new RuntimeException('Moodle identity or room was not preserved.');
}
$url = new moodle_url('/mod/chateabc/view.php', ['id' => $cm->id, 'g' => (int)$options['group']]);
if ($claims['chateabc']['room_url'] !== $url->out() || $claims['chateabc']['site_url'] !== $CFG->wwwroot) {
    throw new RuntimeException('The signed chat destination differs from the original room.');
}
$denied = false;
try {
    chateabc_lia_claims($course, $cm, $chat, (int)$options['other-group']);
} catch (moodle_exception $error) {
    $denied = $error->errorcode === 'liagroups';
}
if (!$denied) { throw new RuntimeException('Cross-group access was not rejected.'); }
$disabled = clone $chat;
$disabled->liacmid = 0;
$denied = false;
try {
    chateabc_lia_claims($course, $cm, $disabled, (int)$options['group']);
} catch (moodle_exception $error) {
    $denied = $error->errorcode === 'liagroups';
}
if (!$denied) { throw new RuntimeException('Disabled Lia was not rejected.'); }
$missinglia = clone $chat;
$missinglia->liacmid = PHP_INT_MAX;
$denied = false;
try {
    chateabc_lia_claims($course, $cm, $missinglia, (int)$options['group']);
} catch (moodle_exception $error) {
    $denied = $error->errorcode === 'liainvalid';
}
if (!$denied) { throw new RuntimeException('A missing Lia activity did not return liainvalid.'); }
echo "Moodle identity, signed destination, group, disabled-feature and missing-Lia checks passed.\n";
