export function stringToSlugCase(str: string): string {
    return str
        .replace(/\s+/g, '-')
        .toLowerCase();
}
