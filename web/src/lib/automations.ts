// Koleksiyon otomasyonları (Notion'daki gibi): "ne zaman" olunca "ne yap".
// Kurallar ayarlarda koleksiyon başına tutulur (Drive ile eşitlenir); bu cihazda not değişince uygulanır.

export type Trigger =
  | { kind: 'created' }
  /** Bir alan değişince; "to" verilmişse yalnızca o değere geçince */
  | { kind: 'changed'; key: string; to?: string };

export interface Action {
  key: string;
  /** "today" = bugünün tarihi, "clear" = boşalt, "true"/"false" onay kutusu; diğerleri olduğu gibi */
  value: string;
}

export interface Rule {
  id: string;
  on: boolean;
  when: Trigger;
  then: Action[];
}

const asText = (v: unknown) => (v === undefined || v === null ? '' : Array.isArray(v) ? v.map(String).join(',') : String(v));

/** Değerin bu tetikleyici için "yeni" olup olmadığı (çoklu seçimde: değer listeye yeni eklendiyse) */
function becameTo(oldV: unknown, newV: unknown, to: string): boolean {
  if (Array.isArray(newV)) return newV.map(String).includes(to) && !(Array.isArray(oldV) && oldV.map(String).includes(to));
  if (to === 'true' || to === 'false') return String(Boolean(newV)) === to && String(Boolean(oldV)) !== to;
  return asText(newV) === to && asText(oldV) !== to;
}

export function actionValue(a: Action, today: string, kind?: string): unknown {
  if (a.value === 'clear') return undefined;
  if (a.value === 'today') return today;
  if (a.value === 'true') return true;
  if (a.value === 'false') return undefined;
  if (kind === 'number' || kind === 'rating') return Number(a.value);
  if (kind === 'multiselect') return [a.value];
  return a.value;
}

/**
 * Not değişikliğine uyan kuralların eylemleri: uygulanacak alan değişiklikleri (yoksa null).
 * old = null ise not yeni oluşturuldu.
 */
export function runRules(
  rules: Rule[] | undefined,
  old: Record<string, unknown> | null,
  next: Record<string, unknown>,
  today: string,
  kindOf: (key: string) => string | undefined = () => undefined,
): Record<string, unknown> | null {
  if (!rules?.length) return null;
  const patch: Record<string, unknown> = {};
  let any = false;
  for (const r of rules) {
    if (!r.on || !r.then.length) continue;
    const w = r.when;
    const fire = w.kind === 'created'
      ? old === null
      : old !== null && asText(old[w.key]) !== asText(next[w.key]) && (w.to === undefined || w.to === '' || becameTo(old[w.key], next[w.key], w.to));
    if (!fire) continue;
    for (const a of r.then) {
      const v = actionValue(a, today, kindOf(a.key));
      // Kendini tetiklemesin: zaten aynıysa dokunma
      if (asText(next[a.key]) === asText(v)) continue;
      patch[a.key] = v;
      any = true;
    }
  }
  return any ? patch : null;
}
