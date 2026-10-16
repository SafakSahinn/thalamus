import { describe, expect, it } from 'vitest';
import type { Note } from './types';
import { icsFile, upcoming, whenText } from './upcoming';

const mk = (id: string, type: string, title: string, props: Record<string, unknown>): Note => ({
  id, type, title, props, content: null, text: '', links: [], pinned: false, created_at: '', updated_at: '', deleted_at: null,
});

describe('yaklaşan tarihler', () => {
  const today = '2026-10-16';
  const notes = [
    mk('c', 'conference', 'ICASSP', { deadline: '2026-10-20', start: '2027-05-01', status: 'Başvuracağım' }),
    mk('l', 'lab', 'RC deneyi', { date: '2026-10-14', due: '2026-10-15', status: 'Rapor yazılıyor' }),
    mk('l2', 'lab', 'Op-amp', { due: '2026-10-15', status: 'Teslim edildi' }),
    mk('b', 'book', 'Sapiens', { finished: '2026-10-17', status: 'Okunuyor' }),
  ];
  it('pencere içindeki tarihleri sıralı verir, bitmiş işlerin geçmiş tarihlerini atlar', () => {
    const u = upcoming(notes, 14, 2, today).map((x) => `${x.note.title}:${x.def.key}:${x.days}`);
    expect(u).toEqual(['RC deneyi:due:-1', 'Sapiens:finished:1', 'ICASSP:deadline:4']);
  });
  it('metin ve takvim dosyası', () => {
    expect(whenText(0)).toBe('bugün');
    expect(whenText(-3)).toBe('3 gün önce');
    const ics = icsFile(notes[0], { key: 'deadline', label: 'Son başvuru', kind: 'date' }, '2026-10-20');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261020');
    expect(ics).toContain('DTEND;VALUE=DATE:20261021');
    expect(ics).toContain('SUMMARY:ICASSP — Son başvuru');
    expect(ics).toContain('TRIGGER:-P1D');
  });
});
