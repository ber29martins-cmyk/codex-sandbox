import test from 'node:test';
import assert from 'node:assert/strict';
import templatesData from '../src/templates/templates.json' with { type: 'json' };
import { getProfileContextLabel, getProfileDisplayName, getProfileSwitchFeedback } from '../src/lib/profileUi.ts';

const templates = templatesData.templates ?? [];

const isPediatricTemplate = (template) => String(template?.id ?? '').toLowerCase().startsWith('ped_');
const isTemplateIdCompatibleWithProfile = (id, profile) => {
  if (!id) return false;
  const isPediatricTemplateId = String(id).toLowerCase().startsWith('ped_');
  return profile === 'pediatria' ? isPediatricTemplateId : !isPediatricTemplateId;
};
const byPopulation = (profile) => templates.filter((template) => isTemplateIdCompatibleWithProfile(template.id, profile));
const reconcileTemplateIdOnPopulationChange = (currentTemplateId, nextProfile) => {
  return isTemplateIdCompatibleWithProfile(currentTemplateId, nextProfile) ? currentTemplateId : '';
};
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

test('troca de população: template incompatível limpa seleção', () => {
  const nextTemplateId = reconcileTemplateIdOnPopulationChange('ped_faringoamigdalite_bacteriana', 'adulto');
  assert.equal(nextTemplateId, '');
});

test('troca de população: template compatível mantém seleção', () => {
  const nextTemplateId = reconcileTemplateIdOnPopulationChange('faringoamigdalite_bacteriana', 'adulto');
  assert.equal(nextTemplateId, 'faringoamigdalite_bacteriana');
});

test('paridade: regra de exibição e regra de limpeza usam a mesma compatibilidade', () => {
  for (const profile of ['adulto', 'pediatria']) {
    for (const template of templates) {
      const displayIncludes = byPopulation(profile).some((current) => current.id === template.id);
      const shouldKeepSelected = reconcileTemplateIdOnPopulationChange(template.id, profile) === template.id;
      assert.equal(
        shouldKeepSelected,
        displayIncludes,
        `paridade quebrada para profile=${profile}, templateId=${template.id}`
      );
    }
  }
});

test('alternância mantém indicação de contexto coerente sem impactar seleção/listagem', () => {
  const adultTemplate = templates.find((template) => !String(template.id).toLowerCase().startsWith('ped_'));
  const pediatricTemplate = templates.find((template) => String(template.id).toLowerCase().startsWith('ped_'));
  assert.ok(adultTemplate, 'template adulto não encontrado');
  assert.ok(pediatricTemplate, 'template pediátrico não encontrado');

  assert.equal(getProfileContextLabel('adulto'), 'Contexto ativo: Adulto');
  assert.equal(getProfileContextLabel('pediatria'), 'Contexto ativo: Pediatria');

  const keptAdultId = reconcileTemplateIdOnPopulationChange(adultTemplate.id, 'adulto');
  const clearedAdultOnPed = reconcileTemplateIdOnPopulationChange(adultTemplate.id, 'pediatria');
  assert.equal(keptAdultId, adultTemplate.id);
  assert.equal(clearedAdultOnPed, '');
  assert.equal(byPopulation('adulto').some((template) => template.id === adultTemplate.id), true);
  assert.equal(byPopulation('pediatria').some((template) => template.id === adultTemplate.id), false);

  const keptPedId = reconcileTemplateIdOnPopulationChange(pediatricTemplate.id, 'pediatria');
  const clearedPedOnAdult = reconcileTemplateIdOnPopulationChange(pediatricTemplate.id, 'adulto');
  assert.equal(keptPedId, pediatricTemplate.id);
  assert.equal(clearedPedOnAdult, '');
  assert.equal(byPopulation('pediatria').some((template) => template.id === pediatricTemplate.id), true);
  assert.equal(byPopulation('adulto').some((template) => template.id === pediatricTemplate.id), false);
});

test('indicador persistente e feedback transitório refletem corretamente a alternância de perfil', () => {
  assert.equal(getProfileDisplayName('adulto'), 'Adulto');
  assert.equal(getProfileDisplayName('pediatria'), 'Pediatria');

  const feedbackToPeds = getProfileSwitchFeedback('pediatria');
  const feedbackToAdult = getProfileSwitchFeedback('adulto');
  assert.equal(feedbackToPeds, 'Perfil alterado para Pediatria');
  assert.equal(feedbackToAdult, 'Perfil alterado para Adulto');
});
