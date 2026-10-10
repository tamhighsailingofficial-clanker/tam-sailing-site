// The only file you edit when the Google Sheet changes.
const SHEET_ID = '2PACX-1vT-HX3kLCffruH-8YERAb7Fo_BXUV16D1H44BU4s9gpM6DoGhRetp1URSqGbr3v8vmK9BuEz4yY7jp0'; // the part after /spreadsheets/d/e/ in the publish link
const GIDS = {                                 // the number after gid= in each tab's URL
  regattas: '952006730',
  roster: '173863648',
  faq: '795719397',
  practice: '904982436',
  resources: '202271679',
};

const csvUrl = tab =>
  `https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?gid=${GIDS[tab]}&single=true&output=csv`;
