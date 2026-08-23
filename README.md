# mnrLauncher-afterEffects

After Effects extension for the Project Mata Nui Rising pipeline.

Works standalone, with extra functionality when MNR Launcher and pCloud
are available.

## What this is right now

A connection test. It installs a small dockable panel into After
Effects so the install and removal path can be proven end to end
before real tools get built on top of it.

The panel shows the plugin version, whether the pipeline drive is
mounted, and has two buttons that read basic information back out of
After Effects.

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
src/     the panel source
build/   plugin.json, the install manifest MNR Launcher reads
```
