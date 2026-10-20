# Social kit — copy, images, and how to post them

Everything here is ready to upload by hand. Nothing in this folder is used by the app, so it is not
part of the deployed site; it is launch material.

| Platform | Image | Size (design) | Size (file) | Format |
| --- | --- | --- | --- | --- |
| Instagram | `instagram/01-cover.png` … `10-cta.png` | 1080 × 1350 (4:5) | 2160 × 2700 | PNG, 10 slides |
| LinkedIn | `linkedin/linkedin-card.png` | 1200 × 1200 (1:1) | 2400 × 2400 | PNG, 1 image |
| X / Twitter | `twitter/x-card.png` | 1600 × 900 (16:9) | 3200 × 1800 | PNG, `summary_large_image` |

Every raster is a 2× render of the SVG next to it; the 1× design size is what the platform sees.
Regenerate the whole set with `npm run social && npm run social:png`. Edit wording in
`scripts/build-social.mjs` — one array for Instagram, one object each for LinkedIn and X — never in
the PNGs.

Product facts these captions may claim, and nothing beyond them: 2–8 files, one reference and the
rest as targets; six states; four views (Table is the default); exports are the fix block, a redacted
report and an agent prompt; `connect-src 'none'`; no upload, no account, no storage, no analytics; one
consented `ec-theme` cookie; MIT; 389 tests.

---

## 1. Instagram — 10-slide carousel

**File order matters.** Upload `01` → `10` exactly; the slide number in the top-right corner and the
progress dots are printed into the images, so a shuffled carousel contradicts itself.

| # | File | Reads as |
| --- | --- | --- |
| 1 | `01-cover.png` | The hook: your `.env` is missing something, and nothing tells you. |
| 2 | `02-cause.png` | Why it happens: agents write `.env.example`, you fill `.env` by hand. |
| 3 | `03-drift.png` | The example grows, your file doesn't, and it fails later as a 401. |
| 4 | `04-invisible.png` | Empty and placeholder values both pass a "does this key exist?" check. |
| 5 | `05-diff.png` | A line diff reports noise; a key-aligned table reports the problem. |
| 6 | `06-product.png` | The product itself: one table, every cell named. |
| 7 | `07-states.png` | The six states, each with its plain-language meaning. |
| 8 | `08-files.png` | Two files is the floor; real projects keep more. |
| 9 | `09-fix.png` | The output is the fix, not just the diagnosis. |
| 10 | `10-cta.png` | Privacy, the address, and the ask. |

### Caption

```
Your .env is missing something.

And nothing tells you until the app breaks — usually a 401 in the one place you didn't redeploy.

Here's the part nobody says out loud: AI agents won't touch .env. They're told not to. So they write .env.example, you fill .env in by hand, and the moment the example grows the two files drift apart.

A line diff doesn't save you. Reorder two keys and it reports noise. An empty value and a real one look identical to it.

So I built EnvCompare.

Paste 2–8 env files. Read one table. Copy the block that fills the gaps.

It names six states, not two:
· missing — the key isn't there
· empty — the key is there, the value isn't
· placeholder — still "changeme", still "your-api-key"
· commented — present, but switched off with #
· different — set in both, and they disagree
· set — actually configured, actually working

All of it happens in your tab. No upload, no account, no storage, no analytics. Your .env never becomes a request — which is also why it's okay to open at work.

Free, open source, MIT. Link in bio.

envcompare.vercel.app

#EnvCompare #OpenSource #WebDev #JavaScript #TypeScript #DevOps #DotEnv #Configuration #BuildInPublic #DeveloperTools #Frontend #Privacy #WebDevelopment #SoftwareEngineering #GitHub #Coding #SideProject #DevTools #React #EnvironmentVariables
```

### Alt text — paste one per slide

Instagram carries alt text per image, not per post. Use these verbatim; they are the same strings the
generator holds, so the copy and the artwork cannot drift.

1. Dark card reading “Your .env is missing something.” with a comparison table below showing a key marked Missing, and a note: nothing tells you until the app breaks.
2. Two file cards side by side: .env.example marked “written by the agent” and .env marked “filled in by you”, with the note that agents are told never to touch .env.
3. A timeline: a new key appears in .env.example while .env stays unchanged, and a red line shows the moment the app starts failing.
4. Two code lines that both pass a naive check: an empty value and a placeholder value, each labelled as failing at runtime.
5. Two panels compared: a line diff that shows noise because the same keys sit in a different order, versus a row-aligned variable table where the differences are obvious.
6. The EnvCompare comparison table: rows for five variables against three files — .env, .env.local and .env.staging — with every cell labelled match, missing, empty, copy, differs or extra.
7. Six labelled rows, one per state EnvCompare distinguishes — missing, empty, placeholder, commented, different and set — each with a colour dot and a plain-language meaning.
8. Five file rows — .env.example, .env, .env.local, .env.staging and .env.production — each with the role it plays, and the note that one file is the reference and every target gets its own column.
9. A copy-ready block headed “copy 3 variables for .env”, listing three missing keys with blank values, and the note that no values are in the payload.
10. Closing card: nothing leaves your tab — no upload, no account, no storage, no analytics — with the address envcompare.vercel.app and an invitation to try it.

---

## 2. LinkedIn — one square card, long-form post

Square (1200 × 1200) because LinkedIn crops everything else to roughly 1.91:1 in the feed; a square
stays whole on both mobile and desktop. The card carries the argument, so the post text can carry the
story instead of repeating it.

Image description (alt text):

> Square card: “AI agents won’t touch your .env. So it rots.” Below it, four rows of an env comparison marked Missing, Empty, Placeholder and Match, and the address envcompare.vercel.app.

