// One lesson, top to bottom: the idea, an example, simulations to play with,
// how it works, a quick check, saying it back, and where to go deeper.
import React, { useEffect, useId, useState } from "react";
import Icon from "../components/Icon";


export default function Lesson({ lesson, record, onDone, where }) {
  const [answers, setAnswers] = useState({});
  const [explained, setExplained] = useState(null);
  const total = lesson.quiz.length;
  const answered = Object.keys(answers).length;
  const firstTry = Object.values(answers).filter(Boolean).length;
  const complete = answered === total && explained !== null;

  useEffect(() => {
    if (complete && !record?.done) onDone({ done: true, score: firstTry, of: total });
  }, [complete, record?.done, onDone, firstTry, total]);

  const answer = (i, rightFirstTime) => setAnswers((a) => (i in a ? a : { ...a, [i]: rightFirstTime }));

  return (
    <article className="lesson">
      <header className="lesson-head">
        <h1>{lesson.title}</h1>
        <p className="lesson-lead">{lesson.lead}</p>
        {where && <p className="lesson-where">{where}</p>}
      </header>

      <section className="step step-idea" id="idea" aria-labelledby="h-idea">
        <h2 id="h-idea">The idea</h2>
        <div className="idea">{lesson.idea}</div>
      </section>

      <section className="step" id="example" aria-labelledby="h-example">
        <h2 id="h-example">For example</h2>
        <div className="prose-col">{lesson.example}</div>
      </section>

      <section className="step" id="play" aria-labelledby="h-play">
        <h2 id="h-play">Try it</h2>
        {lesson.play.map((item, i) => (
          <Play key={i} item={item} />
        ))}
      </section>

      {lesson.how && (
        <section className="step" id="how" aria-labelledby="h-how">
          <h2 id="h-how">How it works</h2>
          <div className="prose-col">{lesson.how}</div>
        </section>
      )}

      <section className="step" id="check" aria-labelledby="h-check">
        <h2 id="h-check">Check yourself</h2>
        <ol className="quiz">
          {lesson.quiz.map((item, i) => (
            <li key={i} className="question">
              <Question item={item} onAnswer={(ok) => answer(i, ok)} />
            </li>
          ))}
        </ol>
      </section>

      <section className="step" id="say" aria-labelledby="h-say">
        <h2 id="h-say">Say it back</h2>
        <Explain explain={lesson.explain} onPick={setExplained} />
      </section>

      <section className="step" id="deeper" aria-labelledby="h-deeper">
        <h2 id="h-deeper">Go deeper</h2>
        <ul className="further">
          {lesson.readMore.map((r) => (
            <li key={r.url}>
              <a href={r.url} target="_blank" rel="noopener noreferrer">
                {r.title} <Icon name="external" />
              </a>
              <span>{r.by}</span>
            </li>
          ))}
        </ul>
      </section>

      {(complete || record?.done) && (
        <p className="lesson-done" role="status">
          <Icon name="ascend" /> Lesson done
          {record?.of ? `, ${record.score} of ${record.of} right first time` : `, ${firstTry} of ${total} right first time`}.
        </p>
      )}
    </article>
  );
}

function Play({ item }) {
  const Sim = item.Sim;
  return (
    <div className="play">
      <p className="try">{item.try}</p>
      <Sim />
    </div>
  );
}

// ---------------------------------------------------------------------------

function Question({ item, onAnswer }) {
  if (item.kind === "choice") return <ChoiceQuestion item={item} onAnswer={onAnswer} />;
  if (item.kind === "multi") return <MultiQuestion item={item} onAnswer={onAnswer} />;
  if (item.kind === "number") return <NumberQuestion item={item} onAnswer={onAnswer} />;
  if (item.kind === "task") return <TaskQuestion item={item} onAnswer={onAnswer} />;
  return null;
}

function ChoiceQuestion({ item, onAnswer }) {
  const [tried, setTried] = useState([]);
  const solved = tried.some((i) => item.options[i].ok);
  const pick = (i) => {
    if (solved || tried.includes(i)) return;
    const next = [...tried, i];
    setTried(next);
    if (item.options[i].ok) onAnswer(next.length === 1);
  };
  const last = tried[tried.length - 1];
  return (
    <>
      <p className="q">{item.q}</p>
      <div className="options" role="group" aria-label={item.q}>
        {item.options.map((o, i) => {
          const state = tried.includes(i) ? (o.ok ? "is-right" : "is-wrong") : solved ? "is-faded" : "";
          return (
            <button key={i} type="button" className={`option ${state}`} onClick={() => pick(i)} aria-pressed={tried.includes(i)} disabled={solved && !tried.includes(i)}>
              <span className="option-mark" aria-hidden="true" />
              {o.t}
            </button>
          );
        })}
      </div>
      {last !== undefined && (
        <p className={`feedback ${item.options[last].ok ? "is-right" : "is-wrong"}`} role="status">
          {item.options[last].ok ? "" : "Not quite. "}
          {item.options[last].why}
          {!item.options[last].ok && " Try another."}
        </p>
      )}
    </>
  );
}

