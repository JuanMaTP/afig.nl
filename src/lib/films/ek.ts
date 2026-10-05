// `EK`, the cinema run's cleaner for Meetup event titles, copied verbatim from `docs/context/AFG-Matcher.md`
// (the Film Group project's `claude/AFG-Matcher.md`). Never retype or edit it here: retyping caused three bugs
// in its history (CLAUDE.md, Film matching). Only its first line changed, from `window.EK = function (t) {`.
// It cuts off a title containing "with" or a language word (The English Patient → `the`), so it never
// identifies a film alone: the matcher also needs the year and the director (src/lib/films/match.ts).

export interface EventKey {
  /** The squashed key: letters and digits only. */
  f: string;
  /** The squashed key without a leading article. */
  n: string;
  /** A year in round brackets in the title, such as "(1969)". */
  y: string | null;
  /** The cleaned title, lowercase, words separated by spaces. */
  disp: string;
}

export const EK = function (t: unknown): EventKey {
  var s = String(t || '').trim(), y = null, m;
  m = s.match(/\((19\d\d|20\d\d)\)/); if (m) y = m[1];
  s = s.replace(/^(Film\s*&\s*Food|Film\s*&\s*Drink|Cinema Aperitivo|Lecture|Sing-Along|Double Bill|Field Trip)\s*:\s*/i, '');
  // Brackets nest and are not always round. Strip the INNERMOST pair first and
  // repeat until nothing changes — a single greedy pass over mixed delimiters
  // eats the wrong span. See the note below this block.
  var prev;
  do { prev = s;
       s = s.replace(/\[[^\[\]]*\]/g, ' ')
            .replace(/\{[^\{\}]*\}/g, ' ')
            .replace(/\([^\(\)]*\)/g, ' ');
  } while (s !== prev);
  s = s.replace(/\s+\/\s+.*$/, '');
  s = s.replace(/\s+[-–—]\s+.*$/, '');
  s = s.replace(/\s+(with|w\/|incl\.?|including|plus|\+)\s+.*$/i, '');
  s = s.replace(/\s+(Encore|Premiere)\s*$/i, '');
  s = s.replace(/\s+(English|Dutch|Italian|Spanish|German|Japanese|Silent|Cantonese|Mandarin|French|Portuguese|Korean|Pidgin|Naija)\b.*$/i, '');
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
       .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return { f: s.replace(/ /g, ''),
           n: s.replace(/^(the|a|an|de|het|een|le|la|les|l|il|el|los|las) /, '').replace(/ /g, ''),
           y: y, disp: s };
};
