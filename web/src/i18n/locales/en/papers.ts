import type { Messages } from '../../types';

export default {
  drive: {
    notFound: 'Drive file not found',
    full: 'Your Google Drive storage is full.',
  },
  paper: {
    abstract: 'Abstract',
    keywords: 'Keywords: ',
    noIdent: 'I couldn’t find a DOI or arXiv number in this. Example: 10.1109/TAC.1979.1101943 or arxiv.org/abs/1706.03762',
    noIdentShort: 'No DOI or arXiv number found.',
    noteNotFound: 'Note not found.',
    fromDoi: 'using the DOI in the PDF',
    fromTitle: 'by finding the title on Crossref',
    fromText: 'from the PDF text only (no publication record found, please check)',
    gotAbstract: 'the abstract',
    gotSections: { one: '{count} section heading', other: '{count} section headings' },
    and: ' and ',
    written: '{got} written into the note',
    noContent: 'no content found',
    untouched: 'the content was left alone because the note already has your writing (use ⋯ → “Get details from PDF” to append)',
    filled: 'Details filled in {from}; {content}.',
  },
  cite: {
    noDate: 'n.d.',
  },
} satisfies Messages['papers'];
