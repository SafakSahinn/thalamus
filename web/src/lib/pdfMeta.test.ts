import { describe, expect, it } from 'vitest';
import { analyze, itemsToLines, prettyHeading, type PdfLine } from './pdfMeta';
import { titleSimilarity } from './scholar';

const L = (text: string, size = 10, page = 1): PdfLine => ({ text, size, page });

describe('PDF ayrıştırma', () => {
  it('IEEE makalesi: DOI, başlık, yazarlar, özet, anahtar kelimeler, bölümler', () => {
    const lines = [
      L('IEEE TRANSACTIONS ON INDUSTRIAL ELECTRONICS, VOL. 64, NO. 12, DECEMBER 2017', 7),
      L('Analysis and Suppression of Limit Cycle Oscillation', 22),
      L('for Transmission System With Backlash Nonlinearity', 22),
      L('Can Wang, Ming Yang, Member, IEEE, and Dianguo Xu, Fellow, IEEE', 11),
      L('Abstract—This paper mainly deals with the prediction and suppres-', 9),
      L('sion of limit cycle oscillation existed in the two-mass system.', 9),
      L('Index Terms—Backlash nonlinearity, describing function, limit', 9),
      L('cycle.', 9),
      L('I. I NTRODUCTION', 10),
      L('Backlash is a common nonlinearity in industrial servo systems and it', 10),
      L('Manuscript received March 3, 2017. Digital Object Identifier 10.1109/TIE.2017.2711564', 8),
      L('II. MODEL OF MECHANICAL VIBRATION WITH BACKLASH', 10),
      L('A. Model of a Two-Mass System With Backlash', 10),
      L('The DC motor drives the load through the gear and the PID loop is', 10),
      L('B. Analysis of Semi-/Full-Closed-Loop Control', 10),
      L('III. LIMIT CYCLE OF THE PID CONTROLLED SYSTEM WITH', 10),
      L('BACKLASH', 10),
      L('2. this is a wrapped sentence inside body text that should be ignored', 10),
      L('IV. CONCLUSION', 10),
      L('REFERENCES', 10),
      L('V. NOT A HEADING', 10),
    ];
    const r = analyze(lines);
    expect(r.doi).toBe('10.1109/TIE.2017.2711564');
    expect(r.title).toBe('Analysis and Suppression of Limit Cycle Oscillation for Transmission System With Backlash Nonlinearity');
    expect(r.authors).toEqual(['Can Wang', 'Ming Yang', 'Dianguo Xu']);
    expect(r.abstract).toBe('This paper mainly deals with the prediction and suppression of limit cycle oscillation existed in the two-mass system.');
    expect(r.keywords).toEqual(['Backlash nonlinearity', 'describing function', 'limit cycle']);
    expect(r.sections.map((s) => [s.level, s.text])).toEqual([
      [1, 'I. Introduction'],
      [1, 'II. Model of Mechanical Vibration with Backlash'],
      [2, 'A. Model of a Two-Mass System With Backlash'],
      [2, 'B. Analysis of Semi-/Full-Closed-Loop Control'],
      [1, 'III. Limit Cycle of the PID Controlled System with Backlash'],
      [1, 'IV. Conclusion'],
    ]);
  });

  it('numaralı rapor: gövdedeki numaralı listeyi başlık sanmaz', () => {
    const lines = [
      L('DC Motorlu Tek Eklemli Robot Kolu', 17),
      L('Durum Uzayı Modeli', 12),
      L('1. Sistem seçimi ve gerekçesi', 12),
      L('Bu projeyi seçmemin başlıca 3 sebebi var:', 10.9),
      L('1. Proje elektrik-elektronik mühendisliğine daha yakın olduğu için kendime daha yakın buldum.', 10.9),
      L('2. Simülasyon uygulamalarında projeyi modelleyebilirim. Kişisel olarak bu şekilde', 10.9),
      L('2. Fiziksel şema ve değişkenler', 12),
      L('2.1 Elektrik kısmı', 11),
      L('3. Hareket denklemleri', 12),
      L('Kaynaklar', 12),
    ];
    const r = analyze(lines);
    expect(r.title).toBe('DC Motorlu Tek Eklemli Robot Kolu');
    expect(r.abstract).toBeUndefined();
    expect(r.sections.map((s) => s.text)).toEqual(['1. Sistem seçimi ve gerekçesi', '2. Fiziksel şema ve değişkenler', '2.1 Elektrik kısmı', '3. Hareket denklemleri']);
  });

  it('PDF yer imleri varsa bölümler oradan gelir, künye bölümleri atlanır', () => {
    const r = analyze([L('A Title Long Enough For Detection', 18)], {
      outline: [
        { title: 'Abstract', page: 1, level: 1 },
        { title: '1 Introduction', page: 1, level: 1 },
        { title: '2 Method', page: 2, level: 1 },
        { title: '2.1 Setup', page: 2, level: 2 },
        { title: '3 Results', page: 4, level: 1 },
        { title: 'Data availability statement', page: 6, level: 1 },
      ],
    });
    expect(r.sections.map((s) => [s.level, s.text])).toEqual([[1, '1 Introduction'], [1, '2 Method'], [2, '2.1 Setup'], [1, '3 Results']]);
  });

  it('XMP içindeki DOI ve arXiv numarası', () => {
    expect(analyze([L('x')], { xmp: '<prism:doi>10.1145/3290605.3300233</prism:doi>' }).doi).toBe('10.1145/3290605.3300233');
    expect(analyze([L('arXiv:1706.03762v5 [cs.CL] 6 Dec 2017', 8)]).arxiv).toBe('1706.03762');
  });

  it('küçük büyük harf (small caps) öğeleri tek kelimede birleşir', () => {
    const it = (str: string, x: number, size: number, width: number) => ({ str, transform: [size, 0, 0, size, x, 700], width, height: size });
    const lines = itemsToLines([it('I. I', 50, 10, 12), it('NTRODUCTION', 62, 8, 60)], 1);
    expect(lines[0].text).toBe('I. INTRODUCTION');
  });

  it('başlık düzeltme: kısaltmalar korunur, küçük kelimeler küçük', () => {
    expect(prettyHeading('DESIGN OF THE PID CONTROLLER FOR DC MOTORS', new Set(['PID', 'DC']))).toBe('Design of the PID Controller for DC Motors');
    expect(prettyHeading('Already Mixed Case', new Set())).toBe('Already Mixed Case');
  });

  it('başlık benzerliği', () => {
    expect(titleSimilarity('Friction Generated Limit Cycles', 'Friction generated limit cycles')).toBe(1);
    expect(titleSimilarity('Friction Generated Limit Cycles', 'Friction compensation in servo drives')).toBeLessThan(0.5);
  });
});
