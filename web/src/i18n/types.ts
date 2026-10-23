import type tr from './locales/tr';

/** Sayıya göre değişen metin; kategoriler Intl.PluralRules'unkiler (zero: tam 0 için isteğe bağlı) */
export interface PluralMsg {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}
export type Msg = string | PluralMsg;

/** Kaynak dilin şekli: her yaprak bir mesaj (düz metin ya da çoğul biçim) */
type Shape<T> = { [K in keyof T]: T[K] extends Msg ? Msg : Shape<T[K]> };
export type Messages = Shape<typeof tr>;

type Join<A extends string, B extends string> = `${A}.${B}`;
type Keys<T> = {
  [K in keyof T & string]: T[K] extends Msg ? K : Join<K, Keys<T[K]>>;
}[keyof T & string];

/** Geçerli bütün çeviri anahtarları ('market.install' gibi) */
export type MsgKey = Keys<typeof tr>;


type Groups<T> = {
  [K in keyof T & string]: T[K] extends Msg ? never : K | Join<K, Groups<T[K]>>;
}[keyof T & string];

/** Alt mesaj grupları ('plugins.sticky.features' gibi): tList ile sıralı liste olarak okunur */
export type GroupKey = Groups<typeof tr>;
