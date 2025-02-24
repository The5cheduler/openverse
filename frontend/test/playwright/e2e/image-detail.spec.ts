import { test, expect, Page } from "@playwright/test"

import { mockProviderApis } from "~~/test/playwright/utils/route"
import { preparePageForTests, t } from "~~/test/playwright/utils/navigation"
import {
  collectAnalyticsEvents,
  expectEventPayloadToMatch,
} from "~~/test/playwright/utils/analytics"

const goToCustomImagePage = async (page: Page) => {
  // Test in a custom image detail page, it should apply the same for any image.
  await page.goto("image/e9d97a98-621b-4ec2-bf70-f47a74380452")
}

/* eslint playwright/expect-expect: ["warn", { "additionalAssertFunctionNames": ["showsErrorPage"] }] */
const showsErrorPage = async (page: Page) => {
  await expect(page.locator("h1")).toHaveText(
    /The content you’re looking for seems to have disappeared/
  )
}

test.describe.configure({ mode: "parallel" })

test.beforeEach(async ({ context }) => {
  await mockProviderApis(context)
})

test("shows the author and title of the image", async ({ page }) => {
  await preparePageForTests(page, "xl", {
    features: { additional_search_views: "off" },
  })
  await goToCustomImagePage(page)
  const author = page.locator('a[aria-label^="author"]')
  await expect(author).toBeVisible()
  const imgTitle = page.locator("h1")
  await expect(imgTitle).toBeVisible()
})

test("shows the main image with its title as alt text", async ({ page }) => {
  await goToCustomImagePage(page)
  const imgTitle = await page.locator("h1").innerText()
  const img = page.locator("id=main-image")
  await expect(img).toBeVisible()
  await expect(img).toHaveAttribute("alt", imgTitle)
})

test("does not show back to search results breadcrumb", async ({ page }) => {
  await goToCustomImagePage(page)
  await expect(page.locator(`text="${t("singleResult.back")}"`)).toBeHidden({
    timeout: 300,
  })
})

test("redirects from old /photos/:id route to /image/:id", async ({ page }) => {
  const uuid = "e9d97a98-621b-4ec2-bf70-f47a74380452"
  await page.goto("photos/" + uuid)
  await expect(page).toHaveURL("image/" + uuid)
})

test("shows the 404 error page when no valid id", async ({ page }) => {
  await page.goto("image/foo")
  await showsErrorPage(page)
})

test("shows the 404 error page when no id", async ({ page }) => {
  await page.goto("image/")
  await showsErrorPage(page)
})

test.describe("analytics", () => {
  test.beforeEach(async ({ page }) => {
    await preparePageForTests(page, "xl", { features: { analytics: "on" } })
  })
  test("sends GET_MEDIA event on CTA button click", async ({
    context,
    page,
  }) => {
    const analyticsEvents = collectAnalyticsEvents(context)

    await goToCustomImagePage(page)

    await page.getByRole("link", { name: /get this image/i }).click()

    const getMediaEvent = analyticsEvents.find(
      (event) => event.n === "GET_MEDIA"
    )

    expectEventPayloadToMatch(getMediaEvent, {
      id: "e9d97a98-621b-4ec2-bf70-f47a74380452",
      provider: "flickr",
      mediaType: "image",
    })
  })

  test("sends RIGHT_CLICK_IMAGE event on right-click", async ({
    context,
    page,
  }) => {
    const analyticsEvents = collectAnalyticsEvents(context)

    await goToCustomImagePage(page)

    const img = page.getByRole("img").first()
    await img.click({ button: "right" })

    const rightClickImageEvent = analyticsEvents.find(
      (event) => event.n === "RIGHT_CLICK_IMAGE"
    )

    expectEventPayloadToMatch(rightClickImageEvent, {
      id: "e9d97a98-621b-4ec2-bf70-f47a74380452",
    })
  })
})
