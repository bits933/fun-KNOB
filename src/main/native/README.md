# Native layer

`index.ts` exports `createNative(): NativeApi`. No shared contract changes or new packages.

The keyboard hook is installed on a worker's OS thread. A `MsgWaitForMultipleObjectsEx` / `PeekMessageW`
pump with a 250 ms timeout dispatches the registered koffi callback on that same thread. The callback only
decodes the key, checks atomic flags, deduplicates Mute downs, posts an event, and returns.
It never waits on Electron. Pause, stop, and a pause generation counter use shared
memory; `PostThreadMessageW(WM_QUIT)` wakes the pump for cleanup. Each iteration
yields to Node so worker termination remains possible. The worker is unreferenced,
and a process exit listener stops it even when the owner forgets disposal.
Every 60 seconds the worker installs a replacement hook before removing the old one;
this also repairs silent removal after sleep within one renewal period. Injected input passes
is NOT filtered: Kreo's keyboard software injects the knob keys itself (scan 0, flags 0x11). Instead every event Kreo Dial sends carries `KREO_INPUT_TAG` in dwExtraInfo and the hook skips only those.

The eval worker resolves koffi using the parent module's absolute package path, so it
does not depend on the process working directory or a separately copied worker file.
Packaged paths use `app.asar.unpacked`, matching the native dependency unpack rules.
This follows the dedicated-thread/message-loop guidance in
[LowLevelKeyboardProc](https://learn.microsoft.com/en-us/windows/win32/winmsg/lowlevelkeyboardproc).

Run from the repository root:

```powershell
# Automated injection, latency, volume/mute preservation, and main-thread stall check:
node src/main/native/smoke.cjs

# Also read foreground process, speaker/mic levels and WMI brightness:
node src/main/native/smoke.cjs --system

# Real hardware only; turn, click, hold, and turn while holding. Ctrl+C ends the hook:
node src/main/native/smoke.cjs --manual

# Normal application production build, isolated from other agents' output:
npx electron-vite build --outDir out-native

# Native-only production bundle, including the smoke entry before application wiring:
npx electron-vite build --config src/main/native/electron.vite.config.mts --outDir out-native

# Run that bundle using Electron's Node runtime, preserving captured output:
node -e "const r=require('node:child_process').spawnSync(require('electron'),['out-native/main/smoke.js','--system'],{encoding:'utf8',env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},timeout:15000}); console.log(r.stdout); console.error(r.stderr); process.exitCode=r.status??1"
```

Verified on this PC: native Electron production bundle delivered all 40 events,
maximum 0.57 ms and mean 0.29 ms injection-to-main-callback latency. Output volume was
100% before/after, mute false before/after. Two more turns were swallowed during a
200 ms main-thread stall. Live reads: microphone 68.29%, internal-screen brightness
90%, foreground executable and process snapshot returned correctly.

The smoke also forces hook renewal and verifies capture and volume/mute preservation
after confirmation. `--exit-with-hook` and `--natural-exit-hook` check exit without disposal.

Brightness commands are serialized; sets retain only the latest pending value and
superseded callers share its result. The 10 s timeout starts at the pipe write.
The PowerShell worker caches the brightness-method instance (cleared on failure).

Pure tests cover mute deduplication, input ordering/repeats/extended keys, VK encoding,
brightness coalescing/timeouts/disposal, wheel
direction/modifiers, UTF-16/newlines, invalid inputs, and brightness reply parsing.

Still requires real-keyboard and long-running idle/load tests, target-app keyboard/
wheel/text and focus tests, missing-device/external-monitor tests, setter tests,
and installed/ASAR packaging verification. Windows exposes no query that confirms
a low-level hook has not been silently removed; startup failure, message-pump failure,
and worker death are reported; periodic renewal repairs silent OS removal.
Never enable the injected-input test flag in normal use (injected volume actions
would be recaptured). Input synthesis remains subject to Windows elevation/UIPI and
foreground restrictions.
