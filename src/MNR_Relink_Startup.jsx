/*
    MNR Relink - startup
    --------------------
    Installed by MNR Launcher into After Effects' Scripts\Startup folder,
    which After Effects runs every time it starts.

    Publishes were moved and renamed by the pipeline fix scripts:

      - TIFFs moved from smAnim to rotoKeyIngest
            ...\smAnim\export\publish\media\<name>\tif\
         -> ...\rotoKeyIngest\export\publish\media\<name>\tif\
      - the 4th name token fixed to the task they are in
            BFP102_SQ04_SH12_smAnim_gali01-main_v001
         -> BFP102_SQ04_SH12_rotoKeyIngest_gali01-main_v001
      - BPF102_... names fixed to BFP102_...
      - EXRs moved into an exr folder:   <name>\<name>.####.exr -> <name>\exr\
      - proxies renamed:  <name>_Proxy\...-main_v001.####.png
                       -> <name with -proxy>\png\...-proxy_v001.####.png
      - sequences that started at 0000 / 0001 renumbered (e.g. to 1001)
      - extras in file names dropped: ..._kopaka01-main-ACEScg-16bf_v001
        -> ..._kopaka01-main_v001

    For a sequence, the frames in its new place are counted. The same
    number of frames as the footage had, starting at another number, is
    taken as a renumber and shown as one (0001-0081 -> 1001-1081). A
    different number of frames is shown as a warning and left unticked.

    So older After Effects projects show that footage as missing. Whenever
    a project is opened (checked every few seconds), every missing file
    under P:\01-projects is looked for where those fixes put it. When any
    are found, a window lists them (was / now) and asks before replacing
    anything. Replacing keeps the footage's frame rate and alpha
    interpretation. "Not for this project" stops it asking again for that
    project file.

    $.global.mnrRelinkCheck(true) runs the check by hand (e.g. from the
    Scene Manager). Everything done is logged to
    %APPDATA%\MNR_Launcher\ae_relink.log.

    Written for ExtendScript (ES3).
*/

