const form = document.getElementById('query-form');
const input = document.getElementById('query-input');
const button = document.getElementById('submit-btn');
const status = document.getElementById('status');
const cardSlot = document.getElementById('card-slot');
const trace = document.getElementById('trace');
const traceBody = document.getElementById('trace-body');

function setStatus(text, kind = 'info') {
  if (!text) {
    status.hidden = true;
    status.textContent = '';
    status.classList.remove('error');
    return;
  }
  status.hidden = false;
  status.classList.toggle('error', kind === 'error');
  status.innerHTML =
    kind === 'loading'
      ? `<span class="spinner"></span>${text}`
      : text;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNumber(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Number(n).toFixed(digits).replace(/\.0+$/, '');
}

function compassFromDegrees(deg) {
  if (deg === null || deg === undefined) return '';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((deg % 360) / 45)) % 8];
}

function renderCard({ city, weather, summary }) {
  if (!city || !weather) {
    cardSlot.innerHTML = `<div class="weather-card"><div class="summary">${escapeHtml(
      summary || 'No data returned.',
    )}</div></div>`;
    return;
  }

  const place = [city.name, city.admin1, city.country].filter(Boolean).join(', ');
  const tempUnit = weather.temperature?.unit ?? '°C';
  const wind = weather.wind ?? {};
  const windDir = compassFromDegrees(wind.direction_deg);

  cardSlot.innerHTML = `
    <article class="weather-card">
      <div class="top">
        <div class="place">
          <div class="city">${escapeHtml(city.name)}</div>
          <div class="region">${escapeHtml(place)}</div>
        </div>
        <div class="icon" aria-hidden="true">${weather.icon ?? '⛅'}</div>
      </div>

      <div class="temp-row">
        <div class="temp">${formatNumber(weather.temperature?.value)}<span style="font-size:1.5rem">${escapeHtml(tempUnit)}</span></div>
        <div class="condition">${escapeHtml(weather.condition ?? '')}</div>
      </div>
      <div class="feels">Feels like ${formatNumber(weather.feels_like?.value)}${escapeHtml(tempUnit)}</div>

      <div class="grid">
        <div class="stat">
          <div class="label">Humidity</div>
          <div class="value">${formatNumber(weather.humidity?.value, 0)}${escapeHtml(weather.humidity?.unit ?? '%')}</div>
        </div>
        <div class="stat">
          <div class="label">Wind</div>
          <div class="value">${formatNumber(wind.speed)} ${escapeHtml(wind.speed_unit ?? '')}${windDir ? ' ' + windDir : ''}</div>
        </div>
        <div class="stat">
          <div class="label">Precip</div>
          <div class="value">${formatNumber(weather.precipitation?.value)}${escapeHtml(weather.precipitation?.unit ?? 'mm')}</div>
        </div>
      </div>

      ${summary ? `<div class="summary">${escapeHtml(summary)}</div>` : ''}

      <div class="meta">
        <span>📍 ${formatNumber(city.latitude, 3)}, ${formatNumber(city.longitude, 3)}</span>
        <span>🕒 ${escapeHtml(weather.timezone ?? city.timezone ?? '')}</span>
        <span>${weather.is_day ? '🌞 Day' : '🌙 Night'}</span>
      </div>
    </article>
  `;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = input.value.trim();
  if (!query) return;

  button.disabled = true;
  trace.hidden = true;
  cardSlot.innerHTML = '';
  setStatus('Asking the agent…', 'loading');

  try {
    const res = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    setStatus('');
    renderCard(data);

    if (Array.isArray(data.trace) && data.trace.length) {
      traceBody.textContent = JSON.stringify(data.trace, null, 2);
      trace.hidden = false;
    }
  } catch (err) {
    setStatus(err.message, 'error');
  } finally {
    button.disabled = false;
  }
});
