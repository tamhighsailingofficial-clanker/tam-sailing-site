// Saves the current contents of each published tab to data/<tab>.csv (the site's fallback copy).
// Run by the weekly GitHub Action; also runnable by hand: node scripts/fetch-sheets.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const configSource = await readFile(new URL('../sheet-config.js', import.meta.url), 'utf8');
const { csvUrl, GIDS } = new Function(`${configSource}; return { csvUrl, GIDS };`)();

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
let failed = false;

for (const tab of Object.keys(GIDS)) {
  try {
    const res = await fetch(csvUrl(tab));
    const text = await res.text();
    if (!res.ok || text.trimStart().startsWith('<')) throw new Error(`HTTP ${res.status}, not a CSV (is the tab published?)`);
    await writeFile(new URL(`../data/${tab}.csv`, import.meta.url), text); // old copy is kept if anything fails
    console.log(`saved data/${tab}.csv`);
  } catch (err) {
    console.error(`${tab}: ${err.message}`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
