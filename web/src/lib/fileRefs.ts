// Kullanılmayan ekleri bulma: notlarda (çöptekiler dahil) ve ayarlarda geçen gd:// / local:// adresleri
// toplanır; hiçbir yerde geçmeyen dosyalar bir süre bekledikten sonra kaldırılır (bkz. store.cleanupFiles).

import type { Note } from './types';

const REF = /\b(gd|local):\/\/([\w-]+)/g;

function scan(text: string, out: Set<string>) {
  for (const m of text.matchAll(REF)) out.add(`${m[1]}:${m[2]}`);
}

/**
 * Kullanımdaki dosyalar: "gd:<Drive kimliği>" ya da "local:<anahtar>".
 * Çöpteki notlar da sayılır (geri yüklenebilirler); paylaşılan sayfanın herkese açık görselleri
 * (__shareFiles, çıplak Drive kimlikleri) de sayfa yayındayken korunur.
 */
export function referencedFiles(notes: Iterable<Note>, settings: unknown): Set<string> {
  const out = new Set<string>();
  for (const n of notes) {
    scan(JSON.stringify(n.props ?? {}), out);
    if (n.content) scan(JSON.stringify(n.content), out);
    const shared = n.props?.__shareFiles;
    if (Array.isArray(shared)) for (const id of shared) if (typeof id === 'string') out.add(`gd:${id}`);
  }
  if (settings) scan(JSON.stringify(settings), out);
  return out;
}

export interface FileCandidate {
  key: string;
  /** Drive'daki oluşturulma zamanı (ms); yeni yüklenen dosyaya, notu henüz eşitlenmemiş olabilir diye dokunulmaz */
  createdMs?: number;
}

/**
 * Hangi dosyalar kaldırılsın? Bir dosya ancak `grace` süresi boyunca kesintisiz kullanılmadıysa kaldırılır
 * (geri alma, başka cihazdan gelecek değişiklik için pay). `since`: dosyanın ilk kez kullanılmaz görüldüğü an.
 */
export function planCleanup(cands: FileCandidate[], refs: Set<string>, since: Record<string, number>, now: number, grace: number) {
  const next: Record<string, number> = {};
  const remove: string[] = [];
  for (const c of cands) {
    if (refs.has(c.key)) continue;
    if (c.createdMs !== undefined && !(now - c.createdMs >= grace)) continue;
    const first = since[c.key] ?? now;
    if (now - first >= grace) remove.push(c.key);
    else next[c.key] = first;
  }
  return { remove, since: next };
}
