'use strict';

const appUrl = 'http://localhost:9001';
const apiVersion = 1;

const supertest = require('ep_etherpad-lite/node_modules/supertest');
const fs = require('fs');
const path = require('path');
const api = supertest(appUrl);
const randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString;


describe('Import and Export markdown', function () {
  let padID;
  let html;

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
      api.get(getMarkdownEndPointFor(padID))
          .expect(200, done);
    });

    it('returns Markdown correctly', function (done) {
      api.get(getMarkdownEndPointFor(padID))
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

// Loads the APIKEY.txt content into a string, and returns it.
const getApiKey = function () {
  const etherpadRoot = '/../../../../../../ep_etherpad-lite/../..';
  const filePath = path.join(__dirname, `${etherpadRoot}/APIKEY.txt`);
  const apiKey = fs.readFileSync(filePath, {encoding: 'utf-8'});
  return apiKey.replace(/\n$/, '');
};

const apiKey = getApiKey();

// Creates a pad and returns the pad id. Calls the callback when finished.
const createPad = (padID, callback) => {
  api.get(`/api/${apiVersion}/createPad?apikey=${apiKey}&padID=${padID}`)
      .end((err, res) => {
        if (err || (res.body.code !== 0)) callback(new Error('Unable to create new Pad'));
        callback(padID);
      });
};

const setHTML = (padID, html, callback) => {
  api.get(`/api/${apiVersion}/setHTML?apikey=${apiKey}&padID=${padID}&html=${html}`)
      .end((err, res) => {
        if (err || (res.body.code !== 0)) callback(new Error('Unable to set pad HTML'));

        callback(null, padID);
      });
};

const getMarkdownEndPointFor = (padID, callback) => `/p/${padID}/export/markdown`;

const buildHTML = (body) => `<html><body>${body}</body></html>`;
