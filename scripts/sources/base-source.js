/**
 * Abstract Base Source interface for Village Daily extractors
 */
class BaseSource {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.config = config;
  }

  /**
   * Extract raw items from the source.
   * @param {Object} options Options like { maxDays: 7, filterKeyword: 'Warboys' }
   * @returns {Promise<Array<{id: string, title: string, content: string, url: string, date: string, category: string, sourceId: string, sourceName: string}>>}
   */
  async extract(options = {}) {
    throw new Error(`Method extract() must be implemented by subclass ${this.constructor.name}`);
  }
}

module.exports = BaseSource;
