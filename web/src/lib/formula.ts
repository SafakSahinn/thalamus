// Notion tarzı formül dili. eval kullanmaz: ifade ayrıştırılıp ağaç olarak değerlendirilir.
//
//   prop("Sayfa") / 30
//   if(prop("Durum") == "Bitti", "✅", "⏳")
//   dateBetween(today(), prop("Bitiş"), "days") + " gün"
//   round(prop("Puan") * 20) + "%"
//
// Değerler: sayı, metin, mantıksal, tarih (Date) ve liste. Hata durumunda FormulaError fırlatılır.

export class FormulaError extends Error {}

type Tok = { t: 'num'; v: number } | { t: 'str'; v: string } | { t: 'id'; v: string } | { t: 'op'; v: string };

const OPS = ['==', '!=', '>=', '<=', '&&', '||', '+', '-', '*', '/', '%', '^', '>', '<', '!', '(', ')', ','];

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = src.slice(i).match(/^\d*\.?\d+(e[+-]?\d+)?/i)!;
      out.push({ t: 'num', v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (c === '"' || c === "'" || c === '“' || c === '”') {
      const close = c === '“' ? '”' : c;
      let j = i + 1;
      let v = '';
      while (j < src.length && src[j] !== close && !(close === '”' && src[j] === '"')) {
        if (src[j] === '\\' && j + 1 < src.length) { v += src[j + 1]; j += 2; continue; }
        v += src[j++];
      }
      if (j >= src.length) throw new FormulaError('Kapatılmamış tırnak');
      out.push({ t: 'str', v });
      i = j + 1;
      continue;
    }
    if (/[\p{L}_]/u.test(c)) {
      const m = src.slice(i).match(/^[\p{L}_][\p{L}\p{N}_]*/u)!;
      const w = m[0];
      if (w === 'and') out.push({ t: 'op', v: '&&' });
      else if (w === 'or') out.push({ t: 'op', v: '||' });
      else if (w === 'not') out.push({ t: 'op', v: '!' });
      else out.push({ t: 'id', v: w });
      i += w.length;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new FormulaError(`Beklenmeyen karakter: ${c}`);
    out.push({ t: 'op', v: op });
    i += op.length;
  }
  return out;
}

type Node =
  | { k: 'lit'; v: unknown }
  | { k: 'call'; name: string; args: Node[] }
  | { k: 'un'; op: string; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node };

const PREC: Record<string, number> = { '||': 1, '&&': 2, '==': 3, '!=': 3, '>': 4, '<': 4, '>=': 4, '<=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6, '^': 8 };

function parse(toks: Tok[]): Node {
  let i = 0;
  const peek = () => toks[i];
  const isOp = (v: string) => peek()?.t === 'op' && peek()!.v === v;
  const expect = (v: string) => {
    if (!isOp(v)) throw new FormulaError(`"${v}" bekleniyordu`);
    i++;
  };
  const primary = (): Node => {
    const tk = toks[i++];
    if (!tk) throw new FormulaError('İfade eksik');
    if (tk.t === 'num' || tk.t === 'str') return { k: 'lit', v: tk.v };
    if (tk.t === 'id') {
      if (tk.v === 'true' || tk.v === 'false') return { k: 'lit', v: tk.v === 'true' };
      if (isOp('(')) {
        i++;
        const args: Node[] = [];
        if (!isOp(')')) {
          args.push(expr(0));
          while (isOp(',')) { i++; args.push(expr(0)); }
        }
        expect(')');
        return { k: 'call', name: tk.v, args };
      }
      throw new FormulaError(`Bilinmeyen ad: ${tk.v} (alan için prop("Ad") yaz)`);
    }
    if (tk.v === '(') {
      const e = expr(0);
      expect(')');
      return e;
    }
    if (tk.v === '-' || tk.v === '!') return { k: 'un', op: tk.v, a: unary(tk.v) };
    throw new FormulaError(`Beklenmeyen: ${tk.v}`);
  };
  const unary = (op: string): Node => (op === '-' ? expr(7) : expr(2.5));
  const expr = (min: number): Node => {
    let left = primary();
    for (;;) {
      const tk = peek();
      if (!tk || tk.t !== 'op' || !(tk.v in PREC)) break;
      const p = PREC[tk.v];
      if (p < min) break;
      i++;
      const right = expr(tk.v === '^' ? p : p + 1);
      left = { k: 'bin', op: tk.v, a: left, b: right };
    }
    return left;
  };
  const tree = expr(0);
  if (i < toks.length) throw new FormulaError(`Fazladan: ${(toks[i] as { v: unknown }).v}`);
  return tree;
}

// ---------- değerlendirme ----------

export interface FormulaCtx {
  /** prop("Ad") → değer */
  prop: (name: string) => unknown;
  now?: Date;
}

const isDateStr = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);

export function toDate(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (isDateStr(v)) {
    const s = v as string;
    return s.length === 10 ? new Date(`${s}T00:00:00`) : new Date(s);
  }
  return null;
}

export function toNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.getTime();
  if (Array.isArray(v)) return v.length;
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function toStr(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) {
    const p = (x: number) => String(x).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  if (Array.isArray(v)) return v.map(toStr).join(', ');
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);
  return String(v);
}

