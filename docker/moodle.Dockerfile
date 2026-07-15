# All-in-one local test image: Moodle 4.5 LTS baked into the official moodlehq base.
#
# Moodle core lives on the Linux filesystem *inside the image* (fast on Windows) rather
# than being bind-mounted from an NTFS host path — that host bind-mount is what makes the
# whole Moodle tree crawl under Docker Desktop/WSL2. Only the two small plugin dirs and
# config.php are bind-mounted at runtime (see compose.yml).
FROM moodlehq/moodle-php-apache:8.1

# 4.5 is LTS, PHP 8.1-compatible, and the first branch with the hook system that
# local_ulibot's before_standard_head_html_generation callback targets.
ARG MOODLE_BRANCH=MOODLE_405_STABLE

# Work from /var/www so deleting/recreating /var/www/html (the base image's WORKDIR) doesn't
# pull the shell's own CWD out from under it (git clone fails otherwise).
WORKDIR /var/www

RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /var/www/html \
    && git clone --depth 1 --branch ${MOODLE_BRANCH} https://github.com/moodle/moodle.git /var/www/html \
    && mkdir -p /var/www/moodledata /var/www/phpunitdata /var/www/behatdata /var/www/behatfaildumps \
    && chown -R www-data:www-data /var/www/html /var/www/moodledata /var/www/phpunitdata /var/www/behatdata /var/www/behatfaildumps

# Restore the docroot as WORKDIR so relative Moodle CLI paths (admin/cli/*.php) resolve, and
# inherit the base image's apache2-foreground CMD (serves /var/www/html on port 80).
WORKDIR /var/www/html
