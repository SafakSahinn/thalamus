import { describe, expect, it } from 'vitest';
import { runRules, type Rule } from './automations';

const T = '2026-10-17';
const done: Rule = { id: 'a', on: true, when: { kind: 'changed', key: 'status', to: 'Bitti' }, then: [{ key: 'finished', value: 'today' }] };
const created: Rule = { id: 'b', on: true, when: { kind: 'created' }, then: [{ key: 'status', value: 'Okunacak' }, { key: 'fav', value: 'true' }] };

describe('otomasyonlar', () => {
  it('alan belirli değere geçince eylemi uygular', () => {
    expect(runRules([done], { status: 'Okunuyor' }, { status: 'Bitti' }, T)).toEqual({ finished: T });
    expect(runRules([done], { status: 'Bitti' }, { status: 'Bitti', x: 1 }, T)).toBeNull(); // değişmedi
    expect(runRules([done], { status: 'Okunacak' }, { status: 'Okunuyor' }, T)).toBeNull(); // başka değer
  });
  it('yeni kayıtta çalışır, kapalı kural ve zaten uygun değer atlanır', () => {
    expect(runRules([created], null, {}, T)).toEqual({ status: 'Okunacak', fav: true });
    expect(runRules([created], null, { status: 'Okunacak' }, T)).toEqual({ fav: true });
    expect(runRules([{ ...created, on: false }], null, {}, T)).toBeNull();
    expect(runRules([created], { status: 'x' }, { status: 'y' }, T)).toBeNull();
  });
  it('herhangi bir değişiklikte ve çoklu seçime ekleme ile', () => {
    const any: Rule = { id: 'c', on: true, when: { kind: 'changed', key: 'rating' }, then: [{ key: 'reviewed', value: 'today' }] };
    expect(runRules([any], { rating: 3 }, { rating: 4 }, T)).toEqual({ reviewed: T });
    const tag: Rule = { id: 'd', on: true, when: { kind: 'changed', key: 'tags', to: 'acil' }, then: [{ key: 'pri', value: '5' }] };
    expect(runRules([tag], { tags: ['a'] }, { tags: ['a', 'acil'] }, T, (k) => (k === 'pri' ? 'number' : undefined))).toEqual({ pri: 5 });
    expect(runRules([tag], { tags: ['acil'] }, { tags: ['acil', 'b'] }, T)).toBeNull();
  });
});
