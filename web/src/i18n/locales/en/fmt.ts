import type { Messages } from '../../types';

export default {
  image: 'image',
  imageOf: '[image: {name}]',
  fileOf: '[file: {name}]',
  file: '[file]',
  bibBlock: '_(Bibliography block: shown in Thalamus)_',
  embed: 'Embedded page',
  latexImage: '% image: {src}',
  latexMermaid: '% (Mermaid diagram not exported to LaTeX)',
  relationMissing: 'Relation field not found',
} satisfies Messages['fmt'];
