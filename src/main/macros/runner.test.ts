import { describe, it, expect, vi } from 'vitest'
import { createMacroRunner } from './runner'

describe('macro runner', () => {
  it('runs steps in order and reports state', async () => {
    const events: string[] = [], runner = createMacroRunner({ sendStroke: () => events.push('keys'), typeText: t => events.push(t), open: async t => { events.push(t) }, sleep: async () => { events.push('sleep') } })
    runner.onState(id => events.push(id ?? 'end'))
    expect(await runner.run({id:'a',name:'',icon:'',steps:[{type:'keys',keys:['A']},{type:'text',text:'text'},{type:'open',target:'file'}]})).toBe('done')
    expect(events).toEqual(['a','keys','sleep','text','sleep','file','end'])
  })
  it('cancels waits and catches failures', async () => {
    vi.useFakeTimers()
    try { const runner = createMacroRunner({sendStroke: () => { throw Error() }, typeText: () => {}, open: async () => {}})
      const waiting = runner.run({id:'a',name:'',icon:'',steps:[{type:'wait',ms:1000}]}); runner.stop(); expect(await waiting).toBe('stopped')
      expect(await runner.run({id:'b',name:'',icon:'',steps:[{type:'keys',keys:[]}]})).toBe('failed')
    } finally { vi.useRealTimers() }
  })
})

it('stops a hanging open and allows a subsequent run', async () => {
  const runner = createMacroRunner({sendStroke: () => {}, typeText: () => {}, open: () => new Promise(() => {})})
  const pending = runner.run({id:'a',name:'',icon:'',steps:[{type:'open',target:'x'}]})
  runner.stop(); expect(await pending).toBe('stopped'); expect(runner.running()).toBeNull()
  expect(await runner.run({id:'b',name:'',icon:'',steps:[]})).toBe('done')
})
