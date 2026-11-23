import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { MediaTouch } from '../../shared/contracts'
import { clampPercent } from './audio'

const script = `
$ErrorActionPreference = 'Stop'
$method = $null
$manager = $null
$pausedSession = $null

function Wait-Op($operation, [Type] $type) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($operation))
  $task.Wait(-1) | Out-Null
  $task.Result
}

while ($null -ne ($line = [Console]::ReadLine())) {
  $parts = $line.Split(' '); $id = $parts[0]
  try {
    if ($parts[1] -eq 'get') {
      $screen = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness | Where-Object Active | Select-Object -First 1
      if ($null -eq $screen) { throw 'unsupported' }
      [Console]::WriteLine("$id value $($screen.CurrentBrightness)")
    } elseif ($parts[1] -eq 'set') {
      if ($null -eq $method) {
        $screen = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness | Where-Object Active | Select-Object -First 1
        if ($null -eq $screen) { throw 'unsupported' }
        $method = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods | Where-Object { $_.InstanceName -eq $screen.InstanceName } | Select-Object -First 1
        if ($null -eq $method) { throw 'unsupported' }
      }
      $result = Invoke-CimMethod -InputObject $method -MethodName WmiSetBrightness -Arguments @{ Timeout = [uint32]0; Brightness = [byte]$parts[2] }
      if ($result.ReturnValue -ne 0) { throw 'failed' }
      [Console]::WriteLine("$id ok")
    } elseif ($parts[1] -in 'media-status', 'media-touch') {
      if ($null -eq $manager) {
        Add-Type -AssemblyName System.Runtime.WindowsRuntime
        $asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
          $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
            $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
        })[0]
        $managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]
        $manager = Wait-Op ($managerType::RequestAsync()) $managerType
      }
      $target = $env:KREO_DJ_TARGET
      if (!$target) { $target = 'com.github.th-ch.youtube-music' }
      $media = $manager.GetSessions() | Where-Object { $_.SourceAppUserModelId -eq $target } | Select-Object -First 1
      if ($null -eq $media -and !$env:KREO_DJ_TARGET) { $media = $manager.GetCurrentSession() }
      if ($null -eq $media) { throw 'no media session' }
      $playing = $media.GetPlaybackInfo().PlaybackStatus -eq 'Playing'
      $timeline = $media.GetTimelineProperties()
      $readAt = [DateTimeOffset]::UtcNow
      $end = [long]$timeline.EndTime.TotalMilliseconds
      $position = [long]$timeline.Position.TotalMilliseconds
      $age = ($readAt - $timeline.LastUpdatedTime).TotalMilliseconds
      if ($playing -and $timeline.LastUpdatedTime -gt [DateTimeOffset]::MinValue) {
        $position += [long][Math]::Max(0, $age)
      }
      if ($parts[1] -eq 'media-touch') {
        if (!$playing -or !(Wait-Op ($media.TryPauseAsync()) ([bool]))) { throw 'no playing session to pause' }
        $pausedSession = $media
      }
      $position = [Math]::Max(0L, [Math]::Min($end, $position))
      [Console]::WriteLine("$id media $position $end $([int]$playing) $($readAt.ToUnixTimeMilliseconds())")
    } elseif ($parts[1] -eq 'media-release') {
      if ($null -eq $pausedSession) { throw 'no paused session' }
      $media = $pausedSession
      $pausedSession = $null
      $sought = $true
      try {
        if ($parts.Count -gt 2) {
          $ticks = [long]$parts[2] * [TimeSpan]::TicksPerMillisecond
          $sought = Wait-Op ($media.TryChangePlaybackPositionAsync($ticks)) ([bool])
        }
      } finally {
        $played = Wait-Op ($media.TryPlayAsync()) ([bool])
      }
      if (!$played -or !$sought) { throw 'media handoff failed' }
      [Console]::WriteLine("$id ok")
    } else { throw 'bad command' }
  } catch { $method = $null; [Console]::WriteLine("$id unsupported") }
}
`

