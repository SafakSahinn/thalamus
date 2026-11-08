import { describe, expect, it } from 'vitest';
import type { Note } from './types';
import { googleCalendarUrl, icsFile, upcoming, whenText } from './upcoming';

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
  it('Google Takvim bağlantısı saat, yer ve alanları taşır', () => {
    const ev = mk('e', 'event', 'Seminer', { date: '2026-11-10', time: '14.30', location: 'B-201' });
    const all = Object.fromEntries([...notes, ev].map((n) => [n.id, n]));
    const url = new URL(googleCalendarUrl(ev, { key: 'date', label: 'Tarih', kind: 'date' }, '2026-11-10', all));
    expect(url.searchParams.get('text')).toBe('Seminer');
    expect(url.searchParams.get('dates')).toBe('20261110T143000/20261110T153000');
    expect(url.searchParams.get('location')).toBe('B-201');
    const conf = new URL(googleCalendarUrl(notes[0], { key: 'deadline', label: 'Son başvuru', kind: 'date' }, '2026-10-20', all));
    expect(conf.searchParams.get('details')).toContain('Başvuracağım');
    expect(conf.searchParams.get('dates')).toBe('20261020/20261021');
  });
});
