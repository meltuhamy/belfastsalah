#!/usr/bin/env bash
# Boots the simulator every iOS job uses, and prints its id.
#
#   udid="$(scripts/ios/boot-simulator.sh)"
#
# The newest "iPhone N Pro Max" on the newest iOS the runner has. One model
# everywhere, because the widget snapshot references are only comparable
# with images drawn on the same one - and that model's screenshots are the
# 6.9" size the App Store asks for.
#
# Light appearance, and a status bar pinned to 9:41 with full signal and
# battery, so screenshots differ only where the app does.

set -euo pipefail

udid="$(xcrun simctl list devices available -j | python3 -c '
import json, re, sys
best = None
for runtime, devices in json.load(sys.stdin)["devices"].items():
    version = re.search(r"iOS-(\d+)-(\d+)", runtime)
    if not version:
        continue
    for device in devices:
        model = re.fullmatch(r"iPhone (\d+) Pro Max", device["name"])
        if model:
            key = (int(version[1]), int(version[2]), int(model[1]))
            if best is None or key > best[0]:
                best = (key, device["udid"], device["name"], runtime)
if best is None:
    sys.exit("No iPhone Pro Max simulator on this runner")
print(best[1])
print("Using", best[2], "on", best[3], file=sys.stderr)
')"

xcrun simctl bootstatus "$udid" -b >&2
xcrun simctl ui "$udid" appearance light
xcrun simctl status_bar "$udid" override \
  --time 9:41 --dataNetwork wifi --wifiMode active --wifiBars 3 \
  --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100
echo "$udid"
