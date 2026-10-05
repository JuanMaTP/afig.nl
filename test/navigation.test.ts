import { describe, expect, it } from 'vitest';
import { currentEntry, NAVIGATION, navigationFor } from '../src/lib/navigation';

describe('currentEntry', () => {
  const label = (path: string) => currentEntry(path)?.label ?? null;

  it('finds the entry a page belongs to, its views and sub-pages included', () => {
    expect(label('/')).toBe('Events');
    expect(label('/calendar')).toBe('Events');
    expect(label('/past')).toBe('Events');
    expect(label('/films')).toBe('Film finder');
    expect(label('/films/129')).toBe('Film finder');
    expect(label('/recommend/149')).toBe('Recommend');
    expect(label('/about')).toBe('About');
  });

  it('takes the longest match, at a segment’s end', () => {
    expect(label('/hosts')).toBe('Overview');
    expect(label('/hosts/tips')).toBe('Screening tips');
    expect(label('/hosts/films')).toBe('Recommended films');
    expect(label('/filmsx')).toBeNull();
    expect(label('/pastries')).toBeNull();
    expect(label('/sign-in')).toBeNull();
  });
});

describe('navigationFor', () => {
  const keys = (member: { host: boolean } | null) => navigationFor(member).map((group) => group.key);

  it('shows the hosts’ category to hosts only', () => {
    expect(keys(null)).toEqual(['group', 'tools']);
    expect(keys({ host: false })).toEqual(['group', 'tools']);
    expect(keys({ host: true })).toEqual(['group', 'tools', 'hosts']);
  });

  it('lists every entry once, in one category', () => {
    const hrefs = NAVIGATION.flatMap((group) => group.items.map((item) => item.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
