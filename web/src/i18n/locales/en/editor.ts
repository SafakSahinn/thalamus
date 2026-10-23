import type { Messages } from '../../types';

export default {
  placeholder: 'Start writing…  ‘/’ for commands, ‘[[’ to link a note, ‘@’ for a date',
  linkPrompt: 'Link address',
  linkHint: 'Leave empty to remove the link.',
  bold: 'Bold (Ctrl+B)',
  italic: 'Italic (Ctrl+I)',
  underline: 'Underline (Ctrl+U)',
  strike: 'Strikethrough',
  highlight: 'Highlight',
  code: 'Code',
  link: 'Link',
  toMath: 'Turn selection into a formula',
  comment: 'Add comment',
  commentPrompt: 'Comment',
  commentAbout: 'About “{quote}”',
  color: 'Color',
  textColor: 'Text color',
  background: 'Background',
  plainText: 'Plain text',
  copied: 'Copied ✓',
} satisfies Messages['editor'];
