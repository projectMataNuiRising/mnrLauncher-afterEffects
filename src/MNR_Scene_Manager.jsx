/* MNR Scene Manager (After Effects). Notes below. */
(function (thisObj) {

    // ── Version stamp ──────────────────────────────────────────────
    // Written by the "Stamp plugin version" GitHub action on every push
    // to main. MNR Launcher reads these four lines out of the installed
    // file, so they stay at the very top. Change only version_base in
    // build/plugin.json by hand.
    var PLUGIN_VERSION = "0.3.58";
    var PLUGIN_CHANNEL = "main";
    var PLUGIN_BUILT = "2026-11-11 08:26 UTC";
    var PLUGIN_COMMIT = "d7868d0";
    // ───────────────────────────────────────────────────────────────

    /*
        MNR Scene Manager  (After Effects)
        ----------------------------------
        Project Mata Nui Rising, After Effects side of the pipeline.
        The After Effects twin of the Blender Scene Manager.
    
        Installed and removed by MNR Launcher (Connect Software > After
        Effects). It is a ScriptUI panel: open it from Window >
        MNR_Scene_Manager.jsx and dock it, and After Effects reopens it
        with your workspace every time it starts. Run from File > Scripts
        instead, it opens as its own window, sized to the screen and
        centred. Either way it stays until you close it.
    
        WHAT IT DOES
    
            Project menu   every project folder in P:\01-projects
            Shot | Asset   Shot: episode > sequence > shot (03-shot)
                           Asset: category > asset (02-asset)
                           # template folders are hidden. Search filters it.
            Tasks          rotoKeyPrimary, rotoKeyUtility and comp, unless
                           "Show all folders" is ticked. Tasks with no .aep
                           work files are marked (no files).
            Files          every user's .aep work files in the task:
                             <task>/work/<user>/afterEffects/saveFiles
                             (and loose ones in work/<user> or
                             work/<user>/afterEffects)
                           One row per name + user, newest save on top.
                           Version list below picks an older version.
                           Names that don't follow the pattern are listed
                           by their full file name.
                             shots   BFP102_SQ01_SH00_comp_<name>_v001.aep
                             assets  BFP_cgAsset_<asset>_<name>_v001.aep
            Actions        Open, New (a new project saved straight away as
                           <name>, default main, at the next free version),
                           Save As, Rename (one version or all of them),
                           Copy Path, Show in Explorer. Right-click a file
                           for the same. Double-click opens.
                           New and Save As always save into YOUR folder
                           (the MNR Launcher user), making
                           afterEffects/saveFiles and sourceFiles.
                           Versions are always 3 digits (v54 reads as v054).
                           After Effects itself asks to save the open
                           project first, only if it has changes.
                           Nothing is ever deleted.
    
        NEEDS
    
            Copy Path and Show in Explorer use the command line, which
            After Effects only allows with Preferences > Scripting &
            Expressions > "Allow Scripts to Write Files and Access
            Network" ticked. Everything else works without it.
    
        Written for ExtendScript (ES3): no JSON, Array.indexOf, trim or
        forEach are relied on.
    */


    var PANEL_NAME = "MNR Scene Manager";

    // ─────────────────────────────────────────────
    // Settings
    // ─────────────────────────────────────────────

    var PROJECTS_ROOT = "P:/01-projects";
    var DEFAULT_PROJECT = "BFP";
    var SHOT_DIR = "03-shot";
    var ASSET_DIR = "02-asset";
    var SOFTWARE_DIR = "afterEffects";
    var SAVE_DIR = "saveFiles";
    var SOURCE_DIR = "sourceFiles";
    var EXT = ".aep";
    var DEFAULT_VARIANT = "main";
    var AE_TASKS = ["rotoKeyPrimary", "rotoKeyUtility", "comp"];
    // The pipeline users: one folder each (same list as MNR Launcher's user picker).
    var USERS_DIR = "P:/00-temp";
    // Where the panel remembers what it was showing, per project.
    var SETTINGS_SECTION = "MNR Scene Manager";
    var WINDOW_FRACTION = [0.62, 0.52];

    var C_ACCENT = [0.29, 0.56, 0.89, 1];
    var C_FIELD = [0.24, 0.24, 0.24, 1];
    var C_FIELD_OFF = [0.20, 0.20, 0.20, 1];
    var C_DIM = [0.55, 0.55, 0.55, 1];
    var C_WHITE = [0.96, 0.96, 0.96, 1];
    var C_GOOD = [0.40, 0.80, 0.50, 1];
    var C_BAD = [0.95, 0.40, 0.35, 1];

    // ─────────────────────────────────────────────
    // Small helpers (ExtendScript has no ES5)
    // ─────────────────────────────────────────────

    function trim(s) { return String(s).replace(/^\s+|\s+$/g, ""); }

    function lower(s) { return String(s).toLowerCase(); }

    function startsWith(s, p) { return String(s).substr(0, p.length) === p; }

    function endsWithI(s, p) {
        s = lower(s); p = lower(p);
        return s.length >= p.length && s.substr(s.length - p.length) === p;
    }

    function inListI(list, value) {
        for (var i = 0; i < list.length; i++) {
            if (lower(list[i]) === lower(value)) { return true; }
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

    function dirname(p) { return String(p).replace(/[\/\\][^\/\\]*$/, ""); }

    function basename(p) { return String(p).replace(/^.*[\/\\]/, ""); }

    function stripExt(name) { return String(name).replace(/\.[^.]*$/, ""); }

    function pad3(n) {
        var s = String(n);
        while (s.length < 3) { s = "0" + s; }
        return s;
    }

    function sameFile(a, b) {
        return lower(String(a).replace(/\\/g, "/")) === lower(String(b).replace(/\\/g, "/"));
    }

    function fmtDate(ms) {
        if (!ms) { return "?"; }
        var d = new Date(ms);
        function two(n) { return n < 10 ? "0" + n : String(n); }
        return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate()) +
            "  " + two(d.getHours()) + ":" + two(d.getMinutes());
    }

    // ─────────────────────────────────────────────
    // File system (swapped for a mock when tested outside After Effects)
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
        listFiles: function (path) {
            var out = [];
            var f = new Folder(path);
            if (!f.exists) { return out; }
            var items = f.getFiles();
            for (var i = 0; i < items.length; i++) {
                if (items[i] instanceof File) {
                    out.push({
                        name: File.decode(items[i].name),
                        path: join(path, File.decode(items[i].name)),
                        mtime: items[i].modified ? items[i].modified.getTime() : 0
                    });
                }
            }
            return out;
        },
        isDir: function (path) { return new Folder(path).exists; },
        exists: function (path) { return new File(path).exists || new Folder(path).exists; },
        makeDirs: function (path) {
            var f = new Folder(path);
            if (f.exists) { return true; }
            if (!FS.makeDirs(dirname(path))) { return false; }
            return f.create();
        },
        rename: function (path, newName) { return new File(path).rename(newName); }
    };

    // ─────────────────────────────────────────────
    // User, project, names
    // ─────────────────────────────────────────────

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
        if (!user) { user = $.getenv("USERNAME") || $.getenv("USER") || "user"; }
        return user.replace(/[\\\/:*?"<>|\s]+/g, "") || "user";
    }

    function parseName(filename, kind) {
        /* (variant, version) or null. Shots have 6 tokens, assets 5. */
        if (!endsWithI(filename, EXT)) { return null; }
        var tokens = stripExt(filename).split("_");
        var want = kind === "SHOT" ? 6 : 5;
        if (tokens.length !== want) { return null; }
        var m = tokens[tokens.length - 1].match(/^v(\d+)$/i);
        if (!m || !tokens[tokens.length - 2]) { return null; }
        return { variant: tokens[tokens.length - 2], version: parseInt(m[1], 10) };
    }

    function cleanVariant(text) {
        /* Underscores and spaces would break the tokens, so they become dashes. */
        var t = trim(text || "").replace(/[\s_]+/g, "-");
        t = t.replace(/[\\\/:*?"<>|.]+/g, "");
        return t.replace(/^-+|-+$/g, "");
    }

    function buildName(ctx, variant, version) {
        if (ctx.kind === "SHOT") {
            return ctx.project + ctx.ep + "_" + ctx.sq + "_" + ctx.sh + "_" + ctx.task + "_" +
                variant + "_v" + pad3(version) + EXT;
        }
        return ctx.project + "_" + ctx.task + "_" + ctx.asset + "_" + variant + "_v" +
            pad3(version) + EXT;
    }

    function nextVersion(rows, variant, user) {
        /* One past the highest version of variant (in user's folder, when given). */
        var best = 0;
        for (var i = 0; i < rows.length; i++) {
            if (user && lower(rows[i].user) !== lower(user)) { continue; }
            if (rows[i].variant && lower(rows[i].variant) === lower(variant)) {
                for (var j = 0; j < rows[i].versions.length; j++) {
                    if (rows[i].versions[j].num > best) { best = rows[i].versions[j].num; }
                }
            }
        }
        return best + 1;
    }

    function userDir(work, user) {
        /* work/<user>, reusing an existing folder spelled differently. */
        var names = FS.listDirs(work);
        for (var i = 0; i < names.length; i++) {
            if (lower(names[i]) === lower(user)) { return join(work, names[i]); }
        }
        return join(work, user);
    }

    function saveFolder(ctx, user) {
        return join(userDir(join(ctx.taskPath, "work"), user), SOFTWARE_DIR, SAVE_DIR);
    }

    function makeUserFolders(ctx, user) {
        var base = join(userDir(join(ctx.taskPath, "work"), user), SOFTWARE_DIR);
        if (!FS.makeDirs(join(base, SAVE_DIR)) || !FS.makeDirs(join(base, SOURCE_DIR))) {
            throw new Error("could not make " + join(base, SAVE_DIR));
        }
        return join(base, SAVE_DIR);
    }

    // ─────────────────────────────────────────────
    // Folders and files
    // ─────────────────────────────────────────────

    function listTasks(leafPath, showAll) {
        var names = FS.listDirs(leafPath);
        if (showAll) { return names; }
        var out = [];
        for (var i = 0; i < names.length; i++) {
            if (inListI(AE_TASKS, names[i])) { out.push(names[i]); }
        }
        return out;
    }

    function workFolders(userPath) {
        return [join(userPath, SOFTWARE_DIR, SAVE_DIR), join(userPath, SOFTWARE_DIR), userPath];
    }

    function taskHasFiles(taskPath) {
        var users = FS.listDirs(join(taskPath, "work"));
        for (var u = 0; u < users.length; u++) {
            var folders = workFolders(join(taskPath, "work", users[u]));
            for (var f = 0; f < folders.length; f++) {
                var files = FS.listFiles(folders[f]);
                for (var i = 0; i < files.length; i++) {
                    if (endsWithI(files[i].name, EXT) && !startsWith(files[i].name, "#")) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function scanFiles(taskPath, kind) {
        /* Every user's work files in a task, grouped into rows, newest save first. */
        var groups = {};
        var rows = [];
        var users = FS.listDirs(join(taskPath, "work"));
        for (var u = 0; u < users.length; u++) {
            var user = users[u];
            var folders = workFolders(join(taskPath, "work", user));
            for (var f = 0; f < folders.length; f++) {
                var files = FS.listFiles(folders[f]);
                for (var i = 0; i < files.length; i++) {
                    var file = files[i];
                    if (!endsWithI(file.name, EXT) || startsWith(file.name, "#")) { continue; }
                    var parsed = parseName(file.name, kind);
                    if (parsed) {
                        var key = lower(parsed.variant) + "|" + lower(user);
                        if (!groups[key]) {
                            groups[key] = { name: parsed.variant, variant: parsed.variant,
                                            user: user, versions: [], sel: 0 };
                            rows.push(groups[key]);
                        }
                        groups[key].versions.push({ num: parsed.version, path: file.path,
                                                    mtime: file.mtime });
                    } else {
                        rows.push({ name: file.name, variant: null, user: user, sel: 0,
                                    versions: [{ num: -1, path: file.path, mtime: file.mtime }] });
                    }
                }
            }
        }
        for (var r = 0; r < rows.length; r++) {
            rows[r].versions.sort(function (a, b) {
                return (b.num - a.num) || (b.mtime - a.mtime);
            });
            var newest = 0;
            for (var v = 0; v < rows[r].versions.length; v++) {
                if (rows[r].versions[v].mtime > newest) { newest = rows[r].versions[v].mtime; }
            }
            rows[r].newest = newest;
        }
        rows.sort(function (a, b) {
            if (b.newest !== a.newest) { return b.newest - a.newest; }
            if (lower(a.name) !== lower(b.name)) { return lower(a.name) < lower(b.name) ? -1 : 1; }
            return lower(a.user) < lower(b.user) ? -1 : (lower(a.user) > lower(b.user) ? 1 : 0);
        });
        return rows;
    }

    function rowPath(row) { return row.versions[row.sel].path; }

    function namingContext(st) {
        /* What a new file in the selected task is named from, or null. */
        var leaf = st.selNode[st.tab];
        if (!leaf || !st.selTask) { return null; }
        var root = tabRoot(st);
        if (!startsWith(lower(leaf), lower(root + "/"))) { return null; }
        var parts = leaf.substr(root.length + 1).split("/");
        var ctx = { kind: st.tab, project: st.project, task: st.selTask,
                    taskPath: join(leaf, st.selTask) };
        if (st.tab === "SHOT" && parts.length === 3) {
            ctx.ep = parts[0]; ctx.sq = parts[1]; ctx.sh = parts[2];
        } else if (st.tab === "ASSET" && parts.length === 2) {
            ctx.category = parts[0]; ctx.asset = parts[1];
        } else {
            return null;
        }
        return ctx;
    }

    function userChoices(taskPath, me) {
        /* {have: user folders already in this task's work folder,
            more: other pipeline users (P:\00-temp), the current user
            first in whichever list they are in}. */
        var have = [], more = [], i;
        var existing = FS.listDirs(join(taskPath, "work"));
        for (i = 0; i < existing.length; i++) {
            if (!startsWith(existing[i], "#") && !startsWith(existing[i], ".")) { have.push(existing[i]); }
        }
        var all = FS.listDirs(USERS_DIR);
        for (i = 0; i < all.length; i++) {
            if (!inListI(have, all[i])) { more.push(all[i]); }
        }
        function meFirst(list) {
            for (var j = 0; j < list.length; j++) {
                if (lower(list[j]) === lower(me)) { list.unshift(list.splice(j, 1)[0]); return true; }
            }
            return false;
        }
        if (!meFirst(have) && !meFirst(more)) { more.unshift(me); }
        return { have: have, more: more };
    }

    function viewText(tab, chain, task) {
        /* What the panel was showing, as one line: SHOT|102/SQ04/SH12|rotoKeyPrimary */
        return tab + "|" + chain.join("/") + "|" + (task || "");
    }

    function parseView(text) {
        var p = String(text || "").split("|");
        if (p.length < 3 || (p[0] !== "SHOT" && p[0] !== "ASSET") || !p[1]) { return null; }
        return { tab: p[0], chain: p[1].split("/"), task: p[2] || null };
    }

    function tabRoot(st) {
        return join(PROJECTS_ROOT, st.project, st.tab === "SHOT" ? SHOT_DIR : ASSET_DIR);
    }

    function renamePlan(row, newText, all, openPath) {
        /* {pairs: [{from, to}], error} for a rename. Nothing is touched here. */
        var pairs = [];
        var i;
        if (row.variant) {
            var nv = cleanVariant(newText);
            if (!nv) { return { pairs: [], error: "Type a name." }; }
            if (nv === row.variant) { return { pairs: [], error: "That is already its name." }; }
            var versions = all ? row.versions : [row.versions[row.sel]];
            for (i = 0; i < versions.length; i++) {
                var tokens = stripExt(basename(versions[i].path)).split("_");
                tokens[tokens.length - 2] = nv;
                pairs.push({ from: versions[i].path,
                             to: join(dirname(versions[i].path), tokens.join("_") + EXT) });
            }
        } else {
            var stem = trim(newText || "").replace(/[\\\/:*?"<>|]+/g, "");
            if (!stem) { return { pairs: [], error: "Type a name." }; }
            var p = row.versions[0].path;
            if (stem + EXT === basename(p)) { return { pairs: [], error: "That is already its name." }; }
            pairs.push({ from: p, to: join(dirname(p), stem + EXT) });
        }
        var seen = {};
        for (i = 0; i < pairs.length; i++) {
            if (openPath && sameFile(pairs[i].from, openPath)) {
                return { pairs: pairs, error: basename(pairs[i].from) +
                         " is open right now. Open something else first." };
            }
            if (FS.exists(pairs[i].to) && !sameFile(pairs[i].from, pairs[i].to)) {
                return { pairs: pairs, error: basename(pairs[i].to) + " already exists." };
            }
            var key = lower(pairs[i].to);
            if (seen[key]) {
                return { pairs: pairs, error: "Two files would both become " + basename(pairs[i].to) + "." };
            }
            seen[key] = true;
        }
        return { pairs: pairs, error: "" };
    }

    function parseOpenFile(path, project) {
        /* Where the open project lives: {tab, chain, task} or null. */
        if (!path) { return null; }
        var root = join(PROJECTS_ROOT, project);
        var p = String(path).replace(/\\/g, "/");
        if (!startsWith(lower(p), lower(root + "/"))) { return null; }
        var parts = p.substr(root.length + 1).split("/");
        if (parts[0] === SHOT_DIR && parts.length >= 6) {
            return { tab: "SHOT", chain: [parts[1], parts[2], parts[3]], task: parts[4] };
        }
        if (parts[0] === ASSET_DIR && parts.length >= 5) {
            return { tab: "ASSET", chain: [parts[1], parts[2]], task: parts[3] };
        }
        return null;
    }

    function projectOfPath(path) {
        if (!path) { return null; }
        var p = String(path).replace(/\\/g, "/");
        if (!startsWith(lower(p), lower(PROJECTS_ROOT + "/"))) { return null; }
        return p.substr(PROJECTS_ROOT.length + 1).split("/")[0] || null;
    }

    // Exposed for the tests that run outside After Effects.
    var CORE = {
        FS: FS, trim: trim, join: join, parseName: parseName, cleanVariant: cleanVariant,
        buildName: buildName, nextVersion: nextVersion, userDir: userDir,
        saveFolder: saveFolder, makeUserFolders: makeUserFolders, listTasks: listTasks,
        taskHasFiles: taskHasFiles, scanFiles: scanFiles, namingContext: namingContext,
        renamePlan: renamePlan, parseOpenFile: parseOpenFile, projectOfPath: projectOfPath,
        userChoices: userChoices, viewText: viewText, parseView: parseView,
        setUsersDir: function (d) { USERS_DIR = d; },
        setRoot: function (r) { PROJECTS_ROOT = r; }
    };
    if (typeof module !== "undefined" && module.exports) {
        module.exports = CORE;
        return;
    }

    // ─────────────────────────────────────────────
    // After Effects actions
    // ─────────────────────────────────────────────

    function openProjectPath() {
        try {
            return app.project && app.project.file ? app.project.file.fsName.replace(/\\/g, "/") : "";
        } catch (e) { return ""; }
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

    function canUseCommandLine() {
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

    function needCommandLine() {
        if (canUseCommandLine()) { return true; }
        alert("This needs Edit > Preferences > Scripting & Expressions >\n" +
              "\"Allow Scripts to Write Files and Access Network\" ticked.\n\n" +
              "Starting After Effects from MNR Launcher ticks it for you.", PANEL_NAME);
        return false;
    }

    function copyToClipboard(text) {
        if (!needCommandLine()) { return false; }
        var safe = String(text).replace(/"/g, "");
        system.callSystem('cmd.exe /c "echo|set /p="' + safe + '"|clip"');
        return true;
    }

    function showInExplorer(path, isFile) {
        var nativePath = isFile ? new File(path).fsName : new Folder(path).fsName;
        if (isFile) {
            if (!needCommandLine()) { return; }
            system.callSystem('explorer.exe /select,"' + nativePath + '"');
        } else {
            new Folder(path).execute();
        }
    }

    // ─────────────────────────────────────────────
    // Drawing helpers: launcher-style buttons and labels
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
        b.mnrActive = false;
        b.onDraw = function () {
            var g = this.graphics;
            var w = this.size[0], h = this.size[1];
            var col = !this.enabled ? C_FIELD_OFF : ((this.mnrPrimary || this.mnrActive) ? C_ACCENT : C_FIELD);
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

    function setActive(button, on) {
        button.mnrActive = on;
        // Nudge a redraw.
        button.enabled = !button.enabled;
        button.enabled = !button.enabled;
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
        // Launcher-style section title: small, spaced, grey.
        var t = parent.add("statictext", undefined, text.toUpperCase().split("").join(" "));
        styleText(t, C_DIM, 10, false);
        return t;
    }

    // ─────────────────────────────────────────────
    // The window
    // ─────────────────────────────────────────────

    function buildUI(thisObj) {
        var st = {
            project: projectOfPath(openProjectPath()) ||
                (FS.isDir(join(PROJECTS_ROOT, getSetting("lastProject"))) && getSetting("lastProject")) ||
                DEFAULT_PROJECT,
            tab: "SHOT", selNode: { SHOT: null, ASSET: null }, selTask: null,
            showAll: false, rows: [], tasks: [], search: ""
        };
        var me = currentUser();

        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", PANEL_NAME, undefined, { resizeable: true, closeButton: true });
        win.orientation = "column";
        win.alignChildren = ["fill", "fill"];
        win.spacing = 8;
        win.margins = 12;

        // ── Header
        var header = win.add("group");
        header.orientation = "row";
        header.alignment = ["fill", "top"];
        var title = header.add("statictext", undefined, PANEL_NAME);
        styleText(title, C_WHITE, 16, true);
        var spacer = header.add("statictext", undefined, "");
        spacer.alignment = ["fill", "center"];
        var projectLabel = header.add("statictext", undefined, "Project:  " + st.project);
        projectLabel.characters = 18;
        styleText(projectLabel, C_ACCENT, 12, false);
        var userLabel = header.add("statictext", undefined, "User:  " + me);
        styleText(userLabel, C_DIM, 12, false);
        var verLabel = header.add("statictext", undefined, PLUGIN_CHANNEL + " " + PLUGIN_VERSION);
        verLabel.helpTip = "Built " + (PLUGIN_BUILT || "?") + (PLUGIN_COMMIT ? "  (" + PLUGIN_COMMIT + ")" : "");
        styleText(verLabel, C_DIM, 10, false);

        // ── Body
        var body = win.add("group");
        body.orientation = "row";
        body.alignment = ["fill", "fill"];
        body.alignChildren = ["fill", "fill"];
        body.spacing = 10;

        // Left: project, tabs, search, tree
        var left = body.add("group");
        left.orientation = "column";
        left.alignChildren = ["fill", "top"];
        left.preferredSize.width = 270;
        left.alignment = ["left", "fill"];
        var topRow = left.add("group");
        topRow.orientation = "row";
        topRow.spacing = 6;
        var projectList = topRow.add("dropdownlist", undefined, []);
        projectList.preferredSize = [86, 28];
        var shotTab = flatButton(topRow, "Shot", 82);
        var assetTab = flatButton(topRow, "Asset", 82);
        var search = left.add("edittext", undefined, "");
        search.helpTip = "Search, then press Enter";
        var tree = left.add("treeview", undefined, []);
        tree.alignment = ["fill", "fill"];
        tree.preferredSize = [270, 360];

        // Middle: tasks
        var mid = body.add("group");
        mid.orientation = "column";
        mid.alignChildren = ["fill", "top"];
        mid.preferredSize.width = 200;
        mid.alignment = ["left", "fill"];
        var taskHead = mid.add("group");
        taskHead.orientation = "row";
        heading(taskHead, "Tasks");
        var showAll = taskHead.add("checkbox", undefined, "Show all folders");
        var taskList = mid.add("listbox", undefined, []);
        taskList.alignment = ["fill", "fill"];
        taskList.preferredSize = [200, 360];

        // Right: files
        var right = body.add("group");
        right.orientation = "column";
        right.alignChildren = ["fill", "top"];
        right.alignment = ["fill", "fill"];
        heading(right, "Files");
        var fileList = right.add("listbox", undefined, [], {
            numberOfColumns: 4, showHeaders: true,
            columnTitles: ["File Name", "User", "Date", "Version"],
            columnWidths: [230, 110, 140, 70]
        });
        fileList.alignment = ["fill", "fill"];
        fileList.preferredSize = [560, 330];
        var verRow = right.add("group");
        verRow.orientation = "row";
        verRow.alignment = ["fill", "bottom"];
        verRow.add("statictext", undefined, "Version:");
        var versionList = verRow.add("dropdownlist", undefined, []);
        versionList.preferredSize = [260, 24];

        // Actions
        var actions = body.add("group");
        actions.orientation = "column";
        actions.alignChildren = ["fill", "top"];
        actions.alignment = ["right", "fill"];
        heading(actions, "Actions");
        var bOpen = flatButton(actions, "Open", 140, true);
        var bNew = flatButton(actions, "New", 140);
        var bSaveAs = flatButton(actions, "Save As", 140);
        var bRename = flatButton(actions, "Rename", 140);
        var bCopy = flatButton(actions, "Copy Path", 140);
        var bExplorer = flatButton(actions, "Show in Explorer", 140);

        // ── Footer
        var footer = win.add("group");
        footer.orientation = "row";
        footer.alignment = ["fill", "bottom"];
        var status = footer.add("statictext", undefined, "", { truncate: "middle" });
        status.alignment = ["fill", "center"];
        styleText(status, C_DIM, 10, false);
        var hint = footer.add("statictext", undefined,
            "Right-click: copy path / show in Explorer    Double-click: open");
        styleText(hint, C_DIM, 10, false);

        // ─────────── state -> widgets ───────────

        function say(text, good) {
            status.text = text;
            styleText(status, good === false ? C_BAD : (good ? C_GOOD : C_DIM), 10, false);
        }

        function selectedRow() {
            var i = fileList.selection ? fileList.selection.index : -1;
            return (i >= 0 && i < st.rows.length) ? st.rows[i] : null;
        }

        function updateButtons() {
            var row = selectedRow();
            var ctx = namingContext(st);
            bOpen.enabled = !!row;
            bRename.enabled = !!row;
            bNew.enabled = !!ctx;
            bSaveAs.enabled = !!ctx;
            bCopy.enabled = !!row;
            bExplorer.enabled = !!row || !!ctx;
            if (row) {
                say(new File(rowPath(row)).fsName);
            } else if (ctx) {
                say("New / Save As write to: " + new Folder(saveFolder(ctx, me)).fsName);
            } else {
                say("");
            }
        }

        function fillProjects() {
            projectList.removeAll();
            var names = FS.listDirs(PROJECTS_ROOT);
            if (!names.length) { names = [st.project]; }
            var pick = 0;
            for (var i = 0; i < names.length; i++) {
                projectList.add("item", names[i]);
                if (names[i] === st.project) { pick = i; }
            }
            projectList.selection = pick;
        }

        function addPlaceholder(node) { node.add("item", "..."); node.mnrLoaded = false; }

        function addTreeLevel(parentItem, path, depth) {
            var last = st.tab === "SHOT" ? 2 : 1;
            var names = FS.listDirs(path);
            for (var i = 0; i < names.length; i++) {
                var child = join(path, names[i]);
                var item;
                if (depth === last) {
                    item = parentItem.add("item", names[i]);
                    item.mnrLeaf = true;
                } else {
                    item = parentItem.add("node", names[i]);
                    item.mnrLeaf = false;
                    addPlaceholder(item);
                }
                item.mnrPath = child;
                item.mnrDepth = depth;
            }
        }

        function loadChildren(node) {
            if (node.mnrLoaded) { return; }
            node.removeAll();
            node.mnrLoaded = true;
            addTreeLevel(node, node.mnrPath, node.mnrDepth + 1);
        }

        function buildSearchTree(parentItem, path, depth, trail, query) {
            /* Adds matching leaves with their parents; returns true if anything matched. */
            var last = st.tab === "SHOT" ? 2 : 1;
            var names = FS.listDirs(path);
            var any = false;
            for (var i = 0; i < names.length; i++) {
                var child = join(path, names[i]);
                var words = trail.concat([names[i]]).join(" ");
                if (depth === last) {
                    if (lower(words).indexOf(query) >= 0) {
                        var leaf = parentItem.add("item", names[i]);
                        leaf.mnrLeaf = true; leaf.mnrPath = child; leaf.mnrDepth = depth;
                        any = true;
                    }
                } else {
                    var node = parentItem.add("node", names[i]);
                    node.mnrLeaf = false; node.mnrPath = child; node.mnrDepth = depth;
                    node.mnrLoaded = true;
                    if (buildSearchTree(node, child, depth + 1, trail.concat([names[i]]), query)) {
                        node.expanded = true;
                        any = true;
                    } else {
                        parentItem.remove(node);
                    }
                }
            }
            return any;
        }

        function fillTree() {
            tree.removeAll();
            var root = tabRoot(st);
            if (!FS.isDir(root)) {
                tree.add("item", root.replace(/\//g, "\\") + " not found");
                return;
            }
            var q = lower(trim(st.search));
            if (q) {
                buildSearchTree(tree, root, 0, [], q);
            } else {
                addTreeLevel(tree, root, 0);
            }
        }

        function fillTasks(keepTask) {
            taskList.removeAll();
            var leaf = st.selNode[st.tab];
            st.tasks = leaf ? listTasks(leaf, st.showAll) : [];
            if (!(keepTask && inListI(st.tasks, st.selTask || ""))) { st.selTask = null; }
            var pick = -1;
            for (var i = 0; i < st.tasks.length; i++) {
                var has = taskHasFiles(join(leaf, st.tasks[i]));
                taskList.add("item", st.tasks[i] + (has ? "" : "   (no files)"));
                if (st.tasks[i] === st.selTask) { pick = i; }
            }
            if (pick >= 0) { taskList.selection = pick; }
            fillFiles();
        }

        function fillFiles(keepPath) {
            fileList.removeAll();
            versionList.removeAll();
            var ctx = namingContext(st);
            st.rows = ctx ? scanFiles(ctx.taskPath, st.tab) : [];
            var openPath = openProjectPath();
            var pick = -1;
            for (var i = 0; i < st.rows.length; i++) {
                var r = st.rows[i];
                for (var j = 0; j < r.versions.length; j++) {
                    if (keepPath && sameFile(r.versions[j].path, keepPath)) { pick = i; r.sel = j; }
                }
                var isOpen = false;
                for (j = 0; j < r.versions.length; j++) {
                    if (openPath && sameFile(r.versions[j].path, openPath)) { isOpen = true; }
                }
                var v = r.versions[r.sel];
                var item = fileList.add("item", (isOpen ? "> " : "") + r.name);
                item.subItems[0].text = r.user;
                item.subItems[1].text = fmtDate(v.mtime);
                item.subItems[2].text = v.num >= 0 ? "v" + pad3(v.num) : "-";
            }
            if (pick >= 0) { fileList.selection = pick; }
            fillVersions();
            updateButtons();
        }

        function fillVersions() {
            versionList.removeAll();
            var row = selectedRow();
            if (!row) { versionList.enabled = false; return; }
            for (var i = 0; i < row.versions.length; i++) {
                var v = row.versions[i];
                versionList.add("item", (v.num >= 0 ? "v" + pad3(v.num) : row.name) + "     " +
                                fmtDate(v.mtime));
            }
            versionList.enabled = row.versions.length > 1;
            versionList.selection = row.sel;
        }

        function selectPlace(where, keepPath) {
            /* Shows a tab / shot or asset / task: {tab, chain, task}. */
            if (!where) { return false; }
            st.tab = where.tab;
            setActive(shotTab, st.tab === "SHOT");
            setActive(assetTab, st.tab === "ASSET");
            st.search = ""; search.text = "";
            fillTree();
            var items = tree.items;
            var node = null;
            for (var c = 0; c < where.chain.length; c++) {
                node = null;
                for (var i = 0; i < items.length; i++) {
                    if (items[i].text === where.chain[c]) { node = items[i]; break; }
                }
                if (!node) { return false; }
                if (!node.mnrLeaf) {
                    loadChildren(node);
                    node.expanded = true;
                    items = node.items;
                }
            }
            if (!node || !node.mnrLeaf) { return false; }
            tree.selection = node;
            st.selNode[st.tab] = node.mnrPath;
            st.selTask = where.task;
            fillTasks(true);
            if (where.task && !st.selTask) {
                st.showAll = true; showAll.value = true;
                st.selTask = where.task;
                fillTasks(true);
            }
            fillFiles(keepPath);
            return true;
        }

        function rememberView() {
            /* Saved on every change, so the panel opens where it was left. */
            var leaf = st.selNode[st.tab];
            saveSetting("lastProject", st.project);
            if (!leaf) { return; }
            var root = tabRoot(st);
            if (!startsWith(lower(leaf), lower(root + "/"))) { return; }
            saveSetting("view_" + st.project, viewText(st.tab, leaf.substr(root.length + 1).split("/"), st.selTask));
        }

        function selectStart() {
            /* The open project's shot and task, else where the panel was left
               last time for this project. */
            var open = openProjectPath();
            if (selectPlace(parseOpenFile(open, st.project), open)) { rememberView(); return; }
            selectPlace(parseView(getSetting("view_" + st.project)), null);
        }

        function setProject(name) {
            st.project = name;
            projectLabel.text = "Project:  " + name;
            st.selNode = { SHOT: null, ASSET: null };
            st.selTask = null;
            st.search = "";
            search.text = "";
            fillTree();
            fillTasks(false);
            selectPlace(parseView(getSetting("view_" + name)), null);
            rememberView();
        }

        // ─────────── events ───────────

        projectList.onChange = function () {
            if (projectList.selection && projectList.selection.text !== st.project) {
                setProject(projectList.selection.text);
            }
        };

        shotTab.onClick = function () {
            if (st.tab === "SHOT") { return; }
            st.tab = "SHOT"; setActive(shotTab, true); setActive(assetTab, false);
            st.search = ""; search.text = "";
            fillTree(); fillTasks(true); rememberView();
        };
        assetTab.onClick = function () {
            if (st.tab === "ASSET") { return; }
            st.tab = "ASSET"; setActive(assetTab, true); setActive(shotTab, false);
            st.search = ""; search.text = "";
            fillTree(); fillTasks(true); rememberView();
        };

        search.onChange = function () {
            st.search = search.text;
            fillTree();
        };

        tree.onExpand = function (item) { loadChildren(item); };

        tree.onChange = function () {
            var item = tree.selection;
            if (!item || !item.mnrPath) { return; }
            if (!item.mnrLeaf) {
                loadChildren(item);
                item.expanded = !item.expanded;
                return;
            }
            if (st.selNode[st.tab] !== item.mnrPath) {
                st.selNode[st.tab] = item.mnrPath;
                fillTasks(true);
                rememberView();
            }
        };

        showAll.onClick = function () { st.showAll = showAll.value; fillTasks(true); };

        taskList.onChange = function () {
            if (!taskList.selection) { return; }
            var name = st.tasks[taskList.selection.index];
            if (name !== st.selTask) { st.selTask = name; fillFiles(); rememberView(); }
        };

        fileList.onChange = function () { fillVersions(); updateButtons(); };
        fileList.onDoubleClick = function () { doOpen(); };

        versionList.onChange = function () {
            var row = selectedRow();
            if (!row || !versionList.selection) { return; }
            row.sel = versionList.selection.index;
            var v = row.versions[row.sel];
            var item = fileList.selection;
            item.subItems[1].text = fmtDate(v.mtime);
            item.subItems[2].text = v.num >= 0 ? "v" + pad3(v.num) : "-";
            updateButtons();
        };

        // Right-click menu: a small borderless window that closes when
        // you click anywhere off it.
        function contextMenu(x, y) {
            var row = selectedRow();
            if (!row) { return; }
            var m = new Window("palette", "", [x, y, x + 190, y + 150],
                               { borderless: true, closeButton: false });
            m.orientation = "column";
            m.alignChildren = ["fill", "top"];
            m.margins = 6;
            m.spacing = 4;
            var entries = [["Copy File Path", function () { doCopy(); }],
                           ["Show in Explorer", function () { doExplorer(); }],
                           ["Rename...", function () { doRename(); }],
                           ["Open", function () { doOpen(); }]];
            for (var i = 0; i < entries.length; i++) {
                (function (label, fn) {
                    var b = flatButton(m, label, 176);
                    b.preferredSize = [176, 26];
                    b.onClick = function () { m.close(); fn(); };
                })(entries[i][0], entries[i][1]);
            }
            m.onDeactivate = function () { try { m.close(); } catch (e) {} };
            m.show();
        }
        fileList.addEventListener("mousedown", function (e) {
            if (e.button === 2) { contextMenu(e.screenX, e.screenY); }
        });

        // ─────────── actions ───────────

        function doOpen() {
            var row = selectedRow();
            if (!row) { return; }
            var f = new File(rowPath(row));
            if (!f.exists) { say("File not found: " + f.fsName, false); return; }
            // After Effects asks to save the current project first, if it changed.
            var opened = app.open(f);
            if (opened) {
                say("Opened " + basename(rowPath(row)), true);
                fillFiles(rowPath(row));
                // Missing footage that the pipeline moved or renamed: found
                // and offered by MNR_Relink_Startup.jsx (asks first).
                try { if ($.global.mnrRelinkOnOpen) { $.global.mnrRelinkOnOpen(); } } catch (e) {}
            }
        }

        function nameDialog(kind, initial) {
            /* New / Save As: a centred dialog showing the exact file it becomes. */
            var ctx = namingContext(st);
            if (!ctx) { return null; }
            var d = new Window("dialog", kind === "NEW" ? "New Project" : "Save As");
            d.orientation = "column";
            d.alignChildren = ["fill", "top"];
            d.margins = 18;
            d.spacing = 10;
            var t = d.add("statictext", undefined, kind === "NEW" ? "New Project" : "Save As");
            styleText(t, C_WHITE, 16, true);
            var sub = d.add("statictext", undefined, kind === "NEW"
                ? "A new After Effects project, saved straight away."
                : "Saves the open project as a new file.");
            styleText(sub, C_DIM, 11, false);
            heading(d, "Name");
            var field = d.add("edittext", undefined, initial);
            field.characters = 50;
            heading(d, "User");
            var users = userChoices(ctx.taskPath, me);
            var userList = d.add("dropdownlist", undefined, []);
            userList.preferredSize.width = 300;
            userList.helpTip = "Whose work folder it is saved in. Folders already in this task are " +
                "at the top; under them, the other pipeline users.";
            var userNames = [];
            var pickUser = 0, u;
            for (u = 0; u < users.have.length; u++) {
                userList.add("item", users.have[u]);
                userNames.push(users.have[u]);
                if (lower(users.have[u]) === lower(me)) { pickUser = userNames.length - 1; }
            }
            if (users.have.length && users.more.length) { userList.add("separator"); userNames.push(null); }
            for (u = 0; u < users.more.length; u++) {
                userList.add("item", "Add new:  " + users.more[u]);
                userNames.push(users.more[u]);
                if (lower(users.more[u]) === lower(me)) { pickUser = userNames.length - 1; }
            }
            userList.selection = pickUser;
            function chosenUser() {
                var sel = userList.selection;
                return (sel && userNames[sel.index]) || me;
            }
            var fileText = d.add("statictext", undefined, "", { truncate: "middle" });
            styleText(fileText, C_WHITE, 13, true);
            var verText = d.add("statictext", undefined, "");
            styleText(verText, C_ACCENT, 11, false);
            var folderText = d.add("statictext", undefined, "", { truncate: "middle" });
            styleText(folderText, C_DIM, 10, false);
            var errText = d.add("statictext", undefined, "");
            styleText(errText, C_BAD, 11, false);
            var buttons = d.add("group");
            buttons.alignment = ["right", "bottom"];
            var cancel = flatButton(buttons, "Cancel", 110);
            var ok = flatButton(buttons, kind === "NEW" ? "Create" : "Save", 110, true);
            var result = null;

            function target() {
                var variant = cleanVariant(field.text) || DEFAULT_VARIANT;
                var user = chosenUser();
                var version = nextVersion(st.rows, variant, user);
                return { variant: variant, version: version, user: user,
                         path: join(saveFolder(ctx, user), buildName(ctx, variant, version)) };
            }
            function refresh() {
                var t2 = target();
                fileText.text = basename(t2.path);
                verText.text = "Version v" + pad3(t2.version) + "  -  next free for '" +
                    t2.variant + "' in " + t2.user + "'s folder";
                folderText.text = new Folder(dirname(t2.path)).fsName;
                errText.text = "";
            }
            field.onChanging = refresh;
            userList.onChange = function () {
                if (userList.selection && !userNames[userList.selection.index]) {
                    userList.selection = pickUser;          // the separator line
                }
                refresh();
            };
            refresh();
            cancel.onClick = function () { d.close(0); };
            ok.onClick = function () {
                var t2 = target();
                if (!cleanVariant(field.text)) { errText.text = "Type a name."; return; }
                if (FS.exists(t2.path)) { errText.text = basename(t2.path) + " already exists."; return; }
                result = t2;
                d.close(1);
            };
            d.defaultElement = ok;
            d.cancelElement = cancel;
            field.active = true;
            d.center();
            d.show();
            return result;
        }

        function doNew() {
            var t = nameDialog("NEW", DEFAULT_VARIANT);
            if (!t) { return; }
            var ctx = namingContext(st);
            try { makeUserFolders(ctx, t.user); } catch (e) { say("Could not make the folders: " + e, false); return; }
            // After Effects asks to save the current project first, if it changed.
            var proj = app.newProject();
            if (!proj) { say("New cancelled.", false); return; }
            // MNR project settings (timecode, OCIO ACES 1.3, 32 bpc),
            // from MNR_Project_Settings_Startup.jsx when it is installed.
            try {
                if ($.global.mnrApplyProjectSettings) { $.global.mnrApplyProjectSettings("new project"); }
            } catch (e) {}
            app.project.save(new File(t.path));
            say("Created " + basename(t.path), true);
            fillFiles(t.path);
        }

        function doSaveAs() {
            var openPath = openProjectPath();
            var parsed = openPath ? parseName(basename(openPath), st.tab) : null;
            var t = nameDialog("SAVE_AS", parsed ? parsed.variant : DEFAULT_VARIANT);
            if (!t) { return; }
            var ctx = namingContext(st);
            try { makeUserFolders(ctx, t.user); } catch (e) { say("Could not make the folders: " + e, false); return; }
            app.project.save(new File(t.path));
            say("Saved " + basename(t.path), true);
            fillFiles(t.path);
        }

        function doRename() {
            var row = selectedRow();
            if (!row) { return; }
            var d = new Window("dialog", "Rename");
            d.orientation = "column";
            d.alignChildren = ["fill", "top"];
            d.margins = 18;
            d.spacing = 10;
            var t = d.add("statictext", undefined, "Rename");
            styleText(t, C_WHITE, 16, true);
            var sub = d.add("statictext", undefined, row.variant
                ? "Changes the name part only; the shot, task and version stay."
                : "Renames the file. .aep is kept.");
            styleText(sub, C_DIM, 11, false);
            heading(d, "New name");
            var field = d.add("edittext", undefined, row.variant ? row.variant : stripExt(row.name));
            field.characters = 50;
            var all = null;
            if (row.variant && row.versions.length > 1) {
                all = d.add("checkbox", undefined, "Rename all " + row.versions.length +
                            " versions of it (" + row.user + "'s)");
            }
            var fromText = d.add("statictext", undefined, "", { truncate: "middle" });
            styleText(fromText, C_DIM, 11, false);
            var toText = d.add("statictext", undefined, "", { truncate: "middle" });
            styleText(toText, C_WHITE, 13, true);
            var moreText = d.add("statictext", undefined, "");
            styleText(moreText, C_ACCENT, 10, false);
            var errText = d.add("statictext", undefined, "");
            styleText(errText, C_BAD, 11, false);
            var buttons = d.add("group");
            buttons.alignment = ["right", "bottom"];
            var cancel = flatButton(buttons, "Cancel", 110);
            var ok = flatButton(buttons, "Rename", 110, true);

            function plan() { return renamePlan(row, field.text, all ? all.value : false, openProjectPath()); }
            function refresh() {
                var p = plan();
                fromText.text = p.pairs.length ? basename(p.pairs[0].from) : "";
                toText.text = p.pairs.length ? "->  " + basename(p.pairs[0].to) : "";
                moreText.text = p.pairs.length > 1 ? "and " + (p.pairs.length - 1) + " more version(s)" : "";
                errText.text = (p.error && p.error !== "That is already its name.") ? p.error : "";
            }
            field.onChanging = refresh;
            if (all) { all.onClick = refresh; }
            refresh();
            var done = [];
            cancel.onClick = function () { d.close(0); };
            ok.onClick = function () {
                var p = plan();
                if (p.error) { errText.text = p.error; return; }
                for (var i = 0; i < p.pairs.length; i++) {
                    var from = p.pairs[i].from, to = p.pairs[i].to;
                    if (!FS.exists(from) || (FS.exists(to) && !sameFile(from, to))) {
                        errText.text = "Stopped: " + basename(from) + " changed on disk. " +
                            done.length + " renamed.";
                        return;
                    }
                    if (!FS.rename(from, basename(to))) {
                        errText.text = "Could not rename " + basename(from) + ". " + done.length + " renamed.";
                        return;
                    }
                    done.push(to);
                }
                d.close(1);
            };
            d.defaultElement = ok;
            d.cancelElement = cancel;
            field.active = true;
            d.center();
            d.show();
            if (done.length) {
                say("Renamed " + done.length + " file(s).", true);
                fillTasks(true);
                fillFiles(done[0]);
            } else {
                fillFiles();
            }
        }

        function doCopy() {
            var row = selectedRow();
            if (!row) { return; }
            var nativePath = new File(rowPath(row)).fsName;
            if (copyToClipboard(nativePath)) { say("Copied: " + nativePath, true); }
        }

        function doExplorer() {
            var row = selectedRow();
            if (row) { showInExplorer(rowPath(row), true); return; }
            var ctx = namingContext(st);
            if (ctx) { showInExplorer(ctx.taskPath, false); }
        }

        bOpen.onClick = doOpen;
        bNew.onClick = doNew;
        bSaveAs.onClick = doSaveAs;
        bRename.onClick = doRename;
        bCopy.onClick = doCopy;
        bExplorer.onClick = doExplorer;

        // ─────────── start ───────────

        setActive(shotTab, true);
        fillProjects();
        fillTree();
        fillTasks(false);
        selectStart();

        win.layout.layout(true);
        win.layout.resize();
        win.onResizing = win.onResize = function () { this.layout.resize(); };
        return win;
    }

    function placeWindow(w) {
        /* WINDOW_FRACTION of the main screen, centred. */
        try {
            var s = $.screens[0];
            var sw = s.right - s.left, sh = s.bottom - s.top;
            var ww = Math.round(sw * WINDOW_FRACTION[0]), wh = Math.round(sh * WINDOW_FRACTION[1]);
            var x = s.left + Math.round((sw - ww) / 2), y = s.top + Math.round((sh - wh) / 2);
            w.bounds = [x, y, x + ww, y + wh];
            w.layout.resize();
        } catch (e) {
            w.center();
        }
    }

    // A floating window that is already open is brought forward instead
    // of opening a second one.
    if (!(thisObj instanceof Panel)) {
        var existing = $.global.mnrSceneManagerWindow;
        if (existing && existing.visible) {
            try { existing.active = true; } catch (e) {}
            return;
        }
    }

    var built = buildUI(thisObj);
    if (built instanceof Window) {
        // Kept on $.global so the window lives on after this script ends,
        // and so the startup script can tell it is open.
        $.global.mnrSceneManagerWindow = built;
        built.onClose = function () { $.global.mnrSceneManagerWindow = null; };
        built.show();
        placeWindow(built);
    } else {
        // Docked in the workspace: the startup script then opens nothing.
        $.global.mnrSceneManagerDocked = true;
    }

})(this);
