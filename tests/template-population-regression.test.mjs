import test from 'node:test';
import assert from 'node:assert/strict';
import templatesData from '../src/templates/templates.json' with { type: 'json' };

const templates = templatesData.templates ?? [];

const isPediatricTemplate = (template) => String(template?.id ?? '').toLowerCase().startsWith('ped_');
const byPopulation = (profile) => templates.filter((template) => (profile === 'pediatria' ? isPediatricTemplate(template) : !isPediatricTemplate(template)));
const normalize = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

test('adulto não exibe templates pediátricos', () => {
  const adult = byPopulation('adulto');
  assert.ok(adult.length > 0, 'lista adulta vazia');
  assert.equal(adult.some(isPediatricTemplate), false);
});

test('pediatria exibe apenas templates pediátricos', () => {
  const peds = byPopulation('pediatria');
  assert.ok(peds.length > 0, 'lista pediátrica vazia');
  assert.equal(peds.every(isPediatricTemplate), true);
});

test('homônimos entre populações coexistem sem vazamento', () => {
  const adult = byPopulation('adulto');
  const peds = byPopulation('pediatria');
  const targetLabel = 'faringoamigdalite bacteriana';

  const adultHit = adult.find((template) => normalize(template.label) === targetLabel);
  const pedHit = peds.find((template) => normalize(template.label) === targetLabel);

  assert.ok(adultHit, 'homônimo adulto não encontrado');
  assert.ok(pedHit, 'homônimo pediátrico não encontrado');
  assert.notEqual(adultHit.id, pedHit.id);
  assert.equal(isPediatricTemplate(adultHit), false);
  assert.equal(isPediatricTemplate(pedHit), true);
});