function MultiQuestion({ item, onAnswer }) {
  const [picked, setPicked] = useState([]);
  const [checked, setChecked] = useState(0);
  const [solved, setSolved] = useState(false);
  const toggle = (i) => !solved && setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  const check = () => {
    const ok = item.options.every((o, i) => !!o.ok === picked.includes(i));
    setChecked((c) => c + 1);
    if (ok) {
      setSolved(true);
      onAnswer(checked === 0);
    }
  };
  return (
    <>
      <p className="q">{item.q}</p>
      <div className="options" role="group" aria-label={item.q}>
        {item.options.map((o, i) => {
          const on = picked.includes(i);
          const state = checked ? (on && o.ok ? "is-right" : on && !o.ok ? "is-wrong" : !on && o.ok && solved ? "is-right" : "") : "";
          return (
            <button key={i} type="button" className={`option is-multi ${on ? "is-on" : ""} ${state}`} onClick={() => toggle(i)} aria-pressed={on}>
              <span className="option-mark" aria-hidden="true" />
              {o.t}
              {checked > 0 && (on || solved) && <span className="option-why">{o.why}</span>}
            </button>
          );
        })}
      </div>
      {!solved && (
        <button type="button" className="ctl-btn is-primary" onClick={check} disabled={!picked.length}>
          Check
        </button>
      )}
      {checked > 0 && (
        <p className={`feedback ${solved ? "is-right" : "is-wrong"}`} role="status">
          {solved ? "All right." : "Not all right yet. The notes under your picks say why; change them and check again."}
        </p>
      )}
    </>
  );
}

function NumberQuestion({ item, onAnswer }) {
  const id = useId();
  const [value, setValue] = useState("");
  const [tries, setTries] = useState(0);
  const [solved, setSolved] = useState(false);
  const [shown, setShown] = useState(false);
  const check = (e) => {
    e.preventDefault();
    const n = Number(String(value).replace(/[%\s,]/g, ""));
    if (!Number.isFinite(n) || value === "") return;
    setTries((t) => t + 1);
    if (Math.abs(n - item.answer) <= item.tolerance) {
      setSolved(true);
      onAnswer(tries === 0);
    }
  };
  const giveUp = () => {
    setShown(true);
    if (!solved) {
      setSolved(true);
      onAnswer(false);
    }
  };
  return (
    <>
      <p className="q">
        <label htmlFor={id}>{item.q}</label>
      </p>
      <form className="number-answer" onSubmit={check}>
        <input id={id} inputMode="decimal" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} disabled={solved} placeholder="Your answer" />
        {item.unit && <span className="unit">{item.unit}</span>}
        {!solved && (
          <button type="submit" className="ctl-btn is-primary">
            Check
          </button>
        )}
        {!solved && tries > 0 && (
          <button type="button" className="ctl-btn" onClick={giveUp}>
            Show me
          </button>
        )}
      </form>
      {tries > 0 && !solved && (
        <p className="feedback is-wrong" role="status">
          Not quite. Work it through once more, or ask to see the working.
        </p>
      )}
      {solved && (
        <p className={`feedback ${shown ? "is-shown" : "is-right"}`} role="status">
          {shown ? `The answer is ${item.answer}${item.unit ?? ""}. ` : "Yes. "}
          {item.why}
        </p>
      )}
    </>
  );
}

function TaskQuestion({ item, onAnswer }) {
  const [state, setState] = useState(null);
  const [solved, setSolved] = useState(false);
  const { Sim } = item;
  useEffect(() => {
    if (!solved && state && item.check(state)) {
      setSolved(true);
      onAnswer(true);
    }
  }, [state, solved, item, onAnswer]);
  return (
    <>
      <p className="q">{item.q}</p>
      <div className={`task${solved ? " is-solved" : ""}`}>
        <Sim onState={setState} />
      </div>
      <p className={`feedback ${solved ? "is-right" : "is-waiting"}`} role="status">
        {solved ? `Done. ${item.done}` : "Use the controls above. This checks itself as you go."}
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------

const VERDICT = { right: "Spot on", partly: "Partly right", wrong: "Not quite" };

function Explain({ explain, onPick }) {
  const [picked, setPicked] = useState(null);
  const [all, setAll] = useState(false);
  const pick = (i) => {
    setPicked(i);
    onPick(i);
  };
  return (
    <div className="explain">
      <p className="q">{explain.q}</p>
      <div className="options" role="radiogroup" aria-label={explain.q}>
        {explain.options.map((o, i) => {
          const show = all || picked === i;
          return (
            <button key={i} type="button" role="radio" aria-checked={picked === i} className={`option is-explain ${picked === i ? "is-on" : ""} ${show ? `verdict-${o.verdict}` : ""}`} onClick={() => pick(i)}>
              <span className="option-mark" aria-hidden="true" />
              <span className="option-text">{o.t}</span>
              {show && (
                <span className="option-why">
                  <strong>{VERDICT[o.verdict]}.</strong> {o.why}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {picked !== null && !all && (
        <button type="button" className="link-btn" onClick={() => setAll(true)}>
          See what's right and wrong in the others
        </button>
      )}
    </div>
  );
}
