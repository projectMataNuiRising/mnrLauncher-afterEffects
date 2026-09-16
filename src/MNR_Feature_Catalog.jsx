/*
    MNR Feature Catalog
    ===================

    A showroom, not a tool. Every widget ScriptUI can draw and a wide
    spread of things After Effects scripting can actually do, each one
    numbered so it can be pointed at by name:

        UI-nn   a widget type, to judge how it looks and behaves
        PRJ-nn  project level actions (colour management, settings)
        CMP-nn  composition actions
        RQ-nn   render queue and output actions
        LYR-nn  layer creation and manipulation
        ORG-nn  import and organisation
        INF-nn  read only inspection, safe to click blindly
        DLG-nn  dialog styles

    Nothing here is meant to survive into the real panel as is. Pick the
    widgets and the actions that matter and the real one gets built from
    that shortlist.

    SAFETY
      Every action that changes the project is wrapped in an undo group,
      so Ctrl+Z steps back out of it. Anything genuinely destructive
      asks first. INF items only read.

    LIMITS WORTH KNOWING
      ScriptUI draws native widgets only. No custom colours on most
      controls, no rounded corners, no icons beyond images you ship, no
      animation, no HTML. If the layout you want is not in the UI tab,
      it probably needs a CEP extension instead, which is a full HTML
      panel.
*/

