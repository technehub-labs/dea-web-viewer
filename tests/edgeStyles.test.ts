// Tests for spec-driven edge styling (edge-styles.ts, tranche 4).

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  REL_TYPE_STYLES,
  edgeStyleFor,
  edgeStyleLegend,
} from '../src/lib/edge-styles.ts'

describe('edge-styles (CR-8 §67 vocabulary)', () => {
  it('every live graph rel_type has an explicit style', () => {
    // The 10 rel_types present in entity-graph.json as of metamodel 1.0.0.
    const liveTypes = [
      'dependency', 'governance', 'realization', 'flow', 'composition',
      'association', 'aggregation', 'serving', 'execution', 'contract',
    ]
    for (const t of liveTypes) {
      assert.ok(REL_TYPE_STYLES[t], `${t} must have an explicit style`)
    }
  })

  it('CR-6 §22: governance and dependency edges are never solid', () => {
    assert.ok(edgeStyleFor('governance').dasharray)
    assert.ok(edgeStyleFor('dependency').dasharray)
    assert.ok(edgeStyleFor('association').dasharray)
    // structural and behavioral edges are solid
    assert.equal(edgeStyleFor('composition').dasharray, undefined)
    assert.equal(edgeStyleFor('realization').dasharray, undefined)
  })

  it('unknown or missing rel_type falls back to a dashed default', () => {
    assert.equal(edgeStyleFor('bogus').category, 'coupling')
    assert.ok(edgeStyleFor(undefined).dasharray)
  })

  it('legend deduplicates rel_types preserving first-seen order', () => {
    const legend = edgeStyleLegend(['governance', 'flow', 'governance', 'flow', 'realization'])
    assert.deepEqual(legend.map((l) => l.relType), ['governance', 'flow', 'realization'])
    assert.equal(legend[0].style.stroke, edgeStyleFor('governance').stroke)
  })

  it('categories partition the vocabulary', () => {
    const cats = new Set(Object.values(REL_TYPE_STYLES).map((s) => s.category))
    assert.deepEqual([...cats].sort(), ['behavioral', 'coupling', 'governance', 'structural'])
  })
})
