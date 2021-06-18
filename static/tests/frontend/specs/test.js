'use strict';

describe('Set formatting attributes and ensure ep_markdown displays properly', function () {
  // create a new pad before each test run
  beforeEach(async function () {
    this.timeout(60000);
    await helper.aNewPad();
  });

  it('Bold section is shown as **foo** when clicking Show Markdown', async function () {
    this.timeout(60000);
    const chrome$ = helper.padChrome$;
    const inner$ = helper.padInner$;

    const $editorContents = inner$('div');

    // clear pad
    $editorContents.sendkeys('{selectall}');
    inner$('div').first().sendkeys('bold');
    inner$('div').first().sendkeys('{selectall}');
    chrome$('.buttonicon-bold').click();
    chrome$('#options-markdown').click();

    await helper.waitForPromise(() => (inner$('div').first()[0].textContent === 'bold'));

    const hasMarkdown = inner$('body').hasClass('markdown');
    // TODO: Use a psuedo selector to ensure the value displayed to user is **bold**
    expect(hasMarkdown).to.be(true);
  });
});
