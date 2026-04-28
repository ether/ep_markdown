import {expect, test} from '@playwright/test';
import {clearPadContent, getPadBody, goToNewPad, selectAllText, writeToPad}
    from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';

test.beforeEach(async ({page}) => {
  await goToNewPad(page);
});

test.describe('ep_markdown', () => {
  test('Bold section renders the markdown class on body when "Show Markdown" is enabled',
      async ({page}) => {
        const padBody = await getPadBody(page);
        await padBody.click();
        await clearPadContent(page);
        await writeToPad(page, 'bold');
        await selectAllText(page);

        // Apply bold via the toolbar button. force:true because under
        // Firefox + WITH_PLUGINS load #toolbar-overlay can intercept
        // pointer events; chromium resolves the click via fallback
        // hit-testing but firefox is stricter.
        await page.locator('.buttonicon-bold').click({force: true});
        // Wait for the bold to actually apply before flipping the
        // markdown setting — otherwise the markdown class could land
        // before there's anything bold to render.
        await expect(padBody.locator('div').first().locator('b')).toHaveCount(1);

        // Toggle "Show Markdown" in pad settings.
        // Settings popup must be open for #options-markdown to be clickable.
        await page.locator('.buttonicon-settings').click();
        await page.locator('#options-markdown').click({force: true});

        // The pad body should gain the `markdown` class so its CSS swaps
        // <b> for visible **bold** rendering.
        await expect(padBody).toHaveClass(/markdown/);

        // The original text content is unchanged (the rendering is purely
        // CSS-driven; the underlying text remains "bold" without the
        // surrounding asterisks in the document model).
        await expect(padBody.locator('div').first()).toHaveText('bold');
      });
});
