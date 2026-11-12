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
            AE Importer       opens the MNR AE Importer panel
            AE Exporter       opens the MNR AE Exporter panel
            Missing Footage   looks for missing footage that was moved or
                              renamed (MNR_Relink_Startup.jsx)
            Project Settings  sets the MNR project settings on the open
                              project (MNR_Project_Settings_Startup.jsx)

        Panels open through the Window menu (the same as picking them
        there), else as their own window. Hover a button for its name.

        The icons are drawn in code (gradients as thin strips, as ScriptUI
        has no gradient brush), so there are no image files to install. The bar turns
        into a column when the panel is docked taller than it is wide.
    */

    var PANEL_NAME = "MNR Toolbar";
    var BUTTON = 36;            // button size in pixels

    // After Effects greys and blue. Pairs are [top, bottom] of a gradient.
    var BG = [[0.21, 0.21, 0.21], [0.16, 0.16, 0.16]];
    var BG_HOVER = [[0.31, 0.31, 0.31], [0.24, 0.24, 0.24]];
    var BG_DOWN = [[0.25, 0.45, 0.72], [0.17, 0.34, 0.58]];
    var GREY = [[0.90, 0.90, 0.90], [0.66, 0.66, 0.66]];
    var GREY_DARK = [[0.56, 0.56, 0.56], [0.42, 0.42, 0.42]];
    var BLUE = [[0.50, 0.72, 1.00], [0.20, 0.45, 0.85]];
    var ORANGE = [[1.00, 0.76, 0.32], [0.90, 0.52, 0.12]];
    var GREEN = [[0.52, 0.92, 0.58], [0.20, 0.64, 0.34]];
    var BARS = [[0.80, 0.80, 0.80], [0.82, 0.77, 0.36], [0.36, 0.74, 0.78],
                [0.38, 0.70, 0.40], [0.74, 0.40, 0.70], [0.76, 0.38, 0.36]];

    var SCRIPT_DIR = (function () {
        try { return new File($.fileName).parent.fsName; } catch (e) { return ""; }
    })();

    // ─────────────────────────────────────────────
    // Drawing. ScriptUI has no gradient brush, so gradients are drawn as
    // thin horizontal strips. Icons are drawn on a 24 x 24 grid.
    // ─────────────────────────────────────────────

    function mix(a, b, t, lift) {
        var out = [];
        for (var i = 0; i < 3; i++) { out.push(Math.min(1, (a[i] + (b[i] - a[i]) * t) * lift)); }
        out.push(1);
        return out;
    }

    function Painter(g, k, ox, oy, lift) {
        this.g = g; this.k = k; this.ox = ox; this.oy = oy; this.lift = lift;
    }

    Painter.prototype.x = function (v) { return this.ox + v * this.k; };
    Painter.prototype.y = function (v) { return this.oy + v * this.k; };

    Painter.prototype.grad = function (y0, y1, span, cols) {
        /* Fills from y0 to y1 (grid units); span(y) gives [left, right] at
           that height; cols is [top colour, bottom colour]. */
        var g = this.g;
        var n = Math.max(2, Math.ceil((y1 - y0) * this.k));
        var h = (y1 - y0) / n;
        for (var i = 0; i < n; i++) {
            var y = y0 + h * i;
            var s = span(y + h / 2);
            if (!s || s[1] <= s[0]) { continue; }
            g.newPath();
            g.rectPath(this.x(s[0]), this.y(y), (s[1] - s[0]) * this.k, h * this.k + (i < n - 1 ? 0.6 : 0));
            g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, mix(cols[0], cols[1], i / (n - 1), this.lift)));
        }
    };

    Painter.prototype.rect = function (x0, y0, x1, y1, cols) {
        this.grad(y0, y1, function () { return [x0, x1]; }, cols);
    };

    Painter.prototype.circle = function (cx, cy, r, cols) {
        this.grad(cy - r, cy + r, function (y) {
            var d = r * r - (y - cy) * (y - cy);
            if (d <= 0) { return null; }
            d = Math.sqrt(d);
            return [cx - d, cx + d];
        }, cols);
    };

    function roundSpan(x0, x1, y0, y1, r) {
        // [left, right] of a rounded rectangle at height y.
        return function (y) {
            var dy = y < y0 + r ? y0 + r - y : (y > y1 - r ? y - (y1 - r) : 0);
            var inset = dy > 0 ? r - Math.sqrt(Math.max(0, r * r - dy * dy)) : 0;
            return [x0 + inset, x1 - inset];
        };
    }

    var ICONS = {
        sceneManager: function (p) {
            // An open folder: dark back with its tab, light front flap.
            p.grad(5, 19, function (y) { return y < 7.5 ? [3, 9 + (y - 5)] : [3, 21]; }, GREY_DARK);
            p.grad(10, 19, function (y) {
                var t = (y - 10) / 9;
                return [6 - 3 * t, 23 - 2 * t];
            }, GREY);
        },
        importer: function (p) {
            // A green arrow coming down into a tray (import).
            p.rect(3, 13, 5.5, 21, GREY);
            p.rect(18.5, 13, 21, 21, GREY);
            p.rect(3, 18.5, 21, 21, GREY);
            p.grad(2, 17, function (y) {
                if (y < 9) { return [10, 14]; }
                var w = 7 * (17 - y) / 8;
                return [12 - w, 12 + w];
            }, GREEN);
        },
        exporter: function (p) {
            // A blue arrow going up out of a tray (publish).
            p.rect(3, 13, 5.5, 21, GREY);
            p.rect(18.5, 13, 21, 21, GREY);
            p.rect(3, 18.5, 21, 21, GREY);
            p.grad(2, 16.5, function (y) {
                if (y < 10) { var w = 7 * (y - 2) / 8; return [12 - w, 12 + w]; }
                return [10, 14];
            }, BLUE);
        },
        relink: function (p, bg) {
            // A footage tile showing colour bars (After Effects' missing
            // footage), with an orange ? badge.
            var tile = roundSpan(2, 20, 3, 16, 1.5);
            p.grad(3, 16, tile, GREY_DARK);
            for (var i = 0; i < BARS.length; i++) {
                var x0 = 3.2 + i * 2.6;
                var c = BARS[i];
                p.rect(x0, 4.2, x0 + 2.6, 14.8, [c, [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8]]);
            }
            p.circle(16.5, 16.5, 7.2, [bg, bg]);
            p.circle(16.5, 16.5, 6, ORANGE);
            var g = p.g;
            var size = Math.round(10 * p.k);
            var font;
            try { font = ScriptUI.newFont("Arial", "BOLD", size); } catch (e) { font = g.font; }
            var pen = g.newPen(g.PenType.SOLID_COLOR, [0.13, 0.13, 0.13, 1], 1);
            var m = g.measureString("?", font);
            g.drawString("?", pen, p.x(16.5) - m[0] / 2, p.y(16.6) - m[1] / 2, font);
        },
        settings: function (p, bg) {
            // Three sliders with blue knobs.
            var rows = [[6, 8], [12, 16], [18, 11]];
            for (var i = 0; i < rows.length; i++) {
                var y = rows[i][0], x = rows[i][1];
                p.rect(3, y - 1, 21, y + 1, GREY);
                p.circle(x, y, 4, [bg, bg]);
                p.circle(x, y, 3.1, BLUE);
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
            var bgCols = down ? BG_DOWN : (over ? BG_HOVER : BG);
            var lift = over || down ? 1.12 : 1;
            // Rounded tile, lighter at the top.
            var tile = new Painter(g, 1, 0, 0, 1);
            tile.grad(0, h, roundSpan(0, w, 0, h, 4), bgCols);
            var k = (Math.min(w, h) - 8) / 24;
            var p = new Painter(g, k, (w - 24 * k) / 2, (h - 24 * k) / 2, lift);
            // Colour behind the icon at its middle, for cut-out edges.
            var mid = mix(bgCols[0], bgCols[1], 0.6, 1);
            try { ICONS[icon](p, mid); } catch (e) {}
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
        iconButton(bar, "importer", "MNR AE Importer\nBring in the shot's TIFF sequences, with comps",
            function () { openPanel("MNR_AE_Importer.jsx"); });
        iconButton(bar, "exporter", "MNR AE Exporter\nPublish renders: EXR, MP4 preview, proxy PNG",
            function () { openPanel("MNR_AE_Exporter.jsx"); });
        iconButton(bar, "relink", "Find Missing Footage\nRelink footage that was moved or renamed",
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
