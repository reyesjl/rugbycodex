export function stringToSlugCase(str: string): string {
    return str
        .replace(/\s+/g, '-')
        .toLowerCase();
}

export * from './date';
export * from './status';
export * from './duration';
export * from './cdn';
