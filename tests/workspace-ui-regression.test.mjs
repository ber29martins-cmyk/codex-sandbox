import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkspaceContextBadges } from '../src/lib/workspaceUi.ts';

test('contexto de workspace exibe perfil/template/progresso sem alterar fluxo clínico', () => {
  const badges = buildWorkspaceContextBadges({
    profile: 'pediatria',
    templateLabel: 'Otite média aguda',
    hmaItemsCount: 6,
    hmaPresentCount: 2,
    hmaNegCount: 1,
    alarmCount: 3,
    rxSelectedCount: 4
  });

  assert.deepEqual(badges, [
    'Perfil: Pediatria',
    'Template: Otite média aguda',
    'HMA: 3/6',
    'Alarmes: 3',
    'RX selecionados: 4'
  ]);
});
