import test from 'node:test';
import assert from 'node:assert/strict';
import templatesData from '../src/templates/templates.json' with { type: 'json' };

const templates = templatesData.templates ?? [];

const populationById = (id) => (String(id ?? '').toLowerCase().startsWith('ped_') ? 'pediatria' : 'adulto');

test('contrato: convenção de população por prefixo de id', () => {
  assert.ok(templates.length > 0, 'sem templates para validar');

  const pediatric = templates.filter((template) => populationById(template.id) === 'pediatria');
  const adult = templates.filter((template) => populationById(template.id) === 'adulto');

  assert.ok(pediatric.length > 0, 'nenhum template pediátrico encontrado');
  assert.ok(adult.length > 0, 'nenhum template adulto encontrado');
  assert.equal(pediatric.every((template) => String(template.id).toLowerCase().startsWith('ped_')), true);
  assert.equal(adult.every((template) => !String(template.id).toLowerCase().startsWith('ped_')), true);
});
