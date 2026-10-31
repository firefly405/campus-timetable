#!/bin/sh
set -eu

archive=${1:-/tmp/kexu-update-20261018.tar.gz}
stage=$(mktemp -d /tmp/kexu-update.XXXXXX)
backup="/opt/kexu/backups/remembered-login-$(date +%Y%m%d-%H%M%S)"
trap 'rm -rf "$stage"' EXIT

tar -xzf "$archive" -C "$stage"
test -f "$stage/app/school-api.cjs"
test -f "$stage/public/index.html"

sudo mkdir -p "$backup/public" "$backup/app"
sudo cp -a /opt/kexu/public/. "$backup/public/"
sudo cp -a /opt/kexu/app/. "$backup/app/"
sudo cp -a "$stage/public/." /opt/kexu/public/
sudo cp -a "$stage/app/." /opt/kexu/app/
sudo systemctl restart kexu
sudo systemctl is-active --quiet kexu nginx kexu-ngrok

echo "课序更新完成；备份：$backup"
