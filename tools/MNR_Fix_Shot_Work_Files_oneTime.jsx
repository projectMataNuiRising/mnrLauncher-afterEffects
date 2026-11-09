/*
    MNR - Fix shot work files, After Effects (one-time)
    ---------------------------------------------------
    The After Effects twin of mnr_fixShotWorkFiles_oneTime.py (Blender).

    For every shot .aep work file
        <project>/03-shot/<ep>/<sq>/<sh>/<task>/work/<user>/...

        1. Name token     project-main -> main
        2. Version        3 digits: v54 -> v054
        3. Name vs folder the first four tokens must match the folders the
                          file is in (cgPRevis in a cgPrevis folder ->
                          cgPrevis, SQ1 in an SQ11 folder -> SQ11). The
                          project+episode part only when the episode folder
                          is a number, like 102.
        4. Folder         .aep files sitting loose in work/<user>/ or
                          work/<user>/afterEffects/ move into
                          work/<user>/afterEffects/saveFiles/
                          (saveFiles and sourceFiles are made if missing)

        Files whose names don't have the 6 pipeline tokens keep their name,
        but are still moved into saveFiles if they are loose. After Effects
        Auto-Save folders are not touched.

    HOW TO RUN

        1. Nobody should have these files open (on any machine), and pCloud
           should show everything up to date.
        2. In After Effects: Preferences > Scripting & Expressions, tick
           "Allow Scripts to Write Files and Access Network".
        3. File > Scripts > Run Script File... and pick this file.
        4. Nothing changes yet. A window shows every change and why; the
           same list is saved to your Desktop as mnr_ae_fix_preview.txt.
        5. Tick "I have checked the list" and press Fix.

    SAFETY

        - Nothing is ever overwritten. A change is skipped (and listed) if
          its new path already exists, or if two files would end up with
          the same new path.
        - Everything is checked again right before each file is touched.
        - A move is a copy, a size check, then removing the original only
          if the copy matches.
        - The project open in After Effects is skipped.
        - Every change is logged on your Desktop (mnr_ae_fix_log_<date>.txt,
          old path -> new path), so any of it can be put back by hand.
        - Other projects that import one of these .aep files by path will
          lose that link. The preview cannot see those.
*/

