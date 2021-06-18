'use strict';

const common = require('ep_etherpad-lite/tests/backend/common');
const randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString;

let agent;
const apiKey = common.apiKey;
const apiVersion = 1;

const getMarkdownEndPointFor = (padID) => `/p/${padID}/export/markdown`;

const buildHTML = (body) => `<html><body>${body}</body></html>`;

// Creates a pad and returns the pad id. Calls the callback when finished.
const createPad = async (padID) => {
  const res = await agent.get(`/api/${apiVersion}/createPad?apikey=${apiKey}&padID=${padID}`);
  if (res.body.code !== 0) throw new Error('Unable to create new Pad');
};

const setHTML = async (padID, html) => {
  const res =
      await agent.get(`/api/${apiVersion}/setHTML?apikey=${apiKey}&padID=${padID}&html=${html}`);
  if (res.body.code !== 0) throw new Error('Unable to set pad HTML');
};

describe('Import and Export markdown', function () {
  let padID;
  let html;

  before(async function () { agent = await common.init(); });

  // create a new pad before each test run
  beforeEach(async function () {
    padID = randomString(5);
    await createPad(padID);
    await setHTML(padID, html());
  });

  describe('when text has formatting', function () {
    before(async function () {
      html = () => buildHTML(
          '<i>italic</i><b>bold</b><ul><li>derp</li></ul><ol><li>derp2</li></ol><u>underline</u>');
    });

    it('returns ok', async function () {
      await agent.get(getMarkdownEndPointFor(padID))
          .expect(200);
    });

    it('returns Markdown correctly', async function () {
      const res = await agent.get(getMarkdownEndPointFor(padID));
      const markdown = res.text;
      if (markdown.indexOf('*italic*') === -1) throw new Error('Unable to export italic');
      if (markdown.indexOf('**bold**') === -1) throw new Error('Unable to export bold');
      if (markdown.indexOf('* derp') === -1) throw new Error('Unable to export UL');
      if (markdown.indexOf('[]underline[]') === -1) {
        throw new Error('Unable to export underline');
      }
    });
  });
});
