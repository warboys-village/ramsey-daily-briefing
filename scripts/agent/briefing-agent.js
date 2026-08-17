const LlmClient = require('./llm-client');
const { tools } = require('./tools');
const { renderFullBriefingHtml } = require('./template-renderer');

class BriefingAgent {
  constructor(config = {}) {
    this.villageConfig = config;
    this.client = new LlmClient(config.llmConfig || {});
    this.maxTurns = (config.llmConfig && config.llmConfig.maxTurns) || 2;
  }

  /**
   * Run agentic briefing synthesis over pre-filtered source items.
   */
  async generateBriefing(items, isoDate) {
    const villageName = this.villageConfig.villageName || 'Ramsey';
    const county = this.villageConfig.county || 'Cambridgeshire';

    if (!items || items.length === 0) {
      return this.generateZeroItemsBriefing(isoDate, villageName, county);
    }

    const systemPrompt = `You are the local daily news editor for ${villageName}, ${county}, UK.
Synthesize pre-filtered local news, council minutes, events, and planning applications.
Analyze raw text snippets to extract clear, news-worthy local headlines and summaries.
IMPORTANT RULE FOR SCHOOL NEWS: Routine school internal news belongs exclusively on the Schools hub page (/schools/). ONLY include a school item in 'news' if it is of genuine interest to the whole village/town community (e.g. public community fete open to all, road safety/traffic notices affecting all residents, public community facilities).
IMPORTANT RULE FOR OBITUARIES & DEATH NOTICES: Strictly EXCLUDE individual death notices, obituaries, in-memoriam announcements, and personal funeral details from all categories.
STRICT BRITISH ENGLISH LANGUAGE RULE: All output text, headlines, summaries, and descriptions MUST use British English spelling conventions exclusively (e.g. colour, organisation, centre, licence, behaviour, generalised, favourite, analyse, organise).
Return a structured JSON object containing four arrays: 'events', 'news', 'governance', 'planning'.`;

    const contextSummary = items.map((item, idx) => `
Item #${idx + 1}:
- Title: ${item.title}
- Reference: ${item.reference || ''}
- Source: [${item.sourceName}](${item.url})
- Date: ${item.date}
- Category: ${item.category}
- Source ID: ${item.sourceId || ''}
- Event Category: ${item.eventCategory || 'N/A'}
- Is Regular Event: ${item.isRegular ? 'YES' : 'NO'}
- Event Time/Date: ${item.eventTime || 'N/A'}
- Event Date String: ${item.eventDate || item.date || 'N/A'}
- Venue: ${item.venue || 'N/A'}
- Status Category: ${item.statusCategory || 'N/A'}
- Status Label: ${item.statusLabel || 'In Progress'}
- Badge Class: ${item.badgeClass || 'badge-progress'}
- Decision Outcome: ${item.decisionOutcome || 'N/A'}
- Address: ${item.address || 'N/A'}
- Map URL: ${item.mapUrl || '#'}
- Clean Summary: ${item.content}
`).join('\n---\n');

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Here are today's pre-filtered items for ${villageName} (${isoDate}):\n\n${contextSummary}\n\nPlease analyze and synthesize today's briefing.` }
    ];

    let currentTurn = 0;
    let finalBriefingData = null;

    while (currentTurn < this.maxTurns) {
      currentTurn++;
      const response = await this.client.runAgentStep(messages, tools);

      if (response.mockBriefing || (!response.content && !response.tool_calls)) {
        finalBriefingData = this.groupItemsFallback(items);
        break;
      }

      messages.push(response);

      if (response.tool_calls && response.tool_calls.length > 0) {
        for (const toolCall of response.tool_calls) {
          const fnName = toolCall.function.name;
          const fnArgs = JSON.parse(toolCall.function.arguments || '{}');
          const targetTool = tools.find(t => t.name === fnName);
          let toolResult = `Tool ${fnName} not found.`;
          if (targetTool) {
            toolResult = await targetTool.execute(fnArgs);
          }
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: String(toolResult)
          });
        }
      } else if (response.content) {
        try {
          finalBriefingData = JSON.parse(response.content);
        } catch (e) {
          finalBriefingData = this.groupItemsFallback(items);
        }
        break;
      }
    }

    if (!finalBriefingData) {
      finalBriefingData = this.groupItemsFallback(items);
    }

    return renderFullBriefingHtml(finalBriefingData, villageName, county, this.villageConfig);
  }

  generateZeroItemsBriefing(isoDate, villageName, county) {
    return `<div class="briefing-block">
  <div class="briefing-block-header">
    <h3 class="briefing-block-title">Daily Overview</h3>
  </div>
  <div class="briefing-block-content">
    <p>No new local news, events, or planning updates were published for ${villageName} today.</p>
    <p style="margin-top: 1rem;"><strong>Local Information:</strong></p>
    <ul>
      <li><strong>District Council:</strong> ${this.villageConfig.districtCouncil || 'Huntingdonshire District Council'}</li>
      <li><strong>Local Council:</strong> ${this.villageConfig.parishCouncil || (villageName + ' Town Council')}</li>
      <li><strong>County:</strong> ${county}</li>
    </ul>
    <p style="margin-top: 1rem; color: var(--color-text-muted);"><em>Check back tomorrow for fresh updates or explore past entries in the <a href="/archive/">Archive</a>.</em></p>
  </div>
</div>`;
  }

  isWholeVillageWpaItem(item) {
    const srcId = (item.sourceId || '').toLowerCase();
    const srcName = (item.sourceName || '').toLowerCase();
    const isSchool = srcId.includes('school') || srcName.includes('school') || srcName.includes('academy');
    
    if (!isSchool) {
      return true;
    }

    if (item.isWholeVillage) return true;

    const combinedText = `${item.title || ''} ${item.content || ''}`.toLowerCase();
    const wholeVillageKeywords = [
      'whole village', 'village-wide', 'town-wide', 'community', 'public', 'open to all',
      'fete', 'fayre', 'fair', 'road safety', 'traffic', 'parking',
      'crossing patrol', 'floodlit', 'village hall', 'fundraiser for village'
    ];
    return wholeVillageKeywords.some(kw => combinedText.includes(kw));
  }

  groupItemsFallback(items) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const eventItems = items.filter(i => {
      if (!i.category || !i.category.toLowerCase().includes('event')) return false;
      if (i.isRegular) return true;
      const d = new Date(i.eventDate || i.date);
      return !isNaN(d.getTime()) && d >= todayStart;
    });

    const planningItems = items.filter(i => i.sourceId === 'hdc-planning' || (i.category && i.category.toLowerCase() === 'planning'));
    const governanceItems = items.filter(i => !eventItems.includes(i) && !planningItems.includes(i) && (
      i.sourceId === 'ramsey-town' || 
      i.sourceId === 'warboys-parish' || 
      i.sourceId === 'ramsey-newsletter' ||
      (i.sourceName && (i.sourceName.toLowerCase().includes('council') || i.sourceName.toLowerCase().includes('governance'))) || 
      (i.category && i.category.toLowerCase().includes('governance'))
    ));
    const generalNewsItems = items.filter(i => {
      if (eventItems.includes(i) || planningItems.includes(i) || governanceItems.includes(i)) return false;
      return this.isWholeVillageWpaItem(i);
    });

    return {
      events: eventItems,
      news: generalNewsItems,
      governance: governanceItems,
      planning: planningItems
    };
  }
}

module.exports = BriefingAgent;
