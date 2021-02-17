'use strict';

const common = require('ep_etherpad-lite/tests/backend/common');
const randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString;

let agent;
const apiKey = common.apiKey;
const apiVersion = 1;

describe('Import and Export markdown', function () {
  let padID;
  let html;

  before(async function () { agent = await common.init(); });

  // create a new pad before each test run
  beforeEach(function (done) {
    padID = randomString(5);

    createPad(padID, () => {
      setHTML(padID, html(), done);
    });
  });

  context('when text has formatting', function () {
    before(async function () {
      html = () => buildHTML(
          '<i>italic</i><b>bold</b><ul><li>derp</li></ul><ol><li>derp2</li></ol><u>underline</u>');
    });

    it('returns ok', function (done) {
      agent.get(getMarkdownEndPointFor(padID))
          .expect(200, done);
    });

    it('returns Markdown correctly', function (done) {
      agent.get(getMarkdownEndPointFor(padID))
          .expect((res) => {
            const markdown = res.text;
            if (markdown.indexOf('*italic*') === -1) throw new Error('Unable to export italic');
            if (markdown.indexOf('**bold**') === -1) throw new Error('Unable to export bold');
            if (markdown.indexOf('* derp') === -1) throw new Error('Unable to export UL');
            if (markdown.indexOf('[]underline[]') === -1) {
              throw new Error('Unable to export underline');
            }
          })
          .end(done);
    });
  });
});

// Creates a pad and returns the pad id. Calls the callback when finished.
const createPad = (padID, callback) => {
  agent.get(`/api/${apiVersion}/createPad?apikey=${apiKey}&padID=${padID}`)
      .end((err, res) => {
        if (err || (res.body.code !== 0)) callback(new Error('Unable to create new Pad'));
        callback(padID);
      });
};

const setHTML = (padID, html, callback) => {
  agent.get(`/api/${apiVersion}/setHTML?apikey=${apiKey}&padID=${padID}&html=${html}`)
      .end((err, res) => {
        if (err || (res.body.code !== 0)) callback(new Error('Unable to set pad HTML'));

        callback(null, padID);
      });
};

const getMarkdownEndPointFor = (padID, callback) => `/p/${padID}/export/markdown`;

const buildHTML = (body) => `<html><body>${body}</body></html>`;
