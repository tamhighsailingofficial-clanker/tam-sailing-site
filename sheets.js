// Fills pages from a Google Sheet published to the web (one published CSV per tab).
// The sheet id, tab gids and csvUrl() live in sheet-config.js.

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
};

// ---------- CSV ----------
function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  const keys = head.map(h => h.trim().toLowerCase());
  return body
    .filter(r => r.some(v => v.trim()))
    .map(r => Object.fromEntries(keys.map((k, i) => [k, (r[i] || '').trim()])));
}

async function fetchCSV(url) {
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok || text.trimStart().startsWith('<')) throw new Error('not a CSV'); // HTML = unpublished sheet or a 404 page
  return text;
}

// Live sheet first; if Google is unreachable, use the weekly snapshot in data/.
async function load(tab) {
  try {
    return parseCSV(await fetchCSV(csvUrl(tab)));
  } catch {
    return parseCSV(await fetchCSV(`data/${tab}.csv`));
  }
}

// ---------- helpers ----------
// Plain text, newlines become <br>, and [label](url) becomes a link. Never inserts raw HTML.
function richText(parent, text) {
  const plain = s => s.split('\n').forEach((line, i) => {
    if (i) parent.append(document.createElement('br'));
    parent.append(line);
  });
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    plain(text.slice(last, m.index));
    if (/^(https?:|mailto:)/i.test(m[2]) || /^[\w./#?=&-]+$/.test(m[2])) {
      const a = el('a', '', m[1]);
      a.href = m[2];
      parent.append(a);
    } else parent.append(m[0]);
    last = re.lastIndex;
  }
  plain(text.slice(last));
}

// Fills the pill above a section (e.g. "Fall Schedule 2026") from a `season` cell
function setSeason(text) {
  const pill = document.querySelector('[data-season]');
  if (pill && text) { pill.textContent = text; pill.hidden = false; }
}

// Accepts 2026-10-31 or 10/31/2026
function parseDate(s) {
  let m = (s || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(+m[1], m[2] - 1, +m[3]);
  m = (s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? new Date(+m[3], m[1] - 1, +m[2]) : null;
}

const fmt = (d, opts) => d.toLocaleDateString('en-US', opts);
const MD = { month: 'short', day: 'numeric' };

function dateRange(a, b) {
  if (+a === +b) return fmt(a, MD);
  return `${fmt(a, MD)}\u2013${a.getMonth() === b.getMonth() ? b.getDate() : fmt(b, MD)}`;
}

// ---------- renderers (one per tab) ----------
const render = {
  // columns: name, venue, start, end, links, season
  regattas(box, rows) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const events = rows
      .map(r => ({ ...r, a: parseDate(r.start), b: parseDate(r.end) || parseDate(r.start) }))
      .filter(e => e.a && e.b >= today) // past regattas drop off automatically
      .sort((x, y) => x.a - y.a);

    setSeason(events[0]?.season);

    box.replaceChildren();
    if (!events.length) { box.append(el('p', '', 'No upcoming regattas posted yet.')); return; }

    for (const e of events) {
      const item = el('div', 'schedule-item');
      item.append(el('div', 'day', dateRange(e.a, e.b)));
      const body = el('div');
      body.append(el('strong', '', e.name), el('p', '', e.venue));
      const links = (e.links || '').match(/https?:\/\/\S+/g) || [];
      if (links.length) {
        const p = el('p');
        links.forEach((href, i) => {
          const day = new Date(e.a); day.setDate(day.getDate() + i);
          const a = el('a', '', fmt(day, { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' }));
          a.href = href;
          if (i) p.append(document.createElement('br'));
          p.append(a);
        });
        body.append(p);
      }
      item.append(body);
      box.append(item);
    }
  },

  // One column per class year (Freshman, Sophomore, Junior, Senior) with names underneath.
  // Mark a captain like: Flynn Rossington (Captain, captain_1.jpg)  -- the photo filename is optional
  roster(box, rows) {
    const LABELS = { senior: 'Seniors', junior: 'Juniors', sophomore: 'Sophomores', freshman: 'Freshmen' };
    const RANK = ['freshman', 'sophomore', 'junior', 'senior'];
    const captains = box.querySelector('[data-slot=captains]');
    const classes = box.querySelector('[data-slot=classes]');
    captains.replaceChildren();
    classes.replaceChildren();

    const groups = {}, leaders = [];
    for (const r of rows) {
      for (const [cls, cell] of Object.entries(r)) {
        if (!cell) continue;
        const m = cell.match(/^(.*?)\s*\{([^}]*)\}$/);
        const [role = '', photo] = m ? m[2].split(',').map(x => x.trim()) : [];
        if (role) leaders.push({ name: m[1], role, photo, cls });
        else (groups[cls] ||= []).push(cell);
      }
    }

    leaders.sort((a, b) => RANK.indexOf(b.cls) - RANK.indexOf(a.cls)); // seniors first
    for (const l of leaders) {
      const tile = el('div', 'card tile');
      if (l.photo) {
        const img = document.createElement('img');
        img.src = 'images/' + encodeURIComponent(l.photo);
        img.alt = l.name;
        tile.append(img);
      }
      const role = el('p'); role.append(el('strong', '', l.role));
      tile.append(el('h4', 'name', l.name), role, el('p', '', l.cls[0].toUpperCase() + l.cls.slice(1)));
      captains.append(tile);
    }

    const order = [...Object.keys(LABELS), ...Object.keys(groups).filter(k => !(k in LABELS))];
    for (const k of order) {
      if (!groups[k]) continue;
      const tile = el('div', 'tile');
      tile.append(el('h2', '', LABELS[k] || k[0].toUpperCase() + k.slice(1)));
      groups[k].forEach(n => tile.append(el('p', '', n)));
      classes.append(tile);
    }
  },

  // columns: question, answer   (answers support line breaks and [label](url) links)
  faq(box, rows) {
    box.replaceChildren(...rows.filter(r => r.question).map(r => {
      const item = el('div', 'faq-item');
      const p = el('p');
      richText(p, r.answer);
      item.append(el('strong', '', r.question), p);
      return item;
    }));
  },

  // columns: day, time, season
  practice(box, rows) {
    setSeason(rows[0]?.season);
    box.replaceChildren(...rows.filter(r => r.day).map(r => {
      const item = el('div', 'schedule-item');
      item.append(el('div', 'day', r.day), el('div', '', (r.time || '').replace(/\s*-\s*/, ' \u2013 ')));
      return item;
    }));
  },

  // columns: section, label, url   (one card per distinct section, in order)
  resources(box, rows) {
    const sections = new Map();
    for (const r of rows) {
      if (!r.label || !/^https?:\/\//i.test(r.url)) continue;
      if (!sections.has(r.section)) sections.set(r.section, []);
      sections.get(r.section).push(r);
    }
    box.replaceChildren(...[...sections].map(([title, links]) => {
      const card = el('div', 'card');
      const list = el('div', 'grid one');
      for (const l of links) {
        const a = el('a', 'button primary', l.label);
        a.href = l.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        list.append(a);
      }
      card.append(el('h2', 'section-title', title), list);
      return card;
    }));
  },
};

document.querySelectorAll('[data-sheet]').forEach(async box => {
  box.setAttribute('aria-busy', 'true');
  try {
    render[box.dataset.sheet](box, await load(box.dataset.sheet));
  } catch {
    const p = el('p', '', "Couldn't load this right now. Please try again later or ");
    const a = el('a', '', 'contact us');
    a.href = 'contact.html';
    p.append(a, '.');
    box.append(p);
  } finally {
    box.removeAttribute('aria-busy');
  }
});