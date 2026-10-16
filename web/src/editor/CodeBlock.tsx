import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import arduino from 'highlight.js/lib/languages/arduino';
import armasm from 'highlight.js/lib/languages/armasm';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import julia from 'highlight.js/lib/languages/julia';
import kotlin from 'highlight.js/lib/languages/kotlin';
import latex from 'highlight.js/lib/languages/latex';
import makefile from 'highlight.js/lib/languages/makefile';
import markdown from 'highlight.js/lib/languages/markdown';
import matlab from 'highlight.js/lib/languages/matlab';
import php from 'highlight.js/lib/languages/php';
import plaintext from 'highlight.js/lib/languages/plaintext';
import powershell from 'highlight.js/lib/languages/powershell';
import python from 'highlight.js/lib/languages/python';
import r from 'highlight.js/lib/languages/r';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import verilog from 'highlight.js/lib/languages/verilog';
import vhdl from 'highlight.js/lib/languages/vhdl';
import x86asm from 'highlight.js/lib/languages/x86asm';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { createLowlight } from 'lowlight';
import { useState } from 'react';

/** [kimlik, görünen ad, highlight.js tanımı] — sıralama: önce EE/gömülü sistemlerde sık kullanılanlar */
const LANGS = [
  ['c', 'C', c], ['cpp', 'C++', cpp], ['python', 'Python', python], ['matlab', 'MATLAB', matlab],
  ['verilog', 'Verilog', verilog], ['vhdl', 'VHDL', vhdl], ['arduino', 'Arduino', arduino],
  ['x86asm', 'Assembly (x86)', x86asm], ['armasm', 'Assembly (ARM)', armasm], ['julia', 'Julia', julia], ['r', 'R', r],
  ['javascript', 'JavaScript', javascript], ['typescript', 'TypeScript', typescript], ['java', 'Java', java],
  ['csharp', 'C#', csharp], ['go', 'Go', go], ['rust', 'Rust', rust], ['kotlin', 'Kotlin', kotlin], ['swift', 'Swift', swift],
  ['php', 'PHP', php], ['sql', 'SQL', sql], ['bash', 'Bash / Shell', bash], ['powershell', 'PowerShell', powershell],
  ['makefile', 'Makefile', makefile], ['latex', 'LaTeX', latex], ['xml', 'HTML / XML', xml], ['css', 'CSS', css],
  ['json', 'JSON', json], ['yaml', 'YAML', yaml], ['markdown', 'Markdown', markdown], ['plaintext', 'Düz metin', plaintext],
] as const;

const lowlight = createLowlight();
for (const [id, , def] of LANGS) lowlight.register(id, def);
lowlight.registerAlias({ cpp: ['c++', 'h', 'hpp'], python: ['py'], bash: ['sh', 'shell'], javascript: ['js'], typescript: ['ts'], plaintext: ['text', 'txt'] });

function CodeView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const [copied, setCopied] = useState(false);
  const lang = (node.attrs.language as string | null) ?? 'plaintext';
  const copy = async () => {
    await navigator.clipboard.writeText(node.textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <NodeViewWrapper className="codeblock">
      <div className="codeblock-head" contentEditable={false}>
        <select value={lowlight.registered(lang) ? lang : 'plaintext'} onChange={(e) => updateAttributes({ language: e.target.value })} disabled={!editor.isEditable}>
          {LANGS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <button type="button" onClick={() => void copy()}>{copied ? 'Kopyalandı ✓' : 'Kopyala'}</button>
      </div>
      <pre>
        <NodeViewContent<'code'> as="code" className={`hljs language-${lang}`} />
      </pre>
    </NodeViewWrapper>
  );
}

/** Dil seçimli, renklendirilmiş kod bloğu. Tab girinti ekler, ``` ile başlatılır (```c gibi dil de yazılabilir). */
export const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeView);
  },
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Tab: ({ editor }) => {
        if (!editor.isActive('codeBlock')) return false;
        return editor.commands.insertContent('    ');
      },
    };
  },
}).configure({ lowlight, defaultLanguage: 'c' });
