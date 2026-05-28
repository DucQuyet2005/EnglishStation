import axios from 'axios';
import { Logger } from '../utils/logger';

const log = new Logger('TranslationService');

/**
 * Translation service using Google's free translation endpoint.
 */
export async function translateText(
  text: string,
  targetLang: string,
  sourceLang: string = 'auto'
): Promise<string> {
  if (!text || !text.trim() || !targetLang || targetLang === 'none') {
    return '';
  }

  try {
    const url = `https://translate.googleapis.com/translate_a/single`;
    const response = await axios.get(url, {
      params: {
        client: 'gtx',
        sl: sourceLang,
        tl: targetLang,
        dt: 't',
        q: text,
      },
      timeout: 10000, // 10s timeout
    });

    // Google Translate returns a nested array of segments
    if (response.data && response.data[0]) {
      const translatedParts = response.data[0]
        .map((part: any) => part[0])
        .filter(Boolean);
      return translatedParts.join('').trim();
    }
    return '';
  } catch (error) {
    log.error(`Translation error for text "${text.substring(0, 30)}...":`, error);
    // Fallback to empty string on error so the main transcription request doesn't fail
    return '';
  }
}

/**
 * Batch translate a list of segments for high performance.
 * We translate all segments in parallel to minimize latency.
 */
export async function translateSegments(
  segments: Array<{ text: string }>,
  targetLang: string
): Promise<string[]> {
  if (!targetLang || targetLang === 'none' || segments.length === 0) {
    return segments.map(() => '');
  }

  log.info(`Translating ${segments.length} segments to language: ${targetLang}`);
  
  // Parallel translation of all segments
  const promises = segments.map(seg => translateText(seg.text, targetLang));
  return Promise.all(promises);
}
