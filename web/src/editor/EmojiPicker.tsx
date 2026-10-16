import { useEffect, useRef, useState } from 'react';

const GROUPS: [string, string][] = [
  ['Sık', '💡⭐📌✅❗❓⚠️🔥🎯📎🔗🗂️📝✏️🖊️📖📚📄📑🗒️📅⏰🧠💭'],
  ['Akademik', '🎓🏫🔬🧪🧫🧬⚗️🔭📐📏🧮💻🖥️⌨️🖱️💾📊📈📉🗃️🏛️📜🧾✒️🔍'],
  ['Elektronik', '⚡🔌🔋💡📡🛰️🤖⚙️🔧🔩🧲📟📠☎️📱🎛️🎚️🔊📶🌐💽🧯🛠️⛓️'],
  ['Kişiler', '😀🙂😊🤔😎🤓🧐😴🥳😮😢😡👍👎👏🙏💪🫶👀🗣️👤👥🧑‍🎓🧑‍🏫🧑‍🔬'],
  ['Doğa', '🌱🌿🍀🌳🌸🌻🌍🌙☀️⭐🌈❄️🌊🔥🐱🐶🦉🐝🦋🍎☕🍵🍫🎵🎨🎬'],
  ['Semboller', '❤️🧡💛💚💙💜🖤🤍✔️❌➕➖➗♾️🔺🔻🔷🔶⬛⬜🟥🟧🟨🟩🟦🟪'],
];

interface Props {
  onPick: (emoji: string) => void;
  onClose: () => void;
  colors?: readonly string[];
  color?: string;
  onColor?: (c: string) => void;
  allowRemove?: boolean;
}

const split = (s: string) => [...new Intl.Segmenter('tr', { granularity: 'grapheme' }).segment(s)].map((x) => x.segment);

export function EmojiPicker({ onPick, onClose, colors, color, onColor, allowRemove }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [custom, setCustom] = useState('');
  useEffect(() => {
    const out = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    setTimeout(() => document.addEventListener('mousedown', out), 0);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', out);
      document.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  return (
    <div className="emoji-picker" ref={ref} onMouseDown={(e) => e.stopPropagation()}>
      {colors && onColor && (
        <div className="ep-colors">
          {colors.map((c) => (
            <button key={c} type="button" className={`ep-color bg-${c} ${c === color ? 'on' : ''}`} title={c} onClick={() => onColor(c)} />
          ))}
        </div>
      )}
      <div className="ep-scroll">
        {GROUPS.map(([name, chars]) => (
          <div key={name}>
            <div className="ep-group">{name}</div>
            <div className="ep-grid">
              {split(chars).map((e, i) => (
                <button key={i} type="button" onClick={() => onPick(e)}>{e}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="ep-foot">
        <input value={custom} placeholder="Başka emoji yapıştır" onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && custom.trim() && onPick(custom.trim())} />
        {allowRemove && <button type="button" className="btn small ghost" onClick={() => onPick('')}>Kaldır</button>}
      </div>
    </div>
  );
}
