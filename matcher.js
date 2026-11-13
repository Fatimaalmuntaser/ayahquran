/* Arabic phrase lookup. Results always return the original downloaded verse. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AyahMatcher = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function normalize(value) {
    return String(value || '')
      .normalize('NFKC')
      .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF]/g, '')
      .replace(/\u0640/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ؤ/g, 'و')
      .replace(/[ئىي]/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ء/g, '')
      .replace(/[^\u0621-\u063A\u0641-\u064A\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function createIndex(surahs) {
    const verses = [];
    const terms = new Map();
    for (const surah of surahs || []) {
      (surah.ayahs || []).forEach(function (text, position) {
        const displayText = typeof text === 'string' ? text : text.text;
        const searchText = surah.searchAyahs && surah.searchAyahs[position];
        const variants = Array.from(new Set([normalize(searchText || displayText), normalize(displayText)]));
        const entry = {
          surahNumber: Number(surah.number),
          ayahNumber: position + 1,
          text: displayText,
          variants: variants.map(function (normalized) {
            return { normalized: normalized, words: normalized.split(' ') };
          })
        };
        const id = verses.push(entry) - 1;
        const words = new Set(entry.variants.flatMap(function (variant) { return variant.words; }));
        words.forEach(function (word) {
          if (!terms.has(word)) terms.set(word, []);
          terms.get(word).push(id);
        });
      });
    }
    return { verses: verses, terms: terms };
  }

  // Bounded Levenshtein distance; early exit avoids expensive unrelated windows.
  function editDistance(left, right, maximum) {
    if (Math.abs(left.length - right.length) > maximum) return maximum + 1;
    let previous = Array.from({ length: right.length + 1 }, function (_, index) { return index; });
    for (let i = 1; i <= left.length; i++) {
      const current = [i];
      let rowMinimum = i;
      for (let j = 1; j <= right.length; j++) {
        const value = Math.min(
          previous[j] + 1,
          current[j - 1] + 1,
          previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1)
        );
        current[j] = value;
        rowMinimum = Math.min(rowMinimum, value);
      }
      if (rowMinimum > maximum) return maximum + 1;
      previous = current;
    }
    return previous[right.length];
  }

  function result(entry, score, matchType) {
    return {
      surahNumber: entry.surahNumber,
      ayahNumber: entry.ayahNumber,
      text: entry.text,
      score: score,
      matchType: matchType
    };
  }

  function sortResults(results) {
    return results.sort(function (a, b) {
      return b.score - a.score || a.surahNumber - b.surahNumber || a.ayahNumber - b.ayahNumber;
    });
  }

  function search(index, query, options) {
    const config = options || {};
    const limit = Math.max(1, Math.min(50, Number(config.limit) || 5));
    const requestedSurah = config.surahNumber ? Number(config.surahNumber) : null;
    const normalizedQuery = normalize(query);
    if (!index || !normalizedQuery || normalizedQuery.length < 2) return [];
    const eligible = function (entry) { return !requestedSurah || entry.surahNumber === requestedSurah; };
    const paddedQuery = ' ' + normalizedQuery + ' ';
    const exact = [];
    index.verses.forEach(function (entry) {
      if (!eligible(entry)) return;
      let score = 0;
      entry.variants.forEach(function (variant) {
        if ((' ' + variant.normalized + ' ').includes(paddedQuery)) {
          score = Math.max(score, variant.normalized === normalizedQuery ? 1 : 0.99);
        }
      });
      if (score) exact.push(result(entry, score, 'exact'));
    });
    // Repeated phrases remain separate candidates; no arbitrary verse is selected here.
    if (exact.length) return sortResults(exact).slice(0, limit);

    const queryWords = normalizedQuery.split(' ');
    const compactLength = normalizedQuery.replace(/ /g, '').length;
    // One-word or very short approximate searches are too ambiguous to be useful.
    if (queryWords.length < 2 || compactLength < 8) return [];
    const distinctWords = Array.from(new Set(queryWords));
    const overlap = new Map();
    distinctWords.forEach(function (word) {
      (index.terms.get(word) || []).forEach(function (id) {
        overlap.set(id, (overlap.get(id) || 0) + 1);
      });
    });
    const neededOverlap = Math.max(1, Math.ceil(distinctWords.length * 0.5));
    const threshold = queryWords.length >= 5 ? 0.84 : 0.86;
    const maximum = Math.min(8, Math.max(1, Math.floor(normalizedQuery.length * (1 - threshold))));
    const approximate = [];
    overlap.forEach(function (shared, id) {
      const entry = index.verses[id];
      if (shared < neededOverlap || !eligible(entry)) return;
      let best = 0;
      entry.variants.forEach(function (variant) {
        const minWords = Math.max(1, queryWords.length - 1);
        const maxWords = Math.min(variant.words.length, queryWords.length + 1);
        for (let size = minWords; size <= maxWords; size++) {
          for (let start = 0; start + size <= variant.words.length; start++) {
            const phrase = variant.words.slice(start, start + size).join(' ');
            if (Math.abs(phrase.length - normalizedQuery.length) > maximum) continue;
            const distance = editDistance(normalizedQuery, phrase, maximum);
            if (distance > maximum) continue;
            const similarity = 1 - distance / Math.max(phrase.length, normalizedQuery.length);
            if (similarity >= threshold) best = Math.max(best, similarity);
          }
        }
      });
      if (best) approximate.push(result(entry, Math.min(0.97, best), 'approximate'));
    });
    return sortResults(approximate).slice(0, limit);
  }

  return { normalize: normalize, createIndex: createIndex, search: search };
});
