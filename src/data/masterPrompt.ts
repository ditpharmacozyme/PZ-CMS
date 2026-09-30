/**
 * The AI prompt that generates a Calendar CSV matching exactly what
 * parseCalendarCsv/convertCsvRowsToPosts (src/utils/researchParse.ts) accept.
 * Keep these three in sync if the import format ever changes.
 */
export const MASTER_PROMPT = `You are generating a content calendar as a CSV file for direct import into
the Pharmacozyme Brand-Ops Studio CMS. Follow this format exactly — the
importer rejects the file if the header row doesn't match precisely.

OUTPUT FORMAT: plain CSV, comma-delimited, UTF-8, one header row followed by
one row per post. Output ONLY the CSV — no markdown fences, no commentary.

HEADER ROW (exact spelling, exact 8 columns, this exact set — no more, no
fewer):
date,brand,platform,content_type,title,description,status,owner

COLUMN RULES:
- date: YYYY-MM-DD (e.g. 2026-10-03). Every post needs a real date.
- brand: exactly one of — Pharmacozyme, PZ Academy, MED-Q, PillZ,
  PrescriptionZ. (No "Shared" / "All" — pick the one real brand this post
  is for.)
- platform: exactly one of — instagram, linkedin, twitter, web, email
- content_type: exactly one of — feed-post, story, reel, carousel,
  newsletter, bio-report
- title: short working title for the post (plain text)
- description: the full caption / copy for the post. If it contains a
  comma, line break, or quotation mark, wrap the whole field in double
  quotes and escape internal quotes as "" (standard CSV quoting).
- status: always not-started (this is a new plan, nothing has been made yet)
- owner: the team member's name if I give you one, otherwise leave blank

RULES:
- Every value must be lowercase exactly as listed above for platform,
  content_type, and status (not "Instagram" or "Feed Post").
- One row per individual post — don't group multiple posts in one row.
- Don't invent extra columns (no "hashtags", "notes", "image" columns etc.)
  — anything beyond caption/copy goes in \`description\` or gets dropped.
- If I don't specify a date for a post, space posts out sensibly across the
  time window I gave you rather than leaving date blank.

Now here's what I want the calendar to cover:
[DESCRIBE: brand(s), date range, platforms, posting cadence, campaign
themes/topics, any specific post ideas, tone/voice notes, number of posts]
`;

export const MASTER_PROMPT_STEPS: string[] = [
  'Copy the prompt below.',
  'Paste it into your AI chat of choice (ChatGPT, Claude, etc.) and replace the [DESCRIBE: ...] line at the bottom with what you want the calendar to cover.',
  'The AI replies with a CSV. Save that reply as a .csv file (most chat apps let you download code blocks directly).',
  'Click "Import CSV" here and select that file. Every row becomes an editable draft post on the calendar.',
];
