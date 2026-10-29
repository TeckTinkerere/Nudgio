"""Prints the UDID of the newest available iPhone simulator.

Reads `xcrun simctl list devices available --json` on stdin. Runner images
change device names with every Xcode release, so CI picks one instead of
hard-coding "iPhone 17". AlarmKit needs iOS 26, so older runtimes are skipped.
"""
import json
import re
import sys

devices = json.load(sys.stdin)["devices"]
candidates = []
for runtime, entries in devices.items():
    match = re.search(r"iOS-(\d+)-(\d+)", runtime)
    if not match or int(match.group(1)) < 26:
        continue
    version = (int(match.group(1)), int(match.group(2)))
    for device in entries:
        if device.get("isAvailable") and device["name"].startswith("iPhone"):
            candidates.append((version, device["name"], device["udid"]))

if not candidates:
    sys.exit("No iOS 26+ iPhone simulator is installed on this runner")
candidates.sort()
print(candidates[-1][2])
