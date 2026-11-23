<p align="center">
  <img src="resources/logo-pixel.png" width="140" alt="fun KNOB logo" style="image-rendering: pixelated" />
</p>

# fun KNOB

Windows desktop app that turns a keyboard volume knob into a multi-use dial. Built and tested with the Kreo keyboard knob; it works from the Volume Up / Volume Down / Mute keys, so other knobs that send those keys should work too.

One knob, many jobs: system controls, per-app shortcut sets, macros and a DJ-style scratch mode, all picked from an on-screen dial.

Electron + React + TypeScript + Tailwind.

## How it works

### The knob

The knob sends three keys. fun KNOB listens for them with a global Windows keyboard hook, swallows them, and turns them into gestures:

| Knob | Key it sends | Gesture |
| --- | --- | --- |
| Turn right / left | Volume Up / Volume Down | rotate+ / rotate- |
| Press | Mute | click, double click, long press |
| Press and hold while turning | Mute (held) + volume keys | hold + rotate |

It only handles those three keys, from any keyboard. Everything fun KNOB sends itself is tagged so it never reacts to its own output. Pause it from the tray or the Home screen and the knob goes back to being a normal volume knob.

### Dial closed (the knob does its active function)

- **Turn:** drives the active function (Volume by default).
- **Click:** opens the on-screen dial. If an app you have set up on the knob is in front (for example Photoshop), the dial opens straight to that app's shortcuts. Go back for the main dial.
- **Double click:** play / pause (configurable: next track, or nothing).
- **Long press:** mute (configurable).
- **Hold + turn:** cycles through the functions (configurable).
- After 20 seconds without use it returns to the default function.

### Dial open (pick something)

- **Turn:** move the highlight around the ring.
- **Click:** choose the highlighted slot.
- **Double click** on an app: open that app's own shortcut dial. On anything else: go back.
- **Long press:** go back one level. At the top level it closes the dial.
- The dial closes by itself after 4 seconds of inactivity.

The ring has 4 to 8 slots. Each slot can be a system function, an app, a macro, or a folder that holds apps or macros (the defaults are an Apps folder and a Macros folder).

### What a slot can be

- **System functions:** Volume, Brightness, Mic volume, Scroll, Zoom, Media (back / forward), Switch apps, Undo / Redo, Virtual desktops, and DJ. Volume, Brightness and Mic show a level ring; the rest show a small pill at the bottom of the screen.
- **Apps:** each app has up to 8 shortcut slots. A slot maps turning left and right to a key combination or mouse-wheel step, for example Photoshop's brush size. Choosing a slot brings the app to the front, and turning the knob sends those keys while the app is in front. If the app isn't in front the knob falls back to the system function and tells you so. Ready-made sets are included for DaVinci Resolve, Figma, Photoshop and Blender.
- **Macros:** up to 20 steps made of key presses, typed text, open a file or link, and waits. Press the knob while a macro runs to stop it.
- **DJ:** scratch the music with the knob. It captures system audio, lets you scrub it back and forth like a record, and hands playback back to the player where you left off. Built around YouTube Music playback.

### Dashboard

Open it from the tray icon. Screens:

- **Home:** status, the active function, quick actions.
- **Main dial:** edit the ring slot by slot (system function and step size, app, macro, folder).
- **Apps:** pick the apps on your knob and edit their shortcut slots.
- **Macros:** build macros step by step.
- **Gestures:** choose what double click, long press and hold + turn do, and tune the timing.
- **Test:** turn and press the knob and watch each gesture light up.
- **Settings:** start with Windows, run as admin, dial size and position, which screen it opens on, auto-close time, default function, and a settings backup.

The app lives in the tray; closing the dashboard window only hides it.

## Run

Requires Windows, Node.js 20+ and npm.

```
npm install
npm run dev        # development with hot reload
npm start          # build and run the production bundle (Ctrl+C quits)
```

## Other commands

```
npm run typecheck
npm test
npm run dist       # build the Windows installer / portable exe into dist/
```

## Layout

```
src/main       Electron main process: knob hook, gesture engine, dial controller, actions, tray
src/preload    Bridge between main and the windows
src/renderer   dashboard (settings UI) and overlay (the on-screen dial)
src/shared     Types and defaults used by both sides
```
