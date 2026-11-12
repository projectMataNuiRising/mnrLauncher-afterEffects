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
        there), else as their own window. Hover a button for what it does.

        MNR_Toolbar_Startup.jsx (in Scripts\Startup) opens it when After
        Effects starts, if the workspace did not already. Where it docks
        cannot be set by a script: dock it once and After Effects keeps it
        there in the workspace.

        The icons are drawn in code (gradients as thin strips, as ScriptUI
        has no gradient brush), so there are no image files to install. The bar turns
        into a column when the panel is docked taller than it is wide.
    */

    var PANEL_NAME = "MNR Toolbar";
    var ICON = 38;              // icon size in pixels
    var TILE_H = 62;            // button height: icon + name
    var TILE_MIN_W = 64;        // narrowest button
    var C_NAME = [0.78, 0.78, 0.78, 1];
    var C_NAME_HOVER = [1, 1, 1, 1];

    // After Effects greys and blue. Pairs are [top, bottom] of a gradient.
    var BG = [[0.21, 0.21, 0.21], [0.16, 0.16, 0.16]];
    var BG_HOVER = [[0.31, 0.31, 0.31], [0.24, 0.24, 0.24]];
    var BG_DOWN = [[0.25, 0.45, 0.72], [0.17, 0.34, 0.58]];
    var GREY = [[0.90, 0.90, 0.90], [0.66, 0.66, 0.66]];
    var GREY_DARK = [[0.56, 0.56, 0.56], [0.42, 0.42, 0.42]];
    var BLUE = [[0.50, 0.72, 1.00], [0.20, 0.45, 0.85]];
    var ORANGE = [[1.00, 0.76, 0.32], [0.90, 0.52, 0.12]];
    var GREEN = [[0.52, 0.92, 0.58], [0.20, 0.64, 0.34]];
    var GREEN_MID = [[0.34, 0.70, 0.40], [0.18, 0.48, 0.25]];
    var GREEN_BACK = [[0.24, 0.50, 0.29], [0.14, 0.34, 0.18]];
    var FRAME_EDGE = [[0.10, 0.10, 0.10], [0.08, 0.08, 0.08]];
    var CLAY = [[0.98, 0.74, 0.52], [0.80, 0.50, 0.30]];
    var CHECK_LIGHT = [[0.80, 0.80, 0.80], [0.70, 0.70, 0.70]];
    var CHECK_DARK = [[0.50, 0.50, 0.50], [0.42, 0.42, 0.42]];
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

    function puppet(p, cx, top, bottom) {
        /* A little stop-motion puppet: head and shoulders, clay coloured. */
        var h = bottom - top;
        var hr = h * 0.17, hy = top + h * 0.30;
        p.circle(cx, hy, hr, CLAY);
        var y0 = hy + hr * 1.15;
        p.grad(y0, bottom, function (y) {
            var t = (y - y0) / (bottom - y0);
            var w = hr * (0.9 + 1.3 * Math.min(1, t * 2.2));
            return [cx - w, cx + w];
        }, CLAY);
    }

    function arrowRight(p, x0, x1, cy, shaft, half, cols) {
        /* An arrow pointing right from x0 to x1 at height cy. */
        var head = x1 - half * 1.3;
        p.grad(cy - half, cy + half, function (y) {
            var dy = Math.abs(y - cy);
            var tip = head + (x1 - head) * (1 - dy / half);
            return dy <= shaft ? [x0, tip] : [head, tip];
        }, cols);
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
            // A stack of green screen frames (an image sequence) with a
            // puppet on the front one, and an arrow coming in.
            var frames = [[12.5, 4.5, 23.3, 13.5, GREEN_BACK], [10, 7, 20.8, 16, GREEN_MID],
                          [7.5, 9.5, 18.3, 18.5, GREEN]];
            for (var i = 0; i < frames.length; i++) {
                var f = frames[i];
                p.rect(f[0] - 0.7, f[1] - 0.7, f[2] + 0.7, f[3] + 0.7, FRAME_EDGE);
                p.rect(f[0], f[1], f[2], f[3], f[4]);
            }
            puppet(p, 12.9, 11.2, 18.5);
            arrowRight(p, 0.2, 7, 14, 1.4, 3.8, GREY);
        },
        exporter: function (p) {
            // A keyed frame (the puppet on transparency) with an arrow
            // going out.
            p.rect(0.3, 4.3, 14.7, 18.7, FRAME_EDGE);
            var sq = 2.4;
            for (var y = 0; y < 6; y++) {
                for (var x = 0; x < 6; x++) {
                    var c = (x + y) % 2 ? CHECK_DARK : CHECK_LIGHT;
                    p.rect(1 + x * sq, 5 + y * sq, 1 + (x + 1) * sq, 5 + (y + 1) * sq, c);
                }
            }
            puppet(p, 8.2, 8.5, 18.4);
            arrowRight(p, 15.4, 23.7, 11.6, 1.5, 4.3, BLUE);
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

    function nameFont(g) {
        try { return ScriptUI.newFont(g.font.name, ScriptUI.FontStyle.REGULAR, 11); } catch (e) { return g.font; }
    }

    function iconButton(parent, icon, name, tip, onClick) {
        /* A tile: the icon with the tool's name under it. */
        var b = parent.add("button", undefined, "");
        var textW = name.length * 6;
        try { textW = b.graphics.measureString(name, nameFont(b.graphics))[0]; } catch (e) {}
        b.preferredSize = [Math.max(TILE_MIN_W, Math.ceil(textW) + 14), TILE_H];
        b.helpTip = tip;
        b.onDraw = function (state) {
            var g = this.graphics;
            var w = this.size[0], h = this.size[1];
            var over = state && state.mouseOver, down = state && state.leftButtonPressed;
            var bgCols = down ? BG_DOWN : (over ? BG_HOVER : BG);
            var lift = over || down ? 1.12 : 1;
            // Rounded tile, lighter at the top.
            var tile = new Painter(g, 1, 0, 0, 1);
            tile.grad(0, h, roundSpan(0, w, 0, h, 5), bgCols);
            var k = ICON / 24;
            var p = new Painter(g, k, (w - ICON) / 2, 3, lift);
            // Colour behind the icon at its middle, for cut-out edges.
            var mid = mix(bgCols[0], bgCols[1], 0.35, 1);
            try { ICONS[icon](p, mid); } catch (e) {}
            // The name, under the icon.
            try {
                var font = nameFont(g);
                var size = g.measureString(name, font);
                var pen = g.newPen(g.PenType.SOLID_COLOR, over || down ? C_NAME_HOVER : C_NAME, 1);
                g.drawString(name, pen, (w - size[0]) / 2, h - size[1] - 5, font);
            } catch (e2) {}
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

        iconButton(bar, "sceneManager", "Scene Manager", "MNR Scene Manager\nOpen, save and version up shot files",
            function () { openPanel("MNR_Scene_Manager.jsx"); });
        iconButton(bar, "importer", "Importer", "MNR AE Importer\nBring in the shot's TIFF sequences, with comps",
            function () { openPanel("MNR_AE_Importer.jsx"); });
        iconButton(bar, "exporter", "Exporter", "MNR AE Exporter\nPublish renders: EXR, MP4 preview, proxy PNG",
            function () { openPanel("MNR_AE_Exporter.jsx"); });
        iconButton(bar, "relink", "Missing Footage", "Find Missing Footage\nRelink footage that was moved or renamed",
            relink);
        iconButton(bar, "settings", "Project Settings", "Project Settings\nSet the MNR project settings on this project",
            projectSettings);

        // Every tile as wide as the widest name.
        var widest = 0, i;
        for (i = 0; i < bar.children.length; i++) { widest = Math.max(widest, bar.children[i].preferredSize[0]); }
        for (i = 0; i < bar.children.length; i++) { bar.children[i].preferredSize = [widest, TILE_H]; }

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
    // Lets MNR_Toolbar_Startup.jsx know it is already open.
    if (built instanceof Panel) { $.global.mnrToolbarDocked = true; }
    if (built instanceof Window) {
        $.global.mnrToolbarWindow = built;
        built.onClose = function () {
            $.global.mnrToolbarWindow = null;
            return true;
        };
        built.show();
    }

})(this);
