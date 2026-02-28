#!/bin/sh

set -e

echo "Installing linux dependencies"

apt-get update

apt-get install -y postgresql-client openssl gzip
apt-get update

apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev

apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*