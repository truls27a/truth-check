import { config } from '../config.js';

export async function searchWeb(query) {
  if (!config.searchKey) return [];
  const response = await fetch(`https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=5`, { headers: { 'Ocp-Apim-Subscription-Key': config.searchKey } });
  if (!response.ok) throw new Error(`Search request failed (${response.status})`);
  const data = await response.json();
  return (data.webPages?.value || []).map(x => ({ title: x.name, url: x.url, publisher: new URL(x.url).hostname, snippet: x.snippet }));
}
