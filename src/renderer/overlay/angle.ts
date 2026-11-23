/**
 * Continuous highlight angle for slot `idx`, starting from angle `cur`.
 * Goes the way the knob went: the direction that passes fewer filled slots (rotation skips empty
 * ones). On a tie, the shorter way, so 7 -> 0 goes forward one step.
 */
export const nextAngle = (cur: number, idx: number, filled?: boolean[]): number => {
  const n = filled?.length ?? 8
  const spacing = 360 / n
  let d = (((idx * spacing - cur) % 360) + 360) % 360 // clockwise distance, 0..359
  if (d === 0) return cur
  if (filled) {
    const from = ((Math.round(cur / spacing) % n) + n) % n
    const passed = (dir: 1 | -1): number => {
      let count = 0
      for (let i = (from + dir + n) % n; i !== idx; i = (i + dir + n) % n) if (filled[i]) count++
      return count
    }
    const cw = passed(1), ccw = passed(-1)
    if (cw !== ccw) return cw < ccw ? cur + d : cur + d - 360
  }
  return d > 180 ? cur + d - 360 : cur + d
}
