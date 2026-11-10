/* MNR AE Exporter (After Effects). Notes below. */
(function (thisObj) {

    // ── Version stamp ──────────────────────────────────────────────
    // Written by the "Stamp plugin version" GitHub action on every push
    // to main, same numbers as the MNR Scene Manager. Keep at the top.
    var PLUGIN_VERSION = "0.3.20";
    var PLUGIN_CHANNEL = "main";
    var PLUGIN_BUILT = "2026-11-10 04:23 UTC";
    var PLUGIN_COMMIT = "67ffb01";
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
            4. Frames come from the comp's work area, frame rate from the
               comp (Override to change it).
            5. Add to Render Queue, or Add & Render.

        WHAT IT WRITES  (name = BFP102_SQ04_SH08_rotoKeyPrimary_gali01-main_v001)

            EXR      media\<name>\exr\<name>_[####].exr
                     full res, OpenEXR RGB + Alpha, float, zip, ACEScg
            MP4      media\<name>.mp4
                     half res, H.264, over a 64 px checkerboard (0.6 / 0.4),
                     sRGB - Display/Un-tone-mapped
            Proxy    media\<proxy name>\png\<proxy name>_[####].png
                     1/4 or 1/8 res PNG, RGB + Alpha, ACEScg. The proxy name
                     has "proxy" in place of the variant (gali01-proxy).

            Each output renders from its own comp in the "MNR Exports"
            folder of the Project panel (your comp nested inside, scaled
            for MP4 and proxy, the checkerboard under it for MP4). Your
            comp itself is never changed.

        PRESETS

            After Effects scripts cannot pick an output format (EXR, H.264,
            PNG) or its options, so those come from Output Module templates:
              MNR EXR ACEScg, MNR MP4 Preview, MNR PNG Proxy
            When they are missing, they are made from the presets project:
              P:\02-pipeline\apps\afterEffects\presets\MNR_Export_Presets.aep
            which holds one Render Queue item per output, set up by hand:
              OpenEXR Sequence  RGB + Alpha, Floating Point+, Zip,
                                Use Comp Frame Number, Output Color Space
                                scene_linear: ACEScg
              H.264             RGB, VBR 15 Mbps, Output Color Space
                                sRGB - Display/Un-tone-mapped
              PNG Sequence      RGB + Alpha, Millions of Colors+,
                                Use Comp Frame Number, Output Color Space
                                scene_linear: ACEScg
            (any comp, any file name, they are told apart by format). After
            changing that project, press Load Presets to pick it up.

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
    var PRESETS_FILE = "P:/02-pipeline/apps/afterEffects/presets/MNR_Export_Presets.aep";
    var EXPORT_FOLDER = "MNR Exports";
    var RENDER_TEMPLATE = "Best Settings";
    var CHECKER_SIZE = 64;
    var CHECKER_LIGHT = 0.6;
    var CHECKER_DARK = 0.4;
    var MP4_SCALE = 2;
    var PROXY_SCALES = [4, 8];
    var OUTPUTS = {
        exr: { template: "MNR EXR ACEScg", format: /exr/i },
        mp4: { template: "MNR MP4 Preview", format: /264/ },
        png: { template: "MNR PNG Proxy", format: /png/i }
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

    function makePlan(ctx, layer, variant, version, proxyScale) {
        var media = mediaDir(ctx);
        var name = namePrefix(ctx, layer, variant) + "_v" + pad3(version);
        var proxyName = namePrefix(ctx, layer, proxyVariant(variant)) + "_v" + pad3(version);
        return {
            name: name, proxyName: proxyName, media: media,
            exr: { dir: join(media, name, "exr"), file: join(media, name, "exr", name + "_[####].exr"),
                   comp: name + " [exr]", scale: 1, checker: false },
            mp4: { dir: media, file: join(media, name + ".mp4"),
                   comp: name + " [mp4]", scale: MP4_SCALE, checker: true },
            png: { dir: join(media, proxyName, "png"),
                   file: join(media, proxyName, "png", proxyName + "_[####].png"),
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

    var CORE = {
        FS: FS, parseAepPath: parseAepPath, firstToken: firstToken, cleanLayer: cleanLayer,
        cleanVariant: cleanVariant, proxyVariant: proxyVariant, stemOf: stemOf,
        parseLayerName: parseLayerName, mediaDir: mediaDir, nextVersion: nextVersion,
        shotDir: shotDir, taskChoices: taskChoices, folderToOpen: folderToOpen,
        makePlan: makePlan, alreadyThere: alreadyThere, checkInputs: checkInputs,
        setRoot: function (r) { PROJECTS_ROOT = r; }
    };
    if (typeof module !== "undefined" && module.exports) {
        module.exports = CORE;
        return;
    }

    // ─────────────────────────────────────────────
    // After Effects side
    // ─────────────────────────────────────────────

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

    function findTiff(comp, depth, seen) {
        /* File name of the stop-motion TIFF sequence used in a comp (or a
           comp inside it), smAnim ones first. */
        var found = null;
        seen = seen || {};
        for (var i = 1; i <= comp.numLayers; i++) {
            var src;
            try { src = comp.layer(i).source; } catch (e) { src = null; }
            if (!src) { continue; }
            if (src instanceof CompItem) {
                if (depth > 0 && !seen[src.id]) {
                    seen[src.id] = true;
                    var inner = findTiff(src, depth - 1, seen);
                    if (inner && (!found || inner.smAnim)) { found = inner; }
                }
                continue;
            }
            try {
                if (!(src.mainSource instanceof FileSource) || src.mainSource.isStill) { continue; }
                var name = File.decode(src.mainSource.file.name);
                if (!/\.tiff?$/i.test(name)) { continue; }
                var parsed = parseLayerName(name);
                if (!parsed) { continue; }
                var hit = { name: name, parsed: parsed, smAnim: lower(parsed.task) === "smanim" };
                if (hit.smAnim) { return hit; }
                if (!found) { found = hit; }
            } catch (e2) {}
        }
        return found;
    }

    function guessLayer(comp) {
        /* {layer, from} */
        var tif = findTiff(comp, 2);
        if (tif) { return { layer: cleanLayer(tif.parsed.layer), from: "From TIFF: " + tif.name }; }
        var parsed = parseLayerName(comp.name);
        if (parsed) { return { layer: cleanLayer(parsed.layer), from: "From the comp name" }; }
        return { layer: "", from: "No TIFF sequence or pipeline comp name found, type it in" };
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

    function renderComp(folder, src, out, fps) {
        /* The comp an output renders from: src nested, scaled, maybe on the checker. */
        removeCompNamed(folder, out.comp);
        var w = Math.max(1, Math.round(src.width / out.scale));
        var h = Math.max(1, Math.round(src.height / out.scale));
        if (out.checker) { w += w % 2; h += h % 2; }       // H.264 wants even sizes
        var c = app.project.items.addComp(out.comp, w, h, src.pixelAspect, src.duration, fps);
        c.parentFolder = folder;
        try { c.displayStartTime = src.displayStartTime; } catch (e) {}
        c.bgColor = [0, 0, 0];
        if (out.checker) { addChecker(c, CHECKER_SIZE / out.scale); }
        var layer = c.layers.add(src);
        layer.startTime = 0;
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
            if (!inList(have, OUTPUTS[kinds[i]].template)) { out.push(OUTPUTS[kinds[i]].template); }
        }
        return out;
    }

    function loadPresets() {
        /* Imports the presets project, saves its output modules as the MNR
           templates, then removes everything it imported. Returns the
           template names made. */
        var f = new File(PRESETS_FILE);
        if (!f.exists) { throw new Error("The presets project is missing:\n" + f.fsName); }
        var rq = app.project.renderQueue;
        var before = rq.numItems;
        var io = new ImportOptions(f);
        io.importAs = ImportAsType.PROJECT;
        var imported = app.project.importFile(io);
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

    function setUpItem(item, kind, out, span) {
        try { item.applyTemplate(RENDER_TEMPLATE); } catch (e) {}
        item.timeSpanStart = span.start;
        item.timeSpanDuration = span.duration;
        var om = item.outputModule(1);
        om.applyTemplate(OUTPUTS[kind].template);
        om = item.outputModule(1);     // re-fetch, changing an output module can invalidate it
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
        var taskNote = s2.add("statictext", undefined, "", { multiline: true });
        taskNote.preferredSize = [560, 32];
        styleText(taskNote, C_ACCENT, 11, false);

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
        var layerFrom = label(s3, "");
        layerFrom.characters = 70;
        styleText(layerFrom, C_DIM, 11, false);
        var namePreview = label(s3, "");
        namePreview.characters = 70;
        styleText(namePreview, C_WHITE, 12, true);

        // ── 4. Frames
        var s4 = section(win, "4  Frames");
        var r4 = row(s4);
        label(r4, "Start");
        var startText = r4.add("edittext", undefined, "0");
        startText.characters = 6;
        label(r4, "End");
        var endText = r4.add("edittext", undefined, "0");
        endText.characters = 6;
        label(r4, "   Frame rate");
        var fpsText = r4.add("edittext", undefined, "12");
        fpsText.characters = 6;
        fpsText.enabled = false;
        var fpsOverride = r4.add("checkbox", undefined, "Override");
        var framesNote = label(s4, "From the comp's work area and frame rate.");
        styleText(framesNote, C_DIM, 11, false);

        // ── 5. Outputs
        var s5 = section(win, "5  Outputs");
        var r5a = row(s5);
        var doExr = r5a.add("checkbox", undefined, "EXR");
        doExr.value = true;
        doExr.preferredSize.width = 110;
        var exrInfo = label(r5a, "full res  ·  RGB + Alpha float, zip  ·  ACEScg");
        styleText(exrInfo, C_DIM, 11, false);
        var exrPath = label(s5, "");
        exrPath.characters = 80;
        styleText(exrPath, C_DIM, 10, false);
        var r5b = row(s5);
        var doMp4 = r5b.add("checkbox", undefined, "MP4 preview");
        doMp4.value = true;
        doMp4.preferredSize.width = 110;
        var mp4Info = label(r5b, "half res  ·  H.264 on a " + CHECKER_SIZE + " px checkerboard  ·  sRGB");
        styleText(mp4Info, C_DIM, 11, false);
        var mp4Path = label(s5, "");
        mp4Path.characters = 80;
        styleText(mp4Path, C_DIM, 10, false);
        var r5c = row(s5);
        var doPng = r5c.add("checkbox", undefined, "Proxy PNG");
        doPng.value = true;
        doPng.preferredSize.width = 110;
        var scaleList = r5c.add("dropdownlist", undefined, ["1/4 res", "1/8 res"]);
        scaleList.selection = 0;
        var pngInfo = label(r5c, "RGB + Alpha  ·  ACEScg");
        styleText(pngInfo, C_DIM, 11, false);
        var pngPath = label(s5, "");
        pngPath.characters = 80;
        styleText(pngPath, C_DIM, 10, false);

        // ── Footer
        var footer = row(win);
        footer.alignment = ["fill", "bottom"];
        var bPresets = flatButton(footer, "Load Presets", 120);
        bPresets.helpTip = "Remake the MNR output templates from\n" + PRESETS_FILE;
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

        function proxyScale() { return PROXY_SCALES[scaleList.selection ? scaleList.selection.index : 0]; }

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
            var off = frameOffset(c);
            var start = off + Math.round(c.workAreaStart * c.frameRate);
            startText.text = String(start);
            endText.text = String(start + Math.max(1, Math.round(c.workAreaDuration * c.frameRate)) - 1);
            if (!fpsOverride.value) { fpsText.text = String(fps); }
            var g = guessLayer(c);
            layerText.text = g.layer;
            layerFrom.text = g.from;
            nameChanged(true);
        }

        function nameChanged(newVersion) {
            var x = ctx();
            var layer = cleanLayer(layerText.text);
            var variant = cleanVariant(variantText.text) || DEFAULT_VARIANT;
            if (newVersion && layer && x.ep && x.sq && x.sh) {
                versionText.text = pad3(nextVersion(x, layer, variant));
            }
            taskNote.text = TASK_NOTES[x.task] ||
                (x.task ? "Publishing to " + x.task + ", which is not an After Effects task." : "");
            var err = checkInputs(x, layer, variant, versionText.text);
            if (err) {
                namePreview.text = err;
                exrPath.text = mp4Path.text = pngPath.text = "";
                return;
            }
            var p = makePlan(x, layer, variant, parseInt(versionText.text, 10), proxyScale());
            namePreview.text = p.name;
            exrPath.text = "    " + p.exr.file.replace(/\//g, "\\");
            mp4Path.text = "    " + p.mp4.file.replace(/\//g, "\\");
            pngPath.text = "    " + p.png.file.replace(/\//g, "\\");
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

        // ─────────── actions ───────────

        function span(c, fps) {
            var off = frameOffset(c);
            var a = parseInt(startText.text, 10), b = parseInt(endText.text, 10);
            if (isNaN(a) || isNaN(b) || b < a) { return null; }
            return { start: (a - off) / c.frameRate, duration: (b - a + 1) / c.frameRate, fps: fps };
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
            if (!canWriteFiles()) {
                alert("Tick Edit > Preferences > Scripting & Expressions >\n" +
                      "\"Allow Scripts to Write Files and Access Network\"\n" +
                      "so the export folders can be made.\n\n" +
                      "Starting After Effects from MNR Launcher ticks it for you.", PANEL_NAME);
                return;
            }
            var plan = makePlan(x, layer, variant, parseInt(versionText.text, 10), proxyScale());
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
            app.beginUndoGroup(PANEL_NAME);
            try {
                var folder = exportFolder();
                for (i = 0; i < todo.length; i++) {
                    var out = plan[todo[i]];
                    var rc = renderComp(folder, c, out, fps);
                    var item = app.project.renderQueue.items.add(rc);
                    made.push({ kind: todo[i], comp: rc, item: item, out: out });
                }
                // Templates are checked on the first item, and made from the
                // presets project when missing.
                var missing = missingTemplates(made[0].item.outputModule(1), todo);
                if (missing.length) {
                    say("Loading the MNR presets...");
                    loadPresets();
                    missing = missingTemplates(made[0].item.outputModule(1), todo);
                }
                if (missing.length) {
                    throw new Error("These output templates are missing, and the presets project " +
                        "did not have them:\n  " + missing.join("\n  ") + "\n\n" + PRESETS_FILE);
                }
                for (i = 0; i < made.length; i++) {
                    setUpItem(made[i].item, made[i].kind, made[i].out, sp);
                }
            } catch (e) {
                for (i = 0; i < made.length; i++) {
                    try { made[i].comp.remove(); } catch (e2) {}
                }
                app.endUndoGroup();
                st.busy = false;
                say("Nothing queued.", false);
                alert(String(e.message || e), PANEL_NAME);
                return;
            }
            app.endUndoGroup();
            st.busy = false;
            say("Queued " + todo.length + " render" + (todo.length > 1 ? "s" : "") + " for " + plan.name, true);
            if (renderNow) {
                try { app.project.renderQueue.render(); } catch (e3) { say("Render stopped: " + e3, false); }
            }
        }

        function doPresets() {
            if (st.busy) { return; }
            st.busy = true;
            app.beginUndoGroup(PANEL_NAME + " presets");
            try {
                var made = loadPresets();
                say(made.length ? "Loaded: " + made.join(", ") : "No EXR, H.264 or PNG items found in the presets project.",
                    made.length === 3 ? true : false);
            } catch (e) {
                say("Presets not loaded.", false);
                alert(String(e.message || e), PANEL_NAME);
            }
            app.endUndoGroup();
            st.busy = false;
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
        fpsOverride.onClick = function () {
            fpsText.enabled = fpsOverride.value;
            if (!fpsOverride.value && comp()) { fpsText.text = String(Math.round(comp().frameRate * 1000) / 1000); }
        };
        bQueue.onClick = function () { doQueue(false); };
        bRender.onClick = function () { doQueue(true); };
        bPresets.onClick = doPresets;

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
