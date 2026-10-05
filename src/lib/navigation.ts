// The site's navigation, in one place (docs/brand/design-direction.md, Navigation and account). Every page a
// visitor can reach from the menu is listed here, under the one category it belongs to:
//   - The group: what AFiG does as a community, the events the hosts publish on Meetup, and who we are.
//   - Tools: what the site offers members who sign in.
//   - Hosts: everything for the hosts, shown to hosts only; each page still checks the role itself
//     (CLAUDE.md, Admin security).
// A new feature adds one entry to its category; the sidebar and the phone's menu both read this list.

export type Audience = 'everyone' | 'members' | 'hosts';

/** The line icons beside the entries (src/components/NavIcon.astro). */
export type NavIconName = 'calendar' | 'info' | 'search' | 'idea' | 'overview' | 'link' | 'film';

export interface NavItem {
  /** Also the key that tells which entry a page belongs to. */
  href: string;
  label: string;
  icon: NavIconName;
  /** Other paths that belong to this entry, such as the views of Events. Matched as prefixes, like `href`. */
  also?: string[];
  /** For the hosts' entries: the count shown beside it, from `hostCounts`. */
  badge?: 'openTips' | 'newFilms';
}

export interface NavGroup {
  key: 'group' | 'tools' | 'hosts';
  label: string;
  /** Who sees the category: members-only entries carry a lock for visitors; hosts' categories are hidden. */
  audience: Audience;
  items: NavItem[];
}

export const NAVIGATION: NavGroup[] = [
  {
    key: 'group',
    label: 'The group',
    audience: 'everyone',
    items: [
      { href: '/', label: 'Events', icon: 'calendar', also: ['/calendar', '/past'] },
      { href: '/about', label: 'About', icon: 'info' },
    ],
  },
  {
    key: 'tools',
    label: 'Tools',
    audience: 'members',
    items: [
      { href: '/films', label: 'Film finder', icon: 'search' },
      { href: '/recommend', label: 'Recommend', icon: 'idea' },
    ],
  },
  {
    key: 'hosts',
    label: 'Hosts',
    audience: 'hosts',
    items: [
      { href: '/hosts', label: 'Overview', icon: 'overview' },
      { href: '/hosts/tips', label: 'Screening tips', icon: 'link', badge: 'openTips' },
      { href: '/hosts/films', label: 'Recommended films', icon: 'film', badge: 'newFilms' },
    ],
  },
];

/** The categories a visitor sees: the hosts' only for hosts. */
export function navigationFor(member: { host: boolean } | null, navigation: NavGroup[] = NAVIGATION): NavGroup[] {
  return navigation.filter((group) => group.audience !== 'hosts' || member?.host === true);
}

/**
 * The entry a path belongs to: the one whose `href` or `also` is the longest prefix of the path, at a
 * segment's end, so `/hosts/tips` is Screening tips and not Overview, and `/films/129` is the Film finder.
 */
export function currentEntry(path: string, navigation: NavGroup[] = NAVIGATION): NavItem | null {
  let best: { item: NavItem; length: number } | null = null;
  for (const group of navigation) {
    for (const item of group.items) {
      for (const prefix of [item.href, ...(item.also ?? [])]) {
        const matches = prefix === '/' ? path === '/' : path === prefix || path.startsWith(`${prefix}/`);
        if (matches && (!best || prefix.length > best.length)) best = { item, length: prefix.length };
      }
    }
  }
  return best?.item ?? null;
}
