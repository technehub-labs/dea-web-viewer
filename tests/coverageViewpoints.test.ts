// Tests for the second enrichment tranche: coverage analytics
// (coverage.ts) and viewpoint presets (viewpoints.ts).

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  buildCoverageReport,
  pct,
  dominantStatus,
} from '../src/lib/coverage.ts'
import {
  VIEWPOINTS,
  getViewpoint,
  viewpointToUrlState,
} from '../src/lib/viewpoints.ts'
import { serializeUrlState } from '../src/lib/url-state.ts'

import type { MetamodelEntity, MetamodelLayer } from '../src/types'

function entity(partial: Partial<MetamodelEntity>): MetamodelEntity {
  return {
    id: 'SO',
    name: 'Strategic Objective',
    layerId: 'layer1',
    attributes: [],
    ...partial,
  }
}

const layers: MetamodelLayer[] = [
  { id: 'layer1', number: 1, name: 'Ecosystem & Value Network', subtitle: 'L1', color: '#2dd4bf', borderColor: '#2dd4bf' },
  { id: 'dim', number: 6, name: 'Dimensions', subtitle: 'DIM', color: '#9ca3af', borderColor: '#9ca3af' },
]

/* ----------------------------- coverage ------------------------------ */

describe('coverage', () => {
  const entities: MetamodelEntity[] = [
    entity({ id: 'ACT', name: 'Actor', catalog_repo: 'dea-catalog-actors', status: 'existing', membershipRaw: { kind: 'core' } }),
    entity({ id: 'BP', name: 'Business Process', status: 'proposed', membershipRaw: { kind: 'profile', profile: 'dea:business' } }),
    entity({ id: 'MMT', name: 'Maturity Model', layerId: 'dim', status: 'planned' }),
    entity({ id: 'MTR', name: 'Metric', layerId: 'dim', layer_name: 'Measurement Dimension', status: 'planned', ecfCoordinatesRaw: { domain: null, stage: null } }),
  ]

  it('counts catalog coverage', () => {
    const r = buildCoverageReport(entities, layers)
    assert.equal(r.total, 4)
    assert.equal(r.cataloged, 1)
    assert.equal(r.unplanned, 3)
    assert.deepEqual(
      r.catalogBacklog.map((e) => e.id).sort(),
      ['BP', 'MMT', 'MTR'],
    )
  })

  it('aggregates status counts sorted by frequency', () => {
    const r = buildCoverageReport(entities, layers)
    assert.deepEqual(r.statusCounts[0], { status: 'planned', count: 2 })
    assert.ok(r.statusCounts.some((s) => s.status === 'existing' && s.count === 1))
  })

  it('counts per-layer entities', () => {
    const r = buildCoverageReport(entities, layers)
    const l1 = r.layerCounts.find((l) => l.layer.id === 'layer1')
    const dim = r.layerCounts.find((l) => l.layer.id === 'dim')
    assert.equal(l1!.count, 2)
    assert.equal(dim!.count, 2)
  })

  it('surfaces ECF coordinate presence (even when null)', () => {
    const r = buildCoverageReport(entities, layers)
    assert.equal(r.withEcf.length, 1)
    assert.equal(r.withEcf[0].id, 'MTR')
  })

  it('pct is safe and rounds', () => {
    assert.equal(pct(1, 4), 25)
    assert.equal(pct(0, 0), 0)
    assert.equal(pct(2, 3), 67)
  })

  it('dominantStatus returns the most common status', () => {
    assert.equal(dominantStatus(entities), 'planned')
    assert.equal(dominantStatus([]), null)
  })
})

/* ---------------------------- viewpoints ----------------------------- */

describe('viewpoints (issue #3)', () => {
  it('presets have unique ids, labels, and at least one layer', () => {
    const ids = new Set(VIEWPOINTS.map((v) => v.id))
    assert.equal(ids.size, VIEWPOINTS.length)
    for (const vp of VIEWPOINTS) {
      assert.ok(vp.layers.length >= 1, `${vp.id} has layers`)
      assert.ok(vp.audience.length > 0)
      assert.ok(vp.description.length > 0)
    }
  })

  it('getViewpoint is case-insensitive and returns null for unknown', () => {
    assert.equal(getViewpoint('CTO')!.id, 'cto')
    assert.equal(getViewpoint('Core')!.id, 'core')
    assert.equal(getViewpoint('nope'), null)
  })

  it('viewpointToUrlState produces canonical, serializable state', () => {
    const vp = getViewpoint('cto')!
    const state = viewpointToUrlState(vp)
    assert.equal(state.view, 'interactive')
    assert.equal(state.membership, 'profile:dea:technology')
    const qs = serializeUrlState(state)
    assert.ok(qs.includes('view=interactive'))
    assert.ok(qs.includes('membership=profile%3Adea%3Atechnology'))
    assert.ok(qs.includes('layers='))
  })

  it('core viewpoint covers all five architecture layers', () => {
    const vp = getViewpoint('core')!
    assert.deepEqual(vp.layers, ['layer1', 'layer2', 'layer3', 'layer4', 'layer5'])
    assert.equal(vp.membership, 'core')
  })
})
