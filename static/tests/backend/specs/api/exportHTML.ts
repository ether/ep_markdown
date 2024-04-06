'use strict';

const common = require('ep_etherpad-lite/tests/backend/common');
const randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString;
import {generateJWTToken} from "ep_etherpad-lite/tests/backend/common";

let agent;
const apiVersion = 1;

const getMarkdownEndPointFor = (padID: string) => `/p/${padID}/export/markdown`;

const buildHTML = (body: string) => `<html><body>${body}</body></html>`;

// Creates a pad and returns the pad id. Calls the callback when finished.
const createPad = async (padID: string) => {
  const res = await agent.get(`/api/${apiVersion}/createPad?padID=${padID}`)
      .set("Authorization", await generateJWTToken())
  return new Promise((resolve, reject) => {
    if (res.body.code !== 0) {
      reject(new Error('Unable to create new Pad'));
    } else {
      resolve(padID);
    }
  })
};

const setHTML = async (padID: string, html: string) => {
  const newHtml = `/api/${apiVersion}/setHTML?padID=${padID}&html=${html}`
  console.log("New HTML is",newHtml)
  const res = await agent.get(newHtml)
      .set("Authorization", await generateJWTToken())
  console.log("Res is",res.body)
  return new Promise((resolve, reject) => {
    if (res.body.code !== 0) {
      reject(new Error('Unable to set pad HTML'));
    } else {
      resolve(padID);
    }
  })
};

describe('Import and Export markdown', function () {
  let padID: string;
  let html: Function;

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
      await agent
          .get(getMarkdownEndPointFor(padID))
          .set("Authorization", await generateJWTToken())
          .expect(200);
    });

    it('returns Markdown correctly', async function () {
      const res = await agent
          .get(getMarkdownEndPointFor(padID))
          .set("Authorization", await generateJWTToken())
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
