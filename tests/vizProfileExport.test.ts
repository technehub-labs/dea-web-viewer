// Tests for tranche 3: visualization-profile consumption (viz-profile.ts)
// and scoped exports (export.ts).

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  CANONICAL_PROFILE,
  loadVizProfile,
  groupForProfile,
  profilesEquivalent,
  parseVizProfileYaml,
  type VizProfile,
} from '../src/lib/viz-profile.ts'
import {
  buildJsonExport,
  buildPumlExport,
  slugify,
} from '../src/lib/export.ts'

import type { MetamodelAST, MetamodelEntity, MetamodelRelationship } from '../src/types'

function entity(partial: Partial<MetamodelEntity>): MetamodelEntity {
  return {
    id: 'SO',
    name: 'Strategic Objective',
    layerId: 'layer1',
    attributes: [],
    ...partial,
  }
}

const ast: MetamodelAST = {
  title: 'test',
  version: '1.0.0',
  layers: [],
  entities: [
    entity({
      id: 'SO',
      name: 'Strategic Objective',
      entity_id: 'dea:entity-strategic-objective',
      layer_name: 'Ecosystem & Value Network',
      status: 'proposed',
      attributes: [{ name: 'objective_id', type: 'string' }],
    }),
    entity({ id: 'BC', name: 'Business Capability' }),
  ],
  relationships: [
    { from: 'SO', to: 'BC', label: 'realizes', type: 'solid' },
    { from: 'BC', to: 'SO', label: 'impacts', type: 'dashed' },
  ],
  rawPuml: '',
}

/* --------------------------- viz-profile ----------------------------- */

describe('viz-profile (CR-8 §67 consumer)', () => {
  it('canonical profile has 12 ordered groups', () => {
    assert.equal(CANONICAL_PROFILE.groups.length, 12)
    assert.deepEqual(
      CANONICAL_PROFILE.groups.slice(0, 3).map((g) => g.key),
      ['core', 'business', 'digital'],
    )
  })

  it('maps dea: profile ids to spec groups', () => {
    assert.equal(groupForProfile('dea:business')!.label, 'Business')
    assert.equal(groupForProfile('dea:technology')!.color, '#6e7781')
    assert.equal(groupForProfile('dea:nonexistent'), undefined)
  })

  it('parses the real upstream YAML shape', () => {
    const yaml = [
      'version: 1.0.0',
      'groups:',
      '  core:        {label: OpenDEA Core,        color: "#1f6feb", order: 1}',
      '  business:    {label: Business,            color: "#8250df", order: 2}',
      'icons:',
      '  BusinessCapability: capability',
      'edge_styles:',
      '  planned:   {stroke: dashed}',
    ].join('\n')
    const parsed = parseVizProfileYaml(yaml) as VizProfile
    assert.equal(parsed.version, '1.0.0')
    assert.equal(parsed.groups.length, 2)
    assert.equal(parsed.groups[0].key, 'core')
    assert.equal(parsed.groups[0].color, '#1f6feb')
    // icons section must not be mistaken for groups
    assert.ok(!parsed.groups.some((g) => g.key === 'icons'))
  })

  it('loadVizProfile falls back to canonical on 404', async () => {
    const { profile, source } = await loadVizProfile(async () => ({ ok: false, text: async () => '' }))
    assert.equal(source, 'canonical')
    assert.equal(profile, CANONICAL_PROFILE)
  })

  it('loadVizProfile uses the remote copy when vendored and equivalent', async () => {
    const yaml = [
      'version: 1.0.0',
      'groups:',
      ...CANONICAL_PROFILE.groups.map(
        (g) => `  ${g.key}: {label: ${g.label}, color: "${g.color}", order: ${g.order}}`,
      ),
      'icons:',
      '  x: y',
    ].join('\n')
    const { profile, source } = await loadVizProfile(
      async () => ({ ok: true, text: async () => yaml }),
    )
    assert.equal(source, 'remote')
    assert.ok(profilesEquivalent(profile, CANONICAL_PROFILE))
  })
})

/* ------------------------------ export ------------------------------ */

describe('export', () => {
  it('builds a JSON export with provenance and counts', () => {
    const out = buildJsonExport(ast, {
      metamodelVersion: '1.0.0',
      membership: 'profile:dea:business',
    })
    assert.equal(out.schema, 'dea-web-viewer/export/v1')
    assert.equal(out.metamodel_version, '1.0.0')
    assert.equal(out.filters.membership, 'profile:dea:business')
    assert.equal(out.counts.entities, 2)
    assert.equal(out.counts.relationships, 2)
    assert.equal(out.entities[0].id, 'SO')
    assert.equal(out.entities[0].entity_id, 'dea:entity-strategic-objective')
    assert.equal(out.entities[0].attributes[0].name, 'objective_id')
  })

  it('builds a PUML fragment with entities, attributes, and typed arrows', () => {
    const puml = buildPumlExport(ast, { metamodelVersion: '1.0.0' })
    assert.ok(puml.includes('entity "Strategic Objective" as SO {'))
    assert.ok(puml.includes('+ objective_id : string'))
    assert.ok(puml.includes('SO --> BC : "realizes"'))       // solid
    assert.ok(puml.includes('BC ..> SO : "impacts"'))       // dashed
    assert.ok(puml.includes("' metamodel 1.0.0"))
  })

  it('emits single-line entities when they have no attributes', () => {
    const puml = buildPumlExport(ast, { metamodelVersion: '1.0.0' })
    assert.ok(puml.includes('entity "Business Capability" as BC\n'))
  })

  it('slugify makes safe download names', () => {
    assert.equal(slugify('profile:dea:business'), 'profile-dea-business')
    assert.equal(slugify('All Entities!'), 'all-entities')
  })
})
