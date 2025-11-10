export type EntryTag = 'Publication' | 'Milestone' | 'Release';

export type InsideEntry = {
  slug: string;
  tags: EntryTag[];
  date: string;
  title: string;
  summary: string;
  readingTime: string;
};

export const insideEntries: InsideEntry[] = [
  // template entry
  // {
  //   slug: '',
  //   tags: [],
  //   category: '',
  //   date: '',
  //   title: '',
  //   summary: '',
  //   readingTime: '',
  // },
  {
    slug: 'controlled-rugby-vocabulary',
    tags: ['Publication'],
    date: 'November 10, 2025',
    title: 'A Common Language for Rugby: Building the Controlled Vocabulary',
    summary: 'How Rugbycodex and leading coaches are collaborating to create a shared language for rugby knowledge',
    readingTime: '3 min read',
  },
  {
    slug: 'closed-beta-for-the-people',
    tags: ['Release', 'Milestone'],
    date: 'October 10, 2025',
    title: 'The Open Beta: Building Rugbycodex Together',
    summary: 'Opening Rugbycodex to the community. Clubs, coaches, and players join us to shape what comes next.',
    readingTime: '1 min read',
  },
  {
    slug: 'the-first-release',
    tags: ['Milestone', 'Release'],
    date: 'September 21, 2025',
    title: 'The First Release',
    summary: 'Turning an idea into an experience. Our journey to launch Rugbycodex',
    readingTime: '1 min read',
  },
  {
    slug: 'how-rugbycodex-began',
    tags: ['Release', 'Publication'],
    date: 'August 14, 2025',
    title: 'How Rugbycodex Began',
    summary: 'A reflection on how a single training session sparked a new way to share rugby knowledge',
    readingTime: '3 min read',
  }
];