(function (thisObj) {

    var PANEL_NAME = "MNR Feature Catalog";
    var CATALOG_VERSION = "0.1.0";

    // ----------------------------------------------------------------
    // helpers
    // ----------------------------------------------------------------

    var logBox = null;

    function log(msg) {
        try {
            if (logBox) {
                var stamp = new Date().toTimeString().substr(0, 8);
                logBox.text = "[" + stamp + "] " + msg + "\n" + logBox.text;
            }
        } catch (e) {}
    }

    function safe(label, fn) {
        // Every demo action runs through here: one undo group, and a
        // failure reports itself instead of throwing a raw stack trace
        // at whoever clicked it.
        return function () {
            try {
                app.beginUndoGroup("MNR Catalog: " + label);
                var result = fn();
                app.endUndoGroup();
                log(label + (result ? " -> " + result : " -> done"));
            } catch (e) {
                try { app.endUndoGroup(); } catch (e2) {}
                log("FAILED " + label + ": " + e.toString());
            }
        };
    }

    function activeComp() {
        var item = app.project.activeItem;
        if (item && item instanceof CompItem) return item;
        throw new Error("No composition is active. Open one first.");
    }

    function btn(parent, id, label, onClick, help) {
        var g = parent.add("group");
        g.orientation = "row";
        g.alignChildren = ["left", "center"];
        g.spacing = 6;

        var tag = g.add("statictext", undefined, id);
        tag.preferredSize.width = 56;

        var b = g.add("button", undefined, label);
        b.preferredSize.width = 200;
        if (help) b.helpTip = help;
        b.onClick = onClick;
        return b;
    }

    function header(parent, text) {
        var t = parent.add("statictext", undefined, text);
        try {
            t.graphics.font = ScriptUI.newFont(
                t.graphics.font.name, ScriptUI.FontStyle.BOLD, 12);
        } catch (e) {}
        return t;
    }

    function note(parent, text) {
        var t = parent.add("statictext", undefined, text, { multiline: true });
        t.alignment = ["fill", "top"];
        return t;
    }

    // ----------------------------------------------------------------
    // build
    // ----------------------------------------------------------------

    function build(thisObj) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", PANEL_NAME, undefined, { resizeable: true });

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 6;
        win.margins = 10;

        var title = win.add("statictext", undefined,
            "MNR Feature Catalog  v" + CATALOG_VERSION);
        try {
            title.graphics.font = ScriptUI.newFont(
                title.graphics.font.name, ScriptUI.FontStyle.BOLD, 14);
        } catch (e) {}

        var tabs = win.add("tabbedpanel");
        tabs.alignChildren = ["fill", "fill"];
        tabs.preferredSize.height = 420;

        buildUITab(tabs.add("tab", undefined, "UI"));
        buildProjectTab(tabs.add("tab", undefined, "Project"));
        buildCompTab(tabs.add("tab", undefined, "Comp"));
        buildRenderTab(tabs.add("tab", undefined, "Render"));
        buildLayerTab(tabs.add("tab", undefined, "Layers"));
        buildOrganiseTab(tabs.add("tab", undefined, "Organise"));
        buildInfoTab(tabs.add("tab", undefined, "Info"));
        buildDialogTab(tabs.add("tab", undefined, "Dialogs"));

        tabs.selection = 0;

        // shared log, so any click shows what happened
        var logPanel = win.add("panel", undefined, "Log");
        logPanel.alignChildren = ["fill", "fill"];
        logPanel.margins = 8;
        logBox = logPanel.add("edittext", undefined, "", {
            multiline: true, readonly: true, scrolling: true
        });
        logBox.preferredSize.height = 90;

        var logRow = logPanel.add("group");
        logRow.alignment = ["right", "top"];
        var clearBtn = logRow.add("button", undefined, "Clear Log");
        clearBtn.onClick = function () { logBox.text = ""; };

        win.layout.layout(true);
        win.layout.resize();
        win.onResizing = win.onResize = function () { this.layout.resize(); };
        return win;
    }

    // ----------------------------------------------------------------
    // UI tab: every widget ScriptUI can draw
    // ----------------------------------------------------------------

    function buildUITab(tab) {
        tab.orientation = "column";
        tab.alignChildren = ["fill", "top"];
        tab.spacing = 4;
        tab.margins = 10;

        var sc = tab.add("group");
        sc.orientation = "column";
        sc.alignChildren = ["fill", "top"];

        note(sc, "Every control ScriptUI can draw. Judge look and feel here, " +
                 "then say which numbers you want in the real panel.");

        // UI-01 static text
        var g1 = sc.add("group"); g1.alignChildren = ["left", "center"];
        g1.add("statictext", undefined, "UI-01").preferredSize.width = 56;
        g1.add("statictext", undefined, "Static text, plain label");

        // UI-02 bold text
        var g2 = sc.add("group"); g2.alignChildren = ["left", "center"];
        g2.add("statictext", undefined, "UI-02").preferredSize.width = 56;
        var boldT = g2.add("statictext", undefined, "Static text, bold");
        try { boldT.graphics.font = ScriptUI.newFont(boldT.graphics.font.name, ScriptUI.FontStyle.BOLD, 12); } catch (e) {}

        // UI-03 coloured text
        var g3 = sc.add("group"); g3.alignChildren = ["left", "center"];
        g3.add("statictext", undefined, "UI-03").preferredSize.width = 56;
        var colT = g3.add("statictext", undefined, "Static text, coloured (green)");
        try {
            colT.graphics.foregroundColor =
                colT.graphics.newPen(colT.graphics.PenType.SOLID_COLOR, [0.35, 0.78, 0.5, 1], 1);
        } catch (e) {}

        // UI-04 button
        var g4 = sc.add("group"); g4.alignChildren = ["left", "center"];
        g4.add("statictext", undefined, "UI-04").preferredSize.width = 56;
        var b4 = g4.add("button", undefined, "Standard button");
        b4.preferredSize.width = 200;
        b4.onClick = function () { log("UI-04 button pressed"); };

        // UI-05 checkbox
        var g5 = sc.add("group"); g5.alignChildren = ["left", "center"];
        g5.add("statictext", undefined, "UI-05").preferredSize.width = 56;
        var cb = g5.add("checkbox", undefined, "Checkbox");
        cb.value = true;
        cb.onClick = function () { log("UI-05 checkbox = " + cb.value); };

        // UI-06 radio buttons
        var g6 = sc.add("group"); g6.alignChildren = ["left", "center"];
        g6.add("statictext", undefined, "UI-06").preferredSize.width = 56;
        var r1 = g6.add("radiobutton", undefined, "Radio A");
        var r2 = g6.add("radiobutton", undefined, "Radio B");
        var r3 = g6.add("radiobutton", undefined, "Radio C");
        r1.value = true;
        r1.onClick = r2.onClick = r3.onClick = function () { log("UI-06 radio changed"); };

        // UI-07 dropdown
        var g7 = sc.add("group"); g7.alignChildren = ["left", "center"];
        g7.add("statictext", undefined, "UI-07").preferredSize.width = 56;
        var dd = g7.add("dropdownlist", undefined, ["Option one", "Option two", "Option three"]);
        dd.selection = 0;
        dd.preferredSize.width = 200;
        dd.onChange = function () { log("UI-07 dropdown = " + dd.selection.text); };

        // UI-08 single line text field
        var g8 = sc.add("group"); g8.alignChildren = ["left", "center"];
        g8.add("statictext", undefined, "UI-08").preferredSize.width = 56;
        var et = g8.add("edittext", undefined, "Editable text field");
        et.preferredSize.width = 200;
        et.onChange = function () { log("UI-08 text = " + et.text); };

        // UI-09 multiline text
        var g9 = sc.add("group"); g9.alignChildren = ["left", "top"];
        g9.add("statictext", undefined, "UI-09").preferredSize.width = 56;
        var mt = g9.add("edittext", undefined, "Multiline\ntext area", { multiline: true });
        mt.preferredSize = [200, 48];

        // UI-10 slider
        var g10 = sc.add("group"); g10.alignChildren = ["left", "center"];
        g10.add("statictext", undefined, "UI-10").preferredSize.width = 56;
        var sl = g10.add("slider", undefined, 50, 0, 100);
        sl.preferredSize.width = 150;
        var slVal = g10.add("statictext", undefined, "50  ");
        slVal.preferredSize.width = 40;
        sl.onChanging = function () { slVal.text = Math.round(sl.value) + ""; };

        // UI-11 progress bar
        var g11 = sc.add("group"); g11.alignChildren = ["left", "center"];
        g11.add("statictext", undefined, "UI-11").preferredSize.width = 56;
        var pb = g11.add("progressbar", undefined, 0, 100);
        pb.preferredSize.width = 150;
        pb.value = 35;
        var pbBtn = g11.add("button", undefined, "Run");
        pbBtn.preferredSize.width = 44;
        pbBtn.onClick = function () {
            for (var i = 0; i <= 100; i += 5) {
                pb.value = i;
                try { pb.window.update(); } catch (e) {}
                $.sleep(20);
            }
            log("UI-11 progress finished");
        };

        // UI-12 listbox
        var g12 = sc.add("group"); g12.alignChildren = ["left", "top"];
        g12.add("statictext", undefined, "UI-12").preferredSize.width = 56;
        var lb = g12.add("listbox", undefined, ["List row one", "List row two", "List row three"]);
        lb.preferredSize = [200, 60];
        lb.onChange = function () {
            if (lb.selection) log("UI-12 selected: " + lb.selection.text);
        };

        // UI-13 multi column listbox
        var g13 = sc.add("group"); g13.alignChildren = ["left", "top"];
        g13.add("statictext", undefined, "UI-13").preferredSize.width = 56;
        var mlb = g13.add("listbox", undefined, [], {
            numberOfColumns: 3,
            showHeaders: true,
            columnTitles: ["Name", "Type", "Frames"]
        });
        mlb.preferredSize = [260, 70];
        var rowsData = [["kopaka01", "cr2", "174"], ["solek01", "jpg", "174"], ["gali01", "mp4", "1"]];
        for (var i = 0; i < rowsData.length; i++) {
            var it = mlb.add("item", rowsData[i][0]);
            it.subItems[0].text = rowsData[i][1];
            it.subItems[1].text = rowsData[i][2];
        }

        // UI-14 checkbox list (multi select)
        var g14 = sc.add("group"); g14.alignChildren = ["left", "top"];
        g14.add("statictext", undefined, "UI-14").preferredSize.width = 56;
        var msl = g14.add("listbox", undefined,
            ["Multi select A", "Multi select B", "Multi select C"], { multiselect: true });
        msl.preferredSize = [200, 60];

        // UI-15 treeview
        var g15 = sc.add("group"); g15.alignChildren = ["left", "top"];
        g15.add("statictext", undefined, "UI-15").preferredSize.width = 56;
        var tv = g15.add("treeview", undefined);
        tv.preferredSize = [200, 80];
        var n1 = tv.add("node", "SQ08");
        n1.add("item", "SH07");
        n1.add("item", "SH08");
        n1.expanded = true;
        var n2 = tv.add("node", "SQ09");
        n2.add("item", "SH01");

        // UI-16 panel group box
        var g16 = sc.add("group"); g16.alignChildren = ["left", "top"];
        g16.add("statictext", undefined, "UI-16").preferredSize.width = 56;
        var pnl = g16.add("panel", undefined, "Panel with a title");
        pnl.preferredSize = [200, 56];
        pnl.alignChildren = ["fill", "top"];
        pnl.margins = 10;
        pnl.add("statictext", undefined, "Grouped content");

        // UI-17 separator
        var g17 = sc.add("group"); g17.alignChildren = ["left", "center"];
        g17.add("statictext", undefined, "UI-17").preferredSize.width = 56;
        g17.add("statictext", undefined, "Separator line below");
        var sep = sc.add("panel");
        sep.alignment = ["fill", "top"];
        sep.preferredSize.height = 2;

        // UI-18 icon button from a drawn image
        var g18 = sc.add("group"); g18.alignChildren = ["left", "center"];
        g18.add("statictext", undefined, "UI-18").preferredSize.width = 56;
        g18.add("statictext", undefined, "Icon buttons need a shipped image file");

        // UI-19 disabled state
        var g19 = sc.add("group"); g19.alignChildren = ["left", "center"];
        g19.add("statictext", undefined, "UI-19").preferredSize.width = 56;
        var dis = g19.add("button", undefined, "Disabled button");
        dis.preferredSize.width = 200;
        dis.enabled = false;

        // UI-20 row of small buttons
        var g20 = sc.add("group"); g20.alignChildren = ["left", "center"];
        g20.add("statictext", undefined, "UI-20").preferredSize.width = 56;
        var sb1 = g20.add("button", undefined, "A"); sb1.preferredSize.width = 34;
        var sb2 = g20.add("button", undefined, "B"); sb2.preferredSize.width = 34;
        var sb3 = g20.add("button", undefined, "C"); sb3.preferredSize.width = 34;
        var sb4 = g20.add("button", undefined, "D"); sb4.preferredSize.width = 34;

        // UI-21 two column layout
        var g21 = sc.add("group"); g21.alignChildren = ["left", "top"];
        g21.add("statictext", undefined, "UI-21").preferredSize.width = 56;
        var cols = g21.add("group");
        cols.orientation = "row";
        var colA = cols.add("group"); colA.orientation = "column"; colA.alignChildren = ["fill", "top"];
        colA.add("button", undefined, "Left column");
        colA.add("button", undefined, "Left again");
        var colB = cols.add("group"); colB.orientation = "column"; colB.alignChildren = ["fill", "top"];
        colB.add("button", undefined, "Right column");
        colB.add("button", undefined, "Right again");

        note(sc, "Not possible in ScriptUI: custom button colours, rounded corners, " +
                 "hover effects, animation, embedded web content, custom fonts beyond " +
                 "system ones. Those need a CEP extension.");
    }

    // ----------------------------------------------------------------
    // Project tab
    // ----------------------------------------------------------------

    function buildProjectTab(tab) {
        tab.orientation = "column";
        tab.alignChildren = ["fill", "top"];
        tab.spacing = 4;
        tab.margins = 10;

        header(tab, "Colour management");
        note(tab, "This is the group most relevant to forcing a project onto the " +
                  "pipeline colour setup at startup.");

        btn(tab, "PRJ-01", "List available colour profiles", safe("PRJ-01", function () {
            var list = app.project.listColorProfiles();
            log("Profiles available: " + list.length);
            for (var i = 0; i < list.length; i++) log("   " + list[i]);
            return list.length + " profiles, see log";
        }), "Shows every working space this install offers");

        btn(tab, "PRJ-02", "Show current working space", safe("PRJ-02", function () {
            return "working space: " + app.project.workingSpace +
                   " | gamma: " + app.project.workingGamma;
        }));

        btn(tab, "PRJ-03", "Set working space to first ACES found", safe("PRJ-03", function () {
            var list = app.project.listColorProfiles();
            for (var i = 0; i < list.length; i++) {
                if (list[i].toLowerCase().indexOf("aces") !== -1) {
                    app.project.workingSpace = list[i];
                    return "set to " + list[i];
                }
            }
            return "no ACES profile found on this machine";
        }), "Demonstrates forcing a colour space from script");

        btn(tab, "PRJ-04", "Set working gamma 1.0 (linear)", safe("PRJ-04", function () {
            app.project.workingGamma = 1.0;
            return "gamma 1.0";
        }));

        btn(tab, "PRJ-05", "Clear working space (none)", safe("PRJ-05", function () {
            app.project.workingSpace = "";
            return "colour management off";
        }));

        btn(tab, "PRJ-06", "Set bit depth 32 bpc", safe("PRJ-06", function () {
            app.project.bitsPerChannel = 32;
            return "32 bits per channel";
        }));

        btn(tab, "PRJ-07", "Set bit depth 16 bpc", safe("PRJ-07", function () {
            app.project.bitsPerChannel = 16;
            return "16 bits per channel";
        }));

        btn(tab, "PRJ-08", "Toggle linear blending", safe("PRJ-08", function () {
            app.project.linearBlending = !app.project.linearBlending;
            return "linear blending = " + app.project.linearBlending;
        }));

        header(tab, "Project file");

        btn(tab, "PRJ-09", "Save project", safe("PRJ-09", function () {
            app.project.save();
            return "saved";
        }));

        btn(tab, "PRJ-10", "Show project path", safe("PRJ-10", function () {
            return app.project.file ? app.project.file.fsName : "not saved yet";
        }));

        btn(tab, "PRJ-11", "Set frame rate of all comps to 24", safe("PRJ-11", function () {
            var n = 0;
            for (var i = 1; i <= app.project.numItems; i++) {
                var it = app.project.item(i);
                if (it instanceof CompItem) { it.frameRate = 24; n++; }
            }
            return n + " comps set to 24 fps";
        }));

        btn(tab, "PRJ-12", "Set project time display to frames", safe("PRJ-12", function () {
            app.project.timeDisplayType = TimeDisplayType.FRAMES;
            return "time display = frames";
        }));
    }

    // ----------------------------------------------------------------
    // Comp tab
    // ----------------------------------------------------------------

    function buildCompTab(tab) {
        tab.orientation = "column";
        tab.alignChildren = ["fill", "top"];
        tab.spacing = 4;
        tab.margins = 10;

        header(tab, "Creating comps");

        btn(tab, "CMP-01", "New comp 1920x1080 24fps 10s", safe("CMP-01", function () {
            var c = app.project.items.addComp("MNR_demo_HD", 1920, 1080, 1, 10, 24);
            c.openInViewer();
            return c.name;
        }));

        btn(tab, "CMP-02", "New comp 4K 24fps", safe("CMP-02", function () {
            var c = app.project.items.addComp("MNR_demo_4K", 3840, 2160, 1, 10, 24);
            return c.name;
        }));

        btn(tab, "CMP-03", "New comp from shot naming pattern", safe("CMP-03", function () {
            var c = app.project.items.addComp("MNR_SQ00_SH00_comp_v001", 1920, 1080, 1, 7.25, 24);
            return c.name;
        }), "Shows a comp created with a pipeline style name");

        header(tab, "Changing the active comp");

        btn(tab, "CMP-04", "Rename active comp", safe("CMP-04", function () {
            var c = activeComp();
            c.name = c.name + "_renamed";
            return c.name;
        }));

        btn(tab, "CMP-05", "Set active comp resolution to Half", safe("CMP-05", function () {
            var c = activeComp();
            c.resolutionFactor = [2, 2];
            return "half resolution";
        }));

        btn(tab, "CMP-06", "Set active comp resolution to Full", safe("CMP-06", function () {
            activeComp().resolutionFactor = [1, 1];
            return "full resolution";
        }));

        btn(tab, "CMP-07", "Set work area to full duration", safe("CMP-07", function () {
            var c = activeComp();
            c.workAreaStart = 0;
            c.workAreaDuration = c.duration;
            return "work area reset";
        }));

        btn(tab, "CMP-08", "Set comp background to mid grey", safe("CMP-08", function () {
            activeComp().bgColor = [0.5, 0.5, 0.5];
            return "background grey";
        }));

        btn(tab, "CMP-09", "Enable motion blur on comp", safe("CMP-09", function () {
            activeComp().motionBlur = true;
            return "motion blur on";
        }));

        btn(tab, "CMP-10", "Add comp marker at current time", safe("CMP-10", function () {
            var c = activeComp();
            var m = new MarkerValue("MNR marker");
            c.markerProperty.setValueAtTime(c.time, m);
            return "marker added";
        }));

        btn(tab, "CMP-11", "Duplicate active comp", safe("CMP-11", function () {
            var c = activeComp();
            var d = c.duplicate();
            return d.name;
        }));
    }

    // ----------------------------------------------------------------
    // Render tab
    // ----------------------------------------------------------------

    function buildRenderTab(tab) {
        tab.orientation = "column";
        tab.alignChildren = ["fill", "top"];
        tab.spacing = 4;
        tab.margins = 10;

        header(tab, "Render queue");
        note(tab, "The group behind an 'add render queue export settings' button.");

        btn(tab, "RQ-01", "Add active comp to render queue", safe("RQ-01", function () {
            var c = activeComp();
            var item = app.project.renderQueue.items.add(c);
            return "queued " + c.name;
        }));

        btn(tab, "RQ-02", "List render setting templates", safe("RQ-02", function () {
            var c = activeComp();
            var item = app.project.renderQueue.items.add(c);
            var t = item.templates;
            for (var i = 0; i < t.length; i++) log("   render template: " + t[i]);
            item.remove();
            return t.length + " templates, see log";
        }), "Shows which render setting presets exist here");

        btn(tab, "RQ-03", "List output module templates", safe("RQ-03", function () {
            var c = activeComp();
            var item = app.project.renderQueue.items.add(c);
            var t = item.outputModule(1).templates;
            for (var i = 0; i < t.length; i++) log("   output template: " + t[i]);
            item.remove();
            return t.length + " output templates, see log";
        }), "These are the names an auto setup would apply");

        btn(tab, "RQ-04", "Queue with Best Settings", safe("RQ-04", function () {
            var item = app.project.renderQueue.items.add(activeComp());
            item.applyTemplate("Best Settings");
            return "Best Settings applied";
        }));

        btn(tab, "RQ-05", "Queue and set output to a chosen folder", safe("RQ-05", function () {
            var folder = Folder.selectDialog("Pick an output folder");
            if (!folder) return "cancelled";
            var c = activeComp();
            var item = app.project.renderQueue.items.add(c);
            item.outputModule(1).file = new File(folder.fsName + "/" + c.name + "_[#####].exr");
            return folder.fsName;
        }), "Demonstrates driving the output path from script");

        btn(tab, "RQ-06", "Queue every comp in the project", safe("RQ-06", function () {
            var n = 0;
            for (var i = 1; i <= app.project.numItems; i++) {
                var it = app.project.item(i);
                if (it instanceof CompItem) { app.project.renderQueue.items.add(it); n++; }
            }
            return n + " comps queued";
        }));

        btn(tab, "RQ-07", "Add a second output module", safe("RQ-07", function () {
            var item = app.project.renderQueue.items.add(activeComp());
            item.outputModules.add();
            return "two output modules on one queue item";
        }), "One render, two deliverables");

        btn(tab, "RQ-08", "Clear the render queue", safe("RQ-08", function () {
            var rq = app.project.renderQueue;
            var n = rq.numItems;
            while (rq.numItems > 0) rq.item(1).remove();
            return n + " items removed";
        }));

        btn(tab, "RQ-09", "Show queue contents", safe("RQ-09", function () {
            var rq = app.project.renderQueue;
            for (var i = 1; i <= rq.numItems; i++) {
                log("   " + i + ": " + rq.item(i).comp.name + " status " + rq.item(i).status);
            }
            return rq.numItems + " items, see log";
        }));
    }

    // ----------------------------------------------------------------
    // Layers tab
    // ----------------------------------------------------------------

    function buildLayerTab(tab) {
        tab.orientation = "column";
        tab.alignChildren = ["fill", "top"];
        tab.spacing = 4;
        tab.margins = 10;

        header(tab, "Creating layers");

        btn(tab, "LYR-01", "Add null", safe("LYR-01", function () {
            return activeComp().layers.addNull().name;
        }));

        btn(tab, "LYR-02", "Add adjustment layer", safe("LYR-02", function () {
            var c = activeComp();
            var s = c.layers.addSolid([1, 1, 1], "MNR adjustment", c.width, c.height, 1);
            s.adjustmentLayer = true;
            return s.name;
        }));

        btn(tab, "LYR-03", "Add solid (mid grey)", safe("LYR-03", function () {
            var c = activeComp();
            return c.layers.addSolid([0.5, 0.5, 0.5], "MNR solid", c.width, c.height, 1).name;
        }));

        btn(tab, "LYR-04", "Add text layer", safe("LYR-04", function () {
            return activeComp().layers.addText("MNR").name;
        }));

        btn(tab, "LYR-05", "Add camera", safe("LYR-05", function () {
            var c = activeComp();
            return c.layers.addCamera("MNR camera", [c.width / 2, c.height / 2]).name;
        }));

        btn(tab, "LYR-06", "Add light", safe("LYR-06", function () {
            var c = activeComp();
            return c.layers.addLight("MNR light", [c.width / 2, c.height / 2]).name;
        }));

        btn(tab, "LYR-07", "Add shape layer", safe("LYR-07", function () {
            return activeComp().layers.addShape().name;
        }));

        header(tab, "Acting on selected layers");

        btn(tab, "LYR-08", "Rename selected with a prefix", safe("LYR-08", function () {
            var c = activeComp(), sel = c.selectedLayers;
            for (var i = 0; i < sel.length; i++) sel[i].name = "MNR_" + sel[i].name;
            return sel.length + " layers renamed";
        }));

        btn(tab, "LYR-09", "Toggle solo on selected", safe("LYR-09", function () {
            var sel = activeComp().selectedLayers;
            for (var i = 0; i < sel.length; i++) sel[i].solo = !sel[i].solo;
            return sel.length + " layers toggled";
        }));

        btn(tab, "LYR-10", "Shy the selected layers", safe("LYR-10", function () {
            var sel = activeComp().selectedLayers;
            for (var i = 0; i < sel.length; i++) sel[i].shy = true;
            activeComp().hideShyLayers = true;
            return sel.length + " layers shy";
        }));

        btn(tab, "LYR-11", "Label selected red", safe("LYR-11", function () {
            var sel = activeComp().selectedLayers;
            for (var i = 0; i < sel.length; i++) sel[i].label = 1;
            return sel.length + " layers labelled";
        }));

        btn(tab, "LYR-12", "Parent selected to a new null", safe("LYR-12", function () {
            var c = activeComp(), sel = c.selectedLayers;
            if (!sel.length) return "nothing selected";
            var n = c.layers.addNull();
            n.name = "MNR_parent";
            for (var i = 0; i < sel.length; i++) sel[i].parent = n;
            return sel.length + " layers parented";
        }));

        btn(tab, "LYR-13", "Apply Gaussian Blur to selected", safe("LYR-13", function () {
            var sel = activeComp().selectedLayers;
            for (var i = 0; i < sel.length; i++) sel[i].property("Effects").addProperty("ADBE Gaussian Blur 2");
            return sel.length + " layers blurred";
        }), "Shows applying an effect by its internal match name");

        btn(tab, "LYR-14", "Add an expression to selected opacity", safe("LYR-14", function () {
            var sel = activeComp().selectedLayers;
            for (var i = 0; i < sel.length; i++) {
                sel[i].property("Transform").property("Opacity").expression = "wiggle(2, 20)";
            }
            return sel.length + " expressions added";
        }));

        btn(tab, "LYR-15", "Keyframe selected position over 1s", safe("LYR-15", function () {
            var c = activeComp(), sel = c.selectedLayers;
            for (var i = 0; i < sel.length; i++) {
                var p = sel[i].property("Transform").property("Position");
                p.setValueAtTime(0, p.value);
                p.setValueAtTime(1, [p.value[0] + 200, p.value[1]]);
            }
            return sel.length + " layers keyframed";
        }));
    }

    // ----------------------------------------------------------------
    // Organise tab
    // ----------------------------------------------------------------

    function buildOrganiseTab(tab) {
        tab.orientation = "column";
        tab.alignChildren = ["fill", "top"];
        tab.spacing = 4;
        tab.margins = 10;

        header(tab, "Import");

        btn(tab, "ORG-01", "Import a single file", safe("ORG-01", function () {
            var f = File.openDialog("Pick a file to import");
            if (!f) return "cancelled";
            return app.project.importFile(new ImportOptions(f)).name;
        }));

        btn(tab, "ORG-02", "Import an image sequence", safe("ORG-02", function () {
            var f = File.openDialog("Pick the first frame of a sequence");
            if (!f) return "cancelled";
            var io = new ImportOptions(f);
            io.sequence = true;
            return app.project.importFile(io).name;
        }), "The one relevant to bringing in rendered frames");

        btn(tab, "ORG-03", "Import a folder of footage", safe("ORG-03", function () {
            var d = Folder.selectDialog("Pick a folder");
            if (!d) return "cancelled";
            var files = d.getFiles();
            var n = 0;
            for (var i = 0; i < files.length; i++) {
                if (files[i] instanceof File) {
                    try { app.project.importFile(new ImportOptions(files[i])); n++; } catch (e) {}
                }
            }
            return n + " files imported";
        }));

        header(tab, "Organisation");

        btn(tab, "ORG-04", "Create the MNR folder structure", safe("ORG-04", function () {
            var names = ["01_footage", "02_comps", "03_precomps", "04_elements", "05_output"];
            for (var i = 0; i < names.length; i++) app.project.items.addFolder(names[i]);
            return names.length + " folders created";
        }), "A realistic example of enforcing project structure");

        btn(tab, "ORG-05", "Move all footage into a folder", safe("ORG-05", function () {
            var target = app.project.items.addFolder("_footage");
            var n = 0;
            for (var i = app.project.numItems; i >= 1; i--) {
                var it = app.project.item(i);
                if (it instanceof FootageItem) { it.parentFolder = target; n++; }
            }
            return n + " items moved";
        }));

        btn(tab, "ORG-06", "Colour label all comps blue", safe("ORG-06", function () {
            var n = 0;
            for (var i = 1; i <= app.project.numItems; i++) {
                var it = app.project.item(i);
                if (it instanceof CompItem) { it.label = 5; n++; }
            }
            return n + " comps labelled";
        }));

        btn(tab, "ORG-07", "Find and report missing footage", safe("ORG-07", function () {
            var missing = 0;
            for (var i = 1; i <= app.project.numItems; i++) {
                var it = app.project.item(i);
                if (it instanceof FootageItem && it.footageMissing) {
                    log("   missing: " + it.name);
                    missing++;
                }
            }
            return missing + " missing items";
        }));

        btn(tab, "ORG-08", "Reduce project to selected comps", safe("ORG-08", function () {
            if (!confirm("This removes everything not used by the selected comps. Continue?"))
                return "cancelled";
            app.project.reduceProject(app.project.selection);
            return "project reduced";
        }));

        btn(tab, "ORG-09", "Collect files", safe("ORG-09", function () {
            app.executeCommand(app.findMenuCommandId("Collect Files..."));
            return "collect files dialog opened";
        }), "Shows driving a built in menu command from script");
    }

    // ----------------------------------------------------------------
    // Info tab, read only
    // ----------------------------------------------------------------

    function buildInfoTab(tab) {
        tab.orientation = "column";
        tab.alignChildren = ["fill", "top"];
        tab.spacing = 4;
        tab.margins = 10;

        note(tab, "Everything here only reads. Safe to click without changing anything.");

        btn(tab, "INF-01", "After Effects version", safe("INF-01", function () {
            return app.version + "  build " + app.buildName;
        }));

        btn(tab, "INF-02", "Project summary", safe("INF-02", function () {
            var comps = 0, footage = 0, folders = 0;
            for (var i = 1; i <= app.project.numItems; i++) {
                var it = app.project.item(i);
                if (it instanceof CompItem) comps++;
                else if (it instanceof FootageItem) footage++;
                else folders++;
            }
            return comps + " comps, " + footage + " footage, " + folders + " folders";
        }));

        btn(tab, "INF-03", "Active comp details", safe("INF-03", function () {
            var c = activeComp();
            return c.name + "  " + c.width + "x" + c.height + "  " +
                   c.frameRate + "fps  " + c.duration.toFixed(2) + "s  " +
                   c.numLayers + " layers";
        }));

        btn(tab, "INF-04", "Selected layer details", safe("INF-04", function () {
            var sel = activeComp().selectedLayers;
            for (var i = 0; i < sel.length; i++) {
                log("   " + sel[i].index + ": " + sel[i].name + "  " + sel[i].constructor.name);
            }
            return sel.length + " selected, see log";
        }));

        btn(tab, "INF-05", "Is the pipeline drive mounted", safe("INF-05", function () {
            return new Folder("P:/").exists ? "P: found" : "P: not found";
        }));

        btn(tab, "INF-06", "Who is logged in", safe("INF-06", function () {
            return "system: " + system.userName + " | machine: " + system.machineName;
        }));

        btn(tab, "INF-07", "Available memory and disk cache", safe("INF-07", function () {
            return "memory in use: " + app.memoryInUse;
        }));

        btn(tab, "INF-08", "List every effect on selected layer", safe("INF-08", function () {
            var sel = activeComp().selectedLayers;
            if (!sel.length) return "nothing selected";
            var fx = sel[0].property("Effects");
            for (var i = 1; i <= fx.numProperties; i++) {
                log("   " + fx.property(i).name + "  [" + fx.property(i).matchName + "]");
            }
            return fx.numProperties + " effects, see log";
        }), "Match names are what a script needs to apply effects");
    }

    // ----------------------------------------------------------------
    // Dialogs tab
    // ----------------------------------------------------------------

    function buildDialogTab(tab) {
        tab.orientation = "column";
        tab.alignChildren = ["fill", "top"];
        tab.spacing = 4;
        tab.margins = 10;

        note(tab, "The ways a panel can interrupt and ask something.");

        btn(tab, "DLG-01", "Simple alert", function () {
            alert("A plain message.", PANEL_NAME);
            log("DLG-01 shown");
        });

        btn(tab, "DLG-02", "Yes / no confirm", function () {
            var yes = confirm("Do you want to continue?", false, PANEL_NAME);
            log("DLG-02 answered: " + yes);
        });

        btn(tab, "DLG-03", "Text prompt", function () {
            var v = prompt("Enter a version number:", "v001", PANEL_NAME);
            log("DLG-03 entered: " + v);
        });

        btn(tab, "DLG-04", "File picker", function () {
            var f = File.openDialog("Pick a file");
            log("DLG-04: " + (f ? f.fsName : "cancelled"));
        });

        btn(tab, "DLG-05", "Folder picker", function () {
            var d = Folder.selectDialog("Pick a folder");
            log("DLG-05: " + (d ? d.fsName : "cancelled"));
        });

        btn(tab, "DLG-06", "Save as picker", function () {
            var f = File.saveDialog("Save as");
            log("DLG-06: " + (f ? f.fsName : "cancelled"));
        });

        btn(tab, "DLG-07", "Custom modal dialog", function () {
            var d = new Window("dialog", "Custom dialog", undefined);
            d.orientation = "column";
            d.alignChildren = ["fill", "top"];
            d.margins = 16;
            d.add("statictext", undefined, "A dialog built from scratch.");
            var dd = d.add("dropdownlist", undefined, ["Option A", "Option B"]);
            dd.selection = 0;
            var cb = d.add("checkbox", undefined, "A checkbox");
            var row = d.add("group");
            row.alignment = ["right", "top"];
            var ok = row.add("button", undefined, "OK");
            row.add("button", undefined, "Cancel");
            var answer = null;
            ok.onClick = function () {
                answer = dd.selection.text + ", checkbox " + cb.value;
                d.close();
            };
            d.show();
            log("DLG-07: " + (answer || "cancelled"));
        }, "The most flexible option, any layout from the UI tab works here");

        btn(tab, "DLG-08", "Progress window", function () {
            var w = new Window("palette", "Working", undefined);
            w.orientation = "column";
            w.margins = 16;
            var t = w.add("statictext", undefined, "Processing frame 0 of 50");
            t.preferredSize.width = 220;
            var p = w.add("progressbar", undefined, 0, 50);
            p.preferredSize.width = 220;
            w.show();
            for (var i = 0; i <= 50; i++) {
                p.value = i;
                t.text = "Processing frame " + i + " of 50";
                w.update();
                $.sleep(20);
            }
            w.close();
            log("DLG-08 finished");
        }, "What a long running pipeline action would show");
    }

    // ----------------------------------------------------------------

    var built = build(thisObj);
    if (built instanceof Window) {
        built.center();
        built.show();
    }

})(this);
