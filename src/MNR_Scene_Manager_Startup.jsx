/*
    MNR Scene Manager - startup
    ---------------------------
    Installed by MNR Launcher into After Effects' Scripts\Startup folder,
    which After Effects runs every time it starts.

    1. Opens the MNR Scene Manager as its own window once After Effects
       has finished starting, in place of the Home screen. Skipped when
       the Scene Manager is already docked in the workspace, or when
       After Effects was started with a project.

    2. Turns off After Effects' Home screen (Preferences > Startup and
       Repair > Enable Home Screen), so it stops opening at launch. That
       takes effect from the next launch. Adobe doesn't document the
       setting's script name, so it is looked up in After Effects' own
       preference files; what was found is logged to
       %APPDATA%\MNR_Launcher\ae_startup.log.
       Set MNR_KEEP_HOME_SCREEN = true below to leave it alone.

    Written for ExtendScript (ES3).
*/

(function () {

    var MNR_KEEP_HOME_SCREEN = false;
    var OPEN_DELAY_MS = 2500;
    var PANEL_FILE = "MNR_Launcher_Panel.jsx";

    function log(text) {
        try {
            var folder = new Folder(Folder.userData.fsName + "/MNR_Launcher");
            if (!folder.exists) { folder.create(); }
            var f = new File(folder.fsName + "/ae_startup.log");
            f.encoding = "UTF-8";
            if (f.open("a")) {
                f.writeln(new Date().toString() + "  " + text);
                f.close();
            }
        } catch (e) { /* logging is never worth failing over */ }
    }

    // ── Where the panel was installed: the app's own ScriptUI Panels
    // folder first, then the per-user one.
    function findPanel() {
        var spots = [];
        try { spots.push(Folder.startup.fsName + "/Scripts/ScriptUI Panels/" + PANEL_FILE); } catch (e) {}
        try {
            var base = new Folder(Folder.userData.fsName + "/Adobe/After Effects");
            var major = String(app.version).split(".")[0];
            var subs = base.exists ? base.getFiles() : [];
            for (var i = 0; i < subs.length; i++) {
                if (subs[i] instanceof Folder && File.decode(subs[i].name).split(".")[0] === major) {
                    spots.push(subs[i].fsName + "/Scripts/ScriptUI Panels/" + PANEL_FILE);
                }
            }
        } catch (e) {}
        for (var j = 0; j < spots.length; j++) {
            var f = new File(spots[j]);
            if (f.exists) { return f; }
        }
        return null;
    }

    // Run by app.scheduleTask once After Effects has finished starting.
    $.global.mnrSceneManagerStartupOpen = function () {
        try {
            if ($.global.mnrSceneManagerDocked) { log("docked panel is open, not opening a window"); return; }
            var w = $.global.mnrSceneManagerWindow;
            if (w && w.visible) { return; }
            if (app.project && app.project.file) { log("started with a project, not opening"); return; }
            var panel = findPanel();
            if (!panel) { log("could not find " + PANEL_FILE); return; }
            $.evalFile(panel);
            log("opened the Scene Manager from " + panel.fsName);
        } catch (e) {
            log("could not open the Scene Manager: " + e.toString());
        }
    };

    // ── Home screen off. Looks for the setting in After Effects' own
    // preference files and only ever switches that one setting off.
    function prefTypeFor(fileName) {
        if (typeof PREFType === "undefined") { return null; }
        var n = fileName.toLowerCase();
        if (n.indexOf("indep-general") >= 0) { return PREFType.PREF_Type_MACHINE_INDEPENDENT; }
        if (n.indexOf("indep-render") >= 0) { return PREFType.PREF_Type_MACHINE_INDEPENDENT_RENDER; }
        if (n.indexOf("indep-output") >= 0) { return PREFType.PREF_Type_MACHINE_INDEPENDENT_OUTPUT; }
        if (n.indexOf("indep-composition") >= 0) { return PREFType.PREF_Type_MACHINE_INDEPENDENT_COMPOSITION; }
        if (n.indexOf("text") >= 0) { return PREFType.PREF_Type_MACHINE_SPECIFIC_TEXT; }
        if (n.indexOf("paint") >= 0) { return PREFType.PREF_Type_MACHINE_SPECIFIC_PAINT; }
        return PREFType.PREF_Type_MACHINE_SPECIFIC;
    }

    function prefsFolder() {
        var base = new Folder(Folder.userData.fsName + "/Adobe/After Effects");
        if (!base.exists) { return null; }
        var want = String(app.version).replace(/x.*$/, "");      // e.g. 26.5
        var major = want.split(".")[0];
        var subs = base.getFiles();
        var best = null;
        for (var i = 0; i < subs.length; i++) {
            if (!(subs[i] instanceof Folder)) { continue; }
            var name = File.decode(subs[i].name);
            if (name === want) { return subs[i]; }
            if (name.split(".")[0] === major) { best = subs[i]; }
        }
        return best;
    }

    function homeScreenOff() {
        if (MNR_KEEP_HOME_SCREEN) { return; }
        var folder = prefsFolder();
        if (!folder) { log("home screen: preferences folder not found"); return; }
        var files = folder.getFiles("*.txt");
        for (var i = 0; i < files.length; i++) {
            var f = files[i];
            if (!(f instanceof File) || !f.open("r")) { continue; }
            var section = "";
            var found = null;
            while (!f.eof) {
                var line = f.readln();
                var s = line.match(/^\s*\["([^"]+)"\]/);
                if (s) { section = s[1]; continue; }
                var k = line.match(/^\s*"([^"]*[Hh]ome\s*[Ss]creen[^"]*)"\s*=\s*(\S+)/);
                if (k && /enable|show|launch/i.test(k[1])) {
                    found = { section: section, key: k[1], value: k[2] };
                    break;
                }
            }
            f.close();
            if (!found) { continue; }
            var fileName = File.decode(f.name);
            var on = !/^0+$/.test(found.value) && !/^false$/i.test(found.value);
            if (!on) { return; }                       // already off, nothing to do
            var type = prefTypeFor(fileName);
            try {
                if (type === null) {
                    app.preferences.savePrefAsBool(found.section, found.key, false);
                } else {
                    app.preferences.savePrefAsBool(found.section, found.key, false, type);
                }
                app.preferences.saveToDisk();
                log("home screen: turned off [" + found.section + "] \"" + found.key + "\" in " + fileName);
            } catch (e) {
                log("home screen: found [" + found.section + "] \"" + found.key + "\" in " + fileName +
                    " but could not change it: " + e.toString());
            }
            return;
        }
        log("home screen: setting not found, turn it off by hand in " +
            "Preferences > Startup and Repair > Enable Home Screen");
    }

    try { homeScreenOff(); } catch (e) { log("home screen: " + e.toString()); }

    try {
        app.scheduleTask("try { $.global.mnrSceneManagerStartupOpen(); } catch (e) {}", OPEN_DELAY_MS, false);
    } catch (e) {
        log("could not schedule the Scene Manager: " + e.toString());
    }

})();
