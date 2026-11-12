"""
Stamps the plugin version into the panels and the manifest.

Run by .github/workflows/stamp-version.yml on every push to main, so
every change that reaches artists has its own number:

    version  = <version_base>.<build>     e.g. 0.3.14
    build    = number of commits on main (always goes up)
    channel  = the branch (main)
    built    = when the commit was made (UTC)
    commit   = short commit id, to find the exact change on GitHub

Bump version_base in build/plugin.json by hand for a bigger release
(0.3 -> 0.4); the build number keeps counting either way.

Usage: python build/stamp_version.py <build> <commit> <built> [channel]
"""

import json
import re
import sys

PANELS = ("src/MNR_Scene_Manager.jsx", "src/MNR_AE_Exporter.jsx", "src/MNR_AE_Importer.jsx")
MANIFEST = "build/plugin.json"


def stamp(build, commit, built, channel="main"):
    with open(MANIFEST, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    base = str(manifest.get("version_base") or "0.3")
    version = "%s.%s" % (base, build)

    for panel in PANELS:
        with open(panel, "r", encoding="utf-8") as f:
            text = f.read()
        for name, value in (("PLUGIN_VERSION", version), ("PLUGIN_CHANNEL", channel),
                            ("PLUGIN_BUILT", built), ("PLUGIN_COMMIT", commit)):
            text, n = re.subn(r'(var %s\s*=\s*")[^"]*(")' % name,
                              lambda m: m.group(1) + value + m.group(2), text, count=1)
            if n != 1:
                raise SystemExit("could not find %s in %s" % (name, panel))
        with open(panel, "w", encoding="utf-8", newline="\n") as f:
            f.write(text)

    manifest.update(version=version, channel=channel, built=built, commit=commit)
    with open(MANIFEST, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(manifest, indent=2) + "\n")
    print("stamped %s %s (%s, %s)" % (channel, version, built, commit))
    return version


if __name__ == "__main__":
    if len(sys.argv) < 4:
        raise SystemExit(__doc__)
    stamp(*sys.argv[1:5])
