// Tests for CR-MM-02-VIEWER Stage 2 — feature flag + maturity data loader.
// Uses Node's built-in test runner (`node --test`); no new dev deps.
// Run with:  npm test   (which calls `node --test tests/`)

import { describe, it, mock, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  flag,
  activeFlags,
  setExperimentalFlag,
} from '../src/lib/feature-flags.ts'
import {
  loadMaturityData,
  V2_BANDS,
  V1_BANDS,
  WORKED_EXAMPLE,
} from '../src/lib/maturity-v2-loader.ts'

// loadMaturityData uses `fetch` from the global scope. node:test doesn't
// ship a default fetch in 18+, so we always inject one.
type FetchLike = (input: any, init?: any) => Promise<{ ok: boolean; text: () => Promise<string> }>

describe('feature-flags', () => {
  beforeEach(() => setExperimentalFlag('maturityV2', false))
  afterEach(() => setExperimentalFlag('maturityV2', false))

  it('default off for maturityV2 (CR-MM-02)', () => {
    assert.equal(flag('maturityV2'), false)
  })

  it('setExperimentalFlag flips the localStorage state, flag() reflects it', () => {
    setExperimentalFlag('maturityV2', true)
    assert.equal(flag('maturityV2'), true)
    setExperimentalFlag('maturityV2', false)
    assert.equal(flag('maturityV2'), false)
  })

  it('activeFlags returns the list of effective-on flags', () => {
    setExperimentalFlag('maturityV2', true)
    const on = activeFlags()
    assert.ok(on.includes('maturityV2'))
    setExperimentalFlag('maturityV2', false)
    const off = activeFlags()
    assert.ok(!off.includes('maturityV2'))
  })
})

describe('maturity-v2-loader (CR-MM-02)', () => {
  it('exposes canonical v2 bands matching CR-014', () => {
    assert.equal(V2_BANDS.length, 5)
    assert.deepEqual(V2_BANDS.map(b => b.name),
      ['Emergent','Structured','Systematic','Adaptive','Self-Optimising'])
    assert.deepEqual(V2_BANDS.map(b => b.effort_multiplier),
      [1.0, 1.5, 2.5, 4.0, 6.0])
    assert.deepEqual(V2_BANDS.map(b => b.legacy_name),
      ['Ad Hoc','Defined','Managed','Quantitatively Managed','Optimising'])
  })

  it('exposes v1 bands for the historical overlay', () => {
    assert.equal(V1_BANDS.length, 5)
    assert.deepEqual(V1_BANDS.map(b => b.name),
      ['Ad Hoc','Defined','Managed','Quantitatively Managed','Optimising'])
  })

  it('exposes the CR-014 worked example', () => {
    assert.equal(WORKED_EXAMPLE.score, 80)
    assert.equal(WORKED_EXAMPLE.band_v2, 'Adaptive')
    assert.equal(WORKED_EXAMPLE.effort_adjusted_value, 49.2)
  })

  it('returns canonical data when fetch throws (network down)', async () => {
    const fakeFetch: FetchLike = async () => { throw new Error('network down') }
    const data = await loadMaturityData(fakeFetch as any)
    assert.deepEqual(data.v2_bands, V2_BANDS)
    assert.deepEqual(data.v1_bands, V1_BANDS)
  })

  it('returns canonical data on 404', async () => {
    const fakeFetch: FetchLike = async () => ({ ok: false, text: async () => '' } as any)
    const data = await loadMaturityData(fakeFetch as any)
    assert.deepEqual(data.v2_bands, V2_BANDS)
  })

  it('falls back to canonical on YAML drift (test the drift detector)', async () => {
    const drifted = [
      'bands:',
      '  - id: WRONG-LEVEL-ID',
      '    name: WRONG',
      '    legacy_name: WRONG',
      '    range: [0, 999]',
      '    width: 999',
      '    effort_multiplier: 9.0',
      '    colour: "#000000"',
    ].join('\n')
    const fakeFetch: FetchLike = async () => ({ ok: true, text: async () => drifted } as any)
    const data = await loadMaturityData(fakeFetch as any)
    assert.deepEqual(data.v2_bands, V2_BANDS)
  })

  it('parses perfectly synced YAML', async () => {
    const yaml = [
      'bands:',
      ...V2_BANDS.map(b =>
        `  - id: ${b.id}\n` +
        `    name: ${b.name}\n` +
        `    legacy_name: ${b.legacy_name}\n` +
        `    range: [${b.range[0]}, ${b.range[1]}]\n` +
        `    width: ${b.width}\n` +
        `    effort_multiplier: ${b.effort_multiplier}\n` +
        `    colour: "${b.colour}"`
      ),
    ].join('\n')
    const fakeFetch: FetchLike = async () => ({ ok: true, text: async () => yaml } as any)
    const data = await loadMaturityData(fakeFetch as any)
    assert.equal(data.v2_bands.length, 5)
    assert.deepEqual(data.v2_bands.map(b => b.id), V2_BANDS.map(b => b.id))
    assert.equal(data.v2_bands[0].colour, V2_BANDS[0].colour)
  })
})
