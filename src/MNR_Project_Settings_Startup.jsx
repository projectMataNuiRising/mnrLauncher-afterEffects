/*
    MNR Project Settings - startup
    ------------------------------
    Installed by MNR Launcher into After Effects' Scripts\Startup folder,
    which After Effects runs every time it starts.

    Sets the MNR project settings (File > Project Settings):

      Time Display Style
        Timecode, Footage Start Time: Use Media Source, Default Base: 12

      Color
        Color Engine:            OCIO color managed
        OCIO Configuration:      ACES 1.3 CG v1.0
        Bit Depth:               32 bits per channel (float)
        3D LUT Interpolation:    Tetrahedral
        Working Color Space:     scene_linear: ACEScg
        Display Color Space:     sRGB - Display/Un-tone-mapped
        Linearize working color space        off
        Blend colors using 1.0 gamma         off
        Compensate for scene-referred profiles  on

    When it runs
      - At launch, on the empty Untitled project (not when After Effects
        was started with a project, existing projects are never changed).
      - When the MNR Scene Manager makes a New project, through
        $.global.mnrApplyProjectSettings(), before the first save.
      - When the MNR AE Importer imports into a project whose settings
        differ ($.global.mnrCheckProjectSettings() lists them).

    Some of these have no scripting access in every After Effects
    version (Default Base and Display Color Space have none at all).
    Each setting is read back after it is set, and anything that did not
    take is listed in %APPDATA%\MNR_Launcher\ae_startup.log so it can be
    set by hand.

    Written for ExtendScript (ES3).
*/

