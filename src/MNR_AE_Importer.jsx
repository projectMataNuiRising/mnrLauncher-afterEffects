/* MNR AE Importer (After Effects). Notes below. */
(function (thisObj) {

    // ── Version stamp ──────────────────────────────────────────────
    // Written by the "Stamp plugin version" GitHub action on every push
    // to main, same numbers as the MNR Scene Manager. Keep at the top.
    var PLUGIN_VERSION = "0.3.0";
    var PLUGIN_CHANNEL = "main";
    var PLUGIN_BUILT = "";
    var PLUGIN_COMMIT = "";
    // ───────────────────────────────────────────────────────────────

    /*
        MNR AE Importer  (After Effects)
        --------------------------------
        Project Mata Nui Rising. Brings the stop-motion TIFF sequences of a
        shot into the open project, ready to key.

        Installed by MNR Launcher with the other MNR panels. Open it from
        the MNR Toolbar or Window > MNR_AE_Importer.jsx.

        HOW IT WORKS

            1. The shot is filled in from where the open .aep lives (as the
               MNR Scene Manager saves it), and can be changed. "From" is
               the task the TIFFs come from (rotoKeyIngest by default):
                 P:\01-projects\<project>\03-shot\<ep>\<sq>\<sh>\<task>\
                     export\publish\media\<name>\tif\<name>.####.tif
            2. Every TIFF sequence there is listed with a tick box (latest
               version of each layer only, unless that is unticked), with
               its frames, the MP4's frame rate and the TIFF's bit depth.
               Ones already in the project are listed but not ticked.
            3. Import brings in the ticked ones:
                 - the TIFF sequence, at the MP4's frame rate
                   (<name>.mp4 next to its folder). Not 12 or 24 fps, or no
                   MP4 (12 fps is used), is warned about first. The MP4 is
                   only read, not imported.
                 - Interpret Footage colour set to ACEScg when the TIFF is
                   scene linear (16 / 32-bit float, read from the file),
                   else a warning.
                 - a comp named like the folder, the TIFF's size and
                   length, numbered from its first frame (1001...), so the
                   MNR AE Exporter numbers renders the same.
               Into these project bins (made when missing):
                 01_comps                     the comps
                 02_footage\<task>            the TIFF sequences
                 03_precomps                  for your own precomps

        ACESCG

            Scripts cannot set Interpret Footage > Color. Replacing a
            footage item's file keeps its interpretation though, so the
            importer brings in a reference footage item that is already
            ACEScg and swaps its file for the TIFF sequence. The reference
            is a footage item named "MNR ACEScg" (Interpret Footage > Color
            set to ACEScg) saved in MNR_Import_Presets_<year>_v###.aep, next
            to this script or in P:\02-pipeline\apps\afterEffects\presets\.
            A project saved in an older After Effects opens in newer ones,
            so one saved in the oldest version in use covers them all.
            Without it the TIFFs import with After Effects' default colour
            and the panel says so.

        Written for ExtendScript (ES3).
    */

    var PANEL_NAME = "MNR AE Importer";

    // ─────────────────────────────────────────────
    // Settings
    // ─────────────────────────────────────────────

    var PROJECTS_ROOT = "P:/01-projects";
    var DEFAULT_PROJECT = "BFP";
    var SHOT_DIR = "03-shot";
    var MEDIA_PATH = ["export", "publish", "media"];
    var SOURCE_TASKS = ["rotoKeyIngest", "smAnim"];
    var DEFAULT_SOURCE = "rotoKeyIngest";
    var PRESETS_DIR = "P:/02-pipeline/apps/afterEffects/presets";
    var PRESETS_PATTERN = /^MNR_Import_Presets_(\d{4})_v(\d+)\.aep$/i;
    var REFERENCE_NAME = /^MNR ACEScg\b/i;
    var PIPELINE_FPS = [12, 24];
    var DEFAULT_FPS = 12;                    // when there is no MP4
    var BIN_COMPS = "01_comps";
    var BIN_FOOTAGE = "02_footage";
    var BIN_PRECOMPS = "03_precomps";
    var SCENE_MANAGER_SETTINGS = "MNR Scene Manager";
    var SCRIPT_DIR = (function () {
        try { return new File($.fileName).parent.fsName.replace(/\\/g, "/"); } catch (e) { return ""; }
    }());

    var C_ACCENT = [0.29, 0.56, 0.89, 1];
    var C_FIELD = [0.24, 0.24, 0.24, 1];
    var C_FIELD_OFF = [0.20, 0.20, 0.20, 1];
    var C_DIM = [0.55, 0.55, 0.55, 1];
    var C_WHITE = [0.96, 0.96, 0.96, 1];
    var C_GOOD = [0.40, 0.80, 0.50, 1];
    var C_WARN = [0.95, 0.70, 0.30, 1];
    var C_BAD = [0.95, 0.40, 0.35, 1];

    // ─────────────────────────────────────────────
    // Small helpers (ES3)
    // ─────────────────────────────────────────────

    function trim(s) { return String(s).replace(/^\s+|\s+$/g, ""); }

    function lower(s) { return String(s).toLowerCase(); }

    function startsWith(s, p) { return String(s).substr(0, p.length) === p; }

    function inList(list, value) {
        for (var i = 0; i < list.length; i++) {
            if (list[i] === value) { return true; }
        }
        return false;
    }

    function join() {
        var parts = [];
        for (var i = 0; i < arguments.length; i++) {
            var p = String(arguments[i]).replace(/\\/g, "/");
            if (p) { parts.push(p.replace(/\/+$/, "")); }
        }
        return parts.join("/");
    }

    function sortNames(list) {
        list.sort(function (a, b) { return lower(a) < lower(b) ? -1 : (lower(a) > lower(b) ? 1 : 0); });
        return list;
    }

    function samePath(a, b) {
        return lower(String(a).replace(/\\/g, "/").replace(/\/+$/, "")) ===
            lower(String(b).replace(/\\/g, "/").replace(/\/+$/, ""));
    }

    // ─────────────────────────────────────────────
    // File system and binary reading (swapped for mocks in the tests)
    // ─────────────────────────────────────────────

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
            return sortNames(out);
        },
        listNames: function (path) {
            var out = [];
            var f = new Folder(path);
            if (!f.exists) { return out; }
            var items = f.getFiles();
            for (var i = 0; i < items.length; i++) {
                if (items[i] instanceof File) { out.push(File.decode(items[i].name)); }
            }
            return out;
        },
        isDir: function (path) { return new Folder(path).exists; },
        isFile: function (path) { return new File(path).exists; },
        reader: function (path) {
            /* {size, bytes(pos, len) -> [0..255], close()} or null. */
            var f = new File(path);
            f.encoding = "BINARY";
            if (!f.exists || !f.open("r")) { return null; }
            return {
                size: f.length,
                bytes: function (pos, len) {
                    f.seek(pos, 0);
                    var s = f.read(len);
                    var out = [];
                    for (var i = 0; i < s.length; i++) { out.push(s.charCodeAt(i) & 255); }
                    return out;
                },
                close: function () { try { f.close(); } catch (e) {} }
            };
        }
    };

    // ─────────────────────────────────────────────
    // Names and paths
    // ─────────────────────────────────────────────

    function parseAepPath(path) {
        /* {project, ep, sq, sh, task} from where an .aep lives, or {} */
        var p = String(path || "").replace(/\\/g, "/");
        if (!startsWith(lower(p), lower(PROJECTS_ROOT + "/"))) { return {}; }
        var parts = p.substr(PROJECTS_ROOT.length + 1).split("/");
        var out = { project: parts[0] };
        if (parts[1] === SHOT_DIR && parts.length >= 7) {
            out.ep = parts[2]; out.sq = parts[3]; out.sh = parts[4]; out.task = parts[5];
        }
        return out;
    }

    function shotDir(ctx) {
        return join(PROJECTS_ROOT, ctx.project, SHOT_DIR, ctx.ep, ctx.sq, ctx.sh);
    }

    function mediaDir(ctx, task) {
        return join(shotDir(ctx), task, MEDIA_PATH.join("/"));
    }

    function sourceChoices(ctx) {
        /* The usual source tasks first, then any other task in the shot
           that has a publish media folder. */
        var out = SOURCE_TASKS.slice(0);
        var tasks = ctx.sh ? FS.listDirs(shotDir(ctx)) : [];
        for (var i = 0; i < tasks.length; i++) {
            if (!inList(out, tasks[i]) && FS.isDir(mediaDir(ctx, tasks[i]))) { out.push(tasks[i]); }
        }
        return out;
    }

    function stemOf(fileName) {
        var s = String(fileName).replace(/\.[^.]+$/, "");
        s = s.replace(/[._]\[?\d+(-\d+)?\]?$/, "");
        return s;
    }

    function parseLayerName(name) {
        /* {layer, variant, task, version} from a pipeline name, or null. */
        var tokens = stemOf(name).split("_");
        if (tokens.length < 6 || !/^v\d+$/i.test(tokens[tokens.length - 1])) { return null; }
        var seg = tokens[tokens.length - 2];
        var dash = seg.indexOf("-");
        var layer = dash > 0 ? seg.substr(0, dash) : seg;
        if (!layer) { return null; }
        return { layer: layer, variant: dash > 0 ? seg.substr(dash + 1) : "",
                 task: tokens[tokens.length - 3],
                 version: parseInt(tokens[tokens.length - 1].substr(1), 10) };
    }

    function folderStem(names) {
        /* The sequence name used by most .####.tif files in a folder, or "". */
        var counts = {}, best = "", bestN = 0;
        for (var i = 0; i < names.length; i++) {
            var m = String(names[i]).match(/^(.+?)[._]\d+\.tiff?$/i);
            if (!m) { continue; }
            counts[m[1]] = (counts[m[1]] || 0) + 1;
        }
        for (var k in counts) {
            if (counts.hasOwnProperty(k) && counts[k] > bestN) { best = k; bestN = counts[k]; }
        }
        return best;
    }

    function tifFrames(names, stem) {
        /* [{n, name}] of stem.####.tif / stem_####.tif, by frame number. */
        var out = [], seen = {};
        var head = lower(stem);
        for (var i = 0; i < names.length; i++) {
            var n = lower(names[i]);
            if (n.substr(0, head.length) !== head) { continue; }
            var m = n.substr(head.length).match(/^[._](\d+)\.tiff?$/);
            if (!m) { continue; }
            var f = parseInt(m[1], 10);
            if (!seen[f]) { seen[f] = true; out.push({ n: f, name: names[i] }); }
        }
        out.sort(function (a, b) { return a.n - b.n; });
        return out;
    }

    function fpsProblem(fps) {
        /* "" for 12 / 24 fps, else what to say about it. */
        for (var i = 0; i < PIPELINE_FPS.length; i++) {
            if (Math.abs(fps - PIPELINE_FPS[i]) < 0.01) { return ""; }
        }
        return fpsText(fps) + " fps is not 12 or 24";
    }

    function fpsText(f) { return String(Math.round(f * 1000) / 1000); }

    function findMp4(media, folder) {
        /* The MP4 that goes with a TIFF folder: <name>.mp4 next to the
           folder, else inside it (or its mp4 folder). "" when none. */
        var tries = [join(media, folder + ".mp4"), join(media, folder, folder + ".mp4"),
                     join(media, folder, "mp4", folder + ".mp4")];
        for (var i = 0; i < tries.length; i++) {
            if (FS.isFile(tries[i])) { return tries[i]; }
        }
        var dirs = [join(media, folder), join(media, folder, "mp4")];
        for (var d = 0; d < dirs.length; d++) {
            var names = FS.listNames(dirs[d]);
            for (var j = 0; j < names.length; j++) {
                if (/\.mp4$/i.test(names[j])) { return join(dirs[d], names[j]); }
            }
        }
        return "";
    }

    // ─────────────────────────────────────────────
    // Reading file headers
    // ─────────────────────────────────────────────

    function u16(b, i, le) { return le ? b[i] | (b[i + 1] << 8) : (b[i] << 8) | b[i + 1]; }

    function u32(b, i, le) {
        return le ? (b[i] + b[i + 1] * 256 + b[i + 2] * 65536 + b[i + 3] * 16777216) :
            (b[i] * 16777216 + b[i + 1] * 65536 + b[i + 2] * 256 + b[i + 3]);
    }

    function ascii(b, start, len) {
        var s = "";
        for (var i = start; i < start + len && i < b.length; i++) {
            if (b[i] === 0) { break; }
            s += String.fromCharCode(b[i]);
        }
        return s;
    }

    function readTiff(r) {
        /* {bits, float, samples, description, software, icc} from a TIFF
           header, or null. */
        var head = r.bytes(0, 8);
        if (head.length < 8) { return null; }
        var le;
        if (head[0] === 0x49 && head[1] === 0x49) { le = true; } else if (head[0] === 0x4D && head[1] === 0x4D) { le = false; } else { return null; }
        if (u16(head, 2, le) !== 42) { return null; }
        var ifd = u32(head, 4, le);
        var n = u16(r.bytes(ifd, 2), 0, le);
        var e = r.bytes(ifd + 2, n * 12);
        var sizes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 16: 8 };
        function value(i) {
            /* First value of entry i (numbers), or the text (ASCII). */
            var type = u16(e, i + 2, le), count = u32(e, i + 4, le);
            var size = (sizes[type] || 1) * count;
            var data = size <= 4 ? e.slice(i + 8, i + 12) : r.bytes(u32(e, i + 8, le), Math.min(size, 2048));
            if (type === 2) { return ascii(data, 0, data.length); }
            if (type === 3) { return u16(data, 0, le); }
            if (type === 4) { return u32(data, 0, le); }
            return data[0];
        }
        var out = { bits: 0, float: false, samples: 1, description: "", software: "", icc: "" };
        for (var k = 0; k < n; k++) {
            var i = k * 12, tag = u16(e, i, le);
            if (tag === 258) { out.bits = value(i); }
            else if (tag === 277) { out.samples = value(i); }
            else if (tag === 339) { out.float = value(i) === 3; }
            else if (tag === 270) { out.description = value(i); }
            else if (tag === 305) { out.software = value(i); }
            else if (tag === 34675) {
                // ICC profile: its description, roughly (the readable text in it).
                var cnt = u32(e, i + 4, le), at = u32(e, i + 8, le);
                var icc = r.bytes(at, Math.min(cnt, 4096));
                var txt = "";
                for (var c = 128; c < icc.length; c++) {
                    if (icc[c] >= 32 && icc[c] < 127) { txt += String.fromCharCode(icc[c]); } else { txt += " "; }
                }
                var m = txt.match(/(ACES[\w .-]*|sRGB[\w .-]*|Linear[\w .-]*|Rec\.? ?709[\w .-]*|Display P3[\w .-]*|Adobe RGB[\w .-]*)/i);
                out.icc = m ? trim(m[1]) : "embedded";
            }
        }
        return out;
    }

    function tiffColour(info) {
        /* {text, aces, warn}: what the TIFF says it is, and whether it gets
           ACEScg. Scene linear = float; a named colour space wins. */
        if (!info) { return { text: "could not read the TIFF", aces: false, warn: "could not read the TIFF header" }; }
        var depth = info.bits + "-bit " + (info.float ? "float" : "int");
        var named = lower(info.description + " " + info.software + " " + info.icc);
        if (/acescg|aces ?- ?cg|\bap1\b/.test(named)) { return { text: depth + ", ACEScg", aces: true, warn: "" }; }
        if (/aces2065|\bap0\b/.test(named)) {
            return { text: depth + ", ACES2065-1", aces: false, warn: "says ACES2065-1, not ACEScg" };
        }
        if (/srgb|rec\.? ?709|display p3|adobe rgb/.test(named) && !info.float) {
            return { text: depth + ", display referred (" + (info.icc || "named") + ")", aces: false,
                     warn: "display referred, not scene linear" };
        }
        if (info.float) { return { text: depth + ", scene linear", aces: true, warn: "" }; }
        return { text: depth, aces: false, warn: "not float, so likely not scene linear" };
    }

    function readMp4Fps(r) {
        /* The video track's frame rate from an MP4's header (mdhd timescale
           over the stts sample durations), or 0. Only box headers are read,
           wherever the moov box sits. */
        var found = { fps: 0 };
        function walk(start, end, depth) {
            var pos = start;
            var timescale = 0, video = false, frames = 0, ticks = 0;
            while (pos + 8 <= end) {
                var h = r.bytes(pos, 16);
                if (h.length < 8) { break; }
                var size = u32(h, 0, false), type = ascii(h, 4, 4), head = 8;
                if (size === 1) { size = u32(h, 8, false) * 4294967296 + u32(h, 12, false); head = 16; }
                else if (size === 0) { size = end - pos; }
                if (size < head) { break; }
                if (type === "moov" || type === "mdia" || type === "minf" || type === "stbl") {
                    var inner = walk(pos + head, pos + size, depth + 1);
                    if (inner) {
                        if (inner.timescale) { timescale = inner.timescale; }
                        if (inner.video) { video = true; }
                        if (inner.frames) { frames = inner.frames; ticks = inner.ticks; }
                    }
                } else if (type === "trak") {
                    var t = walk(pos + head, pos + size, depth + 1);
                    if (t && t.video && t.timescale && t.frames && t.ticks && !found.fps) {
                        found.fps = t.frames * t.timescale / t.ticks;
                    }
                } else if (type === "mdhd") {
                    var m = r.bytes(pos + head, 24);
                    timescale = m[0] === 1 ? u32(m, 20, false) : u32(m, 12, false);
                } else if (type === "hdlr") {
                    var hd = r.bytes(pos + head, 12);
                    video = ascii(hd, 8, 4) === "vide";
                } else if (type === "stts") {
                    var count = u32(r.bytes(pos + head + 4, 4), 0, false);
                    var ent = r.bytes(pos + head + 8, Math.min(count, 4096) * 8);
                    for (var i = 0; i + 8 <= ent.length; i += 8) {
                        var c = u32(ent, i, false), d = u32(ent, i + 4, false);
                        frames += c; ticks += c * d;
                    }
                }
                pos += size;
                if (depth === 0 && found.fps) { break; }
            }
            return { timescale: timescale, video: video, frames: frames, ticks: ticks };
        }
        try { walk(0, r.size, 0); } catch (e) { return 0; }
        return Math.round(found.fps * 1000) / 1000;
    }

    function mp4Fps(path) {
        var r = FS.reader(path);
        if (!r) { return 0; }
        try { return readMp4Fps(r); } finally { r.close(); }
    }

    function tiffInfo(path) {
        var r = FS.reader(path);
        if (!r) { return null; }
        try { return readTiff(r); } catch (e) { return null; } finally { r.close(); }
    }

    // ─────────────────────────────────────────────
    // Finding the sequences
    // ─────────────────────────────────────────────

    function scanSequences(ctx, task) {
        /* Every TIFF sequence in a task's publish media folder:
           [{folder, tifDir, stem, parsed, frames: [{n, name}], first, last,
             count, gaps, mp4, fps, info, colour}] */
        var media = mediaDir(ctx, task);
        var out = [];
        var dirs = FS.listDirs(media);
        for (var i = 0; i < dirs.length; i++) {
            var tifDir = join(media, dirs[i], "tif");
            if (!FS.isDir(tifDir)) { tifDir = join(media, dirs[i]); }
            var names = FS.listNames(tifDir);
            var stem = folderStem(names);
            if (!stem) { continue; }
            var frames = tifFrames(names, stem);
            if (!frames.length) { continue; }
            var first = frames[0].n, last = frames[frames.length - 1].n;
            var mp4 = findMp4(media, dirs[i]);
            var info = tiffInfo(join(tifDir, frames[0].name));
            out.push({
                folder: dirs[i], tifDir: tifDir, stem: stem,
                parsed: parseLayerName(dirs[i]) || parseLayerName(stem),
                frames: frames, first: first, last: last, count: frames.length,
                gaps: last - first + 1 - frames.length,
                mp4: mp4, fps: mp4 ? mp4Fps(mp4) : 0,
                info: info, colour: tiffColour(info)
            });
        }
        return out;
    }

    function latestOnly(seqs) {
        /* The highest version of each layer + variant. */
        var best = {}, order = [];
        for (var i = 0; i < seqs.length; i++) {
            var p = seqs[i].parsed;
            var key = p ? lower(p.layer + "-" + p.variant) : lower(seqs[i].folder);
            if (!best[key]) { order.push(key); best[key] = seqs[i]; continue; }
            var have = best[key].parsed;
            if (p && have && p.version > have.version) { best[key] = seqs[i]; }
        }
        var out = [];
        for (var k = 0; k < order.length; k++) { out.push(best[order[k]]); }
        return out;
    }

    function seqLabel(seq) {
        var p = seq.parsed;
        return p ? p.layer + (p.variant ? "-" + p.variant : "") + "  v" + ("00" + p.version).slice(-3) : seq.folder;
    }

    function seqDetails(seq) {
        return seq.first + "-" + seq.last + "  ·  " + seq.count + " frames" +
            (seq.gaps ? " (" + seq.gaps + " missing)" : "") + "  ·  " +
            (seq.fps ? fpsText(seq.fps) + " fps" : (seq.mp4 ? "MP4 fps unread" : "no MP4")) + "  ·  " +
            seq.colour.text;
    }

    function seqWarnings(seq) {
        var w = [];
        if (!seq.mp4) { w.push("no MP4, the comp will be " + DEFAULT_FPS + " fps"); }
        else if (seq.fps && fpsProblem(seq.fps)) { w.push(fpsProblem(seq.fps)); }
        if (seq.gaps) { w.push(seq.gaps + (seq.gaps === 1 ? " frame" : " frames") + " missing"); }
        if (seq.colour.warn) { w.push(seq.colour.warn); }
        return w;
    }

    function pickPresets(names, major) {
        /* The import presets project for After Effects <major> (26 ->
           2026): that year or the newest older one, highest v###. Or "". */
        var want = 2000 + major;
        var best = "", bestYear = -1, bestVer = -1;
        for (var i = 0; i < names.length; i++) {
            var m = String(names[i]).match(PRESETS_PATTERN);
            if (!m) { continue; }
            var year = parseInt(m[1], 10), ver = parseInt(m[2], 10);
            if (year > want) { continue; }
            if (year > bestYear || (year === bestYear && ver > bestVer)) {
                best = names[i]; bestYear = year; bestVer = ver;
            }
        }
        return best;
    }

    var CORE = {
        FS: FS, parseAepPath: parseAepPath, parseLayerName: parseLayerName, folderStem: folderStem,
        tifFrames: tifFrames, findMp4: findMp4, readTiff: readTiff, tiffColour: tiffColour,
        readMp4Fps: readMp4Fps, scanSequences: scanSequences, latestOnly: latestOnly,
        seqLabel: seqLabel, seqDetails: seqDetails, seqWarnings: seqWarnings, pickPresets: pickPresets,
        fpsProblem: fpsProblem, sourceChoices: sourceChoices,
        setRoot: function (r) { PROJECTS_ROOT = r; }
    };
    if (typeof module !== "undefined" && module.exports) {
        module.exports = CORE;
        return;
    }

    // ─────────────────────────────────────────────
    // After Effects side
    // ─────────────────────────────────────────────

    function log(text) {
        /* %APPDATA%\MNR_Launcher\ae_importer.log, for working out problems. */
        try {
            var folder = new Folder(Folder.userData.fsName + "/MNR_Launcher");
            if (!folder.exists) { folder.create(); }
            var f = new File(folder.fsName + "/ae_importer.log");
            f.encoding = "UTF-8";
            if (f.exists && f.length > 2000000) { f.remove(); }
            if (f.open("a")) {
                f.writeln(new Date().toString() + "  " + text);
                f.close();
            }
        } catch (e) { /* logging is never worth failing over */ }
    }

    function aeMajor() {
        try { return parseInt(String(app.version), 10); } catch (e) { return 99; }
    }

    function openProjectPath() {
        try { return app.project && app.project.file ? app.project.file.fsName : ""; } catch (e) { return ""; }
    }

    function currentUser() {
        var user = trim($.getenv("MNR_CURRENT_USER") || "");
        if (!user) {
            try {
                var f = new File(Folder.userData.fsName + "/MNR_Launcher/state.json");
                if (f.exists && f.open("r")) {
                    var text = f.read();
                    f.close();
                    var m = text.match(/"current_user"\s*:\s*"([^"]*)"/);
                    if (m) { user = trim(m[1]); }
                }
            } catch (e) { user = ""; }
        }
        return user || $.getenv("USERNAME") || "user";
    }

    function lastSceneManagerProject() {
        try {
            return app.settings.haveSetting(SCENE_MANAGER_SETTINGS, "lastProject") ?
                app.settings.getSetting(SCENE_MANAGER_SETTINGS, "lastProject") : "";
        } catch (e) { return ""; }
    }

    function findPresetsFile() {
        var dirs = [];
        if (SCRIPT_DIR) { dirs.push(SCRIPT_DIR); }
        dirs.push(PRESETS_DIR);
        for (var d = 0; d < dirs.length; d++) {
            var name = pickPresets(FS.listNames(dirs[d]), aeMajor());
            if (name) { return new File(join(dirs[d], name)); }
        }
        return null;
    }

    function findIn(folder, test) {
        /* First item in a project folder (and folders inside it) that passes. */
        for (var i = 1; i <= folder.numItems; i++) {
            var it = folder.item(i);
            if (test(it)) { return it; }
            if (it instanceof FolderItem) {
                var inner = findIn(it, test);
                if (inner) { return inner; }
            }
        }
        return null;
    }

    function bin(parent, name) {
        /* A project folder by name inside parent, made when missing. */
        for (var i = 1; i <= parent.numItems; i++) {
            var it = parent.item(i);
            if (it instanceof FolderItem && it.name === name) { return it; }
        }
        var f = app.project.items.addFolder(name);
        f.parentFolder = parent;
        return f;
    }

    function footageIn(tifDir) {
        /* A footage item in the project already reading from tifDir. */
        return findIn(app.project.rootFolder, function (it) {
            try {
                return it instanceof FootageItem && it.mainSource instanceof FileSource &&
                    it.mainSource.file && samePath(it.mainSource.file.parent.fsName, tifDir);
            } catch (e) { return false; }
        });
    }

    function compNamed(name) {
        return findIn(app.project.rootFolder, function (it) { return it instanceof CompItem && it.name === name; });
    }

    function acesReference(presets) {
        /* A fresh copy of the "MNR ACEScg" footage item from the presets
           project: {item, imported} (imported: the folder to remove), or
           null. */
        var imported = app.project.importFile(new ImportOptions(presets));
        var ref = findIn(imported, function (it) { return it instanceof FootageItem && REFERENCE_NAME.test(it.name); });
        if (!ref) {
            try { imported.remove(); } catch (e) {}
            return null;
        }
        return { item: ref, imported: imported };
    }

    function setStartFrame(c, first, fps) {
        /* The comp's first frame number = first (1001...). */
        var done = false;
        try {
            if (typeof c.displayStartFrame !== "undefined") {
                c.displayStartFrame = first;
                done = c.displayStartFrame === first;
            }
        } catch (e) {}
        if (!done) {
            try { c.displayStartTime = (first + 0.001) / fps; } catch (e2) {}
        }
    }

    function importSequence(seq, opts, bins, presets) {
        /* Imports one sequence (and its comp). Returns {comp, notes}. */
        var notes = [];
        var fps = seq.fps || DEFAULT_FPS;
        var file = new File(join(seq.tifDir, seq.frames[0].name));
        var item = null;
        if (opts.aces && seq.colour.aces && presets) {
            var ref = acesReference(presets);
            if (ref) {
                item = ref.item;
                item.parentFolder = bins.footage;
                try { ref.imported.remove(); } catch (e) {}
                item.replaceWithSequence(file, false);
                log("  ACEScg from the reference, " + file.fsName);
            } else {
                notes.push("no \"MNR ACEScg\" footage in " + File.decode(presets.name) + ", set the colour by hand");
            }
        } else if (opts.aces && seq.colour.aces) {
            notes.push("no MNR_Import_Presets .aep, set Interpret Footage > Color to ACEScg by hand");
        } else if (opts.aces && seq.colour.warn) {
            notes.push(seq.colour.warn + ", colour left as After Effects reads it");
        }
        if (!item) {
            var io = new ImportOptions(file);
            io.sequence = true;
            io.forceAlphabetical = false;
            item = app.project.importFile(io);
            item.parentFolder = bins.footage;
        }
        item.name = seq.stem;
        item.mainSource.conformFrameRate = fps;
        try { if (item.mainSource.hasAlpha) { item.mainSource.guessAlphaMode(); } } catch (e2) {}

        var comp = null;
        if (opts.makeComp) {
            if (compNamed(seq.folder)) {
                notes.push("a comp called " + seq.folder + " is already here, none made");
            } else {
                comp = app.project.items.addComp(seq.folder, item.width, item.height,
                    item.pixelAspect, item.duration, fps);
                comp.parentFolder = bins.comps;
                if (opts.number) { setStartFrame(comp, seq.first, fps); }
                comp.layers.add(item);
            }
        }
        log("imported " + seq.stem + "  " + seq.first + "-" + seq.last + " @ " + fps + " fps" +
            (notes.length ? "  (" + notes.join("; ") + ")" : ""));
        return { comp: comp, notes: notes };
    }

    // ─────────────────────────────────────────────
    // Drawing helpers (same look as the other MNR panels)
    // ─────────────────────────────────────────────

    function roundRectPath(g, x, y, w, h, r) {
        var steps = 4;
        var corners = [[x + w - r, y + r, -90], [x + w - r, y + h - r, 0],
                       [x + r, y + h - r, 90], [x + r, y + r, 180]];
        g.newPath();
        for (var c = 0; c < 4; c++) {
            for (var i = 0; i <= steps; i++) {
                var a = (corners[c][2] + 90 * i / steps) * Math.PI / 180;
                var px = corners[c][0] + r * Math.cos(a);
                var py = corners[c][1] + r * Math.sin(a);
                if (c === 0 && i === 0) { g.moveTo(px, py); } else { g.lineTo(px, py); }
            }
        }
        g.closePath();
    }

    function flatButton(parent, text, width, primary) {
        var b = parent.add("button", undefined, text);
        b.preferredSize = [width || 120, 30];
        b.mnrPrimary = !!primary;
        b.onDraw = function () {
            var g = this.graphics;
            var w = this.size[0], h = this.size[1];
            var col = !this.enabled ? C_FIELD_OFF : (this.mnrPrimary ? C_ACCENT : C_FIELD);
            try {
                roundRectPath(g, 0, 0, w, h, 5);
                g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, col));
            } catch (e) {
                g.rectPath(0, 0, w, h);
                g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, col));
            }
            var pen = g.newPen(g.PenType.SOLID_COLOR, this.enabled ? C_WHITE : C_DIM, 1);
            var size = g.measureString(this.text, g.font);
            g.drawString(this.text, pen, (w - size[0]) / 2, (h - size[1]) / 2, g.font);
        };
        return b;
    }

    function styleText(t, color, size, bold) {
        try {
            if (size || bold) {
                t.graphics.font = ScriptUI.newFont(t.graphics.font.name,
                    bold ? ScriptUI.FontStyle.BOLD : ScriptUI.FontStyle.REGULAR,
                    size || t.graphics.font.size);
            }
            if (color) {
                t.graphics.foregroundColor = t.graphics.newPen(t.graphics.PenType.SOLID_COLOR, color, 1);
            }
        } catch (e) { /* cosmetic */ }
    }

    function heading(parent, text) {
        var t = parent.add("statictext", undefined, text.toUpperCase().split("").join(" "));
        styleText(t, C_DIM, 10, false);
        return t;
    }

    function section(parent, text) {
        var g = parent.add("panel");
        g.orientation = "column";
        g.alignChildren = ["fill", "top"];
        g.margins = [12, 14, 12, 10];
        g.spacing = 6;
        heading(g, text);
        return g;
    }

    function row(parent) {
        var g = parent.add("group");
        g.orientation = "row";
        g.alignChildren = ["left", "center"];
        g.spacing = 6;
        return g;
    }

    function label(parent, text, width) {
        var t = parent.add("statictext", undefined, text);
        if (width) { t.preferredSize.width = width; }
        return t;
    }

    function fillDropdown(dd, items, want) {
        dd.removeAll();
        var list = items.slice(0);
        if (want && !inList(list, want)) { list.unshift(want); }
        for (var i = 0; i < list.length; i++) { dd.add("item", list[i]); }
        var pick = 0;
        for (var j = 0; j < list.length; j++) {
            if (list[j] === want) { pick = j; }
        }
        if (list.length) { dd.selection = pick; }
    }

    function ddValue(dd) { return dd.selection ? dd.selection.text : ""; }

    // ─────────────────────────────────────────────
    // The window
    // ─────────────────────────────────────────────

    function buildUI(thisObj) {
        var here = parseAepPath(openProjectPath());
        if (!here.project) { here = { project: lastSceneManagerProject() || DEFAULT_PROJECT }; }
        var st = { seqs: [], rows: [], busy: false };

        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", PANEL_NAME, undefined, { resizeable: true, closeButton: true });
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 8;
        win.margins = 12;

        // ── Header
        var header = row(win);
        header.alignment = ["fill", "top"];
        var title = header.add("statictext", undefined, PANEL_NAME);
        styleText(title, C_WHITE, 16, true);
        var spacer = header.add("statictext", undefined, "");
        spacer.alignment = ["fill", "center"];
        var userLabel = header.add("statictext", undefined, "User:  " + currentUser());
        styleText(userLabel, C_DIM, 12, false);
        var verLabel = header.add("statictext", undefined, PLUGIN_CHANNEL + " " + PLUGIN_VERSION);
        verLabel.helpTip = "Built " + (PLUGIN_BUILT || "?") + (PLUGIN_COMMIT ? "  (" + PLUGIN_COMMIT + ")" : "");
        styleText(verLabel, C_DIM, 10, false);

        // ── 1. Shot
        var s1 = section(win, "1  Shot");
        var r1 = row(s1);
        label(r1, "Project");
        var projectList = r1.add("dropdownlist", undefined, []);
        projectList.preferredSize = [80, 26];
        label(r1, "Ep");
        var epList = r1.add("dropdownlist", undefined, []);
        epList.preferredSize = [90, 26];
        label(r1, "Seq");
        var sqList = r1.add("dropdownlist", undefined, []);
        sqList.preferredSize = [80, 26];
        label(r1, "Shot");
        var shList = r1.add("dropdownlist", undefined, []);
        shList.preferredSize = [80, 26];
        label(r1, "From");
        var taskList = r1.add("dropdownlist", undefined, []);
        taskList.preferredSize = [130, 26];
        taskList.helpTip = "The task the TIFF sequences are published from.";
        var bOpen = flatButton(r1, "Open Folder", 110);
        bOpen.helpTip = "Open this task's publish media folder in File Explorer.";
        var shotNote = label(s1, "");
        shotNote.characters = 70;
        styleText(shotNote, C_DIM, 11, false);

        // ── 2. Sequences
        var s2 = section(win, "2  TIFF sequences");
        var r2 = row(s2);
        var latest = r2.add("checkbox", undefined, "Latest version of each layer only");
        latest.value = true;
        var gap = r2.add("statictext", undefined, "");
        gap.alignment = ["fill", "center"];
        var bAll = flatButton(r2, "All", 60);
        var bNone = flatButton(r2, "None", 60);
        var bRefresh = flatButton(r2, "Refresh", 80);
        bRefresh.helpTip = "Look in the folder again.";
        var list = s2.add("group");
        list.orientation = "column";
        list.alignChildren = ["fill", "top"];
        list.spacing = 2;

        // ── 3. Options
        var s3 = section(win, "3  Options");
        var optComp = s3.add("checkbox", undefined, "Make a comp for each, named like its folder");
        optComp.value = true;
        var optNumber = s3.add("checkbox", undefined,
            "Number the comp from the first TIFF frame (1001...), as the MNR AE Exporter does");
        optNumber.value = true;
        var optAces = s3.add("checkbox", undefined, "Set scene linear (float) TIFFs to ACEScg");
        optAces.value = true;
        optAces.helpTip = "Copies Interpret Footage > Color from the \"MNR ACEScg\" footage in\n" +
            "MNR_Import_Presets_<year>_v###.aep (scripts cannot set colour directly).";
        var acesNote = label(s3, "");
        acesNote.characters = 70;
        var binNote = label(s3, "");
        binNote.characters = 70;
        styleText(binNote, C_DIM, 11, false);

        // ── Bottom
        var bottom = row(win);
        bottom.alignment = ["fill", "bottom"];
        var status = bottom.add("statictext", undefined, "");
        status.alignment = ["fill", "center"];
        status.characters = 50;
        var bImport = flatButton(bottom, "Import", 160, true);

        // ─────────── helpers ───────────

        function say(text, good) {
            status.text = text || "";
            styleText(status, good === false ? C_BAD : (good ? C_GOOD : C_DIM), 11, false);
        }

        function ctx() {
            return { project: ddValue(projectList), ep: ddValue(epList), sq: ddValue(sqList), sh: ddValue(shList) };
        }

        function relayout() {
            try { win.layout.layout(true); win.layout.resize(); } catch (e) {}
        }

        function fillLevel(dd, path, want) { fillDropdown(dd, FS.listDirs(path), want); }

        function fillShot(level, want) {
            want = want || {};
            if (level <= 0) { fillLevel(projectList, PROJECTS_ROOT, want.project || ddValue(projectList) || DEFAULT_PROJECT); }
            var shotRoot = join(PROJECTS_ROOT, ddValue(projectList), SHOT_DIR);
            if (level <= 1) { fillLevel(epList, shotRoot, want.ep); }
            if (level <= 2) { fillLevel(sqList, join(shotRoot, ddValue(epList)), want.sq); }
            if (level <= 3) { fillLevel(shList, join(shotRoot, ddValue(epList), ddValue(sqList)), want.sh); }
            fillDropdown(taskList, sourceChoices(ctx()), ddValue(taskList) || DEFAULT_SOURCE);
            scan();
        }

        function scan() {
            var x = ctx();
            var task = ddValue(taskList);
            st.all = x.sh && task ? scanSequences(x, task) : [];
            shotNote.text = x.sh ? mediaDir(x, task).replace(/\//g, "\\") : "Pick a shot.";
            showRows();
        }

        function showRows() {
            while (list.children.length) { list.remove(list.children[0]); }
            st.seqs = latest.value ? latestOnly(st.all || []) : (st.all || []);
            st.rows = [];
            if (!st.seqs.length) {
                var none = label(list, ctx().sh ? "No TIFF sequences in this folder." : "");
                styleText(none, C_DIM, 11, false);
            }
            for (var i = 0; i < st.seqs.length; i++) {
                var seq = st.seqs[i];
                var already = footageIn(seq.tifDir);
                var r = row(list);
                var cb = r.add("checkbox", undefined, seqLabel(seq));
                cb.preferredSize.width = 170;
                cb.value = !already;
                cb.helpTip = seq.tifDir.replace(/\//g, "\\");
                var d = label(r, seqDetails(seq));
                styleText(d, C_WHITE, 11, false);
                var warns = seqWarnings(seq);
                if (already) { warns.unshift("already in this project"); }
                var w = label(r, warns.join(",  "));
                styleText(w, already ? C_DIM : C_WARN, 11, false);
                st.rows.push(cb);
            }
            var presets = findPresetsFile();
            st.presets = presets;
            acesNote.text = presets ? "ACEScg from \"MNR ACEScg\" in " + File.decode(presets.name) :
                "No MNR_Import_Presets_<year>_v###.aep found, so TIFFs keep After Effects' default " +
                "colour (set ACEScg by hand).";
            styleText(acesNote, presets ? C_DIM : C_WARN, 11, false);
            binNote.text = "Into bins:  " + BIN_COMPS + ",  " + BIN_FOOTAGE + "\\" + (ddValue(taskList) || DEFAULT_SOURCE) +
                ",  " + BIN_PRECOMPS;
            relayout();
        }

        function tickAll(value) {
            for (var i = 0; i < st.rows.length; i++) { st.rows[i].value = value; }
        }

        function picked() {
            var out = [];
            for (var i = 0; i < st.rows.length; i++) {
                if (st.rows[i].value) { out.push(st.seqs[i]); }
            }
            return out;
        }

        function doImport() {
            if (st.busy) { return; }
            var todo = picked();
            if (!todo.length) { say("Tick at least one sequence.", false); return; }
            var warn = [];
            for (var i = 0; i < todo.length; i++) {
                var fpsWarn = !todo[i].mp4 ? "no MP4, will be " + DEFAULT_FPS + " fps" :
                    (todo[i].fps ? fpsProblem(todo[i].fps) : "could not read the MP4's fps, will be " + DEFAULT_FPS + " fps");
                if (fpsWarn) { warn.push(seqLabel(todo[i]) + ":  " + fpsWarn); }
                if (footageIn(todo[i].tifDir)) { warn.push(seqLabel(todo[i]) + ":  already in this project"); }
            }
            if (warn.length && !confirm("Check these first:\n\n" + warn.join("\n") +
                    "\n\nPipeline frame rates are 12 or 24 fps.\n\nImport anyway?", true, PANEL_NAME)) {
                return;
            }
            st.busy = true;
            var notes = [], made = [], step = "starting";
            log("import " + todo.length + " from " + mediaDir(ctx(), ddValue(taskList)) + "  AE " + app.version);
            app.beginUndoGroup(PANEL_NAME);
            try {
                step = "making the bins";
                var root = app.project.rootFolder;
                var footRoot = bin(root, BIN_FOOTAGE);
                var bins = { comps: bin(root, BIN_COMPS), footage: bin(footRoot, ddValue(taskList) || DEFAULT_SOURCE) };
                bin(root, BIN_PRECOMPS);
                for (var j = 0; j < todo.length; j++) {
                    step = "importing " + todo[j].stem;
                    say("Importing " + seqLabel(todo[j]) + "...");
                    var res = importSequence(todo[j], { makeComp: optComp.value, number: optNumber.value,
                        aces: optAces.value }, bins, optAces.value ? st.presets : null);
                    if (res.comp) { made.push(res.comp); }
                    for (var k = 0; k < res.notes.length; k++) { notes.push(seqLabel(todo[j]) + ":  " + res.notes[k]); }
                }
            } catch (e) {
                var where = "Failed while " + step + (e.line ? " (line " + e.line + ")" : "");
                log("ERROR " + where + ": " + e.toString());
                app.endUndoGroup();
                st.busy = false;
                say("Stopped, see the message.", false);
                alert(String(e.message || e) + "\n\n" + where +
                      "\n\nLog: %APPDATA%\\MNR_Launcher\\ae_importer.log", PANEL_NAME);
                showRows();
                return;
            }
            app.endUndoGroup();
            st.busy = false;
            if (made.length) {
                try { made[made.length - 1].openInViewer(); } catch (e2) {}
            }
            showRows();
            say("Imported " + todo.length + " sequence" + (todo.length > 1 ? "s" : "") +
                (made.length ? ", made " + made.length + " comp" + (made.length > 1 ? "s" : "") : "") + ".", true);
            if (notes.length) { alert("Imported, with notes:\n\n" + notes.join("\n"), PANEL_NAME); }
        }

        // ─────────── events ───────────

        projectList.onChange = function () { fillShot(1); };
        epList.onChange = function () { fillShot(2); };
        sqList.onChange = function () { fillShot(3); };
        shList.onChange = function () { fillShot(4); };
        taskList.onChange = scan;
        latest.onClick = showRows;
        bAll.onClick = function () { tickAll(true); };
        bNone.onClick = function () { tickAll(false); };
        bRefresh.onClick = scan;
        bOpen.onClick = function () {
            var x = ctx();
            var path = mediaDir(x, ddValue(taskList));
            while (path && !FS.isDir(path) && path.indexOf("/") > 0) { path = path.replace(/\/[^\/]*$/, ""); }
            if (!FS.isDir(path)) { say("Could not find " + PROJECTS_ROOT + ". Is pCloud running as P:?", false); return; }
            new Folder(path).execute();
        };
        bImport.onClick = doImport;

        // ─────────── first fill ───────────

        fillShot(0, here);
        say(openProjectPath() ? "" : "Save the project first (MNR Scene Manager) to fill in the shot by itself.");

        win.layout.layout(true);
        win.onResizing = win.onResize = function () { this.layout.resize(); };
        return win;
    }

    // A floating window that is already open is brought forward.
    if (!(thisObj instanceof Panel)) {
        var existing = $.global.mnrAEImporterWindow;
        if (existing && existing.visible) {
            try { existing.active = true; } catch (e) {}
            return;
        }
    }

    var built = buildUI(thisObj);
    if (built instanceof Window) {
        $.global.mnrAEImporterWindow = built;
        built.onClose = function () {
            $.global.mnrAEImporterWindow = null;
            return true;
        };
        built.center();
        built.show();
    }

})(this);
