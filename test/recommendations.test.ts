import { describe, expect, it } from 'vitest';
import { cleanNote, NOTE_LENGTH, parseNote, parseTip, webUrl } from '../src/lib/recommendations';

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};

describe('cleanNote', () => {
  it('trims, squeezes spaces and blank lines, and keeps single line breaks', () => {
    expect(cleanNote('  A  classic.\r\n\r\n\r\nSee it   on 35mm.  ')).toBe('A classic.\n\nSee it on 35mm.');
    expect(cleanNote('One\nTwo')).toBe('One\nTwo');
  });

  it('is null when nothing was typed', () => {
    expect(cleanNote('   \n ')).toBeNull();
    expect(cleanNote(null)).toBeNull();
    expect(cleanNote(undefined)).toBeNull();
  });
});

describe('webUrl', () => {
  it('keeps a web address, and adds https:// when it was left out', () => {
    expect(webUrl('https://www.cinemercator.nl/agenda?x=1')).toBe('https://www.cinemercator.nl/agenda?x=1');
    expect(webUrl('http://example.org')).toBe('http://example.org/');
    expect(webUrl('oedipus.com/panorama')).toBe('https://oedipus.com/panorama');
  });

  it('refuses anything that is not a web page', () => {
    for (const text of ['javascript:alert(1)', 'mailto:a@b.nl', 'ftp://example.org/file', 'data:text/html,hi', 'not a link', 'localhost:4321', 'https://user:pass@example.org/']) {
      expect(webUrl(text), text).toBeNull();
    }
  });
});

describe('parseTip', () => {
  it('reads the link and the note', () => {
    expect(parseTip(form({ url: ' cinemercator.nl ', note: ' Wednesdays, €3 ' }))).toEqual({
      ok: true,
      value: { url: 'https://cinemercator.nl/', note: 'Wednesdays, €3' },
    });
    expect(parseTip(form({ url: 'https://eye.nl/x' }))).toEqual({ ok: true, value: { url: 'https://eye.nl/x', note: null } });
  });

  it('says what is wrong, field by field', () => {
    const empty = parseTip(form({ url: '  ' }));
    expect(empty.ok).toBe(false);
    expect(!empty.ok && empty.errors.url).toMatch(/Paste the link/);

    const wrong = parseTip(form({ url: 'javascript:alert(1)', note: 'x'.repeat(NOTE_LENGTH + 1) }));
    expect(!wrong.ok && Object.keys(wrong.errors).sort()).toEqual(['note', 'url']);
  });
});

describe('parseNote', () => {
  it('accepts no note, and refuses a long one', () => {
    expect(parseNote(form({}))).toEqual({ ok: true, value: { note: null } });
    expect(parseNote(form({ note: 'Restored, and on the big screen.' }))).toEqual({ ok: true, value: { note: 'Restored, and on the big screen.' } });
    const long = parseNote(form({ note: 'x'.repeat(NOTE_LENGTH + 1) }));
    expect(!long.ok && long.errors.note).toMatch(/under 500/);
  });
});