(function () {

    var APPLY_DELAY_MS = 2000;

    var WANT = {
        ocioConfig: "ACES 1.3 CG v1.0",
        workingSpace: "scene_linear: ACEScg",
        displaySpace: "sRGB - Display/Un-tone-mapped",
        timecodeBase: 12
    };

    function log(text) {
        try {
            var folder = new Folder(Folder.userData.fsName + "/MNR_Launcher");
            if (!folder.exists) { folder.create(); }
            var f = new File(folder.fsName + "/ae_startup.log");
            f.encoding = "UTF-8";
            if (f.open("a")) {
                f.writeln(new Date().toString() + "  project settings: " + text);
                f.close();
            }
        } catch (e) { /* logging is never worth failing over */ }
    }

    function has(obj, name) {
        try { return typeof obj[name] !== "undefined"; } catch (e) { return false; }
    }

    function lower(s) { return String(s).toLowerCase(); }

    // Sets one setting and reads it back. check(value) says whether the
    // read-back value is right, defaults to an exact match.
    function setOne(p, report, label, name, value, check) {
        if (report.dry) {
            // Check only: list it when it differs (ones scripts cannot
            // read are left out).
            if (!has(p, name)) { return true; }
            var cur;
            try { cur = p[name]; } catch (e0) { return true; }
            var same = check ? check(cur) : (cur === value);
            if (!same) { report.differ.push(label.replace(/:.*$/, "")); }
            return same;
        }
        if (!has(p, name)) {
            report.missed.push(label + " (no scripting access in this version)");
            return false;
        }
        try {
            if (p[name] !== value) { p[name] = value; }
        } catch (e) {
            report.missed.push(label + " (" + e.toString() + ")");
            return false;
        }
        var now;
        try { now = p[name]; } catch (e2) { now = undefined; }
        var ok = check ? check(now) : (now === value);
        if (ok) {
            report.done.push(label);
        } else {
            report.missed.push(label + " (did not take, now " + now + ")");
        }
        return ok;
    }

    // Picks the entry from listColorProfiles() that matches the one we
    // want: exact name first, then any ACEScg one (not ACEScct).
    function pickProfile(p, want, mustContain, mustNotContain) {
        var list = [];
        try { list = p.listColorProfiles(); } catch (e) { return null; }
        var i;
        for (i = 0; i < list.length; i++) {
            if (list[i] === want) { return list[i]; }
        }
        for (i = 0; i < list.length; i++) {
            var n = lower(list[i]);
            if (n.indexOf(lower(mustContain)) >= 0 &&
                (!mustNotContain || n.indexOf(lower(mustNotContain)) < 0)) {
                return list[i];
            }
        }
        return null;
    }

    function applyTo(p, given) {
        var report = given || { done: [], missed: [] };
        if (!p) { report.missed.push("no project open"); return report; }

        // ── Time Display Style
        if (typeof TimeDisplayType !== "undefined") {
            setOne(p, report, "Time Display Style: Timecode", "timeDisplayType", TimeDisplayType.TIMECODE);
        } else {
            report.missed.push("Time Display Style: Timecode (no scripting access)");
        }
        if (typeof FootageTimecodeDisplayStartType !== "undefined") {
            setOne(p, report, "Footage Start Time: Use Media Source", "footageTimecodeDisplayStartType",
                   FootageTimecodeDisplayStartType.FTCS_USE_SOURCE_MEDIA);
        } else {
            report.missed.push("Footage Start Time: Use Media Source (no scripting access)");
        }
        // No After Effects version documents a property for Default Base,
        // these are tried in case a newer one adds it.
        if (has(p, "timecodeBase")) {
            setOne(p, report, "Default Base: 12", "timecodeBase", WANT.timecodeBase);
        } else if (has(p, "timecodeDefaultBase")) {
            setOne(p, report, "Default Base: 12", "timecodeDefaultBase", WANT.timecodeBase);
        } else {
            report.missed.push("Default Base: 12 (no scripting access, set by hand)");
        }

        // ── Color. The engine and config go first, the colour space
        // lists depend on them.
        setOne(p, report, "Color Engine: OCIO color managed", "colorManagementSystem", 1);
        setOne(p, report, "OCIO Configuration: " + WANT.ocioConfig, "ocioConfigurationFile", WANT.ocioConfig,
               function (v) { return v === WANT.ocioConfig || lower(v).indexOf("aces 1.3") >= 0; });
        setOne(p, report, "Bit Depth: 32 bpc", "bitsPerChannel", 32);
        setOne(p, report, "3D LUT Interpolation: Tetrahedral", "lutInterpolationMethod", 1);

        var ws = pickProfile(p, WANT.workingSpace, "acescg", "acescct");
        if (ws) {
            setOne(p, report, "Working Color Space: " + ws, "workingSpace", ws);
        } else {
            report.missed.push("Working Color Space: " + WANT.workingSpace + " (not in the list of spaces)");
        }

        if (has(p, "displayColorSpace")) {
            setOne(p, report, "Display Color Space: " + WANT.displaySpace, "displayColorSpace", WANT.displaySpace);
        } else {
            report.missed.push("Display Color Space: " + WANT.displaySpace + " (no scripting access, set by hand)");
        }

        setOne(p, report, "Linearize working color space: off", "linearizeWorkingSpace", false);
        setOne(p, report, "Blend colors using 1.0 gamma: off", "linearBlending", false);
        setOne(p, report, "Compensate for scene-referred profiles: on", "compensateForSceneReferredProfiles", true);

        return report;
    }

    // Used by the MNR AE Importer: the names of the settings that are not
    // MNR ([] when they all are). Changes nothing.
    $.global.mnrCheckProjectSettings = function () {
        var report = { done: [], missed: [], differ: [], dry: true };
        if (!app.project) { return []; }
        applyTo(app.project, report);
        return report.differ;
    };

    // Used by the MNR Scene Manager's New, and at launch below.
    // Returns { done: [...], missed: [...] }.
    $.global.mnrApplyProjectSettings = function (why) {
        var report;
        try {
            app.beginUndoGroup("MNR Project Settings");
            report = applyTo(app.project);
        } catch (e) {
            report = { done: [], missed: ["failed: " + e.toString()] };
        }
        try { app.endUndoGroup(); } catch (e2) {}
        log((why || "applied") + ": " + report.done.length + " set" +
            (report.missed.length ? ", NOT set: " + report.missed.join("; ") : ""));
        return report;
    };

    // Run by app.scheduleTask once After Effects has finished starting.
    $.global.mnrProjectSettingsStartup = function () {
        try {
            if (!app.project) { return; }
            if (app.project.file) { log("started with a project, left alone"); return; }
            $.global.mnrApplyProjectSettings("launch");
        } catch (e) {
            log("launch: " + e.toString());
        }
    };

    try {
        app.scheduleTask("try { $.global.mnrProjectSettingsStartup(); } catch (e) {}", APPLY_DELAY_MS, false);
    } catch (e) {
        log("could not schedule: " + e.toString());
    }

})();
