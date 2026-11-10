# Privacy and visitor statistics

What the site counts, what it never collects, and what it sends anywhere. Back to the [README](../README.md).

## Visitor statistics

Anonymous visit counts go to GoatCounter, at <https://wikin.goatcounter.com>. It sets
no cookies and stores nothing personal, so there's no consent banner; the footer says
it's there.

The script in `index.html` has its automatic count switched off, because GoatCounter
ignores everything after the `#`, and that's where the Learn and planet pages live.
`src/lib/visits.js` counts instead (tested in `visits.test.js`), along with what
people do on each page:

Most things count once per page visit (a slider dragged back and forth is one count),
which keeps the numbers readable and well inside GoatCounter's free allowance.

| Where | What | Shows up in GoatCounter as |
|---|---|---|
| Everywhere | Each page: the home page (any section), Learn, a chapter, a lesson, the planet | `/`, `/learn`, `/learn/vision`, `/learn/vision/convolution`, `/planet` |
| | Time on each page, in bands | `time/learn/vision/convolution/1-3m` |
| | Links out of the site, by site only; email; downloads | `out/github.com/home`, `email/home`, `download/<file>/home` |
| | Light or dark chosen | `theme/dark` |
| | Touch or mouse, reduced motion, the system's light/dark preference | `browsing/touch`, `browsing/reduced-motion`, `browsing/prefers-dark` |
| | Errors visitors hit (first five per visit) | `error/<page>/<message>` |
| Home | Sections scrolled to | `section/projects` |
| | Case studies opened | `case-study/<id>` |
| | The Game of Life tapped | `life/home/tapped` |
| Lessons | How far down people get | `reached/vision/convolution/check` |
| | "The details" opened | `details/vision/convolution` |
| | Walkthrough played, and played to the end | `walkthrough/vision/convolution/played`, `/finished` |
| | A simulation touched, and each control used (with the option picked) | `sim/<lesson>/<sim>`, `control/<lesson>/<sim>/activation/relu` |
| | Each question's first try | `quiz/<lesson>/q2/right` or `/wrong` |
| | A number answer revealed; a task solved | `quiz-answer-shown/<lesson>/…`, `task-solved/<lesson>/…` |
| | "Say it back": first pick, and "see the others" | `say-it-back/<lesson>/right`, `/partly`, `/wrong`, `/see-all` |
| | Lesson finished, and its first-try score | `lesson-done/<lesson>`, `lesson-score/<lesson>/3-of-4` |
| Planet | Orbit or drive, car or drone, graphics level | `planet/mode/drive`, `planet/vehicle/drone`, `planet/graphics/high` |
| | Camera, time of day, drone handling, when changed | `planet/camera/fpv`, `planet/time/night` |
| | Autopilot, help, radio, music, settings, a screenshot, a building opened | `planet/autopilot`, `planet/opened/<id>` |

Nothing typed into the site is sent, nor where on the screen anyone clicks, nor anything
that could tell who someone is or link one visit to the next.

Nothing is counted on `localhost`, so working on the site doesn't skew the numbers
(add `"allow_local": true` to the settings in `index.html` to test counting locally).
Ad and tracker blockers stop the count for some visitors; the totals are a floor.

## Privacy

Opening any page contacts one outside service only: GoatCounter, for the counts
above. Everything else comes from this site:

- The fonts are bundled from npm (`@fontsource-variable/fraunces`,
  `@fontsource-variable/schibsted-grotesk`, `@fontsource/jetbrains-mono`, imported in
  `src/main.jsx`), not loaded from Google Fonts, which would tell Google about every
  visit.
- The portrait on the home page is `public/avatar.png`, a copy of the GitHub avatar
  (replace the file to change it), for the same reason.
- YouTube is contacted only when someone presses play on the planet's radio, and the
  radio panel says so.
- Links to other sites tell them only "susang.com.np", never which page
  (`<meta name="referrer">` in `index.html`; new-tab links also use `noreferrer`).
- What the site stores in the browser (theme, lesson progress, planet settings, the
  radio's "My mix") stays there and is never sent anywhere.
- Error reports in the statistics have links, email addresses and long numbers taken
  out first (`scrubError` in `src/lib/visits.js`).

The CV in `public/` lists only an email, LinkedIn and GitHub; no phone number or
address.
