import type { Messages } from '../../types';

export default {
  export: {
    figure: 'figure',
    attachments: 'attachments',
    file: 'file',
    journal: 'Journal',
    readme: '# Thalamus export\n\nCreated on {date}. {notes} notes, {assets} attachments.\n\nEach collection is in its own folder; note fields are in the YAML section at the top of each file. Links use the [[Note name]] format, so the folder opens directly in Obsidian.\n',
  },
  quick: {
    aria: 'Save to Thalamus',
    title: '📥 Save to Thalamus',
    titleField: 'Title',
    collection: 'Collection',
    note: 'Note',
    notePlaceholder: 'Add a note if you like…',
    ident: '🔎 This is a {kind} link: title, authors, year and abstract will be filled in automatically.',
    fetching: 'Fetching details…',
  },
  bib: {
    title: '📚 Bibliography',
    copied: '✓ Copied',
    copyText: 'Copy text',
    copyBib: 'Copy BibTeX',
    empty: 'This note doesn’t cite any papers yet. Type {code} in the text and pick a paper to list it here.',
  },
  shared: {
    failed: 'The content could not be displayed.',
    sharedWith: 'shared with',
    notFound: 'This page was not found. Sharing may have been stopped.',
    updated: 'Last updated: {date}',
  },
  scholar: {
    notFound: 'No publication found with this identifier. Check the DOI or arXiv number.',
  },
} satisfies Messages['capture'];
