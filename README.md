# mnrLauncher-afterEffects

After Effects extension for the Project Mata Nui Rising pipeline.

Works standalone, with extra functionality when MNR Launcher and pCloud
are available.

## What this is

The MNR Scene Manager for After Effects, the twin of the Blender Scene
Manager. It opens, creates, saves and renames pipeline `.aep` work
files:

- Project menu (every folder in `P:\01-projects`), Shot / Asset tabs,
  search, and the episode > sequence > shot tree.
- Tasks: `rotoKeyPrimary`, `rotoKeyUtility` and `comp` (tick "Show all
  folders" for the rest). Tasks with no work files say `(no files)`.
- Files: every user's work files in
  `<task>/work/<user>/afterEffects/saveFiles`, newest save on top, with
  a version list for older versions.
- Open, New, Save As, Rename (one version or all), Copy Path, Show in
  Explorer. Right-click a file for the same; double-click opens.
- New and Save As save into your own folder (the MNR Launcher user) at
  the next free 3-digit version, named
  `BFP102_SQ01_SH00_comp_main_v001.aep`.

It opens by itself as its own window every time After Effects starts
(`src/MNR_Scene_Manager_Startup.jsx`, installed into After Effects'
`Scripts\Startup` folder), in place of the Home screen, which it turns
off. Docked in the workspace instead, it reopens with the workspace and
the startup window is skipped.

MNR project settings (`src/MNR_Project_Settings_Startup.jsx`, also in
`Scripts\Startup`) are set on the Untitled project at launch and on
every New project from the Scene Manager: Timecode with Use Media
Source, OCIO color managed with ACES 1.3 CG v1.0, 32 bpc, Tetrahedral,
working space ACEScg, linearize and 1.0 gamma blending off, compensate
for scene-referred profiles on. Existing projects are never changed.
Default Base (12) and Display Color Space have no scripting access, and
anything that did not take is listed in
`%APPDATA%\MNR_Launcher\ae_startup.log`.

Copy Path and Show in Explorer need Preferences > Scripting &
Expressions > "Allow Scripts to Write Files and Access Network".

## Versions

Every push to `main` gets its own version, stamped by the "Stamp plugin
version" GitHub action into the panel and `build/plugin.json`:

```
main 0.3.14     channel, then version_base.<build number>
built           when that commit was made (UTC)
commit          the short commit id, to find the change on GitHub
```

MNR Launcher reads the stamp out of the installed panel, shows it on
the After Effects tile, and turns the link yellow when a newer version
is published. To mark a bigger release, change `version_base` in
`build/plugin.json` (0.3 -> 0.4); the build number keeps counting.

## One-time tools

`tools/MNR_Fix_Shot_Work_Files_oneTime.jsx` renames `project-main` to
`main`, pads versions to 3 digits, fixes names that disagree with their
folders, and moves loose `.aep` files into `afterEffects/saveFiles`.
It shows every change and asks before doing anything. Not installed by
the launcher; run it once from File > Scripts > Run Script File.

## Why a ScriptUI panel and not a CEP extension

A ScriptUI panel installs into a per-user Documents folder:

```
Documents\Adobe\After Effects <version>\Scripts\ScriptUI Panels\
```

That needs no administrator rights and no registry changes.

An unsigned CEP extension, by contrast, requires a `PlayerDebugMode`
registry flag to be set before After Effects will load it at all, and
the CEP version has to match the host release. That is more moving
parts than a first test needs. CEP remains the right choice later if a
richer HTML panel is wanted, which is why `build/plugin.json` records
an `install_type` rather than assuming one.

## Standalone by design

Nothing in the panel requires MNR Launcher or the P: drive to be
present. The pipeline check uses a plain folder existence test and
falls back to a "running standalone" state, so the panel still opens
and works on a machine with no pCloud mounted.

## Installing

Normally handled by MNR Launcher, under Connect Software > After
Effects. It downloads the panel straight from this repository, so
whatever is on `main` is what gets installed.

To install by hand, copy `src/MNR_Launcher_Panel.jsx` into the
ScriptUI Panels path above and restart After Effects. It then appears
in the `Window` menu.

## Layout

```
src/     the panel source (MNR_Launcher_Panel.jsx is what gets installed)
tools/   one-time admin scripts, not installed
build/   plugin.json (the install manifest MNR Launcher reads) and
         stamp_version.py (run by the version action)
```
