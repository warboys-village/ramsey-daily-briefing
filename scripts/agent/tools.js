const cheerio = require('cheerio');
const pdfParse = require('pdf-parse');

/**
 * Helper to fetch article content via smry.ai for paywalled or script-heavy news sites (like Hunts Post)
 */
async function fetchViaSmry(targetUrl) {
  try {
    const smryUrl = `https://smry.ai/${targetUrl}`;
    const res = await fetch(smryUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VillageDaily/1.0' },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header, .ad, .cookie-banner').remove();
    
    // Extract main content container or body text
    const articleText = $('#article-body, article, .smry-content, main, body').text().replace(/\s+/g, ' ').trim();
    return articleText.length > 100 ? articleText.slice(0, 1500) : null;
  } catch (err) {
    return null;
  }
}

/**
 * Agent tool definitions and implementations
 */
const tools = [
  {
    name: 'fetch_page_content',
    description: 'Fetch and clean HTML content from a URL to inspect details. Automatically uses smry.ai reader for news sites like Hunts Post.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The absolute Web URL to fetch' }
      },
      required: ['url']
    },
    execute: async ({ url }) => {
      // If URL is from Hunts Post or similar news domain, try smry.ai first
      if (url.includes('huntspost.co.uk') || url.includes('news')) {
        const smryText = await fetchViaSmry(url);
        if (smryText) return `[Via smry.ai reader] ${smryText}`;
      }

      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 VillageDaily/1.0' },
          signal: AbortSignal.timeout(5000)
        });
        if (!res.ok) {
          // Fallback to smry.ai on non-200 HTTP response
          const smryText = await fetchViaSmry(url);
          if (smryText) return `[Via smry.ai fallback] ${smryText}`;
          return `Failed to fetch URL ${url} (HTTP status ${res.status})`;
        }
        const html = await res.text();
        const $ = cheerio.load(html);
        $('script, style, nav, footer, header').remove();
        const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

        // If body text is too short (likely blocked by cookie banner/paywall), try smry.ai
        if (bodyText.length < 150) {
          const smryText = await fetchViaSmry(url);
          if (smryText) return `[Via smry.ai reader] ${smryText}`;
        }

        return bodyText.slice(0, 1200);
      } catch (err) {
        const smryText = await fetchViaSmry(url);
        if (smryText) return `[Via smry.ai fallback] ${smryText}`;
        return `Error fetching URL ${url}: ${err.message}`;
      }
    }
  },
  {
    name: 'fetch_smry_article',
    description: 'Directly fetch full news article text using smry.ai bypass reader for news sites like Hunts Post.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The news article URL' }
      },
      required: ['url']
    },
    execute: async ({ url }) => {
      const smryText = await fetchViaSmry(url);
      if (smryText) return smryText;
      return `Unable to fetch article via smry.ai for ${url}.`;
    }
  },
  {
    name: 'extract_pdf_text',
    description: 'Download and parse text from a PDF document URL (such as parish council minutes or planning PDFs).',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The absolute URL of the PDF document' }
      },
      required: ['url']
    },
    execute: async ({ url }) => {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 VillageDaily/1.0' },
          signal: AbortSignal.timeout(6000)
        });
        if (!res.ok) return `Failed to download PDF from ${url}`;
        const buffer = await res.arrayBuffer();
        const data = await pdfParse(Buffer.from(buffer));
        return (data.text || '').replace(/\s+/g, ' ').trim().slice(0, 1500);
      } catch (err) {
        return `Error extracting PDF text from ${url}: ${err.message}`;
      }
    }
  }
];

module.exports = { tools, fetchViaSmry };
