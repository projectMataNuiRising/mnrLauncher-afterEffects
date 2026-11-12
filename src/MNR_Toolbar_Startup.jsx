/*
    MNR Toolbar - startup
    ---------------------
    Installed by MNR Launcher into After Effects' Scripts\Startup folder,
    which After Effects runs every time it starts.

    Opens the MNR Toolbar once After Effects has finished starting, unless
    the workspace already opened it (docked). It opens the same way as
    Window > MNR_Toolbar.jsx, so it comes up where it was last docked.
    Scripts cannot choose where a panel docks: drag it to the top once and
    After Effects keeps it there. Logged to
    %APPDATA%\MNR_Launcher\ae_startup.log.

    Written for ExtendScript (ES3).
*/

(function () {

    var OPEN_DELAY_MS = 3000;
    var PANEL_FILE = "MNR_Toolbar.jsx";

    function log(text) {
        try {
            var folder = new Folder(Folder.userData.fsName + "/MNR_Launcher");
            if (!folder.exists) { folder.create(); }
            var f = new File(folder.fsName + "/ae_startup.log");
            f.encoding = "UTF-8";
            if (f.open("a")) {
                f.writeln(new Date().toString() + "  toolbar: " + text);
                f.close();
            }
        } catch (e) { /* logging is never worth failing over */ }
    }

    function findPanel() {
        var dirs = [];
        try { dirs.push(Folder.startup.fsName + "/Scripts/ScriptUI Panels/"); } catch (e) {}
        try {
            var base = new Folder(Folder.userData.fsName + "/Adobe/After Effects");
            var major = String(app.version).split(".")[0];
            var subs = base.exists ? base.getFiles() : [];
            for (var i = 0; i < subs.length; i++) {
                if (subs[i] instanceof Folder && File.decode(subs[i].name).split(".")[0] === major) {
                    dirs.push(subs[i].fsName + "/Scripts/ScriptUI Panels/");
                }
            }
        } catch (e2) {}
        for (var j = 0; j < dirs.length; j++) {
            var f = new File(dirs[j] + PANEL_FILE);
            if (f.exists) { return f; }
        }
        return null;
    }

    // Run by app.scheduleTask once After Effects has finished starting.
    $.global.mnrToolbarStartupOpen = function () {
        try {
            if ($.global.mnrToolbarDocked) { log("already open in the workspace"); return; }
            var w = $.global.mnrToolbarWindow;
            if (w && w.visible) { return; }
            var id = 0;
            try { id = app.findMenuCommandId(PANEL_FILE); } catch (e) {}
            if (id) {
                app.executeCommand(id);
                log("opened from the Window menu");
                return;
            }
            var panel = findPanel();
            if (!panel) { log("could not find " + PANEL_FILE); return; }
            $.evalFile(panel);
            log("opened as a window from " + panel.fsName);
        } catch (e2) {
            log("could not open: " + e2.toString());
        }
    };

    try {
        app.scheduleTask("try { $.global.mnrToolbarStartupOpen(); } catch (e) {}", OPEN_DELAY_MS, false);
    } catch (e) {
        log("could not schedule: " + e.toString());
    }

})();
