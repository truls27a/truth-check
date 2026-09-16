import { DEMO_TRANSCRIPT } from './demo.js';
import { config } from '../config.js';

export async function getYouTubeTranscript(videoId) {
  if (config.demoMode) return DEMO_TRANSCRIPT;
  const page = await (await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`)).text();
  const match = page.match(/"captionTracks":(\[.*?\])/);
  if (!match) throw new Error('No captions available for this video');
  const tracks = JSON.parse(match[1].replace(/\\u0026/g, '&'));
  const track = tracks.find(t => t.languageCode === 'en') || tracks[0];
  const xml = await (await fetch(track.baseUrl)).text();
  return [...xml.matchAll(/<text start="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g)].map(m => ({ start: Number(m[1]), text: decodeHtml(m[2]).trim() })).filter(x => x.text);
}
function decodeHtml(s) { return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"'); }
