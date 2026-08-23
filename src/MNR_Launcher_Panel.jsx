/*
    MNR Launcher Panel
    ------------------
    Project Mata Nui Rising, After Effects side of the pipeline.

    This is a ScriptUI panel, not a CEP extension. That choice is
    deliberate: a ScriptUI panel installs into a per-user Documents
    folder, so it needs no administrator rights and no registry
    changes, unlike an unsigned CEP extension which requires the
    PlayerDebugMode flag to be set before After Effects will load it
    at all.

    Right now this panel is a connection test. It proves the install
    path works end to end and gives something visible to click. Real
    pipeline tools get added here once that is confirmed.

    It is written to run standalone: nothing here requires MNR
    Launcher or the P: drive to be present. Anything that depends on
    the pipeline checks for it first and degrades gracefully.
*/

(function (thisObj) {

    var PANEL_NAME = "MNR Launcher";
    var PLUGIN_VERSION = "0.1.0";
    var PIPELINE_ROOT = "P:/";

    function pipelineAvailable() {
        // Folder() works whether or not the drive exists, so this is a
        // safe check on a machine with no pCloud mounted.
        try {
            return new Folder(PIPELINE_ROOT).exists;
        } catch (e) {
            return false;
        }
    }

    function buildUI(thisObj) {
        var panel = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", PANEL_NAME, undefined, { resizeable: true });

        panel.orientation = "column";
        panel.alignChildren = ["fill", "top"];
        panel.spacing = 10;
        panel.margins = 14;

        // ---- header ----
        var title = panel.add("statictext", undefined, "MNR Launcher");
        try {
            title.graphics.font = ScriptUI.newFont(title.graphics.font.name, ScriptUI.FontStyle.BOLD, 16);
        } catch (e) {
            // Font styling is cosmetic, never worth failing over.
        }

        panel.add("statictext", undefined, "Plugin version " + PLUGIN_VERSION);

        // ---- pipeline status ----
        var connected = pipelineAvailable();
        var statusText = panel.add("statictext", undefined,
            connected ? "Pipeline drive found (P:)" : "Pipeline drive not found, running standalone");
        try {
            statusText.graphics.foregroundColor = connected
                ? statusText.graphics.newPen(statusText.graphics.PenType.SOLID_COLOR, [0.30, 0.69, 0.49, 1], 1)
                : statusText.graphics.newPen(statusText.graphics.PenType.SOLID_COLOR, [0.82, 0.65, 0.27, 1], 1);
        } catch (e) {
            // Colour is cosmetic too.
        }

        panel.add("panel", undefined, undefined).alignment = ["fill", "top"];

        // ---- the actual test ----
        var testButton = panel.add("button", undefined, "Run Connection Test");
        testButton.onClick = function () {
            var lines = [];
            lines.push("MNR Launcher panel is installed and running.");
            lines.push("");
            lines.push("Plugin version: " + PLUGIN_VERSION);
            lines.push("After Effects: " + app.version);
            lines.push("Pipeline drive: " + (pipelineAvailable() ? "found" : "not found"));

            var proj = app.project;
            lines.push("Open project: " + (proj && proj.file ? proj.file.name : "none saved yet"));

            alert(lines.join("\n"), PANEL_NAME);
        };

        var countButton = panel.add("button", undefined, "Count Project Items");
        countButton.onClick = function () {
            try {
                var total = app.project ? app.project.numItems : 0;
                var comps = 0;
                for (var i = 1; i <= total; i++) {
                    if (app.project.item(i) instanceof CompItem) {
                        comps++;
                    }
                }
                alert(
                    "This project has " + total + " item(s), " + comps + " of which are compositions.",
                    PANEL_NAME
                );
            } catch (e) {
                alert("Could not read the project: " + e.toString(), PANEL_NAME);
            }
        };

        var note = panel.add("statictext", undefined,
            "Installed and removed from MNR Launcher.", { multiline: true });
        note.alignment = ["fill", "top"];

        panel.layout.layout(true);
        panel.layout.resize();
        panel.onResizing = panel.onResize = function () {
            this.layout.resize();
        };

        return panel;
    }

    var builtPanel = buildUI(thisObj);

    if (builtPanel instanceof Window) {
        builtPanel.center();
        builtPanel.show();
    }

})(this);
