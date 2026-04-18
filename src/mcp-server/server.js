#!/usr/bin/env node
/**
 * Weather MCP Server
 *
 * Exposes two tools over stdio:
 *   - get_city_info: geocodes a city name -> { lat, lon, country, timezone, ... }
 *   - get_weather:   given lat/lon, returns current weather conditions
 *
 * Both tools use Open-Meteo (https://open-meteo.com), which is free and
 * requires no API key.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

const TOOLS = [
  {
    name: 'get_city_info',
    description:
      'Look up geographic information for a city by name. Returns latitude, longitude, country, admin region, and timezone. Always call this first to obtain coordinates before fetching weather.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'City name, optionally including country (e.g. "Hyderabad" or "Paris, France").',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_weather',
    description:
      'Fetch the current weather for a given latitude/longitude. Returns temperature, apparent temperature, humidity, wind, weather code, and a human-readable condition.',
    inputSchema: {
      type: 'object',
      properties: {
        latitude: { type: 'number', description: 'Latitude in decimal degrees.' },
        longitude: { type: 'number', description: 'Longitude in decimal degrees.' },
        timezone: {
          type: 'string',
          description: 'IANA timezone string (optional, defaults to "auto").',
        },
      },
      required: ['latitude', 'longitude'],
    },
  },
];

const WEATHER_CODE_MAP = {
  0: { label: 'Clear sky', icon: '☀️' },
  1: { label: 'Mainly clear', icon: '🌤️' },
  2: { label: 'Partly cloudy', icon: '⛅' },
  3: { label: 'Overcast', icon: '☁️' },
  45: { label: 'Fog', icon: '🌫️' },
  48: { label: 'Depositing rime fog', icon: '🌫️' },
  51: { label: 'Light drizzle', icon: '🌦️' },
  53: { label: 'Moderate drizzle', icon: '🌦️' },
  55: { label: 'Dense drizzle', icon: '🌧️' },
  56: { label: 'Light freezing drizzle', icon: '🌧️' },
  57: { label: 'Dense freezing drizzle', icon: '🌧️' },
  61: { label: 'Slight rain', icon: '🌦️' },
  63: { label: 'Moderate rain', icon: '🌧️' },
  65: { label: 'Heavy rain', icon: '🌧️' },
  66: { label: 'Light freezing rain', icon: '🌧️' },
  67: { label: 'Heavy freezing rain', icon: '🌧️' },
  71: { label: 'Slight snow', icon: '🌨️' },
  73: { label: 'Moderate snow', icon: '🌨️' },
  75: { label: 'Heavy snow', icon: '❄️' },
  77: { label: 'Snow grains', icon: '❄️' },
  80: { label: 'Slight rain showers', icon: '🌦️' },
  81: { label: 'Moderate rain showers', icon: '🌧️' },
  82: { label: 'Violent rain showers', icon: '⛈️' },
  85: { label: 'Slight snow showers', icon: '🌨️' },
  86: { label: 'Heavy snow showers', icon: '❄️' },
  95: { label: 'Thunderstorm', icon: '⛈️' },
  96: { label: 'Thunderstorm with slight hail', icon: '⛈️' },
  99: { label: 'Thunderstorm with heavy hail', icon: '⛈️' },
};

function describeWeatherCode(code) {
  return WEATHER_CODE_MAP[code] ?? { label: 'Unknown', icon: '❓' };
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'mcp-to-mcp-weather/1.0 (open-meteo)' },
  });
  if (!res.ok) {
    throw new Error(`Upstream ${res.status} ${res.statusText} from ${url}`);
  }
  return res.json();
}

async function getCityInfo({ name }) {
  const url = new URL(GEOCODE_URL);
  url.searchParams.set('name', name);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  const data = await fetchJson(url.toString());
  const hit = data?.results?.[0];
  if (!hit) {
    throw new Error(`No city found for "${name}"`);
  }
  return {
    name: hit.name,
    country: hit.country,
    country_code: hit.country_code,
    admin1: hit.admin1 ?? null,
    latitude: hit.latitude,
    longitude: hit.longitude,
    elevation: hit.elevation,
    timezone: hit.timezone,
    population: hit.population ?? null,
  };
}

async function getWeather({ latitude, longitude, timezone = 'auto' }) {
  const url = new URL(FORECAST_URL);
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('timezone', timezone);
  url.searchParams.set(
    'current',
    [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'is_day',
      'precipitation',
      'weather_code',
      'wind_speed_10m',
      'wind_direction_10m',
    ].join(','),
  );

  const data = await fetchJson(url.toString());
  const c = data.current ?? {};
  const units = data.current_units ?? {};
  const condition = describeWeatherCode(c.weather_code);

  return {
    observed_at: c.time,
    temperature: { value: c.temperature_2m, unit: units.temperature_2m ?? '°C' },
    feels_like: { value: c.apparent_temperature, unit: units.apparent_temperature ?? '°C' },
    humidity: { value: c.relative_humidity_2m, unit: units.relative_humidity_2m ?? '%' },
    precipitation: { value: c.precipitation, unit: units.precipitation ?? 'mm' },
    wind: {
      speed: c.wind_speed_10m,
      speed_unit: units.wind_speed_10m ?? 'km/h',
      direction_deg: c.wind_direction_10m,
    },
    is_day: c.is_day === 1,
    condition: condition.label,
    icon: condition.icon,
    weather_code: c.weather_code,
    timezone: data.timezone,
  };
}

const server = new Server(
  { name: 'weather-mcp-server', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    let result;
    if (name === 'get_city_info') {
      result = await getCityInfo(args ?? {});
    } else if (name === 'get_weather') {
      result = await getWeather(args ?? {});
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  } catch (err) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Error in ${name}: ${err.message}` }],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write('[weather-mcp-server] ready on stdio\n');
