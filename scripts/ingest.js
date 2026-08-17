const fs = require('fs');
const path = require('path');
const villageConfig = require('../village.config.json');

const RssSource = require('./sources/rss-source');
const HdcPlanningSource = require('./sources/hdc-planning-source');
const ParishCouncilSource = require('./sources/parish-council-source');
const EventsSource = require('./sources/events-source');
const VillageSceneSource = require('./sources/village-scene-source');
const FowlSource = require('./sources/fowl-source');
const CountyCouncilSource = require('./sources/county-council-source');
const TownCouncilSource = require('./sources/town-council-source');
const RamseyNewsletterSource = require('./sources/ramsey-newsletter-source');
const LibraryEventsSource = require('./sources/library-events-source');
const AbbeyCollegeSource = require('./sources/abbey-college-source');

const { preFilterItems } = require('./utils/pre-filter');
const { loadCalendar } = require('./utils/events-calendar-store');
const BriefingAgent = require('./agent/briefing-agent');

async function runIngest() {
  const isMock = process.argv.includes('--mock');
  const now = new Date();
  const isoDate = now.toISOString().split('T')[0]; // e.g. "2026-08-14"
  const formattedDateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  console.log(`[Ingest Pipeline] Starting ingestion for ${villageConfig.villageName} (${isoDate})...`);

  // Map source types to classes
  const sourceInstances = [];
  for (const srcCfg of villageConfig.sources || []) {
    if (!srcCfg.enabled) continue;
    if (srcCfg.type === 'rss') {
      sourceInstances.push(new RssSource(srcCfg));
    } else if (srcCfg.type === 'hdc-planning') {
      sourceInstances.push(new HdcPlanningSource(srcCfg));
    } else if (srcCfg.type === 'parish-council') {
      sourceInstances.push(new ParishCouncilSource(srcCfg));
    } else if (srcCfg.type === 'town-council') {
      sourceInstances.push(new TownCouncilSource(srcCfg));
    } else if (srcCfg.type === 'ramsey-council-newsletter') {
      sourceInstances.push(new RamseyNewsletterSource(srcCfg));
    } else if (srcCfg.type === 'library-events') {
      sourceInstances.push(new LibraryEventsSource(srcCfg));
    } else if (srcCfg.type === 'abbey-college') {
      sourceInstances.push(new AbbeyCollegeSource(srcCfg));
    } else if (srcCfg.type === 'events') {
      sourceInstances.push(new EventsSource(srcCfg));
    } else if (srcCfg.type === 'village-scene') {
      sourceInstances.push(new VillageSceneSource(srcCfg));
    } else if (srcCfg.type === 'fowl-library') {
      sourceInstances.push(new FowlSource(srcCfg));
    } else if (srcCfg.type === 'county-council') {
      sourceInstances.push(new CountyCouncilSource(srcCfg));
    } else if (srcCfg.type === 'wpa-school') {
      sourceInstances.push(new WpaSource(srcCfg));
    }
  }

  // Collect raw items
  const allRawItems = [];
  const sourcesMetadata = [];

  for (const src of sourceInstances) {
    try {
      console.log(` -> Fetching source: ${src.name}...`);
      const items = await src.extract({
        maxDays: (villageConfig.llmConfig && villageConfig.llmConfig.preFilterDays) || 7,
        includeMockFallback: isMock
      });
      allRawItems.push(...items);
      sourcesMetadata.push({
        id: src.id,
        name: src.name,
        type: src.type,
        itemCount: items.length,
        status: 'ok',
        url: src.config.url || 'N/A'
      });
    } catch (err) {
      console.warn(` -> Error extracting from ${src.name}: ${err.message}`);
      sourcesMetadata.push({
        id: src.id,
        name: src.name,
        type: src.type,
        itemCount: 0,
        status: 'error',
        error: err.message
      });
    }
  }

  // Load persistent events from repo store (src/_data/events_calendar.json)
  const savedCalendarEvents = loadCalendar();
  if (savedCalendarEvents && savedCalendarEvents.length > 0) {
    allRawItems.push(...savedCalendarEvents);
  }

  // Pre-filter
  const filteredItems = preFilterItems(allRawItems, villageConfig.llmConfig || {});
  console.log(` -> Collected ${allRawItems.length} raw items (including persistent calendar), pre-filtered down to ${filteredItems.length} high-signal items.`);

  // Save source breakdown data for /archive/YYYY-MM-DD/sources/
  const dataDir = path.join(__dirname, '..', villageConfig.dataDir || 'src/_data');
  const sourcesDataDir = path.join(dataDir, 'daily_sources');
  fs.mkdirSync(sourcesDataDir, { recursive: true });

  const dailySourceData = {
    date: isoDate,
    villageName: villageConfig.villageName,
    sources: sourcesMetadata,
    processedItemCount: filteredItems.length,
    rawItemCount: allRawItems.length,
    rawItems: allRawItems,
    items: filteredItems
  };

  fs.writeFileSync(
    path.join(sourcesDataDir, `${isoDate}.json`),
    JSON.stringify(dailySourceData, null, 2)
  );

  // Synthesize Briefing via Agent
  const agent = new BriefingAgent(villageConfig);
  const briefingBody = await agent.generateBriefing(filteredItems, isoDate);

  // Format Frontmatter
  const title = `${villageConfig.villageName} Daily Briefing – ${formattedDateStr}`;
  const briefingMarkdown = `---
title: "${title}"
date: ${isoDate}
isoDate: "${isoDate}"
villageName: "${villageConfig.villageName}"
county: "${villageConfig.county}"
sourcesCount: ${sourcesMetadata.length}
itemsCount: ${filteredItems.length}
layout: layouts/briefing.njk
permalink: "/archive/${isoDate}/index.html"
---

${briefingBody}
`;

  // Write briefing file to src/briefings/YYYY-MM-DD.md
  const outputDir = path.join(__dirname, '..', villageConfig.outputDir || 'src/briefings');
  fs.mkdirSync(outputDir, { recursive: true });

  const outputFile = path.join(outputDir, `${isoDate}.md`);
  fs.writeFileSync(outputFile, briefingMarkdown, 'utf-8');

  console.log(`[Ingest Pipeline] Successfully generated daily briefing for ${isoDate} at ${outputFile}`);
}

runIngest().catch(err => {
  console.error('[Ingest Pipeline] Fatal error:', err);
  process.exit(1);
});
