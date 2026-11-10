// Simulations for the language and LLMs chapter: embeddings, tokens,
// attention, generating text, making things up, retrieval and fine-tuning.
// The numbers are small, hand-built stand-ins for what real models learn,
// chosen to behave the way the real ones do (and labelled as such).
import React, { useMemo, useState } from "react";
import { cosine, range, rng } from "../math";
import { nextTokenProbs, retrieve, sample, tokenize } from "../mlmath";
import { Axes, Button, Canvas, Choice, Readout, Sim, Slider, Toggle } from "../kit";
import { fix, frame, linePath, pct, useReport } from "../plot";

const W = 640;
const H = 320;

// ---------------------------------------------------------------------------
// Words as places

/** A tiny two-dimensional "embedding": x roughly royalty/power, y roughly female–male, plus other clusters. */
const WORDS = {
  king: [0.82, 0.78],
  queen: [0.8, 0.22],
  man: [0.3, 0.8],
  woman: [0.28, 0.24],
  prince: [0.7, 0.86],
  princess: [0.68, 0.3],
  momo: [0.12, -0.6],
  dal: [0.2, -0.72],
  rice: [0.28, -0.58],
  pizza: [0.04, -0.78],
  bus: [-0.7, 0.05],
  taxi: [-0.82, 0.18],
  bike: [-0.62, -0.12],
  train: [-0.9, -0.05],
};
/** Where each word's name sits, so close neighbours don't overlap: right of the dot unless listed. */
const LABEL_AT = { prince: "above", princess: "above", momo: "left", pizza: "left", train: "left" };
const labelAt = (w, x, y) =>
  ({
    above: { x, y: y - 10, textAnchor: "middle" },
    left: { x: x - 9, y: y + 4, textAnchor: "end" },
  })[LABEL_AT[w]] || { x: x + 9, y: y + 4, textAnchor: "start" };