```
Your .env file is the most-read file in your project that nobody reviews.

It's also the one file an AI agent will not touch. Agents are instructed to leave secrets alone — correctly — so they write .env.example instead, and a human copies the keys across by hand.

That handoff is where the bugs live.

The example gains RESEND_API_KEY on Tuesday. Nobody adds it to .env. Nobody notices, because .env still parses, the app still builds, and the key is only read on the password-reset path that QA doesn't click.

Three weeks later: a 401 in production, an hour of debugging, and the fix is one line that was always going to be one line.

I got tired of that hour, so I built EnvCompare.

Paste 2–8 env files — .env.example plus every environment you actually run — and it aligns them by key instead of by line:

→ missing: the key isn't in the file at all
→ empty: the key is there, the value isn't
→ placeholder: still "changeme", still "your-api-key"
→ commented: present, but switched off with #
→ different: set in both files, and they disagree
→ set: actually configured, actually working

The output is the fix, not just the diagnosis: a copy-ready block with the missing keys in your order, values left blank. Plus a redacted report you can paste into a ticket and an agent prompt that says what to add without ever including a secret.

The design constraint that mattered most: it runs entirely in the browser. No upload, no account, no storage, no analytics — a Content-Security-Policy with connect-src 'none' and a CI check that fails the build if a dependency could phone home. That constraint is why it's usable at work, where "paste your production .env into this website" is a career-limiting move.

Free, open source, MIT.

https://envcompare.vercel.app

#softwareengineering #devops #opensource #webdevelopment #javascript
```

**Link placement.** A link in the post body is the honest choice and it is what this copy does. The
cost is reach: LinkedIn's own guidance and most practitioner tests put external links at a
distribution disadvantage. If reach matters more than a one-click path, move the URL into the first
comment and keep the last line as "Link in the first comment." Do not do both — a duplicated link
reads as an ad.

---

## 3. X / Twitter — one 16:9 card, post plus optional thread

The card is 1600 × 900, which is the `summary_large_image` shape: no crop on mobile, no letterboxing.
X compresses hard, so the card keeps one headline, one table and one address — nothing that needs a
tap to read.

### Main post — 250 characters, 244 as X counts it

```
Your .env is missing a key.

You find out in production, as a 401.

EnvCompare compares 2–8 env files in your browser, names every missing, empty or still-"changeme" variable, then copies the fix.

Nothing uploaded. MIT.
https://envcompare.vercel.app
```

Attach `twitter/x-card.png` and paste this as the image description:

> Wide card: “Your .env is missing something.” with a mini comparison table and the line “Compare 2–8 env files in your browser. Nothing is uploaded.”

### Thread option — 5 posts (247–249 characters each as X counts them)

Use this instead of the single post when you have something to say, not in addition to it: the thread's
first post should replace the main post above, not follow it.

```
1/
Your .env is missing a key.

You find out in production, as a 401.

EnvCompare compares 2–8 env files in your browser, names every missing, empty or still-"changeme" variable, then copies the fix. Nothing uploaded. MIT.

https://envcompare.vercel.app
```

```
2/
Why it happens: agents won't touch .env — they're told not to, and they're right to obey. So they write .env.example.

A human copies keys across by hand.

The example grows on Tuesday. The hand-copy doesn't. Nothing fails until it does.
```

```
3/
A line diff won't catch it.

Reorder two keys and a diff reports noise. "KEY=" and "KEY=sk-live-…" both look like a line with a value.

EnvCompare aligns by key, then classifies each cell instead of comparing text.
```

```
4/
Six states, not two:

missing · empty · placeholder · commented · different · set

"Present" is not a state. A key that's there with no value is a different bug from a key that was never added, and it needs a different fix.
```

```
5/
It runs entirely in your browser: no upload, no account, no storage, no analytics, connect-src 'none', and a CI check that fails if a dependency could phone home.

Your .env never becomes a request.

Free, MIT, no sign-up:
https://envcompare.vercel.app
```

---

## 4. Posting order and timing

Post **X first, then LinkedIn, then Instagram**, on the same day, an hour or two apart. X is the
fastest signal — replies tell you which line landed — and the LinkedIn and Instagram copy can lean on
whatever phrasing gets quoted back at you. Keep the order consistent if you post again; audiences
overlap less than people assume, but the same account posting the same screenshot three times in one
minute looks automated.

Timing is a starting point, not a rule — check your own analytics after the first two posts:

- **X** — weekday mornings in your audience's timezone, 08:00–10:00, or early evening 18:00–21:00.
  Developer accounts also do well on Sunday evening, when people read and don't post.
- **LinkedIn** — Tuesday to Thursday, 08:00–11:00 local. It rewards the first 60–90 minutes, so do not
  post and walk away.
- **Instagram** — weekday 11:00–13:00 or 19:00–21:00. Carousels get saved rather than liked, so the
  first slide is doing the work; the ten-slide depth is what earns the save.

Do not repost the same carousel to all three. LinkedIn gets the square card and the long post; X gets
the wide card and the short post; Instagram gets the ten slides and the caption. Three audiences, three
entry points, one product.

---

## 5. Before you hit post

- [ ] Instagram: slides uploaded `01`→`10`, in order; alt text set on all ten.
- [ ] Instagram: the "link in bio" claim is true — `envcompare.vercel.app` is the bio link.
- [ ] LinkedIn: the URL resolves and is not the `?trk=` tracking variant LinkedIn sometimes appends.
- [ ] X: card attached, count is under 280, image description filled in.
- [ ] Every claim matches the product: 2–8 files, six states, nothing uploaded, MIT.
- [ ] `envcompare.vercel.app` loads in a logged-out browser window before you point anyone at it.