(function () {

    var PROJECTS_ROOT = "P:/01-projects";
    var OLD_TOKEN = "project-main";
    var NEW_TOKEN = "main";
    var PAD_VERSIONS = true;
    var MOVE_LOOSE_FILES = true;
    var FIX_TOKENS_FROM_FOLDERS = true;
    var SOFTWARE_DIR = "afterEffects";
    var SAVE_DIR = "saveFiles";
    var SOURCE_DIR = "sourceFiles";
    var EXT = ".aep";
    var TITLE = "MNR Fix Shot Work Files (After Effects)";

    // ── helpers (ExtendScript has no ES5)
    function lower(s) { return String(s).toLowerCase(); }
    function startsWith(s, p) { return String(s).substr(0, p.length) === p; }
    function endsWithI(s, p) {
        s = lower(s); p = lower(p);
        return s.length >= p.length && s.substr(s.length - p.length) === p;
    }
    function join() {
        var parts = [];
        for (var i = 0; i < arguments.length; i++) {
            var a = String(arguments[i]);
            if (a === "") { continue; }
            parts.push(i === 0 ? a.replace(/[\/\\]+$/, "") : a.replace(/^[\/\\]+|[\/\\]+$/g, ""));
        }
        return parts.join("/");
    }
    function dirname(p) { return String(p).replace(/[\/\\][^\/\\]*$/, ""); }
    function basename(p) { return String(p).replace(/^.*[\/\\]/, ""); }
    function pad3(n) { var s = String(n); while (s.length < 3) { s = "0" + s; } return s; }
    function sameFile(a, b) {
        return lower(String(a).replace(/\\/g, "/")) === lower(String(b).replace(/\\/g, "/"));
    }

    // ── file system (swapped for a mock when tested outside After Effects)
    var FS = {
        listDirs: function (path) {
            var out = [];
            var f = new Folder(path);
            if (!f.exists) { return out; }
            var items = f.getFiles();
            for (var i = 0; i < items.length; i++) {
                if (items[i] instanceof Folder) {
                    var n = File.decode(items[i].name);
                    if (!startsWith(n, "#") && !startsWith(n, ".")) { out.push(n); }
                }
            }
            out.sort(function (a, b) { return lower(a) < lower(b) ? -1 : (lower(a) > lower(b) ? 1 : 0); });
            return out;
        },
        listFileNames: function (path) {
            var out = [];
            var f = new Folder(path);
            if (!f.exists) { return out; }
            var items = f.getFiles();
            for (var i = 0; i < items.length; i++) {
                if (items[i] instanceof File) { out.push(File.decode(items[i].name)); }
            }
            out.sort();
            return out;
        },
        isFile: function (path) { return new File(path).exists && !(new Folder(path).exists); },
        exists: function (path) { return new File(path).exists || new Folder(path).exists; },
        size: function (path) { return new File(path).length; },
        makeDirs: function (path) {
            var f = new Folder(path);
            if (f.exists) { return true; }
            if (!FS.makeDirs(dirname(path))) { return false; }
            return f.create();
        },
        rename: function (path, newName) { return new File(path).rename(newName); },
        copy: function (from, to) { return new File(from).copy(to); },
        remove: function (path) { return new File(path).remove(); }
    };

    function fixedName(filename, project, ep, sq, sh, task) {
        /* {name, reasons}. Names without the 6 pipeline tokens come back unchanged. */
        var stem = filename.substr(0, filename.length - EXT.length);
        var tokens = stem.split("_");
        if (tokens.length !== 6) { return { name: filename, reasons: [] }; }
        var m = tokens[5].match(/^v(\d+)$/i);
        if (!m) { return { name: filename, reasons: [] }; }
        var reasons = [];
        if (FIX_TOKENS_FROM_FOLDERS) {
            var want = [project + ep, sq, sh, task];
            var labels = ["project/episode", "sequence", "shot", "task"];
            for (var i = 0; i < 4; i++) {
                if (i === 0 && !/^\d+$/.test(ep)) { continue; }   // named episode folders
                if (tokens[i] !== want[i]) {
                    reasons.push(labels[i] + " " + tokens[i] + " -> " + want[i]);
                    tokens[i] = want[i];
                }
            }
        }
        if (tokens[4] === OLD_TOKEN) {
            reasons.push("name " + OLD_TOKEN + " -> " + NEW_TOKEN);
            tokens[4] = NEW_TOKEN;
        }
        if (PAD_VERSIONS) {
            var padded = "v" + pad3(parseInt(m[1], 10));
            if (tokens[5] !== padded) {
                reasons.push("version " + tokens[5] + " -> " + padded);
                tokens[5] = padded;
            }
        }
        return { name: tokens.join("_") + EXT, reasons: reasons };
    }

    function plan(openPath) {
        /* {changes: [{from, to, reasons}], skipped: [{path, why}]} - nothing is touched. */
        var found = [];
        var projects = FS.listDirs(PROJECTS_ROOT);
        for (var p = 0; p < projects.length; p++) {
            var shotRoot = join(PROJECTS_ROOT, projects[p], "03-shot");
            var eps = FS.listDirs(shotRoot);
            for (var e = 0; e < eps.length; e++) {
                var sqs = FS.listDirs(join(shotRoot, eps[e]));
                for (var q = 0; q < sqs.length; q++) {
                    var shs = FS.listDirs(join(shotRoot, eps[e], sqs[q]));
                    for (var h = 0; h < shs.length; h++) {
                        var shotPath = join(shotRoot, eps[e], sqs[q], shs[h]);
                        var tasks = FS.listDirs(shotPath);
                        for (var t = 0; t < tasks.length; t++) {
                            var work = join(shotPath, tasks[t], "work");
                            var users = FS.listDirs(work);
                            for (var u = 0; u < users.length; u++) {
                                var userPath = join(work, users[u]);
                                var saveDir = join(userPath, SOFTWARE_DIR, SAVE_DIR);
                                var spots = [[userPath, true], [join(userPath, SOFTWARE_DIR), true],
                                             [saveDir, false]];
                                for (var s = 0; s < spots.length; s++) {
                                    var folder = spots[s][0], loose = spots[s][1];
                                    var names = FS.listFileNames(folder);
                                    for (var n = 0; n < names.length; n++) {
                                        var f = names[n];
                                        if (!endsWithI(f, EXT) || startsWith(f, "#")) { continue; }
                                        var fix = fixedName(f, projects[p], eps[e], sqs[q], shs[h], tasks[t]);
                                        var reasons = fix.reasons;
                                        var targetDir = folder;
                                        if (MOVE_LOOSE_FILES && loose) {
                                            targetDir = saveDir;
                                            reasons = reasons.concat(["moved into afterEffects/saveFiles"]);
                                        }
                                        if (!reasons.length) { continue; }
                                        found.push({ from: join(folder, f), to: join(targetDir, fix.name),
                                                     reasons: reasons });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        var byTarget = {};
        var i;
        for (i = 0; i < found.length; i++) {
            var k = lower(found[i].to);
            byTarget[k] = (byTarget[k] || []).concat([found[i].from]);
        }
        var changes = [], skipped = [];
        for (i = 0; i < found.length; i++) {
            var c = found[i];
            var others = byTarget[lower(c.to)];
            if (openPath && sameFile(c.from, openPath)) {
                skipped.push({ path: c.from, why: "open in After Effects" });
            } else if (others.length > 1) {
                var names2 = [];
                for (var o = 0; o < others.length; o++) {
                    if (others[o] !== c.from) { names2.push(basename(others[o])); }
                }
                skipped.push({ path: c.from, why: names2.join(", ") + " would also become " + basename(c.to) });
            } else if (FS.exists(c.to) && !sameFile(c.from, c.to)) {
                skipped.push({ path: c.from, why: basename(c.to) + " already exists there" });
            } else {
                changes.push(c);
            }
        }
        return { changes: changes, skipped: skipped };
    }

    function moveOrRename(from, to) {
        /* Same folder: rename. Other folder: copy, check size, then remove the original. */
        if (dirname(from) === dirname(to)) {
            return FS.rename(from, basename(to)) ? "" : "could not rename";
        }
        if (!FS.makeDirs(dirname(to))) { return "could not make " + dirname(to); }
        if (basename(dirname(to)) === SAVE_DIR) {
            FS.makeDirs(join(dirname(dirname(to)), SOURCE_DIR));
        }
        if (!FS.copy(from, to)) { return "could not copy"; }
        if (FS.size(to) !== FS.size(from)) {
            FS.remove(to);
            return "the copy did not match, original left in place";
        }
        if (!FS.remove(from)) { return "copied, but the original could not be removed"; }
        return "";
    }

    function apply(changes) {
        var done = [], failed = [];
        for (var i = 0; i < changes.length; i++) {
            var c = changes[i];
            // Checked again right before touching anything.
            if (!FS.isFile(c.from)) { failed.push({ path: c.from, why: "no longer there" }); continue; }
            if (FS.exists(c.to) && !sameFile(c.from, c.to)) {
                failed.push({ path: c.from, why: c.to + " appeared" });
                continue;
            }
            var problem = moveOrRename(c.from, c.to);
            if (problem) { failed.push({ path: c.from, why: problem }); } else { done.push(c); }
        }
        return { done: done, failed: failed };
    }

    function previewText(result) {
        var lines = [];
        var moved = 0, i;
        for (i = 0; i < result.changes.length; i++) {
            if (dirname(result.changes[i].from) !== dirname(result.changes[i].to)) { moved++; }
        }
        lines.push("MNR After Effects fix preview");
        lines.push("");
        lines.push("WILL CHANGE: " + result.changes.length + "   (" + moved + " of them moved into saveFiles)");
        lines.push("SKIPPED:     " + result.skipped.length);
        var last = null;
        for (i = 0; i < result.changes.length; i++) {
            var c = result.changes[i];
            if (dirname(c.from) !== last) {
                lines.push("");
                lines.push("[" + dirname(c.from).replace(/\//g, "\\") + "]");
                last = dirname(c.from);
            }
            lines.push("    " + basename(c.from));
            lines.push("      -> " + (dirname(c.to) !== dirname(c.from) ? c.to.replace(/\//g, "\\") : basename(c.to)));
            lines.push("         (" + c.reasons.join("; ") + ")");
        }
        lines.push("");
        lines.push("SKIPPED: " + result.skipped.length);
        for (i = 0; i < result.skipped.length; i++) {
            lines.push("    " + result.skipped[i].path.replace(/\//g, "\\"));
            lines.push("      (" + result.skipped[i].why + ")");
        }
        return lines.join("\n");
    }

    // Exposed for the tests that run outside After Effects.
    if (typeof module !== "undefined" && module.exports) {
        module.exports = { FS: FS, fixedName: fixedName, plan: plan, apply: apply,
                           previewText: previewText, setRoot: function (r) { PROJECTS_ROOT = r; } };
        return;
    }

    // ─────────────────────────────────────────────
    // Running inside After Effects
    // ─────────────────────────────────────────────

    function writeDesktop(name, text) {
        var f = new File(Folder.desktop.fsName + "/" + name);
        f.encoding = "UTF-8";
        if (f.open("w")) { f.write(text); f.close(); return f.fsName; }
        return "";
    }

    function stamp() {
        var d = new Date();
        function two(n) { return n < 10 ? "0" + n : String(n); }
        return d.getFullYear() + two(d.getMonth() + 1) + two(d.getDate()) + "_" +
            two(d.getHours()) + two(d.getMinutes()) + two(d.getSeconds());
    }

    try {
        if (app.preferences.getPrefAsLong("Main Pref Section",
                "Pref_SCRIPTING_FILE_NETWORK_SECURITY") !== 1) {
            alert("Tick Preferences > Scripting & Expressions >\n" +
                  "\"Allow Scripts to Write Files and Access Network\" first, then run this again.", TITLE);
            return;
        }
    } catch (e) { /* older After Effects: try anyway */ }

    var openPath = "";
    try { openPath = app.project.file ? app.project.file.fsName.replace(/\\/g, "/") : ""; } catch (e) {}

    var result = plan(openPath);
    if (!result.changes.length && !result.skipped.length) {
        alert("Nothing to fix.", TITLE);
        return;
    }
    var text = previewText(result);
    var previewPath = writeDesktop("mnr_ae_fix_preview.txt", text);

    var d = new Window("dialog", TITLE);
    d.orientation = "column";
    d.alignChildren = ["fill", "top"];
    d.margins = 16;
    d.add("statictext", undefined, result.changes.length + " file(s) will change, " +
          result.skipped.length + " skipped. Nothing has changed yet.");
    if (previewPath) {
        d.add("statictext", undefined, "Same list on your Desktop: mnr_ae_fix_preview.txt");
    }
    var box = d.add("edittext", undefined, text, { multiline: true, readonly: true, scrolling: true });
    box.preferredSize = [900, 460];
    d.add("statictext", undefined,
          "Projects that import these .aep files by path will lose the link. Nobody should have them open.");
    var checked = d.add("checkbox", undefined, "I have checked the list");
    var buttons = d.add("group");
    buttons.alignment = ["right", "bottom"];
    var cancel = buttons.add("button", undefined, "Cancel", { name: "cancel" });
    var ok = buttons.add("button", undefined, "Fix " + result.changes.length + " files", { name: "ok" });
    ok.enabled = false;
    checked.onClick = function () { ok.enabled = checked.value && result.changes.length > 0; };
    cancel.onClick = function () { d.close(0); };
    ok.onClick = function () { d.close(1); };
    d.center();
    if (d.show() !== 1) { return; }

    var outcome = apply(result.changes);
    var log = ["MNR After Effects fix log", "", "CHANGED " + outcome.done.length];
    var i;
    for (i = 0; i < outcome.done.length; i++) {
        log.push(outcome.done[i].from.replace(/\//g, "\\"));
        log.push("  -> " + outcome.done[i].to.replace(/\//g, "\\"));
    }
    log.push(""); log.push("FAILED " + outcome.failed.length);
    for (i = 0; i < outcome.failed.length; i++) {
        log.push(outcome.failed[i].path.replace(/\//g, "\\") + "  (" + outcome.failed[i].why + ")");
    }
    log.push(""); log.push("SKIPPED BEFORE RUNNING " + result.skipped.length);
    for (i = 0; i < result.skipped.length; i++) {
        log.push(result.skipped[i].path.replace(/\//g, "\\") + "  (" + result.skipped[i].why + ")");
    }
    var logPath = writeDesktop("mnr_ae_fix_log_" + stamp() + ".txt", log.join("\n"));
    alert("Fixed " + outcome.done.length + " file(s), " + outcome.failed.length + " failed.\n" +
          (logPath ? "Log: " + logPath : ""), TITLE);

})();
