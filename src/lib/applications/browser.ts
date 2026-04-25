import { ApplicationProfile, CvLibraryEntry, EnrichedJob } from "@/types";

export interface BrowserApplyResult {
  status: "applied" | "paused" | "failed";
  blocker?: "login" | "captcha" | "unknown-question" | "missing-profile" | "upload" | "unsupported-flow" | "runtime-error";
  detail?: string;
  evidence?: string;
}

export async function attemptBrowserApplication(input: {
  job: EnrichedJob;
  profile: ApplicationProfile;
  cv: CvLibraryEntry;
  cvPath: string;
}): Promise<BrowserApplyResult> {
  if (!input.job.raw.link) {
    return {
      status: "paused",
      blocker: "unsupported-flow",
      detail: "Job has no apply URL.",
    };
  }

  if ((process.env.AUTO_APPLY_BROWSER || "").toLowerCase() !== "true") {
    return {
      status: "paused",
      blocker: "unsupported-flow",
      detail:
        "Visible browser automation is installed but disabled. Set AUTO_APPLY_BROWSER=true to run it locally.",
    };
  }

  try {
    const { chromium } = await import("playwright");
    const browserProfile =
      process.env.AUTO_APPLY_BROWSER_PROFILE || "data/playwright-auto-apply";
    const context = await chromium.launchPersistentContext(browserProfile, {
      headless: false,
      viewport: { width: 1366, height: 900 },
    });
    let page = context.pages()[0] || (await context.newPage());
    await page.goto(input.job.raw.link, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await page.bringToFront();
    page = await openApplicationForm(page);

    const blocker = await detectBlocker(page);
    if (blocker) {
      return blocker;
    }

    if (!hasMinimumProfile(input.profile)) {
      return {
        status: "paused",
        blocker: "missing-profile",
        detail:
          "Application profile is missing required contact/right-to-work fields. The job page is open so you can inspect it while updating the profile.",
        evidence: page.url(),
      };
    }

    await fillKnownFields(page, input.profile);
    const uploadResult = await uploadCv(page, input.cvPath);
    if (!uploadResult.ok) {
      return {
        status: "paused",
        blocker: "upload",
        detail: uploadResult.detail,
        evidence: page.url(),
      };
    }

    const unknownRequired = await page.locator("input:required, textarea:required, select:required").evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          const element = node as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
          if (element.disabled) return false;
          if (element instanceof HTMLInputElement && ["hidden", "file", "submit", "button"].includes(element.type)) return false;
          return !element.value;
        })
        .map((node) => {
          const element = node as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
          return element.name || element.id || element.getAttribute("aria-label") || "required field";
        })
    );

    if (unknownRequired.length > 0) {
      return {
        status: "paused",
        blocker: "unknown-question",
        detail: `Required fields need review: ${unknownRequired.slice(0, 5).join(", ")}`,
        evidence: page.url(),
      };
    }

    if ((process.env.AUTO_APPLY_SUBMIT || "").toLowerCase() !== "true") {
      return {
        status: "paused",
        blocker: "unsupported-flow",
        detail:
          "Application form was opened and known fields were filled. Submission is disabled until AUTO_APPLY_SUBMIT=true.",
        evidence: page.url(),
      };
    }

    const submit = page
      .getByRole("button", { name: /submit|apply|send application|complete/i })
      .first();
    if ((await submit.count()) === 0) {
      return {
        status: "paused",
        blocker: "unsupported-flow",
        detail: "Could not find a clear submit/apply button.",
        evidence: page.url(),
      };
    }

    await submit.click({ timeout: 10_000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
    const afterText = (await page.locator("body").innerText({ timeout: 10_000 })).toLowerCase();
    await context.close();

    if (/thank you|application received|successfully submitted|we have received/i.test(afterText)) {
      return { status: "applied", evidence: input.job.raw.link };
    }

    return {
      status: "paused",
      blocker: "unknown-question",
      detail: "Submit was clicked, but success confirmation was not detected.",
      evidence: input.job.raw.link,
    };
  } catch (err) {
    return {
      status: "failed",
      blocker: "runtime-error",
      detail: err instanceof Error ? err.message : "Browser application failed",
    };
  }
}

function hasMinimumProfile(profile: ApplicationProfile): boolean {
  return Boolean(
    profile.fullName &&
      profile.email &&
      profile.city &&
      profile.country &&
      profile.rightToWork &&
      profile.sponsorship
  );
}

async function detectBlocker(page: {
  url(): string;
  locator(selector: string): {
    innerText(options?: { timeout?: number }): Promise<string>;
  };
}): Promise<BrowserApplyResult | null> {
  const url = page.url().toLowerCase();
  const body = (await page.locator("body").innerText({ timeout: 10_000 })).toLowerCase();
  if (/captcha|hcaptcha|recaptcha|turnstile|verify you are human|security check/i.test(`${url} ${body}`)) {
    return {
      status: "paused",
      blocker: "captcha",
      detail: "CAPTCHA or bot check detected. Complete it manually in the visible browser, then retry.",
      evidence: page.url(),
    };
  }
  if (/sign in|log in|login|authentication|required to continue/i.test(`${url} ${body}`)) {
    return {
      status: "paused",
      blocker: "login",
      detail: "Login wall detected. Log in manually in the visible browser, then retry.",
      evidence: page.url(),
    };
  }
  return null;
}

async function fillKnownFields(page: any, profile: ApplicationProfile) {
  const fields: Array<[RegExp, string]> = [
    [/full.?name|name/i, profile.fullName],
    [/email/i, profile.email],
    [/phone|mobile/i, profile.phone],
    [/address/i, profile.address],
    [/city/i, profile.city],
    [/country/i, profile.country],
    [/linkedin/i, profile.linkedinUrl],
    [/right.?to.?work|work.?authorization/i, profile.rightToWork],
    [/sponsor/i, profile.sponsorship],
    [/notice/i, profile.noticePeriod],
    [/salary/i, profile.salaryExpectation],
  ];

  const inputs = await page.locator("input, textarea").elementHandles();
  for (const input of inputs) {
    const metadata = [
      await input.getAttribute("name"),
      await input.getAttribute("id"),
      await input.getAttribute("placeholder"),
      await input.getAttribute("aria-label"),
    ]
      .filter(Boolean)
      .join(" ");
    const match = fields.find(([pattern, value]) => value && pattern.test(metadata));
    if (match) {
      await input.fill(match[1]).catch(() => undefined);
    }
  }
}

async function openApplicationForm(page: any): Promise<any> {
  const beforePages = page.context().pages();
  const applyTarget = page
    .getByRole("link", { name: /apply|start application|apply now|apply for this job|easy apply/i })
    .or(page.getByRole("button", { name: /apply|start application|apply now|apply for this job|easy apply|continue/i }))
    .first();

  if ((await applyTarget.count().catch(() => 0)) === 0) {
    return page;
  }

  await Promise.all([
    page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined),
    applyTarget.click({ timeout: 10_000 }).catch(() => undefined),
  ]);

  const afterPages = page.context().pages();
  const opened = afterPages.find((candidate: any) => !beforePages.includes(candidate));
  if (opened) {
    await opened.bringToFront();
    return opened;
  } else {
    await page.bringToFront();
    return page;
  }
}

async function uploadCv(page: any, cvPath: string): Promise<{ ok: boolean; detail?: string }> {
  const fileInputs = await page.locator("input[type='file']").elementHandles();
  if (fileInputs.length === 0) {
    return { ok: true, detail: "No upload field detected." };
  }
  try {
    await fileInputs[0].setInputFiles(cvPath);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : "CV upload failed",
    };
  }
}
