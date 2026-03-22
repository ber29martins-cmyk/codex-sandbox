import test from 'node:test';
import assert from 'node:assert/strict';
import { getBetaAccessValidationError } from '../src/lib/betaAccessForm.ts';

test('formulário beta: mantém pré-validação de campos obrigatórios', () => {
  assert.equal(getBetaAccessValidationError('', ''), 'invalid');
  assert.equal(getBetaAccessValidationError('   ', 'medico@hospital.com'), 'invalid');
  assert.equal(getBetaAccessValidationError('PLANTAO-1234', ''), 'invalid_email');
  assert.equal(getBetaAccessValidationError('PLANTAO-1234', '   '), 'invalid_email');
  assert.equal(getBetaAccessValidationError('PLANTAO-1234', 'medico@hospital.com'), null);
});
