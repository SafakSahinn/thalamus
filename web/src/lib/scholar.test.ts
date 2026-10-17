import { describe, expect, it } from 'vitest';
import { parseIdent } from './scholar';

describe('DOI / arXiv tanıma', () => {
  it('farklı yazımları tanır', () => {
    expect(parseIdent('https://doi.org/10.1115/1.3662552')).toEqual({ kind: 'doi', id: '10.1115/1.3662552' });
    expect(parseIdent('doi: 10.1109/TAC.1979.1101943.')).toEqual({ kind: 'doi', id: '10.1109/TAC.1979.1101943' });
    expect(parseIdent('https://arxiv.org/abs/1706.03762v7')).toEqual({ kind: 'arxiv', id: '1706.03762' });
    expect(parseIdent('https://arxiv.org/pdf/2103.00020.pdf')).toEqual({ kind: 'arxiv', id: '2103.00020' });
    expect(parseIdent('arXiv:2401.01234')).toEqual({ kind: 'arxiv', id: '2401.01234' });
    expect(parseIdent('10.48550/arXiv.1706.03762')).toEqual({ kind: 'arxiv', id: '1706.03762' });
    expect(parseIdent('Kalman filtresi')).toBeNull();
  });
});
