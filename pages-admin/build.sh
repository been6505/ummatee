#!/bin/sh
set -e
cd "$(dirname "$0")"
rm -rf dist && mkdir dist
cp -R ../admin-site/. dist/
cp ../src/worker.js dist/_worker.js
node minify.mjs dist
