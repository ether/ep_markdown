'use strict';

/**
 * aceHandlers.js — Ace editor hook logic for ep_fountain.
 *
 * This module contains helper functions used by the main client-side hooks
 * for managing Fountain line attributes in Etherpad's Ace editor.
 */

const AceHandlers = (() => {
  /**
   * Extract Fountain type from a CSS class string.
   * @param {string} cls - space-separated class string
   * @returns {string|null} - the fountain type or null
   */
  const extractFountainType = (cls) => {
    if (!cls) return null;
    const match = cls.match(/fountain-([a-z_0-9]+)/);
    return match ? match[1] : null;
  };

  /**
   * Build the pre/post HTML wrapper for a line based on its Fountain type.
   * @param {string} type - fountain element type
   * @returns {object|null} - modifier object for aceDomLineProcessLineAttributes
   */
  const buildLineModifier = (type) => {
    if (!type) return null;
    return {
      preHtml: '<div class="fountain-line fountain-' + type + '">',
      postHtml: '</div>',
      processedMarker: true,
    };
  };

  return {
    extractFountainType,
    buildLineModifier,
  };
})();

if (typeof exports !== 'undefined') {
  exports.AceHandlers = AceHandlers;
}