export function EmbedSim({ onState }) {
  const [word, setWord] = useState("queen");
  const [analogy, setAnalogy] = useState(false);
  const target = analogy ? WORDS.king.map((v, i) => v - WORDS.man[i] + WORDS.woman[i]) : WORDS[word];
  const ranked = Object.entries(WORDS)
    .filter(([w]) => (analogy ? !["king", "man", "woman"].includes(w) : w !== word))
    .map(([w, v]) => ({ w, d: Math.hypot(v[0] - target[0], v[1] - target[1]), cos: cosine(v, target) }))
    .sort((a, b) => a.d - b.d);
  useReport(onState, { word, analogy, top: ranked[0].w });
  const X = frame([-1.05, 1.05], [40, W - 20]);
  const Y = frame([-0.95, 1.05], [H - 30, 16]);
  return (
    <Sim
      label="Find a word's nearest neighbours on a map of meanings"
      controls={
        <>
          <Choice
            label="Word"
            options={[["queen", "queen"], ["momo", "momo"], ["bus", "bus"], ["prince", "prince"]]}
            value={word}
            onChange={(v) => {
              setWord(v);
              setAnalogy(false);
            }}
          />
          <Toggle label="king − man + woman" checked={analogy} onChange={setAnalogy} />
        </>
      }
      readouts={
        <>
          <Readout label={analogy ? "Lands nearest" : "Nearest word"} value={ranked[0].w} tone="accent" />
          <Readout label="Next nearest" value={ranked[1].w} />
          <Readout label="Furthest" value={ranked.at(-1).w} />
        </>
      }
    >
      <Canvas width={W} height={H}>
        {analogy && (
          <>
            <path className="line-b" d={linePath([WORDS.king, WORDS.man], X.f, Y.f)} />
            <path className="line-a thick" d={linePath([WORDS.woman, target], X.f, Y.f)} />
          </>
        )}
        {!analogy && ranked.slice(0, 2).map((r) => <path key={r.w} className="line-a" d={linePath([WORDS[word], WORDS[r.w]], X.f, Y.f)} />)}
        {Object.entries(WORDS).map(([w, [x, y]]) => (
          <g key={w}>
            <circle className={w === word && !analogy ? "dot-b" : "dot-a"} cx={X.f(x)} cy={Y.f(y)} r="6" />
            <text className="label" {...labelAt(w, X.f(x), Y.f(y))}>
              {w}
            </text>
          </g>
        ))}
        {analogy && <circle className="dot-b" cx={X.f(target[0])} cy={Y.f(target[1])} r="9" opacity="0.6" />}
      </Canvas>
      <p className="sim-legend">A hand-made two-dimensional map for illustration; real embeddings have hundreds of dimensions, learned from text, but behave the same way.</p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Tokens, not words

const VOCAB = new Set(
  [
    "the", " the", " a", " an", " is", " are", " was", " of", " to", " in", " and", " it", " on", " for", " with", " you", " i", "i", " my", " can",
    " what", "what", " how", "how", " this", " that", " be", " not", " do", " cat", " dog", " sat", " mat", " good", " morning", " machine",
    " learning", " model", " models", " language", " large", " token", " tokens", " word", " words", " count", " cost", " money", " nepal",
    " kathmandu", " hello", "hello", " world", " today", " un", "believ", "able", " believ", "ing", "ed", "ly", "er", "est", "s", " super",
    "cal", "ifr", "ag", "il", "ist", "ic", "exp", "ial", "id", "ocious", " name", " ga", "un", "ra", " mero", " ho", " tap", "ai", "lai",
    " sanchai", " cha", "?", ".", ",", "!", " 2026", " 20", "26",
  ].map((s) => s.toLowerCase())
);

export function TokenSim({ onState }) {
  const [text, setText] = useState("Hello world, machine learning is unbelievable!");
  const tokens = useMemo(() => tokenize(text, VOCAB), [text]);
  const nWords = (text.match(/\S+/g) ?? []).length;
  useReport(onState, { tokens: tokens.length, words: nWords });
  return (
    <Sim
      label="See how a model breaks your text into tokens"
      controls={
        <>
          <Choice
            label="Try"
            options={[
              ["Hello world, machine learning is unbelievable!", "English"],
              ["Supercalifragilisticexpialidocious", "A long word"],
              ["Tapai lai sanchai cha?", "Nepali in Latin letters"],
              ["In 2026 a token costs money.", "Numbers"],
            ]}
            value={text}
            onChange={setText}
          />
        </>
      }
      readouts={
        <>
          <Readout label="Words" value={nWords} />
          <Readout label="Tokens" value={tokens.length} tone="accent" />
          <Readout label="Tokens per word" value={fix(tokens.length / Math.max(1, nWords), 1)} />
        </>
      }
    >
      <div className="token-box">
        <textarea className="token-input" value={text} onChange={(e) => setText(e.target.value)} rows={2} aria-label="Text to split into tokens" spellCheck={false} />
        <p className="token-row" aria-label="Tokens">
          {tokens.map((t, i) => (
            <span key={i} className={`token token-${i % 4}`}>
              {t.replace(/ /g, "·")}
            </span>
          ))}
        </p>
      </div>
      <p className="sim-legend">A toy vocabulary of a hundred pieces, split greedily like a real tokenizer (· marks a space). Real vocabularies have 50,000–200,000 pieces, mostly learned from English.</p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Who is "it"?

const SENTENCE = ["The", "animal", "didn't", "cross", "the", "street", "because", "it", "was", "too"];

export function AttentionSim({ onState }) {
  const [end, setEnd] = useState("tired");
  const [focus, setFocus] = useState(7);
  // Hand-set attention for "it" (index 7); other words attend mostly to their neighbours.
  const weights = useMemo(() => {
    const words = [...SENTENCE, end];
    const raw = words.map((_, j) => {
      if (focus === 7) {
        if (j === 1) return end === "tired" ? 3.2 : 0.6;
        if (j === 5) return end === "wide" ? 3.2 : 0.7;
        if (j === 10) return 1.4;
        return j === 7 ? 0.8 : 0;
      }
      return j === focus ? 1.6 : Math.max(0, 1.2 - Math.abs(j - focus) * 0.5);
    });
    const e = raw.map((v) => Math.exp(v));
    const s = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / s);
  }, [end, focus]);
  const words = [...SENTENCE, end];
  const top = words[weights.indexOf(Math.max(...weights.filter((_, j) => j !== focus)))];
  useReport(onState, { end, focus, top });
  return (
    <Sim
      label="See which words 'it' pays attention to"
      controls={
        <>
          <Choice label="The sentence ends" options={[["tired", "…too tired"], ["wide", "…too wide"]]} value={end} onChange={setEnd} />
        </>
      }
      readouts={<Readout label={`"${words[focus]}" attends most to`} value={top} tone="accent" />}
    >
      <div className="attn-row" role="group" aria-label={`Attention from "${words[focus]}". Tap a word to look from it.`}>
        {words.map((w, j) => (
          <button
            key={j}
            type="button"
            className={`attn-word${j === focus ? " is-focus" : ""}`}
            style={{ "--w": j === focus ? 0 : weights[j] }}
            aria-pressed={j === focus}
            onClick={() => setFocus(j)}
          >
            {w}
            <small>{j === focus ? "looking" : pct(weights[j])}</small>
          </button>
        ))}
      </div>
      <p className="sim-legend">Tap any word to see what it pays attention to. Illustrative weights. Change the last word and "it" shifts from the animal to the street: the model works out what "it" means from the whole sentence.</p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// One word at a time

const NEXT = [
  { w: " Kathmandu", s: 4.2 },
  { w: " a", s: 2.4 },
  { w: " home", s: 1.6 },
  { w: " beautiful", s: 1.3 },
  { w: " Pokhara", s: 0.9 },
  { w: " not", s: 0.4 },
];

export function NextTokenSim({ onState }) {
  const [temp, setTemp] = useState(1);
  const [seed, setSeed] = useState(1);
  const [draws, setDraws] = useState([]);
  const probs = nextTokenProbs(NEXT.map((n) => n.s), temp);
  useReport(onState, { temp, top: probs[0], draws: draws.length, distinct: new Set(draws).size });
  const drawTen = () => {
    const rand = rng(seed * 97 + Math.round(temp * 100));
    setSeed((s) => s + 1);
    setDraws(range(10).map(() => NEXT[sample(probs, rand)].w.trim()));
  };
  const X = frame([0, NEXT.length], [60, W - 20]);
  const Y = frame([0, 1], [H - 50, 16]);
  return (
    <Sim
      label="Choose the next word, with a temperature dial"
      controls={
        <>
          <Slider label="Temperature" value={temp} min={0} max={2} step={0.05} onChange={(v) => { setTemp(v); setDraws([]); }} format={(v) => (v === 0 ? "0 (always the top)" : v.toFixed(2))} />
          <Button primary onClick={drawTen}>Write it 10 times</Button>
        </>
      }
      readouts={
        <>
          <Readout label="Chance of the top word" value={pct(probs[0])} tone="accent" />
          <Readout label="Different endings in 10 tries" value={draws.length ? new Set(draws).size : "–"} />
        </>
      }
    >
      <p className="next-prompt">
        The capital of Nepal is<span className="next-cursor">▍</span>
      </p>
      <Canvas width={W} height={H}>
        <Axes x={X} y={Y} yTicks={[0, 0.5, 1]} fmtY={(v) => pct(v)} yLabel="chance of being the next token" />
        {NEXT.map((n, i) => (
          <g key={n.w}>
            <rect className={i === 0 ? "bar-a" : "bar-muted"} x={X.f(i) + 10} y={Y.f(probs[i])} width={X.f(1) - X.f(0) - 20} height={Y.f(0) - Y.f(probs[i])} rx="4" />
            <text className="label" x={X.f(i + 0.5)} y={H - 30} textAnchor="middle">
              {n.w.trim()}
            </text>
          </g>
        ))}
      </Canvas>
      {draws.length > 0 && <p className="sim-legend">Ten tries: {draws.join(" · ")}</p>}
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Confidently wrong

const YEARS = ["1951", "1956", "1959", "1962", "1965"];

export function HallucinationSim({ onState }) {
  const [source, setSource] = useState(false);
  const [abstain, setAbstain] = useState(false);
  // Without a source the model has only a vague memory: plausible years, spread out, the right one (1959) not even on top.
  const base = source ? [0.2, 0.4, 6.0, 0.3, 0.1] : [1.2, 1.6, 1.4, 1.0, 0.7];
  const scores = abstain ? [...base, source ? -1 : 1.9] : base;
  const probs = nextTokenProbs(scores, 1);
  const labels = abstain ? [...YEARS, "not sure"] : YEARS;
  const answer = labels[probs.indexOf(Math.max(...probs))];
  useReport(onState, { source, abstain, answer, right: probs[2] });
  const X = frame([0, labels.length], [60, W - 20]);
  const Y = frame([0, 1], [H - 50, 16]);
  return (
    <Sim
      label="Ask about a little-known date, with and without a source"
      controls={
        <>
          <Toggle label="Paste in the source document" checked={source} onChange={setSource} />
          <Toggle label="Reward saying 'not sure'" checked={abstain} onChange={setAbstain} />
        </>
      }
      readouts={
        <>
          <Readout label="Its answer" value={answer} tone="accent" />
          <Readout label="Chance of the right year" value={pct(probs[2])} />
        </>
      }
    >
      <p className="next-prompt">"In what year was the village library in Bandipur founded?" (the source says 1959)</p>
      <Canvas width={W} height={H}>
        <Axes x={X} y={Y} yTicks={[0, 0.5, 1]} fmtY={(v) => pct(v)} yLabel="chance of each answer" />
        {labels.map((l, i) => (
          <g key={l}>
            <rect className={l === "1959" ? "bar-a" : l === "not sure" ? "bar-b" : "bar-muted"} x={X.f(i) + 10} y={Y.f(probs[i])} width={X.f(1) - X.f(0) - 20} height={Y.f(0) - Y.f(probs[i])} rx="4" />
            <text className="label" x={X.f(i + 0.5)} y={H - 30} textAnchor="middle">
              {l}
            </text>
          </g>
        ))}
      </Canvas>
      <p className="sim-legend">Illustrative. Without the source, it still answers, fluently, with whichever year looks most plausible. It isn't lying: it has no way to tell remembering from guessing.</p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// An open-book exam

const DOCS = [
  "Refunds are paid back to the original card within 14 days of the return arriving.",
  "Orders over Rs 2,000 get free delivery anywhere in the Kathmandu valley.",
  "Our Lalitpur shop opens at 10 am and closes at 7 pm, Sunday to Friday.",
  "Electronics can be returned within 7 days if they are unopened.",
  "Clothes can be returned within 30 days with the receipt.",
  "Delivery outside the valley takes three to five working days.",
  "Gift cards cannot be refunded or exchanged for cash.",
  "Customer support answers calls from 9 am to 6 pm.",
];
const QUESTIONS = [
  ["How many days do I have to return a phone?", 3],
  ["When will my refund be paid?", 0],
  ["Is delivery free to Bhaktapur?", 1],
  ["Can I get cash for a gift card?", 6],
];

export function RagSim({ onState }) {
  const [q, setQ] = useState(0);
  const [k, setK] = useState(2);
  const [question, answerDoc] = QUESTIONS[q];
  const hits = useMemo(() => retrieve(question, DOCS, k), [question, k]);
  const found = hits.some((h) => h.i === answerDoc);
  useReport(onState, { q, k, found });
  return (
    <Sim
      label="Retrieve the right documents before answering"
      controls={
        <>
          <Choice label="Question" options={QUESTIONS.map(([text], i) => [String(i), text])} value={String(q)} onChange={(v) => setQ(+v)} />
          <Slider label="Documents to retrieve (k)" value={k} min={1} max={4} onChange={setK} />
        </>
      }
      readouts={
        <>
          <Readout label="Right document found" value={found ? "yes" : "no"} tone="accent" />
          <Readout label="Best match score" value={fix(hits[0].score)} />
        </>
      }
    >
      <ol className="rag-docs">
        {DOCS.map((d, i) => {
          const hit = hits.find((h) => h.i === i);
          return (
            <li key={i} className={`${hit ? "is-hit" : ""}${i === answerDoc ? " is-answer" : ""}`}>
              <span>{d}</span>
              {hit && <small>{fix(hit.score)}</small>}
            </li>
          );
        })}
      </ol>
      <p className="sim-legend">
        Highlighted: what gets pasted into the prompt. Underlined: the document that holds the answer. This retriever only matches shared words; for the phone question that fails (the document says "electronics"), which is why real systems match meanings with embeddings.
      </p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Teach it, or tell it?

const curve = (n, start, top, half) => start + (top - start) * (n / (n + half));

export function FinetuneSim({ onState }) {
  const [n, setN] = useState(20);
  const prompt = curve(Math.min(n, 30), 0.62, 0.8, 4);
  const tuned = curve(n, 0.45, 0.94, 300);
  useReport(onState, { n, prompt: +prompt.toFixed(3), tuned: +tuned.toFixed(3) });
  const X = frame([0, 3.5], [60, W - 20]);
  const Y = frame([0.4, 1], [H - 40, 16]);
  const xs = range(141).map((i) => i / 40);
  return (
    <Sim
      label="Compare prompting and fine-tuning as examples grow"
      controls={<Slider label="Labelled examples you have" value={n} min={0} max={3000} step={10} onChange={setN} />}
      readouts={
        <>
          <Readout label="Prompting with examples" value={pct(prompt)} />
          <Readout label="Fine-tuning" value={pct(tuned)} />
          <Readout label="Better here" value={tuned > prompt ? "fine-tuning" : "prompting"} tone="accent" />
        </>
      }
    >
      <Canvas width={W} height={H}>
        <Axes x={X} y={Y} xTicks={[0, 1, 2, 3]} fmtX={(v) => String(10 ** v)} yTicks={[0.4, 0.6, 0.8, 1]} fmtY={(v) => pct(v)} xLabel="labelled examples (log scale)" yLabel="accuracy on the task" />
        <path className="line-b thick" d={linePath(xs.map((x) => [x, curve(Math.min(10 ** x, 30), 0.62, 0.8, 4)]), X.f, Y.f)} />
        <path className="line-a thick" d={linePath(xs.map((x) => [x, curve(10 ** x, 0.45, 0.94, 300)]), X.f, Y.f)} />
        <line className="line-ink dashed thin" x1={X.f(Math.log10(Math.max(1, n)))} x2={X.f(Math.log10(Math.max(1, n)))} y1={Y.range[0]} y2={Y.range[1]} />
      </Canvas>
      <p className="sim-legend">
        <span className="key key-b" /> prompting (only ~30 examples fit in a prompt) <span className="key key-a" /> fine-tuning. Illustrative shapes, typical of a narrow task like sorting support tickets.
      </p>
    </Sim>
  );
}
