/**
 * Static mock for GitHub Pages.
 *
 * Simulates the real flow:
 *   user query  ->  agent  ->  get_city_info  ->  get_weather  ->  card
 * Everything runs in the browser with canned data so the page can be hosted
 * as a pure static site (no Node, no API keys).
 */

// ---- canned data ----------------------------------------------------------

const CITIES = {
  hyderabad: {
    name: 'Hyderabad',
    country: 'India',
    country_code: 'IN',
    admin1: 'Telangana',
    latitude: 17.385,
    longitude: 78.4867,
    elevation: 542,
    timezone: 'Asia/Kolkata',
    population: 6809970,
  },
  bangalore: {
    name: 'Bengaluru',
    country: 'India',
    country_code: 'IN',
    admin1: 'Karnataka',
    latitude: 12.9716,
    longitude: 77.5946,
    elevation: 920,
    timezone: 'Asia/Kolkata',
    population: 8443675,
  },
  bengaluru: 'bangalore',
  mumbai: {
    name: 'Mumbai',
    country: 'India',
    country_code: 'IN',
    admin1: 'Maharashtra',
    latitude: 19.076,
    longitude: 72.8777,
    elevation: 14,
    timezone: 'Asia/Kolkata',
    population: 12442373,
  },
  delhi: {
    name: 'New Delhi',
    country: 'India',
    country_code: 'IN',
    admin1: 'Delhi',
    latitude: 28.6139,
    longitude: 77.209,
    elevation: 216,
    timezone: 'Asia/Kolkata',
    population: 21750000,
  },
  london: {
    name: 'London',
    country: 'United Kingdom',
    country_code: 'GB',
    admin1: 'England',
    latitude: 51.5074,
    longitude: -0.1278,
    elevation: 35,
    timezone: 'Europe/London',
    population: 8961989,
  },
  paris: {
    name: 'Paris',
    country: 'France',
    country_code: 'FR',
    admin1: 'Île-de-France',
    latitude: 48.8566,
    longitude: 2.3522,
    elevation: 35,
    timezone: 'Europe/Paris',
    population: 2161000,
  },
  'new york': {
    name: 'New York',
    country: 'United States',
    country_code: 'US',
    admin1: 'New York',
    latitude: 40.7128,
    longitude: -74.006,
    elevation: 10,
    timezone: 'America/New_York',
    population: 8336817,
  },
  nyc: 'new york',
  tokyo: {
    name: 'Tokyo',
    country: 'Japan',
    country_code: 'JP',
    admin1: 'Tōkyō',
    latitude: 35.6762,
    longitude: 139.6503,
    elevation: 40,
    timezone: 'Asia/Tokyo',
    population: 13929286,
  },
  sydney: {
    name: 'Sydney',
    country: 'Australia',
    country_code: 'AU',
    admin1: 'New South Wales',
    latitude: -33.8688,
    longitude: 151.2093,
    elevation: 58,
    timezone: 'Australia/Sydney',
    population: 5312163,
  },
  dubai: {
    name: 'Dubai',
    country: 'United Arab Emirates',
    country_code: 'AE',
    admin1: 'Dubai',
    latitude: 25.2048,
    longitude: 55.2708,
    elevation: 16,
    timezone: 'Asia/Dubai',
    population: 3331420,
  },
  'san francisco': {
    name: 'San Francisco',
    country: 'United States',
    country_code: 'US',
    admin1: 'California',
    latitude: 37.7749,
    longitude: -122.4194,
    elevation: 16,
    timezone: 'America/Los_Angeles',
    population: 873965,
  },
  sf: 'san francisco',
  singapore: {
    name: 'Singapore',
    country: 'Singapore',
    country_code: 'SG',
    admin1: null,
    latitude: 1.3521,
    longitude: 103.8198,
    elevation: 15,
    timezone: 'Asia/Singapore',
    population: 5453600,
  },
  berlin: {
    name: 'Berlin',
    country: 'Germany',
    country_code: 'DE',
    admin1: 'Berlin',
    latitude: 52.52,
    longitude: 13.405,
    elevation: 34,
    timezone: 'Europe/Berlin',
    population: 3769495,
  },
  toronto: {
    name: 'Toronto',
    country: 'Canada',
    country_code: 'CA',
    admin1: 'Ontario',
    latitude: 43.6532,
    longitude: -79.3832,
    elevation: 76,
    timezone: 'America/Toronto',
    population: 2731571,
  },
};

const WEATHER_PROFILES = [
  { code: 0, label: 'Clear sky', icon: '☀️', tempBase: 28, humidity: 45, wind: 8 },
  { code: 1, label: 'Mainly clear', icon: '🌤️', tempBase: 26, humidity: 50, wind: 9 },
  { code: 2, label: 'Partly cloudy', icon: '⛅', tempBase: 24, humidity: 55, wind: 11 },
  { code: 3, label: 'Overcast', icon: '☁️', tempBase: 21, humidity: 65, wind: 13 },
  { code: 45, label: 'Fog', icon: '🌫️', tempBase: 12, humidity: 92, wind: 4 },
  { code: 61, label: 'Slight rain', icon: '🌦️', tempBase: 18, humidity: 78, wind: 14 },
  { code: 63, label: 'Moderate rain', icon: '🌧️', tempBase: 16, humidity: 85, wind: 18 },
  { code: 71, label: 'Slight snow', icon: '🌨️', tempBase: -2, humidity: 80, wind: 12 },
  { code: 95, label: 'Thunderstorm', icon: '⛈️', tempBase: 22, humidity: 88, wind: 24 },
];

