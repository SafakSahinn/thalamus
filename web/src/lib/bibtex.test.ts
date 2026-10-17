import { describe, expect, it } from 'vitest';
import { bibFile, citeKey, formatCite, parseBibtex, toBibtex } from './bibtex';
import type { CiteMeta } from './scholar';

const kalman: CiteMeta = {
  type: 'article', title: 'A New Approach to Linear Filtering and Prediction Problems',
  authors: [{ given: 'R. E.', family: 'Kalman' }], year: 1960, venue: 'Journal of Basic Engineering',
  volume: '82', issue: '1', pages: '35-45', doi: '10.1115/1.3662552', url: 'https://doi.org/10.1115/1.3662552',
};

describe('BibTeX ve kaynakça', () => {
  it('anahtar ve BibTeX üretir, geri okur', () => {
    expect(citeKey(kalman)).toBe('kalman1960approach');
    const bib = toBibtex(kalman);
    expect(bib).toContain('@article{kalman1960approach,');
    expect(bib).toContain('journal = {Journal of Basic Engineering}');
    expect(bib).toContain('pages = {35--45}');
    const [back] = parseBibtex(bib);
    expect(back).toMatchObject({ type: 'article', title: kalman.title, year: 1960, venue: kalman.venue, pages: '35-45', doi: kalman.doi });
    expect(back.authors).toEqual([{ family: 'Kalman', given: 'R. E.' }]);
  });

  it('Zotero/Scholar biçimindeki kayıtları okur, tekrar eden anahtarlara ek verir', () => {
    const src = `@inproceedings{vaswani2017,
  title={Attention is {All} You Need},
  author={Vaswani, Ashish and Shazeer, Noam and Parmar, Niki},
  booktitle="Advances in Neural Information Processing Systems",
  year=2017
}
@comment{x}
@misc{a, title={Ön baskı}, author={Ali Veli}, eprint={2401.01234}, archivePrefix={arXiv}, year={2024}}`;
    const list = parseBibtex(src);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ type: 'inproceedings', title: 'Attention is All You Need', venue: 'Advances in Neural Information Processing Systems', year: 2017 });
    expect(list[0].authors.map((a) => a.family)).toEqual(['Vaswani', 'Shazeer', 'Parmar']);
    expect(list[1]).toMatchObject({ arxiv: '2401.01234', venue: 'arXiv', authors: [{ family: 'Veli', given: 'Ali' }] });
    expect(bibFile([kalman, kalman])).toContain('kalman1960approachb');
  });

  it('IEEE ve APA biçimleri', () => {
    expect(formatCite(kalman, 'ieee')).toBe('R. E. Kalman, “A New Approach to Linear Filtering and Prediction Problems,” Journal of Basic Engineering, vol. 82, no. 1, pp. 35–45, 1960. doi: 10.1115/1.3662552.');
    expect(formatCite(kalman, 'apa')).toBe('Kalman, R. E. (1960). A New Approach to Linear Filtering and Prediction Problems. Journal of Basic Engineering, 82(1), 35–45. https://doi.org/10.1115/1.3662552');
  });
});
