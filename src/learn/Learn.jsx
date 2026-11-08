// The lessons: a library of chapters, each chapter's contents, and the lessons
// themselves. Opened from the Learn section of the landing page; downloads
// only when someone comes here.
import React, { useCallback, useEffect, useRef, useState } from "react";
import Icon from "../components/Icon";
import ThemeToggle from "../components/site/ThemeToggle";
import { profile } from "../content/profile";
import { pageTitle } from "../lib/sections";
import { CHAPTERS } from "./chapters";
import Cover from "./Covers";
import Lesson from "./Lesson";
import { STEPS } from "./steps";
import { lessonKey, useProgress } from "./progress";
import { learnHash, neighbours, resolve } from "./route";
import "./learn.css";

/** Dark by default here, unless the visitor has picked a theme themselves. */
function useDarkByDefault() {
  useEffect(() => {
    const root = document.documentElement;
    let saved = null;
    try {
      saved = localStorage.getItem("theme");
    } catch {
      // No storage: treat as no choice.
    }
    if (saved || root.dataset.theme) return;
    root.dataset.theme = "dark";
    return () => {
      let now = null;
      try {
        now = localStorage.getItem("theme");
      } catch {
        // As above.
      }
      if (!now) delete root.dataset.theme;
    };
  }, []);
}