(function () {

    var PROJECTS_ROOT = "P:/01-projects";
    var POLL_MS = 3000;
    var SETTINGS_SECTION = "MNR Relink";
    var IMAGE_EXT = /\.(tiff?|exr|png|dpx|jpe?g|tga|psd|cin|hdr|sgi|bmp)$/i;

    function lower(s) { return String(s).toLowerCase(); }

    // ─────────────────────────────────────────────
    // Where a moved / renamed publish is now (no files touched here)
    // ─────────────────────────────────────────────

    var MEDIA_RE = /^(.*?\/([^\/]+)\/03-shot\/([^\/]+)\/([^\/]+)\/([^\/]+)\/)([^\/]+)\/export\/publish\/media\/([^\/]+)\/(.*)$/i;

    function proxyVariant(variant) {
        var v = lower(variant);
        if (v === "proxy" || v.substr(v.length - 6) === "-proxy") { return variant; }
        return v === "main" ? "proxy" : variant + "-proxy";
    }

    function fixFolderName(name, project, ep, task) {
        /* {name, proxy} with the pipeline fixes, or null when not a pipeline name. */
        var t = String(name).split("_");
        var proxy = false;
        if (t.length === 7 && lower(t[6]) === "proxy") {
            t = t.slice(0, 6);
            proxy = true;
        }
        if (t.length !== 6 || !/^v\d+$/i.test(t[5]) || t[4].indexOf("-") < 1) { return null; }
        if (proxy) {
            var dash = t[4].indexOf("-");
            t[4] = t[4].substr(0, dash) + "-" + proxyVariant(t[4].substr(dash + 1));
        }
        t[3] = task;
        if (/^\d+$/.test(ep)) { t[0] = project + ep; }
        return { name: t.join("_"), proxy: proxy };
    }

    function fixFileName(file, oldFolder, newFolder) {
        /* A file with the same layer and version as its folder is named
           after the folder's new name up to the version (extras like
           -ACEScg-16bf dropped), frame number and extension kept. */
        var m = String(file).match(/^(.+?_v\d+)(.*)$/i);
        if (!m) { return file; }
        var ft = m[1].split("_");
        var ot = String(oldFolder).split("_");
        if (ft.length !== 6 || ot.length < 6) { return file; }
        var fLayer = lower(ft[4].split("-")[0]), oLayer = lower(ot[4].split("-")[0]);
        if (fLayer !== oLayer || lower(ft[5]) !== lower(ot[5])) { return file; }
        return newFolder + m[2];
    }

    function newPlaces(path) {
        /* Where a publish file may be now, most fixed first. Paths use "/". */
        var p = String(path).replace(/\\/g, "/");
        var out = [];
        function add(x) {
            for (var i = 0; i < out.length; i++) { if (lower(out[i]) === lower(x)) { return; } }
            if (lower(x) !== lower(p)) { out.push(x); }
        }
        // TIFFs that were in smAnim live in rotoKeyIngest now.
        var moved = p.replace(/\/smAnim\/export\/publish\/media\//i, "/rotoKeyIngest/export/publish/media/");
        var m = moved.match(MEDIA_RE);
        if (m) {
            var shotDir = m[1], project = m[2], ep = m[3], task = m[6], folder = m[7], rest = m[8];
            var fixed = fixFolderName(folder, project, ep, task);
            if (fixed) {
                var slash = rest.lastIndexOf("/");
                var sub = slash >= 0 ? rest.substr(0, slash + 1) : "";
                var file = slash >= 0 ? rest.substr(slash + 1) : rest;
                var newFile = fixFileName(file, folder, fixed.name);
                if (!sub && /\.exr$/i.test(file)) { sub = "exr/"; }
                if (!sub && fixed.proxy && /\.png$/i.test(file)) { sub = "png/"; }
                var base = shotDir + task + "/export/publish/media/";
                add(base + fixed.name + "/" + sub + newFile);
                add(base + fixed.name + "/" + rest);
            }
        }
        add(moved);
        return out;
    }

    function frameOf(file) {
        /* name.1001.tif -> 1001, or -1 */
        var m = String(file).match(/[._](\d+)\.[^.]+$/);
        return m ? parseInt(m[1], 10) : -1;
    }

    function pad4(n) {
        var s = String(n);
        while (s.length < 4) { s = "0" + s; }
        return s;
    }

    function stemOf(file) {
        /* name.1001.tif / name_1001.tif -> name */
        return String(file).replace(/\.[^.]+$/, "").replace(/[._]\d+$/, "");
    }

    var CORE = { newPlaces: newPlaces, fixFolderName: fixFolderName, fixFileName: fixFileName,
                 stemOf: stemOf, frameOf: frameOf };
    if (typeof module !== "undefined" && module.exports) {
        module.exports = CORE;
        return;
    }

    // ─────────────────────────────────────────────
    // After Effects side
    // ─────────────────────────────────────────────

    function log(text) {
        try {
            var folder = new Folder(Folder.userData.fsName + "/MNR_Launcher");
            if (!folder.exists) { folder.create(); }
            var f = new File(folder.fsName + "/ae_relink.log");
            f.encoding = "UTF-8";
            if (f.exists && f.length > 2000000) { f.remove(); }
            if (f.open("a")) { f.writeln(new Date().toString() + "  " + text); f.close(); }
        } catch (e) { /* logging is never worth failing over */ }
    }

    function getSetting(key) {
        try {
            return app.settings.haveSetting(SETTINGS_SECTION, key) ?
                app.settings.getSetting(SETTINGS_SECTION, key) : "";
        } catch (e) { return ""; }
    }

    function saveSetting(key, value) {
        try { app.settings.saveSetting(SETTINGS_SECTION, key, value); } catch (e) {}
    }

    function skipKey(projectPath) {
        return "skip " + lower(projectPath).replace(/[^a-z0-9]+/g, "_").substr(-200);
    }

    function existingFile(path, sequence) {
        /* {file, first, last, count} for the file, or for a sequence its
           frames of the same name in that folder (any numbers: a renumbered
           sequence has the same name with other frame numbers). null when
           not there. */
        var f = new File(path);
        if (!sequence) { return f.exists ? { file: f, first: -1, last: -1, count: 1 } : null; }
        var dir = new Folder(path.replace(/\/[^\/]*$/, ""));
        if (!dir.exists) { return null; }
        var want = lower(stemOf(path.replace(/^.*\//, "")));
        var files = dir.getFiles();
        var best = null, first = -1, last = -1, count = 0;
        for (var i = 0; i < files.length; i++) {
            if (!(files[i] instanceof File)) { continue; }
            var n = File.decode(files[i].name);
            if (lower(stemOf(n)) !== want) { continue; }
            var fr = frameOf(n);
            if (fr < 0) { continue; }
            count++;
            if (first < 0 || fr < first) { first = fr; best = files[i]; }
            if (fr > last) { last = fr; }
        }
        if (f.exists && frameOf(path.replace(/^.*\//, "")) === first) { best = f; }
        return best ? { file: best, first: first, last: last, count: count } : null;
    }

    function findMoved() {
        /* [{item, was, now, sequence}] for missing footage found in its new place. */
        var out = [];
        var root = lower(PROJECTS_ROOT);
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (!(item instanceof FootageItem)) { continue; }
            try {
                if (!item.footageMissing || !(item.mainSource instanceof FileSource)) { continue; }
                var was = item.mainSource.file.fsName.replace(/\\/g, "/");
                if (lower(was).substr(0, root.length) !== root) { continue; }
                var sequence = !item.mainSource.isStill && IMAGE_EXT.test(was);
                var places = newPlaces(was);
                // Frames the footage had: its length at its frame rate.
                var expected = sequence ? Math.round(item.duration * item.frameRate) : 1;
                var oldFirst = frameOf(was.replace(/^.*\//, ""));
                for (var j = 0; j < places.length; j++) {
                    var f = existingFile(places[j], sequence);
                    if (!f) { continue; }
                    var hit = { item: item, was: was, now: f.file.fsName.replace(/\\/g, "/"),
                                sequence: sequence, note: "", ok: true };
                    if (sequence) {
                        if (f.count !== expected) {
                            hit.note = "frame count differs: " + f.count + " there, " + expected +
                                " expected (" + pad4(f.first) + "-" + pad4(f.last) + ")";
                            hit.ok = false;
                        } else if (oldFirst >= 0 && f.first !== oldFirst) {
                            hit.note = "renumbered " + pad4(oldFirst) + "-" + pad4(oldFirst + expected - 1) +
                                " -> " + pad4(f.first) + "-" + pad4(f.last);
                        } else {
                            hit.note = f.count + " frames, " + pad4(f.first) + "-" + pad4(f.last);
                        }
                    }
                    out.push(hit);
                    break;
                }
            } catch (e) {}
        }
        return out;
    }

    function shortPath(p) {
        return String(p).replace(/^.*\/03-shot\//i, "...\\").replace(/\/export\/publish\/media\//i, "\\...\\")
            .replace(/\//g, "\\");
    }

    function replaceFootage(hit) {
        /* Replaces one footage item, keeping how it was interpreted. */
        var src = hit.item.mainSource;
        var keep = {};
        var props = ["conformFrameRate", "alphaMode", "premulColor", "invertAlpha", "fieldSeparationType",
                     "highQualityFieldSeparation", "removePulldown", "loop"];
        var i;
        for (i = 0; i < props.length; i++) {
            try { keep[props[i]] = src[props[i]]; } catch (e) {}
        }
        if (hit.sequence) {
            hit.item.replaceWithSequence(new File(hit.now), false);
        } else {
            hit.item.replace(new File(hit.now));
        }
        src = hit.item.mainSource;
        for (i = 0; i < props.length; i++) {
            if (!keep.hasOwnProperty(props[i])) { continue; }
            try {
                if (props[i] === "premulColor" && keep.alphaMode !== AlphaMode.PREMULTIPLIED) { continue; }
                src[props[i]] = keep[props[i]];
            } catch (e) {}
        }
    }

    function ask(hits, projectPath) {
        /* The window: was / now per footage item, ticked. Returns the ticked ones, or null. */
        var d = new Window("dialog", "MNR Relink");
        d.orientation = "column";
        d.alignChildren = ["fill", "top"];
        d.margins = 16;
        d.spacing = 8;
        var title = d.add("statictext", undefined, "Found " + hits.length + " missing file" +
            (hits.length > 1 ? "s" : "") + " in their new place");
        try {
            title.graphics.font = ScriptUI.newFont(title.graphics.font.name, ScriptUI.FontStyle.BOLD, 15);
        } catch (e) {}
        d.add("statictext", undefined, "These publishes were moved or renamed by the pipeline. " +
            "Check each one, then Replace to point the footage at its new place.", { multiline: true })
            .preferredSize = [720, 34];
        var list = d.add("group");
        list.orientation = "column";
        list.alignChildren = ["fill", "top"];
        list.spacing = 6;
        var ticks = [];
        var shown = Math.min(hits.length, 12);
        for (var i = 0; i < shown; i++) {
            var g = list.add("panel");
            g.orientation = "column";
            g.alignChildren = ["fill", "top"];
            g.margins = [10, 8, 10, 6];
            g.spacing = 2;
            var tick = g.add("checkbox", undefined, hits[i].item.name);
            tick.value = hits[i].ok;
            ticks.push(tick);
            g.add("statictext", undefined, "was:  " + shortPath(hits[i].was), { truncate: "middle" })
                .preferredSize.width = 700;
            g.add("statictext", undefined, "now:  " + shortPath(hits[i].now), { truncate: "middle" })
                .preferredSize.width = 700;
            if (hits[i].note) {
                var note = g.add("statictext", undefined, (hits[i].ok ? "" : "CHECK: ") + hits[i].note);
                note.preferredSize.width = 700;
                try {
                    note.graphics.foregroundColor = note.graphics.newPen(note.graphics.PenType.SOLID_COLOR,
                        hits[i].ok ? [0.4, 0.8, 0.5, 1] : [0.95, 0.4, 0.35, 1], 1);
                } catch (e2) {}
            }
        }
        if (hits.length > shown) {
            var more = list.add("checkbox", undefined, "... and " + (hits.length - shown) + " more like these");
            more.value = true;
            ticks.push(more);
        }
        var buttons = d.add("group");
        buttons.alignment = ["right", "bottom"];
        var never = buttons.add("button", undefined, "Not for this project");
        var later = buttons.add("button", undefined, "Not now", { name: "cancel" });
        var ok = buttons.add("button", undefined, "Replace", { name: "ok" });
        var choice = 0;
        never.onClick = function () { choice = 2; d.close(2); };
        later.onClick = function () { choice = 0; d.close(0); };
        ok.onClick = function () { choice = 1; d.close(1); };
        d.center();
        d.show();
        if (choice === 2) {
            saveSetting(skipKey(projectPath), "1");
            log("not asking again for " + projectPath);
            return null;
        }
        if (choice !== 1) { return null; }
        var picked = [];
        for (var k = 0; k < hits.length; k++) {
            var t = k < shown ? ticks[k] : ticks[ticks.length - 1];
            if (t.value) { picked.push(hits[k]); }
        }
        return picked;
    }

    $.global.mnrRelinkCheck = function (force) {
        /* Looks for moved / renamed publishes in the open project. force: also
           when "Not for this project" was picked before. */
        try {
            if (!app.project || !app.project.file) { return 0; }
            var projectPath = app.project.file.fsName;
            if (!force && getSetting(skipKey(projectPath)) === "1") { return 0; }
            var hits = findMoved();
            if (!hits.length) {
                if (force) { alert("No missing footage was found in a new place.", "MNR Relink"); }
                return 0;
            }
            log(projectPath + ": " + hits.length + " found");
            var picked = ask(hits, projectPath);
            if (!picked || !picked.length) { return 0; }
            var done = 0, failed = [];
            app.beginUndoGroup("MNR Relink");
            for (var i = 0; i < picked.length; i++) {
                try {
                    replaceFootage(picked[i]);
                    done++;
                    log("  " + picked[i].was + "  ->  " + picked[i].now +
                        (picked[i].note ? "  (" + picked[i].note + ")" : ""));
                } catch (e) {
                    failed.push(picked[i].item.name + ": " + e.toString());
                    log("  FAILED " + picked[i].was + ": " + e.toString());
                }
            }
            app.endUndoGroup();
            if (failed.length) {
                alert("Replaced " + done + ". These failed:\n" + failed.join("\n"), "MNR Relink");
            }
            return done;
        } catch (e2) {
            log("check failed: " + e2.toString());
            return 0;
        }
    };

    // Checks each project once, when it is opened (a different project file).
    $.global.mnrRelinkPoll = function () {
        try {
            var path = app.project && app.project.file ? app.project.file.fsName : "";
            if (path === $.global.mnrRelinkLast) { return; }
            $.global.mnrRelinkLast = path;
            if (path) { $.global.mnrRelinkCheck(false); }
        } catch (e) {}
    };

    try {
        if ($.global.mnrRelinkTask) { app.cancelTask($.global.mnrRelinkTask); }
        $.global.mnrRelinkLast = "";
        $.global.mnrRelinkTask = app.scheduleTask("try { $.global.mnrRelinkPoll(); } catch (e) {}", POLL_MS, true);
    } catch (e) {
        log("could not start: " + e.toString());
    }

})();
