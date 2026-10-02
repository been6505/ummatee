#!/bin/sh
# รวมหน้าหลังบ้าน + API (โหมด _worker.js ของ Pages) ไว้ใน pages-admin/dist
set -e
cd "$(dirname "$0")"
rm -rf dist && mkdir dist
cp -R ../admin-site/. dist/
cp ../src/worker.js dist/_worker.js