export default function Learn({ hash }) {
  useDarkByDefault();
  const { chapter, lesson } = resolve(CHAPTERS, hash);
  const [progress, mark] = useProgress();

  useEffect(() => {
    document.title = pageTitle(profile.name, lesson ? `${lesson.title} · Learn` : chapter ? `${chapter.title} · Learn` : "Learn");
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [chapter, lesson]);

  return (
    <div className="learn">
      <header className="learn-bar">
        <div className="learn-bar-inner">
          <nav className="crumbs" aria-label="You are here">
            {/* Home goes back to the landing page, at the Learn section you came from. */}
            <a href="#learn">Home</a>
            <span aria-hidden="true">/</span>
            <a href={learnHash()} aria-current={!chapter ? "page" : undefined}>
              Learn
            </a>
            {chapter && (
              <>
                <span aria-hidden="true">/</span>
                <a href={learnHash(chapter.id)} aria-current={chapter && !lesson ? "page" : undefined}>
                  {chapter.title}
                </a>
              </>
            )}
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <main className="learn-main">
        {lesson ? (
          <LessonPage chapter={chapter} lesson={lesson} progress={progress} mark={mark} />
        ) : chapter ? (
          <ChapterPage chapter={chapter} progress={progress} />
        ) : (
          <Library progress={progress} />
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------

const doneIn = (chapter, progress) => chapter.lessons.filter((l) => progress[lessonKey(chapter, l)]?.done).length;

/** Where to pick up: the first lesson not yet done. */
const nextUp = (chapter, progress) => chapter.lessons.find((l) => !progress[lessonKey(chapter, l)]?.done) ?? chapter.lessons[0];

function Library({ progress }) {
  return (
    <div className="library">
      <header className="library-head">
        <h1>Learn machine learning by playing with it</h1>
        <p>
          Short lessons, each built around one idea. You get the idea in plain words and a real example, then a simulation you can poke at until
          it makes sense. A few questions check you've got it, and the last step asks you to pick the explanation you'd give a friend. New chapters
          are added as they're written.
        </p>
      </header>
      <ol className="chapters">
        {CHAPTERS.map((c, i) => {
          const done = doneIn(c, progress);
          const next = nextUp(c, progress);
          return (
            <li key={c.id} className="chapter-row">
              <a className="chapter-cover" href={learnHash(c.id)} aria-label={c.title}>
                <Cover kind={c.cover} />
              </a>
              <div className="chapter-text">
                <h2>
                  <a href={learnHash(c.id)}>{c.title}</a>
                </h2>
                <p>{c.blurb}</p>
                <p className="chapter-meta">
                  Chapter {i + 1} · {c.lessons.length} lessons{done ? ` · ${done} done` : ""}
                </p>
                <a className="btn btn-primary" href={learnHash(c.id, next.id)}>
                  {done ? "Continue" : "Start"}: {next.title} <Icon name="arrowRight" />
                </a>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ChapterPage({ chapter, progress }) {
  const next = nextUp(chapter, progress);
  const done = doneIn(chapter, progress);
  return (
    <div className="chapter-page">
      <div className="chapter-hero">
        <div className="chapter-cover is-large">
          <Cover kind={chapter.cover} />
        </div>
        <div>
          <h1>{chapter.title}</h1>
          <p className="chapter-blurb">{chapter.blurb}</p>
          <p className="chapter-meta">
            Chapter {CHAPTERS.indexOf(chapter) + 1} · {chapter.lessons.length} lessons{done ? ` · ${done} done` : ""}
          </p>
          <a className="btn btn-primary" href={learnHash(chapter.id, next.id)}>
            {done ? "Continue" : "Start"} <Icon name="arrowRight" />
          </a>
        </div>
      </div>
      <ol className="lesson-list">
        {chapter.lessons.map((l, i) => {
          const rec = progress[lessonKey(chapter, l)];
          return (
            <li key={l.id} className={rec?.done ? "is-done" : undefined}>
              <a href={learnHash(chapter.id, l.id)}>
                <span className="lesson-n" aria-hidden="true">
                  {rec?.done ? <Icon name="ascend" /> : i + 1}
                </span>
                <span>
                  <strong>{l.title}</strong>
                  <span className="lesson-list-lead">{l.lead}</span>
                </span>
                {rec?.done && <span className="sr-only">(done)</span>}
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Which step of the lesson is on screen, for the rail. */
function useStepInView(lessonId) {
  const [current, setCurrent] = useState("idea");
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.35;
      let found = "idea";
      for (const s of STEPS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= line) found = s.id;
      }
      setCurrent(found);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [lessonId]);
  return current;
}

function LessonPage({ chapter, lesson, progress, mark }) {
  const key = lessonKey(chapter, lesson);
  const { prev, next } = neighbours(CHAPTERS, chapter, lesson);
  const step = useStepInView(key);
  const onDone = useCallback((patch) => mark(key, patch), [mark, key]);
  const index = chapter.lessons.indexOf(lesson);
  const steps = STEPS.filter((s) => s.id !== "how" || lesson.how);
  // On narrow screens the lessons are a row of chips: bring this lesson's chip into view.
  const chips = useRef(null);
  useEffect(() => {
    const row = chips.current;
    const here = row?.querySelector(".is-here");
    if (row && here && row.scrollWidth > row.clientWidth) row.scrollLeft = here.offsetLeft - 16;
  }, [key]);
  const goTo = (e, id) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  return (
    <div className="lesson-layout">
      <aside className="rail" aria-label={`${chapter.title}: lessons`}>
        <p className="rail-chapter">
          <a href={learnHash(chapter.id)}>{chapter.title}</a>
        </p>
        <ol className="rail-lessons" ref={chips}>
          {chapter.lessons.map((l) => {
            const here = l.id === lesson.id;
            const done = progress[lessonKey(chapter, l)]?.done;
            return (
              <li key={l.id} className={`${here ? "is-here" : ""}${done ? " is-done" : ""}`}>
                <a href={learnHash(chapter.id, l.id)} aria-current={here ? "page" : undefined}>
                  <span className="rail-dot" aria-hidden="true" />
                  {l.title}
                  {done && <span className="sr-only"> (done)</span>}
                </a>
                {here && (
                  <ol className="rail-steps">
                    {steps.map((s) => (
                      <li key={s.id}>
                        <a href={`#${s.id}`} onClick={(e) => goTo(e, s.id)} className={step === s.id ? "is-current" : undefined}>
                          {s.label}
                        </a>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ol>
      </aside>

      <div className="lesson-col">
        <Lesson key={key} lesson={lesson} record={progress[key]} onDone={onDone} where={`Lesson ${index + 1} of ${chapter.lessons.length} in ${chapter.title}`} />
        <nav className="pager" aria-label="Next and previous lessons">
          {prev ? (
            <a className="pager-prev" href={learnHash(prev.chapter.id, prev.lesson.id)}>
              <span>
                <Icon name="arrowLeft" /> Previous
              </span>
              <strong>{prev.lesson.title}</strong>
            </a>
          ) : (
            <span />
          )}
          {next ? (
            <a className="pager-next" href={learnHash(next.chapter.id, next.lesson.id)}>
              <span>
                Next {next.chapter.id !== chapter.id ? `chapter: ${next.chapter.title}` : ""} <Icon name="arrowRight" />
              </span>
              <strong>{next.lesson.title}</strong>
            </a>
          ) : (
            <a className="pager-next" href={learnHash()}>
              <span>
                That's everything for now <Icon name="arrowRight" />
              </span>
              <strong>Back to all chapters</strong>
            </a>
          )}
        </nav>
      </div>
    </div>
  );
}
