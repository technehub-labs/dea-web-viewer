// Tests for the quick-wins enrichment: URL deep-linking (url-state.ts),
// fuzzy entity search (search.ts), and CR-4 membership filtering
// (membership.ts). Node built-in test runner, no new dev deps.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  parseUrlState,
  serializeUrlState,
  isDefaultState,
} from '../src/lib/url-state.ts'
import {
  searchEntities,
  scoreEntity,
} from '../src/lib/search.ts'
import {
  getMembership,
  buildMembershipGroups,
  membershipMatches,
} from '../src/lib/membership.ts'

import type { MetamodelEntity } from '../src/types'

function entity(partial: Partial<MetamodelEntity>): MetamodelEntity {
  return {
    id: 'SO',
    name: 'Strategic Objective',
    layerId: 'layer1',
    attributes: [],
    ...partial,
  }
}

/* ----------------------------- url-state ----------------------------- */

describe('url-state', () => {
  it('parses a full deep-link query', () => {
    const s = parseUrlState('?view=interactive&entity=SO&layers=layer1,layer3&membership=core&q=obj')
    assert.equal(s.view, 'interactive')
    assert.equal(s.entity, 'SO')
    assert.deepEqual(s.layers, ['layer1', 'layer3'])
    assert.equal(s.membership, 'core')
    assert.equal(s.q, 'obj')
  })

  it('rejects invalid view names', () => {
    assert.equal(parseUrlState('?view=bogus').view, undefined)
  })

  it('drops a full layer list (equivalent to default = all layers)', () => {
    const all = 'layer1,layer2,layer3,layer4,layer5,dim'
    assert.equal(parseUrlState(`?layers=${all}`).layers, undefined)
  })

  it('drops unknown layers', () => {
    const s = parseUrlState('?layers=layer1,layer9')
    assert.deepEqual(s.layers, ['layer1'])
  })

  it('serializes and round-trips', () => {
    const qs = serializeUrlState({
      view: 'matrix',
      entity: 'MTR',
      layers: ['layer2', 'dim'],
      membership: 'profile:dea:business',
      q: 'metric',
    })
    const back = parseUrlState(qs)
    assert.equal(back.view, 'matrix')
    assert.equal(back.entity, 'MTR')
    assert.deepEqual(back.layers, ['layer2', 'dim'])
    assert.equal(back.membership, 'profile:dea:business')
    assert.equal(back.q, 'metric')
  })

  it('serializes default state to an empty string', () => {
    assert.equal(serializeUrlState({}), '')
    assert.ok(isDefaultState({}))
    assert.ok(!isDefaultState({ view: 'matrix' }))
  })
})

/* ------------------------------ search ------------------------------- */

describe('search', () => {
  const entities: MetamodelEntity[] = [
    entity({ id: 'SO', name: 'Strategic Objective', description: 'Where the enterprise wants to be.' }),
    entity({
      id: 'BC',
      name: 'Business Capability',
      attributes: [{ name: 'capability_layer', type: 'string' }],
      description: 'The ability to deliver value.',
    }),
    entity({ id: 'MTR', name: 'Metric', description: 'A measurement.' }),
  ]

  it('prefix name match outranks substring match', () => {
    const hits = searchEntities(
      [...entities, entity({ id: 'XO', name: 'Objective Key Result' })],
      'obj',
    )
    assert.ok(hits.length >= 2)
    assert.equal(hits[0].entity.name, 'Objective Key Result') // prefix beats substring
    assert.equal(hits[1].entity.name, 'Strategic Objective')
  })

  it('finds by exact alias', () => {
    const hit = scoreEntity(entities[0], 'SO')
    assert.ok(hit)
    assert.equal(hit.field, 'alias')
  })

  it('finds by attribute name', () => {
    const hit = scoreEntity(entities[1], 'capability_layer')
    assert.ok(hit)
    assert.equal(hit.field, 'attribute')
  })

  it('finds by description substring', () => {
    const hit = scoreEntity(entities[0], 'wants to be')
    assert.ok(hit)
    assert.equal(hit.field, 'description')
  })

  it('fuzzy subsequence matches name (sfo → Strategic Objective)', () => {
    const hits = searchEntities(entities, 'sobj')
    assert.ok(hits.length >= 1)
    assert.equal(hits[0].entity.id, 'SO')
  })

  it('returns empty for blank query and honours limit', () => {
    assert.deepEqual(searchEntities(entities, '  '), [])
    assert.ok(searchEntities(entities, 'e', 2).length <= 2)
  })
})

/* ---------------------------- membership ----------------------------- */

describe('membership (CR-4)', () => {
  const entities: MetamodelEntity[] = [
    entity({ id: 'ACT', name: 'Actor', membershipRaw: { kind: 'core' } }),
    entity({ id: 'BP', name: 'Business Process', membershipRaw: { kind: 'profile', profile: 'dea:business' } }),
    entity({ id: 'DS', name: 'Data Subject', membershipRaw: { kind: 'profile', profile: 'dea:data' } }),
    entity({ id: 'MMT', name: 'Maturity Model', membershipRaw: undefined }),
  ]

  it('extracts core / profile / unassigned membership', () => {
    assert.deepEqual(getMembership(entities[0]), { kind: 'core', label: 'core' })
    assert.deepEqual(getMembership(entities[1]), {
      kind: 'profile', profile: 'dea:business', label: 'business',
    })
    assert.deepEqual(getMembership(entities[3]), { kind: 'unassigned', label: 'unassigned' })
  })

  it('groups: core first, profiles alphabetical, unassigned last', () => {
    const groups = buildMembershipGroups(entities)
    assert.deepEqual(groups.map((g) => g.key), [
      'core',
      'profile:dea:business',
      'profile:dea:data',
      'unassigned',
    ])
    assert.equal(groups[0].count, 1)
    assert.equal(groups[3].count, 1)
  })

  it('membershipMatches filters correctly and null = all', () => {
    assert.ok(membershipMatches(entities[0], null))
    assert.ok(membershipMatches(entities[0], 'core'))
    assert.ok(!membershipMatches(entities[1], 'core'))
    assert.ok(membershipMatches(entities[1], 'profile:dea:business'))
    assert.ok(!membershipMatches(entities[1], 'profile:dea:data'))
    assert.ok(membershipMatches(entities[3], 'unassigned'))
    assert.ok(!membershipMatches(entities[0], 'unassigned'))
  })
})
