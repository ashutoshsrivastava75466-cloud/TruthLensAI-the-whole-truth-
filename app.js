const cardContainer = document.getElementById('cardContainer');
const pager = document.getElementById('pager');
const refreshBtn = document.getElementById('refreshBtn');
const analyticsOverlay = document.getElementById('analyticsOverlay');
const analyticsContent = document.getElementById('analyticsContent');
const closeAnalytics = document.getElementById('closeAnalytics');

let articles = [];
let index = 0;

async function loadNews() {
  try {
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Refreshing...';
    const res = await fetch('/api/news');
    articles = await res.json();
    index = 0;
    render();
  } catch (err) {
    console.error('Failed to load news', err);
    cardContainer.innerHTML = '<div class="small">Failed to load news.</div>';
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'Refresh';
  }
}

function render() {
  cardContainer.innerHTML = '';
  if (!articles || articles.length === 0) {
    cardContainer.innerHTML = '<div class="small">No articles available.</div>';
    pager.textContent = '';
    return;
  }
  const a = articles[index];
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="actions">
      <div class="icon" id="analyticsBtn" title="Analytics">📊</div>
      <div class="icon" id="bookmarkBtn" title="Bookmark">🔖</div>
    </div>
    <h2>${escapeHtml(a.title)}</h2>
    <div class="small">${escapeHtml(a.sourceName || '')} • ${timeAgo(a.pubDate)}</div>
    ${a.imageUrl ? `<img src="${a.imageUrl}" alt="${escapeHtml(a.title)}"/>` : ''}
    <p class="small">${escapeHtml(a.summary)}</p>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
      <a href="${a.link}" target="_blank" rel="noreferrer">Read original</a>
      <span class="small">${escapeHtml(a.category || 'general')}</span>
    </div>
  `;
  cardContainer.appendChild(card);
  pager.textContent = (index+1) + ' / ' + articles.length;

  // Analytics button only via click
  document.getElementById('analyticsBtn').addEventListener('click', async (e) => {
    e.stopPropagation();
    openAnalytics(a);
  });

  // swipe handling: simple touch
  let startY = null;
  let moved = false;
  card.addEventListener('touchstart', (ev) => { startY = ev.touches[0].clientY; moved = false; });
  card.addEventListener('touchmove', (ev) => { if (!startY) return; const dy = ev.touches[0].clientY - startY; if (Math.abs(dy) > 10) moved = true; });
  card.addEventListener('touchend', (ev) => {
    if (!startY) return;
    const endY = ev.changedTouches[0].clientY;
    const dy = endY - startY;
    startY = null;
    if (Math.abs(dy) < 50 && !moved) {
      // tap - open detail (use analytics as detail here)
      openDetail(a);
      return;
    }
    if (dy < -80) { // swipe up -> next
      nextArticle();
    } else if (dy > 80) { // swipe down -> prev
      prevArticle();
    }
  });

  // mouse support for desktop (drag)
  let mdStart = null;
  card.addEventListener('mousedown', (ev) => { mdStart = ev.clientY; });
  card.addEventListener('mouseup', (ev) => {
    if (mdStart === null) return;
    const dy = ev.clientY - mdStart;
    mdStart = null;
    if (dy < -80) nextArticle(); else if (dy > 80) prevArticle();
  });
}

function nextArticle() { if (index < articles.length - 1) index++; render(); }
function prevArticle() { if (index > 0) index--; render(); }

async function openAnalytics(article) {
  analyticsContent.innerHTML = '<div class="small">Analyzing…</div>';
  analyticsOverlay.classList.remove('hidden');
  try {
    const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(article) });
    const j = await res.json();
    analyticsContent.innerHTML = renderAnalytics(j);
  } catch (err) {
    analyticsContent.innerHTML = '<div class="small">Failed to analyze.</div>';
  }
}

function renderAnalytics(data) {
  if (!data) return '<div class="small">No data</div>';
  return `
    <div><strong>Truth Score:</strong> <span style="color:${data.truthScore>=80? 'green': data.truthScore>=50? 'orange':'red'}">${data.truthScore ?? '—'}</span></div>
    <div class="small"><strong>Sentiment:</strong> ${data.sentiment?.label ?? '—'}</div>
    <div class="small"><strong>Bias:</strong> ${data.bias?.label ?? '—'}</div>
    <div class="small"><strong>Credibility:</strong> ${data.sourceCredibility?.score ?? '—'}</div>
    <div style="margin-top:8px;"><strong>Fact-check:</strong><div class="small">${escapeHtml(data.factCheckSummary ?? '')}</div></div>
  `;
}

function openDetail(article) {
  // reuse analytics modal for simplicity
  openAnalytics(article);
}

closeAnalytics.addEventListener('click', ()=> analyticsOverlay.classList.add('hidden'));
refreshBtn.addEventListener('click', loadNews);

// tiny helpers
function timeAgo(iso) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / (1000*60));
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm';
  const h = Math.floor(m/60);
  if (h < 24) return h + 'h';
  const days = Math.floor(h/24);
  return days + 'd';
}
function escapeHtml(s) { if(!s) return ''; return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

// init
loadNews();
