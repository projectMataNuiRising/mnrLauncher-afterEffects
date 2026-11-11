/* MNR AE Exporter (After Effects). Notes below. */
(function (thisObj) {

    // ── Version stamp ──────────────────────────────────────────────
    // Written by the "Stamp plugin version" GitHub action on every push
    // to main, same numbers as the MNR Scene Manager. Keep at the top.
    var PLUGIN_VERSION = "0.3.34";
    var PLUGIN_CHANNEL = "main";
    var PLUGIN_BUILT = "2026-11-11 06:25 UTC";
    var PLUGIN_COMMIT = "2fbb2cf";
    // ───────────────────────────────────────────────────────────────

    /*
        MNR AE Exporter  (After Effects)
        --------------------------------
        Project Mata Nui Rising. Sets up publish renders of a comp in the
        Render Queue, named and placed where the pipeline expects them.

        Installed by MNR Launcher with the MNR Scene Manager. Open it from
        Window > MNR_AE_Exporter.jsx (dockable) or File > Scripts (its own
        window).

        HOW IT WORKS

            1. Pick the comp to export (the active comp by default).
            2. Shot and task are filled in from where the open .aep lives,
               and can be changed. The task decides where it goes:
                 P:\01-projects\<project>\03-shot\<ep>\<sq>\<sh>\<task>\
                     export\publish\media\
            3. Layer name and variant (default main). The layer name comes
               from the stop-motion TIFF sequence used in the comp
               (..._smAnim_gali01-main_v001.[####].tif -> gali01), else
               from the comp name. Version defaults to the next free one.
               Any task lists every task folder in the shot, to publish
               somewhere other than the After Effects tasks. Open Folder
               shows the shot and task's media folder in File Explorer.
            4. Frames are numbered like the smAnim TIFF sequence in the comp
               (BFP..._v001.1000.tif in the comp -> the exports start at
               1000 too, handles and all), wherever the artist put the layer.
               The range is the TIFF frames in the comp, and every frame is
               checked to be in the TIFF folder. Override frames to type
               your own range. With no TIFF in the comp, the comp's own
               frame numbers and work area are used. Frame rate from the
               comp (Override to change it).
            5. Add to Render Queue, or Add & Render.

        WHAT IT WRITES  (name = BFP102_SQ04_SH08_rotoKeyPrimary_gali01-main_v001)

            EXR      media\<name>\exr\<name>.[####].exr
                     full res, OpenEXR RGB + Alpha, float, zip, ACEScg
            MP4      media\<name>.mp4
                     1/2 or 1/4 res, H.264, over a 64 px checkerboard
                     (0.6 / 0.4), sRGB - Display/Un-tone-mapped
            Proxy    media\<proxy name>\png\<proxy name>.[####].png
                     1/4 or 1/8 res PNG, RGB + Alpha, ACEScg. The proxy name
                     has "proxy" in place of the variant (gali01-proxy).

            The size of each is shown under Outputs. Sizes are set by the
            exporter (the comp it renders from is made at that size), so
            the templates' own Resize and Crop are switched off.

            Each output renders from its own comp in the "MNR Exports"
            folder of the Project panel (your comp nested inside, scaled
            for MP4 and proxy, the checkerboard under it for MP4). Your
            comp itself is never changed.

        PRESETS

            After Effects scripts cannot pick an output format (EXR, H.264,
            PNG) or its options, so those come from Output Module templates.
            Either name works for each:
              MNR EXR ACEScg    or BFP_exportSetting_openEXR_outputModule_v001
              MNR MP4 Preview   or BFP_exportSetting_mp4Preview_outputModule_v001
              MNR PNG Proxy     or BFP_exportSetting_proxyPng_outputModule_v001
            When none is there, the MNR ones are made from the presets
            project for this After Effects version:
              MNR_Export_Presets_<year>_v###.aep     (2024, 2025, 2026 ...)
            After Effects cannot read a project from a newer version, so
            the one for the running version is used (AE 26 -> 2026), else
            the newest older one, highest v### first. Looked for next to
            this script (MNR Launcher installs them with the plugin) and
            then in P:\02-pipeline\apps\afterEffects\presets\
            which holds one Render Queue item per output, set up by hand:
              OpenEXR Sequence  RGB + Alpha, Floating Point+, Zip,
                                Use Comp Frame Number, Output Color Space
                                scene_linear: ACEScg
              H.264             RGB, VBR 15 Mbps, Output Color Space
                                sRGB - Display/Un-tone-mapped
              PNG Sequence      RGB + Alpha, Millions of Colors+,
                                Use Comp Frame Number, Output Color Space
                                scene_linear: ACEScg
            (any comp, any file name, they are told apart by format). When
            that project changes (a newer file), the next Add to Render
            Queue picks it up by itself. Nothing for artists to do.

        NEEDS

            Preferences > Scripting & Expressions > "Allow Scripts to Write
            Files and Access Network" ticked, to make the output folders.

        Written for ExtendScript (ES3).
    */

    var PANEL_NAME = "MNR AE Exporter";

    // ─────────────────────────────────────────────
    // Settings
    // ─────────────────────────────────────────────

    var PROJECTS_ROOT = "P:/01-projects";
    var DEFAULT_PROJECT = "BFP";
    var SHOT_DIR = "03-shot";
    var MEDIA_PATH = ["export", "publish", "media"];
    var AE_TASKS = ["rotoKeyPrimary", "rotoKeyUtility", "comp"];
    var DEFAULT_TASK = "rotoKeyPrimary";
    var DEFAULT_VARIANT = "main";
    var PRESETS_DIR = "P:/02-pipeline/apps/afterEffects/presets";
    var EXPORT_FOLDER = "MNR Exports";
    var RENDER_TEMPLATE = "Best Settings";
    var CHECKER_SIZE = 64;
    var CHECKER_LIGHT = 0.6;
    var CHECKER_DARK = 0.4;
    var PRESETS_PATTERN = /^MNR_Export_Presets_(\d{4})_v(\d+)\.aep$/i;
    var SCRIPT_DIR = (function () {
        try { return new File($.fileName).parent.fsName.replace(/\\/g, "/"); } catch (e) { return ""; }
    }());
    var SCALES = [1, 2, 4, 8];
    var SCALE_LABELS = ["1/1 res", "1/2 res", "1/4 res", "1/8 res"];
    var MP4_TARGET = [1920, 1080];          // MP4 defaults to the scale closest to this
    var PROXY_TARGET = [1280, 720];         // proxy defaults to the scale closest to this
    // template: the name the exporter saves; names: any of these is used.
    var OUTPUTS = {
        exr: { template: "MNR EXR ACEScg", format: /exr/i,
               names: ["MNR EXR ACEScg", "BFP_exportSetting_openEXR_outputModule_v001"] },
        mp4: { template: "MNR MP4 Preview", format: /264/,
               names: ["MNR MP4 Preview", "BFP_exportSetting_mp4Preview_outputModule_v001"] },
        png: { template: "MNR PNG Proxy", format: /png/i,
               names: ["MNR PNG Proxy", "BFP_exportSetting_proxyPng_outputModule_v001"] }
    };
    var TASK_NOTES = {
        rotoKeyPrimary: "Name the layer the same as the stop-motion layer it came from " +
            "(the smAnim TIFF sequence ingested into rotoKeyIngest), e.g. gali01.",
        rotoKeyUtility: "Name the layer after the stop-motion layer it belongs to, e.g. gali01.",
        comp: "Name the layer after what this comp holds."
    };

    var C_ACCENT = [0.29, 0.56, 0.89, 1];
    var C_FIELD = [0.24, 0.24, 0.24, 1];
    var C_FIELD_OFF = [0.20, 0.20, 0.20, 1];
    var C_DIM = [0.55, 0.55, 0.55, 1];
    var C_WHITE = [0.96, 0.96, 0.96, 1];
    var C_GOOD = [0.40, 0.80, 0.50, 1];
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
            var a = String(arguments[i]);
            if (a === "") { continue; }
            parts.push(i === 0 ? a.replace(/[\/\\]+$/, "") : a.replace(/^[\/\\]+|[\/\\]+$/g, ""));
        }
        return parts.join("/");
    }

    function basename(p) { return String(p).replace(/^.*[\/\\]/, ""); }

    function pad3(n) {
        var s = String(n);
        while (s.length < 3) { s = "0" + s; }
        return s;
    }

    // ─────────────────────────────────────────────
    // File system (swapped for a mock in the tests)
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
            out.sort(function (a, b) { return lower(a) < lower(b) ? -1 : (lower(a) > lower(b) ? 1 : 0); });
            return out;
        },
        listNames: function (path) {
            var out = [];
            var f = new Folder(path);
            if (!f.exists) { return out; }
            var items = f.getFiles();
            for (var i = 0; i < items.length; i++) { out.push(File.decode(items[i].name)); }
            return out;
        },
        exists: function (path) { return new File(path).exists || new Folder(path).exists; },
        makeDirs: function (path) {
            var f = new Folder(path);
            if (f.exists) { return true; }
            var parent = String(path).replace(/[\/\\][^\/\\]*$/, "");
            if (parent === path || !FS.makeDirs(parent)) { return false; }
            return f.create();
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

    function firstToken(project, ep) {
        /* BFP + 102 -> BFP102. Named episodes keep just the project code. */
        return /^\d+$/.test(ep) ? project + ep : project;
    }

    function cleanLayer(text) {
        /* gali01: no spaces, underscores or dashes, they split the name. */
        return trim(text || "").replace(/[\s_\-]+/g, "").replace(/[\\\/:*?"<>|.\[\]]+/g, "");
    }

    function cleanVariant(text) {
        var t = trim(text || "").replace(/[\s_]+/g, "-");
        t = t.replace(/[\\\/:*?"<>|.\[\]]+/g, "");
        return t.replace(/^-+|-+$/g, "");
    }

    function proxyVariant(variant) {
        return lower(variant) === "main" ? "proxy" : variant + "-proxy";
    }

    function stemOf(fileName) {
        /* BFP..._v001.[1001-1054].tif / BFP..._v001.1001.tif / _v001_0001.exr -> BFP..._v001 */
        var s = String(fileName).replace(/\.[^.]+$/, "");
        s = s.replace(/[._]\[?\d+(-\d+)?\]?$/, "");
        s = s.replace(/[._]\[#+\]$/, "");
        return s;
    }

    function parseLayerName(fileName) {
        /* {layer, variant, task} from a pipeline name, or null. */
        var tokens = stemOf(fileName).split("_");
        if (tokens.length < 6 || !/^v\d+$/i.test(tokens[tokens.length - 1])) { return null; }
        var seg = tokens[tokens.length - 2];
        var dash = seg.indexOf("-");
        var layer = dash > 0 ? seg.substr(0, dash) : seg;
        if (!layer) { return null; }
        return { layer: layer, variant: dash > 0 ? seg.substr(dash + 1) : "",
                 task: tokens[tokens.length - 3] };
    }

    function shotDir(ctx) {
        return join(PROJECTS_ROOT, ctx.project, SHOT_DIR, ctx.ep, ctx.sq, ctx.sh);
    }

    function taskChoices(ctx, anyTask) {
        /* The AE tasks, or with anyTask every task folder in the shot too. */
        var out = AE_TASKS.slice(0);
        if (!anyTask) { return out; }
        var found = FS.listDirs(shotDir(ctx));
        for (var i = 0; i < found.length; i++) {
            if (!inList(out, found[i])) { out.push(found[i]); }
        }
        return out;
    }

    function folderToOpen(ctx) {
        /* The media folder, or the closest folder above it that exists. */
        var tries = [mediaDir(ctx), join(shotDir(ctx), ctx.task), shotDir(ctx),
                     join(PROJECTS_ROOT, ctx.project, SHOT_DIR, ctx.ep, ctx.sq),
                     join(PROJECTS_ROOT, ctx.project, SHOT_DIR, ctx.ep),
                     join(PROJECTS_ROOT, ctx.project), PROJECTS_ROOT];
        for (var i = 0; i < tries.length; i++) {
            if (FS.exists(tries[i])) { return tries[i]; }
        }
        return null;
    }

    function mediaDir(ctx) {
        return join(PROJECTS_ROOT, ctx.project, SHOT_DIR, ctx.ep, ctx.sq, ctx.sh, ctx.task,
                    MEDIA_PATH.join("/"));
    }

    function namePrefix(ctx, layer, variant) {
        return firstToken(ctx.project, ctx.ep) + "_" + ctx.sq + "_" + ctx.sh + "_" + ctx.task + "_" +
            layer + "-" + variant;
    }

    function nextVersion(ctx, layer, variant) {
        /* One past the highest version already in the media folder. */
        var prefix = lower(namePrefix(ctx, layer, variant) + "_v");
        var names = FS.listNames(mediaDir(ctx));
        var best = 0;
        for (var i = 0; i < names.length; i++) {
            var n = lower(names[i]);
            if (!startsWith(n, prefix)) { continue; }
            var m = n.substr(prefix.length).match(/^(\d+)/);
            if (m && parseInt(m[1], 10) > best) { best = parseInt(m[1], 10); }
        }
        return best + 1;
    }

    function outputSize(width, height, scale, even) {
        /* [w, h] an output renders at. H.264 wants even sizes. */
        var w = Math.max(1, Math.round(width / scale));
        var h = Math.max(1, Math.round(height / scale));
        if (even) { w += w % 2; h += h % 2; }
        return [w, h];
    }

    function makePlan(ctx, layer, variant, version, proxyScale, mp4Scale) {
        var media = mediaDir(ctx);
        var name = namePrefix(ctx, layer, variant) + "_v" + pad3(version);
        var proxyName = namePrefix(ctx, layer, proxyVariant(variant)) + "_v" + pad3(version);
        return {
            name: name, proxyName: proxyName, media: media,
            exr: { dir: join(media, name, "exr"), file: join(media, name, "exr", name + ".[####].exr"),
                   comp: name + " [exr]", scale: 1, checker: false },
            mp4: { dir: media, file: join(media, name + ".mp4"),
                   comp: name + " [mp4]", scale: mp4Scale || 2, checker: true },
            png: { dir: join(media, proxyName, "png"),
                   file: join(media, proxyName, "png", proxyName + ".[####].png"),
                   comp: proxyName + " [png]", scale: proxyScale, checker: false }
        };
    }

    function alreadyThere(plan, kinds) {
        /* Outputs that would be written over. */
        var out = [];
        for (var i = 0; i < kinds.length; i++) {
            var o = plan[kinds[i]];
            if (kinds[i] === "mp4") {
                if (FS.exists(o.file)) { out.push(o.file); }
            } else if (FS.listNames(o.dir).length) {
                out.push(o.dir);
            }
        }
        return out;
    }

    function checkInputs(ctx, layer, variant, versionText) {
        var miss = [];
        if (!ctx.project) { miss.push("project"); }
        if (!ctx.ep) { miss.push("episode"); }
        if (!ctx.sq) { miss.push("sequence"); }
        if (!ctx.sh) { miss.push("shot"); }
        if (!ctx.task) { miss.push("task"); }
        if (!layer) { miss.push("layer name"); }
        if (!variant) { miss.push("variant"); }
        if (!/^\d+$/.test(trim(versionText)) || parseInt(versionText, 10) < 1) { miss.push("version"); }
        return miss.length ? "Fill in: " + miss.join(", ") + "." : "";
    }

    function closestScale(width, height, target) {
        /* The scale in SCALES whose size is closest to target [w, h] (by area). */
        var want = target[0] * target[1];
        var best = SCALES[0], bestDiff = 1e9;
        for (var i = 0; i < SCALES.length; i++) {
            var area = (width / SCALES[i]) * (height / SCALES[i]);
            var diff = Math.abs(Math.log(area / want));
            if (diff < bestDiff) { best = SCALES[i]; bestDiff = diff; }
        }
        return best;
    }

    function folderStem(names, prefer) {
        /* The sequence name used by most .####.tif files in a folder (the
           files on disk, whatever the footage is called in After Effects).
           prefer wins a tie. "" when there are none. */
        var counts = {}, best = "", bestN = 0;
        for (var i = 0; i < names.length; i++) {
            var m = String(names[i]).match(/^(.+?)[._]\d+\.tiff?$/i);
            if (!m) { continue; }
            counts[m[1]] = (counts[m[1]] || 0) + 1;
        }
        for (var k in counts) {
            if (!counts.hasOwnProperty(k)) { continue; }
            if (counts[k] > bestN || (counts[k] === bestN && lower(k) === lower(prefer || ""))) {
                best = k; bestN = counts[k];
            }
        }
        return best;
    }

    function shortStem(stem) {
        /* BFP102_SQ04_SH12_smAnim_gali01-main_v001 -> BFP102_SQ04_SH12_... */
        var t = String(stem).split("_");
        return t.length > 3 ? t.slice(0, 3).join("_") + "_..." : stem;
    }

    function tifFrames(names, stem) {
        /* Sorted frame numbers of stem.####.tif / stem_####.tif in a folder. */
        var out = [], seen = {};
        var head = lower(stem);
        for (var i = 0; i < names.length; i++) {
            var n = lower(names[i]);
            if (n.substr(0, head.length) !== head) { continue; }
            var m = n.substr(head.length).match(/^[._](\d+)\.tiff?$/);
            if (!m) { continue; }
            var f = parseInt(m[1], 10);
            if (!seen[f]) { seen[f] = true; out.push(f); }
        }
        out.sort(function (a, b) { return a - b; });
        return out;
    }

    function frameRanges(nums) {
        /* [1043, 1050, 1051, 1052] -> "1043, 1050-1052" */
        var parts = [];
        var i = 0;
        while (i < nums.length) {
            var j = i;
            while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) { j++; }
            parts.push(i === j ? String(nums[i]) : nums[i] + "-" + nums[j]);
            i = j + 1;
        }
        return parts.join(", ");
    }

    function checkFrames(have, start, end) {
        /* Frames in start..end that are not in the TIFF folder. */
        var set = {};
        for (var i = 0; i < have.length; i++) { set[have[i]] = true; }
        var missing = [];
        for (var f = start; f <= end; f++) {
            if (!set[f]) { missing.push(f); }
        }
        return missing;
    }

    function templateFor(have, kind) {
        /* The first of an output's template names that After Effects has, or "". */
        var names = OUTPUTS[kind].names;
        for (var i = 0; i < names.length; i++) {
            if (inList(have, names[i])) { return names[i]; }
        }
        return "";
    }

    function presetsDirs() {
        var out = [];
        if (SCRIPT_DIR) { out.push(SCRIPT_DIR); }
        out.push(PRESETS_DIR);
        return out;
    }

    function pickPresets(names, aeMajor) {
        /* The presets project for After Effects <aeMajor> (26 -> 2026) from
           a folder's file names: that year, else the newest older year
           (newer ones cannot be read), highest v### first. Or "". */
        var want = 2000 + aeMajor;
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

    function aeMajor() {
        try { return parseInt(String(app.version), 10); } catch (e) { return 99; }
    }

    var CORE = {
        FS: FS, parseAepPath: parseAepPath, firstToken: firstToken, cleanLayer: cleanLayer,
        cleanVariant: cleanVariant, proxyVariant: proxyVariant, stemOf: stemOf,
        parseLayerName: parseLayerName, mediaDir: mediaDir, nextVersion: nextVersion,
        shotDir: shotDir, taskChoices: taskChoices, folderToOpen: folderToOpen,
        makePlan: makePlan, alreadyThere: alreadyThere, checkInputs: checkInputs,
        outputSize: outputSize, templateFor: templateFor, pickPresets: pickPresets,
        closestScale: closestScale, folderStem: folderStem, shortStem: shortStem,
        tifFrames: tifFrames, frameRanges: frameRanges, checkFrames: checkFrames,
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
        /* %APPDATA%\MNR_Launcher\ae_exporter.log, for working out problems. */
        try {
            var folder = new Folder(Folder.userData.fsName + "/MNR_Launcher");
            if (!folder.exists) { folder.create(); }
            var f = new File(folder.fsName + "/ae_exporter.log");
            f.encoding = "UTF-8";
            if (f.exists && f.length > 2000000) { f.remove(); }
            if (f.open("a")) {
                f.writeln(new Date().toString() + "  " + text);
                f.close();
            }
        } catch (e) { /* logging is never worth failing over */ }
    }

    function openProjectPath() {
        try {
            return app.project && app.project.file ? app.project.file.fsName.replace(/\\/g, "/") : "";
        } catch (e) { return ""; }
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

    function canWriteFiles() {
        /* "Allow Scripts to Write Files and Access Network". Newer After
           Effects keep it in "Main Pref Section v2". MNR Launcher switches
           it on before it starts After Effects. */
        var sections = ["Main Pref Section v2", "Main Pref Section"];
        var found = false;
        for (var i = 0; i < sections.length; i++) {
            try {
                if (!app.preferences.havePref(sections[i], "Pref_SCRIPTING_FILE_NETWORK_SECURITY")) { continue; }
                found = true;
                if (app.preferences.getPrefAsLong(sections[i], "Pref_SCRIPTING_FILE_NETWORK_SECURITY") === 1) {
                    return true;
                }
            } catch (e) {}
        }
        return !found;          // could not tell: let it try
    }

    function allComps() {
        var out = [];
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof CompItem && !(it.parentFolder && it.parentFolder.name === EXPORT_FOLDER)) {
                out.push(it);
            }
        }
        out.sort(function (a, b) { return lower(a.name) < lower(b.name) ? -1 : (lower(a.name) > lower(b.name) ? 1 : 0); });
        return out;
    }

    function activeComp() {
        try {
            if (app.project.activeItem instanceof CompItem) { return app.project.activeItem; }
            var sel = app.project.selection;
            for (var i = 0; i < sel.length; i++) {
                if (sel[i] instanceof CompItem) { return sel[i]; }
            }
        } catch (e) {}
        return null;
    }

    function plainTiming(layer) {
        /* No time remap or stretch, so layer time = comp time - startTime. */
        try {
            return !layer.timeRemapEnabled && Math.abs(layer.stretch - 100) < 0.001;
        } catch (e) { return false; }
    }

    function findTiff(comp, depth, seen) {
        /* The stop-motion TIFF sequence used in a comp (or a comp inside it),
           smAnim ones first, with where it sits in the comp's time:
             {name, parsed, smAnim, folder, offset, inP, outP, ok}
           offset: time of the sequence's first frame from the comp's start;
           inP / outP: when it is visible (also from the comp's start); ok: false when stretched, remapped or at another
           frame rate, so its frame numbers cannot be worked out. */
        var found = null;
        seen = seen || {};
        // After Effects counts layer times from the comp's starting frame
        // number (Start Timecode); everything here is from the comp's start.
        var d = comp.displayStartTime || 0;
        for (var i = 1; i <= comp.numLayers; i++) {
            var layer, src;
            try { layer = comp.layer(i); src = layer.source; } catch (e) { src = null; }
            if (!src) { continue; }
            if (src instanceof CompItem) {
                if (depth > 0 && !seen[src.id]) {
                    seen[src.id] = true;
                    var inner = findTiff(src, depth - 1, seen);
                    if (inner) {
                        var lst = layer.startTime - d;
                        inner.offset += lst;
                        inner.inP = Math.max(layer.inPoint - d, lst + inner.inP);
                        inner.outP = Math.min(layer.outPoint - d, lst + inner.outP);
                        inner.ok = inner.ok && plainTiming(layer) &&
                            Math.abs(src.frameRate - comp.frameRate) < 0.001;
                        if (!found || (inner.smAnim && !found.smAnim)) { found = inner; }
                        if (inner.smAnim) { return found; }
                    }
                }
                continue;
            }
            try {
                if (!(src.mainSource instanceof FileSource) || src.mainSource.isStill) { continue; }
                var fileName = File.decode(src.mainSource.file.name);
                if (!/\.tiff?$/i.test(fileName)) { continue; }
                // The name comes from the files on disk, not the footage's
                // name in After Effects (artists may rename that).
                var folder = src.mainSource.file.parent.fsName.replace(/\\/g, "/");
                var stem = folderStem(FS.listNames(folder), stemOf(fileName)) || stemOf(fileName);
                var parsed = parseLayerName(stem);
                if (!parsed) { continue; }
                var hit = {
                    name: stem, parsed: parsed, smAnim: lower(parsed.task) === "smanim",
                    folder: folder,
                    offset: layer.startTime - d, inP: layer.inPoint - d, outP: layer.outPoint - d,
                    ok: plainTiming(layer) && Math.abs(src.frameRate - comp.frameRate) < 0.001
                };
                if (hit.smAnim) { return hit; }
                if (!found) { found = hit; }
            } catch (e2) {}
        }
        return found;
    }

    function frameInfo(comp) {
        /* How the exports are numbered and the default range.
             base:  frame number at comp time 0
             start, end: default range (frame numbers)
             have:  frame numbers in the TIFF folder ([] with no TIFF)
             note:  what it is numbered from */
        var fps = comp.frameRate;
        var tif = findTiff(comp, 2);
        if (tif && tif.ok) {
            var have = tifFrames(FS.listNames(tif.folder), tif.name);
            if (have.length) {
                var base = have[0] - Math.round(tif.offset * fps);
                var first = base + Math.round(Math.max(tif.inP, 0) * fps);
                var last = base + Math.round(Math.min(tif.outP, comp.duration) * fps) - 1;
                return {
                    base: base, have: have,
                    start: Math.max(first, have[0]), end: Math.min(last, have[have.length - 1]),
                    stem: tif.name, note: ""
                };
            }
        }
        var off = frameOffset(comp);
        var start = off + Math.round((comp.workAreaStart - comp.displayStartTime) * fps);
        return {
            base: off, have: [], stem: "",
            start: start, end: start + Math.max(1, Math.round(comp.workAreaDuration * fps)) - 1,
            note: !tif ? "no smAnim TIFF in this comp, so the comp's own frame numbers and work area" :
                (tif.ok ? "the TIFF folder could not be read, so the comp's own frame numbers and work area" :
                 "the TIFF layer is stretched, time-remapped or at another frame rate, so the comp's " +
                 "own frame numbers and work area")
        };
    }

    function guessLayer(comp) {
        /* {layer, from} */
        var tif = findTiff(comp, 2);
        if (tif) {
            return { layer: cleanLayer(tif.parsed.layer), stem: tif.name,
                     folder: tif.folder, from: "tif" };
        }
        var parsed = parseLayerName(comp.name);
        if (parsed) { return { layer: cleanLayer(parsed.layer), from: "comp" }; }
        return { layer: "", from: "" };
    }

    function frameOffset(comp) {
        return Math.round(comp.displayStartTime * comp.frameRate);
    }

    function exportFolder() {
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof FolderItem && it.name === EXPORT_FOLDER) { return it; }
        }
        return app.project.items.addFolder(EXPORT_FOLDER);
    }

    function removeCompNamed(folder, name) {
        for (var i = folder.numItems; i >= 1; i--) {
            var it = folder.item(i);
            if (it instanceof CompItem && it.name === name) { it.remove(); }
        }
    }

    function setFx(fx, name, value) {
        try { fx.property(name).setValue(value); return true; } catch (e) { return false; }
    }

    function addChecker(c, size) {
        /* Dark solid with a light checkerboard over it. Both solids are the
           dark grey, so it is right whatever the effect's blend mode. */
        var dark = [CHECKER_DARK, CHECKER_DARK, CHECKER_DARK];
        var base = c.layers.addSolid(dark, "MNR Checker Base", c.width, c.height, c.pixelAspect, c.duration);
        var top = c.layers.addSolid(dark, "MNR Checker", c.width, c.height, c.pixelAspect, c.duration);
        var fx = top.property("ADBE Effect Parade").addProperty("ADBE Checkerboard");
        var cx = c.width / 2, cy = c.height / 2;
        setFx(fx, "Anchor", [cx, cy]);
        setFx(fx, "Corner", [cx + size, cy + size]);
        setFx(fx, "Size From", 2);           // Width Slider
        setFx(fx, "Width", size);
        setFx(fx, "Color", [CHECKER_LIGHT, CHECKER_LIGHT, CHECKER_LIGHT, 1]);
        setFx(fx, "Opacity", 100);
        base.locked = true;
        top.locked = true;
    }

    function renderComp(folder, src, out, fps, base) {
        /* The comp an output renders from: src nested, scaled, maybe on the checker. */
        removeCompNamed(folder, out.comp);
        var size = outputSize(src.width, src.height, out.scale, out.checker);
        var w = size[0], h = size[1];
        var c = app.project.items.addComp(out.comp, w, h, src.pixelAspect, src.duration, fps);
        c.parentFolder = folder;
        // Comp frame numbers = the TIFF's (or the comp's) frame numbers, so
        // the templates' Use Comp Frame Number writes them.
        try { c.displayStartTime = base / src.frameRate; } catch (e) {}
        c.bgColor = [0, 0, 0];
        if (out.checker) { addChecker(c, CHECKER_SIZE / out.scale); }
        // Added layers start at the comp's start (whatever its start frame).
        var layer = c.layers.add(src);
        if (out.scale !== 1) {
            layer.property("ADBE Transform Group").property("ADBE Scale").setValue([100 / out.scale, 100 / out.scale]);
            layer.property("ADBE Transform Group").property("ADBE Position").setValue([w / 2, h / 2]);
        }
        try { layer.quality = LayerQuality.BEST; } catch (e2) {}
        try { layer.samplingQuality = LayerSamplingQuality.BICUBIC; } catch (e3) {}
        return c;
    }

    function templateList(om) {
        try { return om.templates; } catch (e) { return []; }
    }

    function missingTemplates(om, kinds) {
        var have = templateList(om);
        var out = [];
        for (var i = 0; i < kinds.length; i++) {
            if (!templateFor(have, kinds[i])) { out.push(OUTPUTS[kinds[i]].template); }
        }
        return out;
    }

    function findPresetsFile() {
        /* The presets project for this After Effects version, next to the
           script first, then on P:. */
        var dirs = presetsDirs();
        for (var d = 0; d < dirs.length; d++) {
            var name = pickPresets(FS.listNames(dirs[d]), aeMajor());
            if (name) { return new File(join(dirs[d], name)); }
        }
        return null;
    }

    // Which presets file (and how new) the templates on this machine were
    // made from, kept in After Effects' own settings.
    var STAMP_SECTION = "MNR AE Exporter";
    var STAMP_KEY = "presetsStamp";

    function presetsStamp(f) {
        try { return f.fsName + "|" + f.modified.getTime(); } catch (e) { return f.fsName; }
    }

    function savedStamp() {
        try {
            return app.settings.haveSetting(STAMP_SECTION, STAMP_KEY) ?
                app.settings.getSetting(STAMP_SECTION, STAMP_KEY) : "";
        } catch (e) { return ""; }
    }

    function saveStamp(stamp) {
        try { app.settings.saveSetting(STAMP_SECTION, STAMP_KEY, stamp); } catch (e) {}
    }

    function loadPresets(f) {
        /* Imports the presets project, saves its output modules as the MNR
           templates, then removes everything it imported. Returns the
           template names made. */
        var rq = app.project.renderQueue;
        var before = rq.numItems;
        var io = new ImportOptions(f);
        io.importAs = ImportAsType.PROJECT;
        var imported;
        try {
            imported = app.project.importFile(io);
        } catch (e) {
            // Most likely saved in a newer After Effects than this one.
            throw new Error("Could not read the presets project:\n" + f.fsName + "\n\n" + e.toString() +
                "\n\nIf it was saved in a newer After Effects, it needs saving as a copy for this " +
                "version (" + app.version + ") with File > Save As > Save a Copy As.");
        }
        var made = [];
        try {
            for (var i = rq.numItems; i > before; i--) {
                var item = rq.item(i);
                for (var j = 1; j <= item.numOutputModules; j++) {
                    var om = item.outputModule(j);
                    var format = "";
                    try { format = String(om.getSettings(GetSettingsFormat.STRING)["Format"]); } catch (e) {}
                    for (var kind in OUTPUTS) {
                        if (OUTPUTS.hasOwnProperty(kind) && OUTPUTS[kind].format.test(format) &&
                                !inList(made, OUTPUTS[kind].template)) {
                            om.saveAsTemplate(OUTPUTS[kind].template);
                            made.push(OUTPUTS[kind].template);
                        }
                    }
                }
            }
        } finally {
            for (var k = rq.numItems; k > before; k--) {
                try { rq.item(k).remove(); } catch (e2) {}
            }
            try { if (imported) { imported.remove(); } } catch (e3) {}
        }
        return made;
    }

    function noResize(om) {
        var keys = ["Resize", "Crop"];
        for (var i = 0; i < keys.length; i++) {
            var s = {};
            s[keys[i]] = false;
            try { om.setSettings(s); } catch (e) {
                try { s[keys[i]] = "false"; om.setSettings(s); } catch (e2) {}
            }
        }
    }

    function setUpItem(item, kind, out, span) {
        try { item.applyTemplate(RENDER_TEMPLATE); } catch (e) {}
        // The render queue counts from the comp's start frame (e.g. 1001 at
        // 12 fps = 83.4 s), not from 0.
        var compStart = 0;
        try { compStart = item.comp.displayStartTime || 0; } catch (e2) {}
        item.timeSpanDuration = span.duration;
        item.timeSpanStart = compStart + span.start;
        item.timeSpanDuration = span.duration;
        var om = item.outputModule(1);
        om.applyTemplate(templateFor(templateList(om), kind));
        om = item.outputModule(1);     // re-fetch, changing an output module can invalidate it
        // Sizes come from the render comp, so a template's own Resize and
        // Crop would scale twice.
        noResize(om);
        om = item.outputModule(1);
        om.file = new File(out.file);
        return item;
    }

    // ─────────────────────────────────────────────
    // Drawing helpers (same look as the MNR Scene Manager)
    // ─────────────────────────────────────────────

    function roundRectPath(g, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
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

    function flatButton(parent, label, width, primary) {
        var b = parent.add("button", undefined, label);
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
        var st = { comps: [], busy: false };

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

        // ── 1. Comp
        var s1 = section(win, "1  Composition");
        var r1 = row(s1);
        r1.alignment = ["fill", "top"];
        var compList = r1.add("dropdownlist", undefined, []);
        compList.alignment = ["fill", "center"];
        compList.preferredSize = [420, 26];
        var bActive = flatButton(r1, "Use Active Comp", 130);
        bActive.helpTip = "Pick the comp open in the viewer, and refresh the list of comps.";
        var compInfo = label(s1, "");
        compInfo.characters = 60;
        styleText(compInfo, C_DIM, 11, false);

        // ── 2. Shot
        var s2 = section(win, "2  Shot and task");
        var r2 = row(s2);
        label(r2, "Project");
        var projectList = r2.add("dropdownlist", undefined, []);
        projectList.preferredSize = [80, 26];
        label(r2, "Ep");
        var epList = r2.add("dropdownlist", undefined, []);
        epList.preferredSize = [90, 26];
        label(r2, "Seq");
        var sqList = r2.add("dropdownlist", undefined, []);
        sqList.preferredSize = [80, 26];
        label(r2, "Shot");
        var shList = r2.add("dropdownlist", undefined, []);
        shList.preferredSize = [80, 26];
        label(r2, "Task");
        var taskList = r2.add("dropdownlist", undefined, AE_TASKS);
        taskList.preferredSize = [130, 26];
        var anyTask = r2.add("checkbox", undefined, "Any task");
        anyTask.helpTip = "Publish to any task folder in this shot, not just the After Effects ones.";
        var bOpen = flatButton(r2, "Open Folder", 110);
        bOpen.helpTip = "Open this shot and task's publish media folder in File Explorer\n" +
            "(or the closest folder above it, if it is not made yet).";

        // ── 3. Name
        var s3 = section(win, "3  Name");
        var r3 = row(s3);
        label(r3, "Layer");
        var layerText = r3.add("edittext", undefined, "");
        layerText.characters = 14;
        label(r3, "Variant");
        var variantText = r3.add("edittext", undefined, DEFAULT_VARIANT);
        variantText.characters = 12;
        label(r3, "Version  v");
        var versionText = r3.add("edittext", undefined, "001");
        versionText.characters = 5;
        var taskNote = s3.add("statictext", undefined, "", { multiline: true });
        taskNote.preferredSize = [640, 32];
        styleText(taskNote, C_ACCENT, 11, false);
        var r3b = row(s3);
        var srcLabel = label(r3b, "Source TIFFs", 90);
        styleText(srcLabel, C_DIM, 11, false);
        var srcValue = label(r3b, "");
        srcValue.characters = 70;
        styleText(srcValue, C_WHITE, 11, false);
        var r3c = row(s3);
        var nameLabel = label(r3c, "Publish as", 90);
        styleText(nameLabel, C_DIM, 11, false);
        var namePreview = label(r3c, "");
        namePreview.characters = 70;
        styleText(namePreview, C_GOOD, 13, true);
        var r3d = row(s3);
        var proxyLabel = label(r3d, "Proxy as", 90);
        styleText(proxyLabel, C_DIM, 11, false);
        var proxyPreview = label(r3d, "");
        proxyPreview.characters = 70;
        styleText(proxyPreview, C_DIM, 11, false);

        // ── 4. Frames
        var s4 = section(win, "4  Frames");
        var r4 = row(s4);
        label(r4, "Start");
        var startText = r4.add("edittext", undefined, "0");
        startText.characters = 6;
        label(r4, "End");
        var endText = r4.add("edittext", undefined, "0");
        endText.characters = 6;
        var framesOverride = r4.add("checkbox", undefined, "Override frames");
        framesOverride.helpTip = "Type your own Start and End. They are still numbered like the source TIFFs.";
        label(r4, "      Frame rate", 90);
        var fpsText = r4.add("edittext", undefined, "12");
        fpsText.characters = 6;
        fpsText.enabled = false;
        var fpsOverride = r4.add("checkbox", undefined, "Override");
        startText.enabled = endText.enabled = false;
        var framesCheck = label(s4, "");
        framesCheck.characters = 90;
        var framesNote = label(s4, "");
        framesNote.characters = 90;
        styleText(framesNote, C_DIM, 11, false);

        // ── 5. Outputs
        var s5 = section(win, "5  Outputs");
        var mediaLine = label(s5, "");
        mediaLine.characters = 100;
        styleText(mediaLine, C_DIM, 11, false);

        function outputRow(parent, title, scaleChoice, info) {
            var r = row(parent);
            var tick = r.add("checkbox", undefined, title);
            tick.value = true;
            tick.preferredSize.width = 110;
            var dd = null;
            if (scaleChoice) {
                dd = r.add("dropdownlist", undefined, SCALE_LABELS);
                dd.preferredSize.width = 80;
            } else {
                var full = label(r, "1/1 res");
                full.preferredSize.width = 80;
                styleText(full, C_DIM, 11, false);
            }
            var size = label(r, "");
            size.characters = 12;
            styleText(size, C_WHITE, 11, true);
            var inf = label(r, info);
            styleText(inf, C_DIM, 11, false);
            var path = label(parent, "");
            path.characters = 100;
            styleText(path, C_DIM, 10, false);
            return { tick: tick, scale: dd, size: size, path: path };
        }

        var oExr = outputRow(s5, "EXR", false, "OpenEXR RGB + Alpha float, zip  ·  ACEScg");
        var oMp4 = outputRow(s5, "MP4 preview", true,
            "H.264 on a " + CHECKER_SIZE + " px checkerboard  ·  sRGB");
        var oPng = outputRow(s5, "Proxy PNG", true, "PNG RGB + Alpha  ·  ACEScg");
        oMp4.scale.selection = 1;
        oPng.scale.selection = 2;
        var doExr = oExr.tick, doMp4 = oMp4.tick, doPng = oPng.tick;
        var mp4ScaleList = oMp4.scale, scaleList = oPng.scale;

        // ── Footer
        var footer = row(win);
        footer.alignment = ["fill", "bottom"];
        var status = footer.add("statictext", undefined, "", { truncate: "middle" });
        status.alignment = ["fill", "center"];
        styleText(status, C_DIM, 11, false);
        var bQueue = flatButton(footer, "Add to Render Queue", 160);
        var bRender = flatButton(footer, "Add & Render", 130, true);

        // ─────────── state -> widgets ───────────

        function say(text, good) {
            status.text = text;
            styleText(status, good === true ? C_GOOD : (good === false ? C_BAD : C_DIM), 11, false);
        }

        function comp() {
            return compList.selection ? st.comps[compList.selection.index] : null;
        }

        function ctx() {
            return { project: ddValue(projectList), ep: ddValue(epList), sq: ddValue(sqList),
                     sh: ddValue(shList), task: ddValue(taskList) };
        }

        function proxyScale() { return SCALES[scaleList.selection ? scaleList.selection.index : 2]; }

        function mp4Scale() { return SCALES[mp4ScaleList.selection ? mp4ScaleList.selection.index : 1]; }

        function scaleIndex(scale) {
            for (var i = 0; i < SCALES.length; i++) { if (SCALES[i] === scale) { return i; } }
            return 0;
        }

        function sizeText(scale, even) {
            var c = comp();
            if (!c) { return ""; }
            var wh = outputSize(c.width, c.height, scale, even);
            return wh[0] + " x " + wh[1];
        }

        function updateSizes() {
            oExr.size.text = sizeText(1, false);
            oMp4.size.text = sizeText(mp4Scale(), true);
            oPng.size.text = sizeText(proxyScale(), false);
        }

        function kinds() {
            var out = [];
            if (doExr.value) { out.push("exr"); }
            if (doMp4.value) { out.push("mp4"); }
            if (doPng.value) { out.push("png"); }
            return out;
        }

        function fillComps(want) {
            st.comps = allComps();
            compList.removeAll();
            var pick = -1;
            for (var i = 0; i < st.comps.length; i++) {
                compList.add("item", st.comps[i].name);
                if (want && st.comps[i] === want) { pick = i; }
            }
            if (pick < 0 && st.comps.length) { pick = 0; }
            if (pick >= 0) { compList.selection = pick; }
        }

        function compChanged() {
            var c = comp();
            if (!c) {
                compInfo.text = "No comps in this project.";
                return;
            }
            var fps = Math.round(c.frameRate * 1000) / 1000;
            compInfo.text = c.width + " x " + c.height + "   ·   " + fps + " fps   ·   " +
                Math.round(c.duration * c.frameRate) + " frames";
            st.frames = frameInfo(c);
            if (!framesOverride.value) {
                startText.text = String(st.frames.start);
                endText.text = String(st.frames.end);
            }
            if (!fpsOverride.value) { fpsText.text = String(fps); }
            // Closest to 1080p for the MP4 and 720p for the proxy.
            mp4ScaleList.selection = scaleIndex(closestScale(c.width, c.height, MP4_TARGET));
            scaleList.selection = scaleIndex(closestScale(c.width, c.height, PROXY_TARGET));
            framesChanged();
            var g = guessLayer(c);
            layerText.text = g.layer;
            if (g.from === "tif") {
                srcValue.text = g.stem + ".####.tif   in   " +
                    g.folder.replace(/^.*\/(rotoKeyIngest|smAnim)\//i, "...\\$1\\").replace(/\//g, "\\");
                srcValue.helpTip = g.folder.replace(/\//g, "\\");
                styleText(srcValue, C_WHITE, 11, false);
            } else {
                srcValue.text = g.from === "comp" ?
                    "None in this comp. Layer name taken from the comp name." :
                    "None in this comp. Type the layer name in.";
                srcValue.helpTip = "";
                styleText(srcValue, C_BAD, 11, false);
            }
            nameChanged(true);
        }

        function nameChanged(newVersion) {
            var x = ctx();
            var layer = cleanLayer(layerText.text);
            var variant = cleanVariant(variantText.text) || DEFAULT_VARIANT;
            if (newVersion && layer && x.ep && x.sq && x.sh) {
                versionText.text = pad3(nextVersion(x, layer, variant));
            }
            updateSizes();
            taskNote.text = TASK_NOTES[x.task] ||
                (x.task ? "Publishing to " + x.task + ", which is not an After Effects task." : "");
            var err = checkInputs(x, layer, variant, versionText.text);
            if (err) {
                namePreview.text = err;
                styleText(namePreview, C_BAD, 12, true);
                proxyPreview.text = mediaLine.text = "";
                oExr.path.text = oMp4.path.text = oPng.path.text = "";
                return;
            }
            var p = makePlan(x, layer, variant, parseInt(versionText.text, 10), proxyScale(), mp4Scale());
            namePreview.text = p.name;
            styleText(namePreview, C_GOOD, 13, true);
            proxyPreview.text = p.proxyName;
            mediaLine.text = "Into   " + p.media.replace(/\//g, "\\") + "\\";
            oExr.path.text = "        <publish name>\\exr\\<publish name>.[####].exr";
            oMp4.path.text = "        <publish name>.mp4";
            oPng.path.text = "        <proxy name>\\png\\<proxy name>.[####].png";
        }

        function fillLevel(dd, path, want) {
            fillDropdown(dd, FS.listDirs(path), want);
        }

        function fillShot(level, want) {
            /* level 0 = project, 1 = ep, 2 = sq, 3 = sh, each refilling the ones below. */
            want = want || {};
            if (level <= 0) { fillLevel(projectList, PROJECTS_ROOT, want.project || ddValue(projectList) || DEFAULT_PROJECT); }
            var shotRoot = join(PROJECTS_ROOT, ddValue(projectList), SHOT_DIR);
            if (level <= 1) { fillLevel(epList, shotRoot, want.ep); }
            if (level <= 2) { fillLevel(sqList, join(shotRoot, ddValue(epList)), want.sq); }
            if (level <= 3) { fillLevel(shList, join(shotRoot, ddValue(epList), ddValue(sqList)), want.sh); }
            fillTasks(want.task);
            nameChanged(true);
        }

        function fillTasks(want) {
            var choices = taskChoices(ctx(), anyTask.value);
            want = want || ddValue(taskList);
            if (!inList(choices, want)) { want = DEFAULT_TASK; }
            fillDropdown(taskList, choices, want);
        }

        function openFolder() {
            var x = ctx();
            var path = folderToOpen(x);
            if (!path) { say("Could not find " + PROJECTS_ROOT + ". Is pCloud running as P:?", false); return; }
            new Folder(path).execute();
            say(path === mediaDir(x) ? "Opened the media folder." :
                "No media folder yet, opened " + path.replace(/\//g, "\\"));
        }

        function frameProblems() {
            /* Text of what is wrong with the range, or "". */
            var f = st.frames;
            var a = parseInt(startText.text, 10), b = parseInt(endText.text, 10);
            if (!f || isNaN(a) || isNaN(b) || b < a) { return "Start and End frames are not right."; }
            var c = comp();
            var probs = [];
            var firstN = f.base, lastN = f.base + Math.round(c.duration * c.frameRate) - 1;
            if (a < firstN || b > lastN) {
                probs.push("The range goes outside the comp (" + firstN + "-" + lastN + ").");
            }
            if (f.have.length) {
                var missing = checkFrames(f.have, a, b);
                if (missing.length) {
                    probs.push(missing.length + (missing.length === 1 ? " frame is" : " frames are") +
                        " missing from the TIFF folder: " + frameRanges(missing));
                }
            }
            return probs.join("  ");
        }

        function framesChanged() {
            var f = st.frames;
            if (!f) { return; }
            var a = parseInt(startText.text, 10), b = parseInt(endText.text, 10);
            var prob = frameProblems();
            if (f.have.length) {
                var total = isNaN(a) || isNaN(b) ? 0 : b - a + 1;
                var found = total - (isNaN(a) || isNaN(b) ? 0 : checkFrames(f.have, a, b).length);
                framesCheck.text = "Expected frame range: " + a + "-" + b + ",  " + found + "/" + total +
                    " frames  (" + shortStem(f.stem) + ")" + (prob ? "   " + prob : "");
            } else {
                framesCheck.text = "Frame range: " + a + "-" + b + ",  " + (b - a + 1) + " frames" +
                    (prob ? "   " + prob : "");
            }
            styleText(framesCheck, prob ? C_BAD : C_GOOD, 11, true);
            var notes = [];
            if (f.note) { notes.push("Numbered from " + f.note + "."); }
            if (fpsOverride.value && f.have.length) {
                notes.push("Frame rate override: the numbers will not line up with the source TIFFs.");
            }
            framesNote.text = notes.join("  ");
        }

        // ─────────── actions ───────────

        function span(c, fps) {
            var a = parseInt(startText.text, 10), b = parseInt(endText.text, 10);
            if (isNaN(a) || isNaN(b) || b < a) { return null; }
            return { start: (a - st.frames.base) / c.frameRate, duration: (b - a + 1) / c.frameRate,
                     fps: fps, base: st.frames.base };
        }

        function doQueue(renderNow) {
            if (st.busy) { return; }
            var c = comp();
            if (!c) { say("Pick a comp first.", false); return; }
            var x = ctx();
            var layer = cleanLayer(layerText.text);
            var variant = cleanVariant(variantText.text);
            var err = checkInputs(x, layer, variant, versionText.text);
            if (err) { say(err, false); return; }
            var todo = kinds();
            if (!todo.length) { say("Tick at least one output.", false); return; }
            var fps = fpsOverride.value ? parseFloat(fpsText.text) : c.frameRate;
            if (!(fps > 0)) { say("The frame rate is not a number.", false); return; }
            var sp = span(c, fps);
            if (!sp) { say("Start and End frames are not right.", false); return; }
            var prob = frameProblems();
            if (prob && !confirm(prob + "\n\nQueue it anyway?", true, PANEL_NAME)) { return; }
            if (!canWriteFiles()) {
                alert("Tick Edit > Preferences > Scripting & Expressions >\n" +
                      "\"Allow Scripts to Write Files and Access Network\"\n" +
                      "so the export folders can be made.\n\n" +
                      "Starting After Effects from MNR Launcher ticks it for you.", PANEL_NAME);
                return;
            }
            var plan = makePlan(x, layer, variant, parseInt(versionText.text, 10), proxyScale(), mp4Scale());
            var there = alreadyThere(plan, todo);
            if (there.length && !confirm("These are already there and would be written over:\n\n" +
                    there.join("\n").replace(/\//g, "\\") + "\n\nCarry on?", true, PANEL_NAME)) {
                return;
            }
            var i;
            for (i = 0; i < todo.length; i++) {
                if (!FS.makeDirs(plan[todo[i]].dir)) {
                    say("Could not make " + plan[todo[i]].dir, false);
                    return;
                }
            }

            st.busy = true;
            var made = [];
            var step = "starting";
            log("queue " + plan.name + "  [" + todo.join(", ") + "]  frames " + startText.text + "-" +
                endText.text + "  AE " + app.version);
            app.beginUndoGroup(PANEL_NAME);
            try {
                // 1. Templates first. Bringing the presets project in can
                //    leave earlier render queue items unusable, so it happens
                //    before anything is made. Made on this machine when they
                //    are missing, or when the presets project is newer than
                //    the one they were made from.
                step = "checking the output templates";
                var pf = findPresetsFile();
                var rqs = app.project.renderQueue;
                var probe = rqs.items.add(c);
                var missing = missingTemplates(probe.outputModule(1), todo);
                probe.remove();
                if (pf && (missing.length || savedStamp() !== presetsStamp(pf))) {
                    step = "loading the presets project " + pf.fsName;
                    say("Setting up the MNR export presets...");
                    log(step);
                    loadPresets(pf);
                    saveStamp(presetsStamp(pf));
                    step = "checking the output templates again";
                    probe = app.project.renderQueue.items.add(c);
                    missing = missingTemplates(probe.outputModule(1), todo);
                    probe.remove();
                }
                if (missing.length) {
                    throw new Error("These output templates are missing:\n  " + missing.join("\n  ") +
                        "\n\n" + (pf ? "The presets project does not have them:\n" + pf.fsName :
                        "No presets project for After Effects " + (2000 + aeMajor()) +
                        " or older (MNR_Export_Presets_<year>_v###.aep) in:\n" +
                        presetsDirs().join("\n").replace(/\//g, "\\") +
                        "\n\nReinstall the AE plugin from MNR Launcher."));
                }

                // 2. A render comp and a render queue item per output.
                step = "making the MNR Exports folder";
                var folder = exportFolder();
                for (i = 0; i < todo.length; i++) {
                    var out = plan[todo[i]];
                    step = "making the " + todo[i] + " render comp";
                    var rc = renderComp(folder, c, out, fps, sp.base);
                    made.push({ kind: todo[i], comp: rc, out: out });
                    step = "adding the " + todo[i] + " render to the queue";
                    var item = app.project.renderQueue.items.add(rc);
                    step = "setting up the " + todo[i] + " render";
                    setUpItem(item, todo[i], out, sp);
                    log("queued " + todo[i] + " -> " + out.file);
                }
            } catch (e) {
                var where = "Failed while " + step + (e.line ? " (line " + e.line + ")" : "");
                log("ERROR " + where + ": " + e.toString());
                for (i = 0; i < made.length; i++) {
                    try { made[i].comp.remove(); } catch (e2) {}
                }
                app.endUndoGroup();
                st.busy = false;
                say("Nothing queued.", false);
                alert(String(e.message || e) + "\n\n" + where +
                      "\n\nLog: %APPDATA%\\MNR_Launcher\\ae_exporter.log", PANEL_NAME);
                return;
            }
            app.endUndoGroup();
            st.busy = false;
            say("Queued " + todo.length + " render" + (todo.length > 1 ? "s" : "") + " for " + plan.name, true);
            if (renderNow) {
                try { app.project.renderQueue.render(); } catch (e3) { say("Render stopped: " + e3, false); }
            }
        }

        // ─────────── events ───────────

        compList.onChange = compChanged;
        bActive.onClick = function () {
            var a = activeComp();
            fillComps(a || comp());
            compChanged();
            if (!a) { say("No active comp, open one in the viewer or select it in the Project panel."); }
        };
        projectList.onChange = function () { fillShot(1); };
        epList.onChange = function () { fillShot(2); };
        sqList.onChange = function () { fillShot(3); };
        shList.onChange = function () { fillTasks(); nameChanged(true); };
        anyTask.onClick = function () { fillTasks(); nameChanged(true); };
        bOpen.onClick = openFolder;
        taskList.onChange = function () { nameChanged(true); };
        layerText.onChange = function () { layerText.text = cleanLayer(layerText.text); nameChanged(true); };
        variantText.onChange = function () {
            variantText.text = cleanVariant(variantText.text) || DEFAULT_VARIANT;
            nameChanged(true);
        };
        versionText.onChange = function () {
            var n = parseInt(versionText.text, 10);
            versionText.text = n > 0 ? pad3(n) : "001";
            nameChanged(false);
        };
        scaleList.onChange = function () { nameChanged(false); };
        mp4ScaleList.onChange = function () { nameChanged(false); };
        fpsOverride.onClick = function () {
            fpsText.enabled = fpsOverride.value;
            if (!fpsOverride.value && comp()) { fpsText.text = String(Math.round(comp().frameRate * 1000) / 1000); }
            framesChanged();
        };
        framesOverride.onClick = function () {
            startText.enabled = endText.enabled = framesOverride.value;
            if (!framesOverride.value && st.frames) {
                startText.text = String(st.frames.start);
                endText.text = String(st.frames.end);
            }
            framesChanged();
        };
        startText.onChange = endText.onChange = framesChanged;
        bQueue.onClick = function () { doQueue(false); };
        bRender.onClick = function () { doQueue(true); };

        // ─────────── first fill ───────────

        fillComps(activeComp());
        // A file saved in a task that is not an After Effects one turns on Any task.
        anyTask.value = !!(here.task && !inList(AE_TASKS, here.task));
        fillShot(0, here);
        compChanged();
        say(openProjectPath() ? "" : "Save the project first to fill in the shot by itself.");

        win.layout.layout(true);
        win.onResizing = win.onResize = function () { this.layout.resize(); };
        return win;
    }

    // A floating window that is already open is brought forward.
    if (!(thisObj instanceof Panel)) {
        var existing = $.global.mnrAEExporterWindow;
        if (existing && existing.visible) {
            try { existing.active = true; } catch (e) {}
            return;
        }
    }

    var built = buildUI(thisObj);
    if (built instanceof Window) {
        $.global.mnrAEExporterWindow = built;
        built.onClose = function () {
            $.global.mnrAEExporterWindow = null;
            return true;
        };
        built.center();
        built.show();
    }

})(this);
