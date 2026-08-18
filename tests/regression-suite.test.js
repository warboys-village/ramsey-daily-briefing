const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const TownCouncilSource = require('../scripts/sources/town-council-source');
const RamseyNewsletterSource = require('../scripts/sources/ramsey-newsletter-source');
const LibraryEventsSource = require('../scripts/sources/library-events-source');
const HdcPlanningSource = require('../scripts/sources/hdc-planning-source');
const CountyCouncilSource = require('../scripts/sources/county-council-source');
const { getCachedDocument, setCachedDocument } = require('../scripts/utils/processed-doc-cache');
const { generateIcs, formatIcsDate } = require('../scripts/utils/ics-generator');
const { preFilterItems } = require('../scripts/utils/pre-filter');
const { renderFullBriefingHtml } = require('../scripts/agent/template-renderer');
const BriefingAgent = require('../scripts/agent/briefing-agent');

describe('Ramsey Daily System - Comprehensive Regression Test Suite', () => {

  describe('1. Ramsey Town Council Governance Extractor (scripts/sources/town-council-source.js)', () => {
    test('extracts disaggregated governance items for Ramsey Town Council', async () => {
      const source = new TownCouncilSource({
        id: 'ramsey-town',
        name: 'Ramsey Town Council',
        url: 'https://www.ramseytowncouncil.gov.uk/beta-ramsey/documents'
      });

      const items = await source.extract({ includeMockFallback: true });

      assert.ok(Array.isArray(items), 'TownCouncilSource should return an array');
      assert.ok(items.length >= 3, 'Should extract disaggregated items for Ramsey Town Council');

      const trafficItem = items.find(i => i.id.includes('great-whyte-traffic'));
      const planningRecItem = items.find(i => i.id.includes('planning-recommendation'));

      assert.ok(trafficItem, 'Should disaggregate Great Whyte traffic safety item');
      assert.ok(planningRecItem, 'Should disaggregate Planning Committee recommendation item');
      assert.strictEqual(trafficItem.sourceId, 'ramsey-town', 'sourceId must be ramsey-town');
    });
  });

  describe('2. Ramsey Library & Community Events Extractor (scripts/sources/library-events-source.js)', () => {
    test('extracts PE26 library events for Ramsey', async () => {
      const source = new LibraryEventsSource({
        id: 'library-events',
        name: 'Library Events Calendar',
        url: 'https://info.cambridgeshire.gov.uk/kb5/cambridgeshire/directory/results.action?camcommunitychannel=6-4&location_postcode__outcode=PE26'
      });

      const items = await source.extract({ includeMockFallback: true });
      assert.ok(items.length > 0, 'LibraryEventsSource must extract items');

      const rhymetime = items.find(i => i.title.includes('Rhymetime'));
      assert.ok(rhymetime, 'Must contain Rhymetime event');
      assert.ok(rhymetime.venue.includes('Ramsey Library'), 'Venue must reference Ramsey Library');
    });
  });

  describe('3. Pre-Filtering & Retention Rules (scripts/utils/pre-filter.js)', () => {
    test('retains governance items up to 60 days and prioritizes high-signal items', () => {
      const mockNow = new Date('2026-08-15T12:00:00.000Z');

      const rawItems = [
        {
          id: 'gov-45-days-old',
          title: 'Ramsey Town Council Minutes: Great Whyte Review',
          content: 'Traffic safety update',
          url: 'https://www.ramseytowncouncil.gov.uk/documents/minutes.pdf',
          date: '2026-07-01T12:00:00.000Z',
          category: 'Village News & Governance',
          sourceId: 'ramsey-town',
          sourceName: 'Ramsey Town Council'
        },
        {
          id: 'rss-45-days-old',
          title: 'Old Regional News Story',
          content: 'Old generic story',
          url: 'https://news.google.com/...',
          date: '2026-07-01T12:00:00.000Z',
          category: 'News',
          sourceId: 'google-news',
          sourceName: 'Google News'
        }
      ];

      const filtered = preFilterItems(rawItems, {}, mockNow);
      assert.strictEqual(filtered.length, 1, 'High priority governance item 45 days old must be retained');
      assert.strictEqual(filtered[0].id, 'gov-45-days-old');
    });

    test('filters out death notices and obituary columns from RSS feeds', () => {
      const items = [
        { title: 'MEGAN IRENE STEPHENS - The Hunts Post', content: '', url: 'https://example.com/1' },
        { title: 'Ramsey Town Council Meeting Scheduled', content: 'Normal governance notice.', url: 'https://example.com/4', sourceId: 'ramsey-town' }
      ];

      const filtered = preFilterItems(items);
      assert.strictEqual(filtered.length, 1, 'Must filter out death notice variants');
      assert.strictEqual(filtered[0].title, 'Ramsey Town Council Meeting Scheduled');
    });

    test('strips leading "Share Share" social sharing UI fluff from article content', () => {
      const items = [
        {
          title: 'Firefighters tackle blaze at nature reserve',
          content: 'Share Share Firefighters are continuing to tackle a blaze at a Cambridgeshire nature reserve...',
          url: 'https://www.huntspost.co.uk/news/12345',
          date: '2026-08-17T12:00:00.000Z'
        }
      ];

      const filtered = preFilterItems(items);
      assert.strictEqual(filtered.length, 1);
      assert.ok(!filtered[0].content.startsWith('Share'), 'Content must NOT start with Share');
      assert.ok(filtered[0].content.startsWith('Firefighters'), 'Content must start cleanly with real article text');
    });

    test('excludes internal Abbey College bulletins from main village news', () => {
      const agent = new BriefingAgent({ villageName: 'Ramsey' });
      
      const internalBulletin = {
        title: "Abbey College: Ramsey Gatehouse Sixth Form February Bulletin8817KB",
        content: "Internal sixth form notices.",
        sourceId: "abbey-college",
        sourceName: "Abbey College Weekly Updates",
        category: "School News"
      };

      const communityEvent = {
        title: "Abbey College Annual Community Science Fete",
        content: "Open to the whole village community.",
        sourceId: "abbey-college",
        sourceName: "Abbey College Weekly Updates",
        category: "School News"
      };

      assert.strictEqual(agent.isWholeVillageSchoolItem(internalBulletin), false, 'Internal Abbey College bulletin must be excluded from village news');
      assert.strictEqual(agent.isWholeVillageSchoolItem(communityEvent), true, 'Community-wide school event must be included');
    });
  });

  describe('4. Deterministic Component Rendering & Categorization (template-renderer.js)', () => {
    test('renders 4 distinct section blocks with Ramsey headers', () => {
      const briefingData = {
        events: [{
          id: 'evt-1',
          title: 'Ramsey Heritage Day',
          eventTime: 'Sunday 13 September • 11:00 AM',
          eventCategory: 'UPCOMING',
          venue: 'Ramsey Abbey Gatehouse',
          content: 'Abbey Gatehouse tours.',
          url: 'https://example.com/tour.pdf',
          sourceName: 'Ramsey Community Events'
        }],
        news: [{
          id: 'news-1',
          title: 'Great Whyte Market Expansion',
          content: 'New market stalls announced.',
          date: '2026-08-14T12:00:00.000Z',
          url: 'https://example.com/market',
          sourceName: 'The Hunts Post'
        }],
        governance: [{
          id: 'gov-1',
          title: 'Ramsey Town Council Governance: Great Whyte Speed Limit',
          content: '20mph zone requested.',
          date: '2026-07-10T12:00:00.000Z',
          url: 'https://www.ramseytowncouncil.gov.uk/documents/minutes.pdf',
          sourceName: 'Ramsey Town Council'
        }],
        planning: [{
          id: 'plan-1',
          title: 'Extension at 14 High Street',
          address: '14 High Street, Ramsey',
          content: 'Erection of single-storey extension.',
          statusCategory: 'NEW',
          statusLabel: 'New Application',
          badgeClass: 'badge-new',
          url: 'https://publicaccess.huntingdonshire.gov.uk/...',
          sourceName: 'HDC Planning'
        }]
      };

      const villageConfig = { parishCouncil: 'Ramsey Town Council', villageName: 'Ramsey' };
      const html = renderFullBriefingHtml(briefingData, 'Ramsey', 'Cambridgeshire', villageConfig);

      assert.ok(html.includes('What\'s On'), 'Must contain Block 1: What\'s On header');
      assert.ok(html.includes('Ramsey News'), 'Must contain Block 2: Ramsey News header');
      assert.ok(html.includes('Governance & Council'), 'Must contain Block 3: Governance header');
      assert.ok(html.includes('Planning & Development'), 'Must contain Block 4: Planning header');
    });
  });

  describe('5. Ramsey Schools Dataset', () => {
    test('verifies ramsey_schools.json dataset definition', () => {
      const ramseySchools = require('../src/_data/ramsey_schools.json');
      assert.ok(Array.isArray(ramseySchools), 'ramsey_schools.json must be an array');
      assert.strictEqual(ramseySchools.length, 4, 'Must define 4 Ramsey schools');

      const abbeyCollege = ramseySchools.find(s => s.id === 'abbey-college');
      assert.ok(abbeyCollege, 'Abbey College must exist');
      assert.ok(abbeyCollege.website.includes('abbey.college'), 'Website must point to Abbey College');
    });
  });

});