// ---- query parsing --------------------------------------------------------

function extractCity(query) {
  const q = query.toLowerCase().trim();
  // Try multi-word matches first (longest first).
  const keys = Object.keys(CITIES).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (q.includes(key)) return key;
  }
  // Fall back: take last word(s) after "in"
  const m = q.match(/\bin\s+([a-zA-Z\s]+?)[\s?.!]*$/);
  if (m) return m[1].trim();
  return null;
}

function resolveCity(key) {
  if (!key) return null;
  let v = CITIES[key];
  while (typeof v === 'string') v = CITIES[v];
  return v ?? null;
}

// ---- deterministic mock weather ------------------------------------------

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickWeather(cityKey) {
  // Slot in a stable bucket per city + day so it varies day-to-day but is
  // stable across reloads.
  const day = new Date().toISOString().slice(0, 10);
  const seed = hashString(`${cityKey}:${day}`);
  const profile = WEATHER_PROFILES[seed % WEATHER_PROFILES.length];

  // Add ±4° wobble derived from the same seed.
  const wobble = ((seed >> 8) % 80) / 10 - 4; // -4.0 .. +3.9
  const temp = +(profile.tempBase + wobble).toFixed(1);
  const feels = +(temp + ((seed >> 16) % 40) / 10 - 2).toFixed(1);
  const windDir = (seed >> 4) % 360;
  const isDay = ((seed >> 12) % 10) > 2; // ~80% day

  return {
    observed_at: new Date().toISOString().slice(0, 16),
    temperature: { value: temp, unit: '°C' },
    feels_like: { value: feels, unit: '°C' },
    humidity: { value: profile.humidity, unit: '%' },
    precipitation: { value: profile.code >= 51 ? +(((seed >> 20) % 40) / 10).toFixed(1) : 0, unit: 'mm' },
    wind: { speed: profile.wind, speed_unit: 'km/h', direction_deg: windDir },
    is_day: isDay,
    condition: profile.label,
    icon: profile.icon,
    weather_code: profile.code,
    timezone: 'auto',
  };
}

// ---- mocked MCP tool calls (with realistic delays) -----------------------

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function mockGetCityInfo(name) {
  await delay(220 + Math.random() * 180);
  const key = extractCity(name) ?? name.toLowerCase();
  const city = resolveCity(key);
  if (!city) {
    throw new Error(`No city found for "${name}"`);
  }
  return city;
}

async function mockGetWeather({ latitude, longitude }) {
  await delay(280 + Math.random() * 220);
  // Find which city these coords belong to (for stable seeding).
  const key =
    Object.keys(CITIES).find((k) => {
      const c = resolveCity(k);
      return c && Math.abs(c.latitude - latitude) < 0.01 && Math.abs(c.longitude - longitude) < 0.01;
    }) ?? `${latitude},${longitude}`;
  return pickWeather(key);
}

// ---- mocked agent loop ---------------------------------------------------

function buildSummary(city, weather) {
  return `It's ${weather.temperature.value}°C and ${weather.condition.toLowerCase()} in ${city.name}, ${city.country}. Feels like ${weather.feels_like.value}°C with ${weather.humidity.value}% humidity.`;
}

async function runMockAgent(query, onStep) {
  const trace = [];
  onStep?.('Agent: deciding to call get_city_info…');

  trace.push({ type: 'tool_use', name: 'get_city_info', input: { name: query } });
  const city = await mockGetCityInfo(query);
  trace.push({ type: 'tool_result', name: 'get_city_info', output: city });

  onStep?.(`Agent: got coords (${city.latitude.toFixed(2)}, ${city.longitude.toFixed(2)}). Calling get_weather…`);

  const weatherInput = { latitude: city.latitude, longitude: city.longitude, timezone: city.timezone };
  trace.push({ type: 'tool_use', name: 'get_weather', input: weatherInput });
  const weather = await mockGetWeather(weatherInput);
  trace.push({ type: 'tool_result', name: 'get_weather', output: weather });

  const summary = buildSummary(city, weather);
  trace.push({ type: 'final', text: summary });

  return { city, weather, summary, trace, iterations: 3 };
}

// ---- DOM rendering (same shape as the real client) -----------------------

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
    kind === 'loading' ? `<span class="spinner"></span>${text}` : text;
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
  return dirs[Math.round((deg % 360) / 45) % 8];
}

function renderCard({ city, weather, summary }) {
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
        <span>🕒 ${escapeHtml(city.timezone ?? '')}</span>
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
    const data = await runMockAgent(query, (msg) => setStatus(msg, 'loading'));
    setStatus('');
    renderCard(data);
    traceBody.textContent = JSON.stringify(data.trace, null, 2);
    trace.hidden = false;
  } catch (err) {
    setStatus(
      `${err.message}. Try one of: Hyderabad, Bengaluru, Mumbai, Delhi, London, Paris, New York, Tokyo, Sydney, Dubai, San Francisco, Singapore, Berlin, Toronto.`,
      'error',
    );
  } finally {
    button.disabled = false;
  }
});
