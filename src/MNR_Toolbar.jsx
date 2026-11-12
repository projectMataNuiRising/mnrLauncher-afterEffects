/* MNR Toolbar (After Effects). Notes below. */
(function (thisObj) {

    /*
        MNR Toolbar  (After Effects)
        ----------------------------
        Project Mata Nui Rising. A shelf of icon buttons for the MNR tools,
        like the shelves in Maya and Houdini. Dock it once (top or side of
        the workspace) and it stays there with the workspace.

        Open it from Window > MNR_Toolbar.jsx. Installed by MNR Launcher
        with the other MNR panels.

        BUTTONS

            Scene Manager     opens the MNR Scene Manager panel
            AE Exporter       opens the MNR AE Exporter panel
            Relink            looks for missing footage that was moved or
                              renamed (MNR_Relink_Startup.jsx)
            Project Settings  sets the MNR project settings on the open
                              project (MNR_Project_Settings_Startup.jsx)

        Panels open through the Window menu (the same as picking them
        there), else as their own window. Hover a button for its name.

        The icons are drawn in code, so there are no image files to
        install, and they stay sharp at any screen scale. The bar turns
        into a column when the panel is docked taller than it is wide.
    */

    var PANEL_NAME = "MNR Toolbar";
    var BUTTON = 34;            // button size in pixels
    var C_BG = [0.16, 0.16, 0.16, 1];
    var C_HOVER = [0.26, 0.26, 0.26, 1];
    var C_DOWN = [0.29, 0.56, 0.89, 1];
    var C_ICON = [0.85, 0.85, 0.85, 1];
    var C_ICON_HOVER = [1, 1, 1, 1];

    var SCRIPT_DIR = (function () {
        try { return new File($.fileName).parent.fsName; } catch (e) { return ""; }
    })();

    // ─────────────────────────────────────────────
    // Icons, drawn on a 24 x 24 grid
    // ─────────────────────────────────────────────

    function line(g, pts, k, ox, oy, close) {
        g.newPath();
        g.moveTo(ox + pts[0][0] * k, oy + pts[0][1] * k);
        for (var i = 1; i < pts.length; i++) { g.lineTo(ox + pts[i][0] * k, oy + pts[i][1] * k); }
        if (close) { g.closePath(); }
    }

    var ICONS = {
        sceneManager: function (g, k, ox, oy, pen) {
            // A folder.
            line(g, [[3, 6], [9, 6], [11, 8], [21, 8], [21, 19], [3, 19]], k, ox, oy, true);
            g.strokePath(pen);
            line(g, [[3, 11], [21, 11]], k, ox, oy, false);
            g.strokePath(pen);
        },
        exporter: function (g, k, ox, oy, pen) {
            // An arrow going up out of a tray (publish).
            line(g, [[4, 14], [4, 20], [20, 20], [20, 14]], k, ox, oy, false);
            g.strokePath(pen);
            line(g, [[12, 4], [12, 15]], k, ox, oy, false);
            g.strokePath(pen);
            line(g, [[7, 9], [12, 4], [17, 9]], k, ox, oy, false);
            g.strokePath(pen);
        },
        relink: function (g, k, ox, oy, pen) {
            // Two chain links.
            g.newPath();
            g.ellipsePath(ox + 2 * k, oy + 8 * k, 12 * k, 8 * k);
            g.strokePath(pen);
            g.newPath();
            g.ellipsePath(ox + 10 * k, oy + 8 * k, 12 * k, 8 * k);
            g.strokePath(pen);
        },
        settings: function (g, k, ox, oy, pen, bg) {
            // Three sliders.
            var rows = [[6, 8], [12, 16], [18, 10]];
            for (var i = 0; i < rows.length; i++) {
                var y = rows[i][0], x = rows[i][1];
                line(g, [[3, y], [21, y]], k, ox, oy, false);
                g.strokePath(pen);
                g.newPath();
                g.ellipsePath(ox + (x - 2.5) * k, oy + (y - 2.5) * k, 5 * k, 5 * k);
                g.fillPath(bg);
                g.newPath();
                g.ellipsePath(ox + (x - 2.5) * k, oy + (y - 2.5) * k, 5 * k, 5 * k);
                g.strokePath(pen);
            }
        }
    };

    function iconButton(parent, icon, tip, onClick) {
        var b = parent.add("button", undefined, "");
        b.preferredSize = [BUTTON, BUTTON];
        b.helpTip = tip;
        b.onDraw = function (state) {
            var g = this.graphics;
            var w = this.size[0], h = this.size[1];
            var over = state && state.mouseOver, down = state && state.leftButtonPressed;
            var bgCol = down ? C_DOWN : (over ? C_HOVER : C_BG);
            var bg = g.newBrush(g.BrushType.SOLID_COLOR, bgCol);
            g.newPath();
            g.rectPath(0, 0, w, h);
            g.fillPath(bg);
            var k = (Math.min(w, h) - 8) / 24;
            var ox = (w - 24 * k) / 2, oy = (h - 24 * k) / 2;
            var pen = g.newPen(g.PenType.SOLID_COLOR, over || down ? C_ICON_HOVER : C_ICON, 2);
            try { ICONS[icon](g, k, ox, oy, pen, bg); } catch (e) {}
        };
        b.onClick = function () {
            try { onClick(); } catch (e) { alert(String(e.message || e), PANEL_NAME); }
        };
        return b;
    }

    // ─────────────────────────────────────────────
    // Actions
    // ─────────────────────────────────────────────

    function openPanel(fileName) {
        /* The same as picking it in the Window menu (docks where it was
           last); else runs it as its own window. */
        var id = 0;
        try { id = app.findMenuCommandId(fileName); } catch (e) {}
        if (id) {
            app.executeCommand(id);
            return;
        }
        var f = new File(SCRIPT_DIR + "/" + fileName);
        if (!f.exists) {
            alert(fileName + " is not installed.\n\nReinstall the AE plugin from MNR Launcher.", PANEL_NAME);
            return;
        }
        $.evalFile(f);
    }

    function needs(fn, file) {
        if (typeof $.global[fn] === "function") { return true; }
        alert(file + " did not load when After Effects started.\n\n" +
              "Reinstall the AE plugin from MNR Launcher, then restart After Effects.", PANEL_NAME);
        return false;
    }

    function relink() {
        if (!needs("mnrRelinkCheck", "MNR_Relink_Startup.jsx")) { return; }
        if (!app.project || !app.project.file) {
            alert("Open or save a project first.", PANEL_NAME);
            return;
        }
        $.global.mnrRelinkCheck(true);
    }

    function projectSettings() {
        if (!needs("mnrApplyProjectSettings", "MNR_Project_Settings_Startup.jsx")) { return; }
        if (!confirm("Set the MNR project settings on this project?\n\n" +
                "Timecode (Use Media Source), OCIO ACES 1.3 CG v1.0, 32 bpc,\n" +
                "Tetrahedral, working space ACEScg.", false, PANEL_NAME)) {
            return;
        }
        var r = $.global.mnrApplyProjectSettings("toolbar");
        var text = "Set " + r.done.length + " settings.";
        if (r.missed.length) {
            text += "\n\nThese need setting by hand in File > Project Settings:\n  " + r.missed.join("\n  ");
        }
        alert(text, PANEL_NAME);
    }

    // ─────────────────────────────────────────────
    // UI
    // ─────────────────────────────────────────────

    function buildUI(thisObj) {
        var win = thisObj instanceof Panel ? thisObj :
            new Window("palette", PANEL_NAME, undefined, { resizeable: true });
        win.margins = 4;
        win.spacing = 0;
        win.alignChildren = ["left", "top"];

        var bar = win.add("group");
        bar.orientation = "row";
        bar.spacing = 4;
        bar.margins = 0;
        bar.alignChildren = ["left", "center"];

        iconButton(bar, "sceneManager", "MNR Scene Manager\nOpen, save and version up shot files",
            function () { openPanel("MNR_Scene_Manager.jsx"); });
        iconButton(bar, "exporter", "MNR AE Exporter\nPublish renders: EXR, MP4 preview, proxy PNG",
            function () { openPanel("MNR_AE_Exporter.jsx"); });
        iconButton(bar, "relink", "Relink\nFind missing footage that was moved or renamed",
            relink);
        iconButton(bar, "settings", "Project Settings\nSet the MNR project settings on this project",
            projectSettings);

        function fit() {
            // A column when docked taller than wide, else a row.
            try {
                var vertical = win.size && win.size.height > win.size.width;
                var want = vertical ? "column" : "row";
                if (bar.orientation !== want) {
                    bar.orientation = want;
                    bar.alignChildren = vertical ? ["center", "top"] : ["left", "center"];
                }
            } catch (e) {}
            win.layout.layout(true);
            win.layout.resize();
        }
        win.onResizing = win.onResize = fit;
        win.layout.layout(true);
        return win;
    }

    // A floating window that is already open is brought forward.
    if (!(thisObj instanceof Panel)) {
        var existing = $.global.mnrToolbarWindow;
        if (existing && existing.visible) {
            try { existing.active = true; } catch (e) {}
            return;
        }
    }

    var built = buildUI(thisObj);
    if (built instanceof Window) {
        $.global.mnrToolbarWindow = built;
        built.onClose = function () {
            $.global.mnrToolbarWindow = null;
            return true;
        };
        built.show();
    }

})(this);
