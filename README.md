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

## MNR AE Exporter

`src/MNR_AE_Exporter.jsx` sets up publish renders of a comp in the
Render Queue, named and placed for the pipeline. Pick the comp, check
the shot and task (filled in from where the `.aep` lives; Any task
lists every task folder in the shot; Open Folder shows the media folder
in File Explorer), the layer name (from the stop-motion TIFF sequence
in the comp, else the comp name) and variant (default `main`), then Add
to Render Queue or Add & Render. Into `<task>\export\publish\media\`:

- `<name>\exr\<name>.[####].exr`  full res EXR, RGB + Alpha float, zip, ACEScg
- `<name>.mp4`  1/2 or 1/4 res H.264 over a 64 px checkerboard (0.6 / 0.4), sRGB
- `<proxy name>\png\<proxy name>.[####].png`  1/4 or 1/8 res PNG, ACEScg
  (`-proxy` in place of the variant)

where `<name>` is e.g. `BFP102_SQ04_SH08_rotoKeyPrimary_gali01-main_v001`.
The size of each output is shown in the panel. Frames come from the
comp's work area and the frame rate from the comp (with an override).
Each output renders from its own comp in the `MNR Exports` project
folder, made at the output size, so the artist's comp is never changed
and the templates' own Resize and Crop are switched off.

Scripts cannot choose an output format, so the formats come from Output
Module templates. For each output either name works:
`MNR EXR ACEScg` / `BFP_exportSetting_openEXR_outputModule_v001`,
`MNR MP4 Preview` / `BFP_exportSetting_mp4Preview_outputModule_v001`,
`MNR PNG Proxy` / `BFP_exportSetting_proxyPng_outputModule_v001`.
When none is there, the MNR ones are made from `src/MNR_Export_Presets.aep`
(installed next to the panel by MNR Launcher, or
`P:\02-pipeline\apps\afterEffects\presets\`): a project with one
Render Queue item per output (OpenEXR Sequence, H.264, PNG Sequence),
told apart by format. When it changes, the next Add to Render Queue picks it up by itself.

## Installing

Normally handled by MNR Launcher, under Connect Software > After
Effects. It downloads the panel straight from this repository, so
whatever is on `main` is what gets installed.

To install by hand, copy `src/MNR_Scene_Manager.jsx` and
`src/MNR_AE_Exporter.jsx` into the ScriptUI Panels path above and
restart After Effects. They then appear in the `Window` menu.
(`MNR_Scene_Manager.jsx` used to be called `MNR_Launcher_Panel.jsx`.)

## Layout

```
src/     the panels (MNR_Scene_Manager.jsx, MNR_AE_Exporter.jsx) and
         the Scripts\Startup files, all installed by MNR Launcher
tools/   one-time admin scripts, not installed
build/   plugin.json (the install manifest MNR Launcher reads) and
         stamp_version.py (run by the version action)
```
