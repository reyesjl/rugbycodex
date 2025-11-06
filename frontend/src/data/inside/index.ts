export type EntryTag = 'Publication' | 'Milestone' | 'Release';

export type InsideEntry = {
  slug: string;
  tags: EntryTag[];
  category: string;
  date: string;
  title: string;
  summary: string;
  readingTime: string;
};

export const insideEntries: InsideEntry[] = [
  {
    slug: 'closed-beta-for-the-people',
    tags: ['Release', 'Milestone'],
    category: 'Development',
    date: 'October 10, 2025',
    title: 'The Open Beta: Building Rugbycodex Together',
    summary: 'Opening Rugbycodex to the community. Clubs, coaches, and players join us to shape what comes next.',
    readingTime: '4 min read',
  },
  {
    slug: 'the-first-release',
    tags: ['Milestone', 'Release'],
    category: 'Launch',
    date: 'September 21, 2025',
    title: 'The First Release',
    summary: 'Turning an idea into an experience. Our journey to launch Rugbycodex',
    readingTime: '3 min read',
  },
  {
    slug: 'how-rugbycodex-began',
    tags: ['Release', 'Publication'],
    category: 'Founding Story',
    date: 'August 14, 2025',
    title: 'How Rugbycodex Began',
    summary: 'A reflection on how a single training session sparked a new way to share rugby knowledge',
    readingTime: '5 min read',
  }
];