export function parseBrightnessLine(line: string): { id: number; value: number | boolean | null } | null {
  const match = /^(\d+) (ok|unsupported|value (\d{1,3}))$/.exec(line)
  if (!match) return null
  if (match[3] && Number(match[3]) > 100) return null
  return { id: Number(match[1]), value: match[2] === 'ok' ? true : match[2] === 'unsupported' ? null : Number(match[3]) }
}

export type TimedMediaTouch = MediaTouch & { readAtMs: number }

export function parseMediaLine(line: string): { id: number; value: TimedMediaTouch } | null {
  const match = /^(\d+) media (\d+) (\d+) ([01]) (\d+)$/.exec(line)
  if (!match) return null
  const [id, positionMs, endMs] = match.slice(1, 4).map(Number)
  const readAtMs = Number(match[5])
  if (![id, positionMs, endMs, readAtMs].every(Number.isSafeInteger)) return null
  return { id, value: { positionMs, endMs, readAtMs, wasPlaying: match[4] === '1' } }
}

type Reply = number | boolean | null | TimedMediaTouch
type Request = { command: string; resolve: ((value: Reply) => void)[] }

export function createSystemWorker(mediaTarget?: string) {
  let child: ChildProcessWithoutNullStreams | null = null, sequence = 0, disposed = false
  let active: (Request & { id: number; timer: NodeJS.Timeout }) | null = null
  const queue: Request[] = []
  function fail(): void {
    const requests: Request[] = [...queue]
    queue.length = 0
    if (active) { clearTimeout(active.timer); requests.unshift(active); active = null }
    for (const request of requests) for (const resolve of request.resolve) resolve(null)
  }
  function pump(): void {
    if (active || !queue.length || disposed) return
    if (!child) {
      const instance = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
        windowsHide: true, stdio: 'pipe', env: { ...process.env, KREO_DJ_TARGET: mediaTarget ?? '' }
      })
      child = instance
      const lines = createInterface({ input: instance.stdout })
      lines.on('line', line => {
        const parsed = parseBrightnessLine(line) ?? parseMediaLine(line)
        if (!parsed || child !== instance || active?.id !== parsed.id) return
        const done = active
        active = null
        clearTimeout(done.timer)
        for (const resolve of done.resolve) resolve(parsed.value)
        pump()
      })
      instance.stderr.resume()
      const died = (): void => { if (child === instance) { child = null; fail() }; lines.close() }
      instance.on('error', died); instance.on('exit', died)
      instance.stdin.on('error', died)
    }
    const instance = child, id = ++sequence, request = queue.shift()!
    const timer = setTimeout(() => { if (child === instance) { child = null; fail(); instance.kill() } }, 10000)
    active = { ...request, id, timer }
    try { instance.stdin.write(`${id} ${request.command}\n`) }
    catch { child = null; fail(); instance.kill() }
  }
  function request(command: string): Promise<Reply> {
    if (disposed) return Promise.resolve(null)
    return new Promise(resolve => {
      const pendingSet = command.startsWith('set ') && queue.find(item => item.command.startsWith('set '))
      if (pendingSet) { pendingSet.command = command; pendingSet.resolve.push(resolve) }
      else queue.push({ command, resolve: [resolve] })
      pump()
    })
  }
  return {
    async get(): Promise<number | null> { const value = await request('get'); return typeof value === 'number' ? value : null },
    async set(percent: number): Promise<boolean> { return await request(`set ${Math.round(clampPercent(percent))}`) === true },
    async primeMedia(): Promise<boolean> { return await request('media-status') !== null },
    async touchMedia(): Promise<TimedMediaTouch | null> {
      const result = await request('media-touch')
      return typeof result === 'object' ? result : null
    },
    async releaseMedia(positionMs?: number): Promise<boolean> {
      return await request(positionMs === undefined ? 'media-release' : `media-release ${positionMs}`) === true
    },
    dispose() { disposed = true; const instance = child; child = null; fail(); instance?.kill() }
  }
}

export const createBrightness = createSystemWorker