const truthy = (v: unknown) => (Array.isArray(v) ? v.length > 0 : Boolean(v) && v !== '0');
const empty = (v: unknown) => v == null || v === '' || (Array.isArray(v) && !v.length);

const UNITS: Record<string, number> = { minutes: 60e3, hours: 3600e3, days: 864e5, weeks: 6048e5, dakika: 60e3, saat: 3600e3, gün: 864e5, gun: 864e5, hafta: 6048e5 };

function dateDiff(a: Date, b: Date, unit: string) {
  if (unit === 'months' || unit === 'ay') return (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth());
  if (unit === 'years' || unit === 'yıl' || unit === 'yil') return a.getFullYear() - b.getFullYear();
  return Math.floor((a.getTime() - b.getTime()) / (UNITS[unit] ?? UNITS.days));
}

function dateAdd(d: Date, n: number, unit: string) {
  const x = new Date(d);
  if (unit === 'months' || unit === 'ay') x.setMonth(x.getMonth() + n);
  else if (unit === 'years' || unit === 'yıl' || unit === 'yil') x.setFullYear(x.getFullYear() + n);
  else x.setTime(x.getTime() + n * (UNITS[unit] ?? UNITS.days));
  return x;
}

type Fn = (args: unknown[], ctx: FormulaCtx) => unknown;

const FUNCS: Record<string, Fn> = {
  prop: ([n], ctx) => ctx.prop(toStr(n)),
  if: ([c, a, b]) => (truthy(c) ? a : b),
  empty: ([v]) => empty(v),
  concat: (a) => a.map(toStr).join(''),
  join: ([list, sep]) => (Array.isArray(list) ? list.map(toStr).join(toStr(sep ?? ', ')) : toStr(list)),
  length: ([v]) => (Array.isArray(v) ? v.length : toStr(v).length),
  lower: ([v]) => toStr(v).toLocaleLowerCase('tr'),
  upper: ([v]) => toStr(v).toLocaleUpperCase('tr'),
  contains: ([s, sub]) => (Array.isArray(s) ? s.map(toStr).includes(toStr(sub)) : toStr(s).toLocaleLowerCase('tr').includes(toStr(sub).toLocaleLowerCase('tr'))),
  replace: ([s, a, b]) => toStr(s).split(toStr(a)).join(toStr(b)),
  slice: ([s, a, b]) => toStr(s).slice(toNum(a), b === undefined ? undefined : toNum(b)),
  format: ([v]) => toStr(v),
  toNumber: ([v]) => toNum(v),
  round: ([v, d]) => { const f = 10 ** toNum(d ?? 0); return Math.round(toNum(v) * f) / f; },
  floor: ([v]) => Math.floor(toNum(v)),
  ceil: ([v]) => Math.ceil(toNum(v)),
  abs: ([v]) => Math.abs(toNum(v)),
  sqrt: ([v]) => Math.sqrt(toNum(v)),
  pow: ([a, b]) => toNum(a) ** toNum(b),
  min: (a) => Math.min(...a.flat().map(toNum)),
  max: (a) => Math.max(...a.flat().map(toNum)),
  sum: (a) => a.flat().map(toNum).reduce((x, y) => x + y, 0),
  now: (_a, ctx) => ctx.now ?? new Date(),
  today: (_a, ctx) => { const d = new Date(ctx.now ?? new Date()); d.setHours(0, 0, 0, 0); return d; },
  dateBetween: ([a, b, u]) => {
    const x = toDate(a), y = toDate(b);
    if (!x || !y) return '';
    return dateDiff(x, y, toStr(u ?? 'days'));
  },
  dateAdd: ([d, n, u]) => { const x = toDate(d); return x ? dateAdd(x, toNum(n), toStr(u ?? 'days')) : ''; },
  year: ([d]) => toDate(d)?.getFullYear() ?? '',
  month: ([d]) => (toDate(d) ? toDate(d)!.getMonth() + 1 : ''),
  day: ([d]) => toDate(d)?.getDate() ?? '',
  formatDate: ([d]) => {
    const x = toDate(d);
    return x ? new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(x) : '';
  },
};

