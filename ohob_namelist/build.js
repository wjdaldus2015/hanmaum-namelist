const fs = require('fs');
const path = require('path');

const [, , txtPath, date, htmlArg] = process.argv;
if (!txtPath || !/^\d{8}$/.test(date || '')) {
  console.error('usage: node build.js <명단.txt> <YYYYMMDD> [index.html]');
  process.exit(1);
}
const htmlPath = htmlArg || path.join(process.cwd(), 'index.html');

function readText(file) {
  const buf = fs.readFileSync(file);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '');
  } catch (e) {
    return new TextDecoder('euc-kr').decode(buf);
  }
}

const names = readText(txtPath)
  .split(/\r?\n/)
  .map((s) => s.replace(/[\s 　]+/g, ' ').trim())
  .filter(Boolean);

const SECTIONS = ['ㄱ', 'ㄴ - ㅅ', 'ㅇ-ㅎ'];
const collator = new Intl.Collator('ko');
const sortKey = (name) => name.replace(/^故\s*/, '고');

function sectionOf(name) {
  const code = sortKey(name).charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return 0;
  const cho = Math.floor((code - 0xac00) / 588);
  if (cho <= 1) return 0;
  if (cho <= 10) return 1;
  return 2;
}

function compare(a, b) {
  const ka = sortKey(a);
  const kb = sortKey(b);
  const ha = /^[가-힣]/.test(ka);
  const hb = /^[가-힣]/.test(kb);
  if (ha !== hb) return ha ? 1 : -1;
  return collator.compare(ka, kb);
}

const groups = SECTIONS.map(() => ({ etc: [], normal: [] }));
names.forEach((name) => {
  const g = groups[sectionOf(name)];
  (/^[가-힣]{3}$/.test(name) ? g.normal : g.etc).push(name);
});

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let out = `  <div class="sponsor_list " id="date${date}">\n`;
groups.forEach((g, i) => {
  g.etc.sort(compare);
  g.normal.sort(compare);
  if (!g.etc.length && !g.normal.length) return;
  out += `    <div class="list_wrap">\n      <p class="name_sort">${SECTIONS[i]}</p>\n`;
  if (g.etc.length) {
    out += '      <ul>\n' + g.etc.map((n) => `        <li class="col3">${esc(n)}</li>\n`).join('') + '      </ul>\n';
  }
  if (g.normal.length) {
    out += '      <ul>\n' + g.normal.map((n) => `        <li>${esc(n)}</li>\n`).join('') + '      </ul>\n';
  }
  out += '    </div>\n';
});
out += '  </div>\n';

let html = fs.readFileSync(htmlPath, 'utf8');
const start = html.indexOf('  <div class="sponsor_list');
const end = html.lastIndexOf('</body>');
if (start < 0 || end < 0 || end < start) {
  console.error('index.html에서 sponsor_list 영역을 찾지 못했습니다.');
  process.exit(1);
}
html = html.slice(0, start) + out + '  \n' + html.slice(end);
html = html.replace(/#date\d{8}/g, `#date${date}`);

const title = path.basename(txtPath, path.extname(txtPath)).replace(/_/g, ' ').trim();
html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);

fs.writeFileSync(htmlPath, html, 'utf8');

console.log(`title: ${title}`);
console.log(`id: date${date}`);
console.log(`total: ${names.length}`);
groups.forEach((g, i) => {
  console.log(`[${SECTIONS[i]}] col3 ${g.etc.length} / 일반 ${g.normal.length}`);
});
console.log('col3 목록:');
groups.forEach((g) => g.etc.forEach((n) => console.log('  ' + n)));
