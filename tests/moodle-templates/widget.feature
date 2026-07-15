# TEMPLATE — copy to plugin-uli/tests/behat/widget.feature to run (see ../README.md).
@local @local_ulibot @javascript
Feature: The UliBot widget loader is injected for privileged users
  In order to chat with the assistant from Moodle
  As a logged-in admin
  I need the widget loader script to be present on the page

  Background:
    Given the following config values are set as admin:
      | urlulibot     | http://localhost:3000        | local_ulibot |
      | urlbackulibot | http://localhost:8000/ulibot | local_ulibot |
      | tokenulibot   | local-test-token             | local_ulibot |

  Scenario: The widget loader is injected on the dashboard
    Given I log in as "admin"
    When I am on homepage
    Then "script[src*='/widget.js']" "css_element" should exist