export const FUNCTION_NAMES = Object.keys(FUNCS);

function evalNode(n: Node, ctx: FormulaCtx): unknown {
  switch (n.k) {
    case 'lit':
      return n.v;
    case 'call': {
      const f = FUNCS[n.name];
      if (!f) throw new FormulaError(`Bilinmeyen işlev: ${n.name}()`);
      // if() yalnızca seçilen dalı değerlendirsin
      if (n.name === 'if') {
        if (n.args.length < 2) throw new FormulaError('if(koşul, doğruysa, yanlışsa)');
        return truthy(evalNode(n.args[0], ctx)) ? evalNode(n.args[1], ctx) : n.args[2] ? evalNode(n.args[2], ctx) : '';
      }
      return f(n.args.map((a) => evalNode(a, ctx)), ctx);
    }
    case 'un': {
      const v = evalNode(n.a, ctx);
      return n.op === '-' ? -toNum(v) : !truthy(v);
    }
    case 'bin': {
      if (n.op === '&&') return truthy(evalNode(n.a, ctx)) && truthy(evalNode(n.b, ctx));
      if (n.op === '||') return truthy(evalNode(n.a, ctx)) || truthy(evalNode(n.b, ctx));
      const a = evalNode(n.a, ctx);
      const b = evalNode(n.b, ctx);
      switch (n.op) {
        case '+': {
          if (typeof a === 'number' && typeof b === 'number') return a + b;
          if ((typeof a === 'number' || typeof a === 'boolean') && (b === '' || b == null)) return toNum(a);
          if (typeof a === 'string' || typeof b === 'string' || a instanceof Date || b instanceof Date) return toStr(a) + toStr(b);
          return toNum(a) + toNum(b);
        }
        case '-': return toNum(a) - toNum(b);
        case '*': return toNum(a) * toNum(b);
        case '/': {
          const d = toNum(b);
          if (d === 0) throw new FormulaError('Sıfıra bölme');
          return toNum(a) / d;
        }
        case '%': return toNum(a) % toNum(b);
        case '^': return toNum(a) ** toNum(b);
        case '==': return toStr(a) === toStr(b);
        case '!=': return toStr(a) !== toStr(b);
        case '>': return cmp(a, b) > 0;
        case '<': return cmp(a, b) < 0;
        case '>=': return cmp(a, b) >= 0;
        case '<=': return cmp(a, b) <= 0;
      }
    }
  }
  throw new FormulaError('Geçersiz ifade');
}

function cmp(a: unknown, b: unknown) {
  const da = toDate(a), db = toDate(b);
  if (da && db) return da.getTime() - db.getTime();
  if (typeof a === 'string' && typeof b === 'string' && Number.isNaN(Number(a))) return a.localeCompare(b, 'tr');
  return toNum(a) - toNum(b);
}

const cache = new Map<string, Node>();

export function evaluate(src: string, ctx: FormulaCtx): unknown {
  let tree = cache.get(src);
  if (!tree) {
    tree = parse(lex(src));
    cache.set(src, tree);
  }
  return evalNode(tree, ctx);
}

/** Yalnızca söz dizimini denetler (alan düzenleme ekranı için) */
export function checkFormula(src: string): string | null {
  try {
    parse(lex(src));
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
