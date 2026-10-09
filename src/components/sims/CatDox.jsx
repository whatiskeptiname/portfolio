// CatDox: straighten a skewed scan, classify it, find its fields, read them
// (Nepali and English), fix the OCR's mistakes and hand back key-value data.
// All names and numbers are made up.
import React, { useState } from "react";
import { DetBox, Stat } from "./shared";
import { clamp, ease, lerp } from "./anim";
import { STAGES } from "./stages";

const DOCS = {
  passport: {
    label: "Passport",
    fields: [
      { key: "name", text: "SITA SHARMA", ocr: "SITA SHARNA" },
      { key: "name_np", text: "सीता शर्मा", ocr: "सीता शर्मा" },
      { key: "passport_no", text: "PA0012345", ocr: "PAOO12345" },
      { key: "date_of_birth", text: "1998-04-12", ocr: "1998-04-l2" },
    ],
    probs: [0.94, 0.03, 0.02, 0.01],
  },
  pan: {
    label: "PAN card",
    fields: [
      { key: "name", text: "RAM THAPA", ocr: "RAM THAPA" },
      { key: "name_np", text: "राम थापा", ocr: "राम थापो" },
      { key: "pan_no", text: "600123456", ocr: "6OO123456" },
      { key: "issued", text: "2079-02-15", ocr: "2079-02-15" },
    ],
    probs: [0.02, 0.95, 0.02, 0.01],
  },
  account: {
    label: "Account form",
    fields: [
      { key: "account_holder", text: "GITA RAI", ocr: "G1TA RAI" },
      { key: "branch", text: "Kathmandu", ocr: "Kathrnandu" },
      { key: "account_type", text: "Savings", ocr: "Savings" },
      { key: "mobile", text: "98XXXXXX10", ocr: "98XXXXXX1O" },
    ],
    probs: [0.01, 0.02, 0.96, 0.01],
  },
};
const CLASSES = ["Passport", "PAN card", "Account form", "Citizenship"];

const stages = STAGES.catdox;

export default function CatDox({ stage, t }) {
  const [kind, setKind] = useState("passport");
  const doc = DOCS[kind];
  const straight = stage >= 2 ? 1 : stage === 1 ? ease(t, 1.6, 1.6) : 0;
  const angle = lerp(-9, 0, straight);
  const skewX = lerp(0.12, 0, straight);
  const fieldY = (i) => 160 + i * 38;
  const keypoints = [
    [92, 72], [250, 64], [140, 120], [300, 150], [96, 300], [290, 296], [200, 220], [150, 260],
  ];
  return (
    <div className="sim-layout">
      <svg className="sim-svg" viewBox="0 0 640 360" role="img" aria-label={stages[stage].title}>
        <g transform={`translate(200 180) rotate(${angle}) matrix(1 0 ${skewX} 1 0 0) translate(-200 -180)`}>
          <rect x="70" y="40" width="260" height="290" rx="8" className="s-paper" />
          <rect x="84" y="56" width="70" height="86" rx="4" className="s-photo" />
          <text x="170" y="74" className="s-receipt-bold">
            {doc.label.toUpperCase()}
          </text>
          <text x="170" y="92" className="s-receipt">
            नेपाल सरकार
          </text>
          <text x="170" y="106" className="s-receipt">
            Govt. of Nepal
          </text>
          {doc.fields.map((f, i) => {
            const shownText = stage >= 5 ? (stage === 5 && t < 0.6 + i * 0.5 ? f.ocr : f.text) : stage === 4 ? f.ocr.slice(0, Math.floor(clamp((t - 0.4 - i * 0.6) / 0.8) * f.ocr.length)) : f.text;
            const fixed = stage >= 5 && f.ocr !== f.text && !(stage === 5 && t < 0.6 + i * 0.5);
            return (
              <g key={f.key}>
                {(stage < 3 || stage > 5) && (
                  <text x="84" y={fieldY(i) - 4} className="s-mono-small">
                    {f.key}
                  </text>
                )}
                <text x="84" y={fieldY(i) + 12} className={stage >= 4 && f.ocr !== f.text && !fixed ? "s-receipt-bold s-warn" : "s-receipt-bold"}>
                  {stage >= 4 ? shownText : f.text}
                </text>
                {fixed && stage === 5 && (
                  <text x="250" y={fieldY(i) + 12} className="s-mono-small s-ok">
                    fixed
                  </text>
                )}
                {stage >= 3 && stage <= 5 && <DetBox x={80} y={fieldY(i) - 2} w={236} h={20} label={f.key} opacity={stage === 3 ? ease(t, 0.3 + i * 0.4, 0.4) : 0.7} />}
              </g>
            );
          })}
          {stage <= 1 &&
            keypoints.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" className="s-key" opacity={ease(t, 0.2 + i * 0.2, 0.3)} />)}
        </g>
        {stage === 1 && (
          <g opacity={1 - ease(t, 2, 1.2)}>
            <rect x="420" y="40" width="170" height="190" rx="6" className="s-template" />
            <text x="505" y="250" textAnchor="middle" className="s-mono-small">
              template
            </text>
            {keypoints.map(([x, y], i) => {
              const tx = 420 + ((x - 70) / 260) * 170;
              const ty = 40 + ((y - 40) / 290) * 190;
              return (
                <g key={i}>
                  <circle cx={tx} cy={ty} r="3.5" className="s-key" />
                  <line x1={x + 6} y1={y + 10} x2={tx} y2={ty} className="s-match" opacity={ease(t, 0.5 + i * 0.12, 0.3)} />
                </g>
              );
            })}
          </g>
        )}
        {stage === 2 &&
          CLASSES.map((c, i) => (
            <g key={c}>
              <text x="380" y={110 + i * 40} className="s-mono">
                {c}
              </text>
              <rect x="380" y={118 + i * 40} width="200" height="10" rx="5" className="s-track" />
              <rect x="380" y={118 + i * 40} width={200 * doc.probs[i] * ease(t, 0.2, 1.2)} height="10" rx="5" className={doc.probs[i] > 0.5 ? "s-fill" : "s-fill-dim"} />
            </g>
          ))}
        {stage === 6 && (
          <g>
            <rect x="360" y="60" width="250" height="230" rx="10" className="s-code" />
            {["{", ...doc.fields.map((f, i) => `  "${f.key}": "${f.text}"${i < doc.fields.length - 1 ? "," : ""}`), "}"].map((line, i) => (
              <text key={i} x="374" y={88 + i * 24} className="s-mono" opacity={ease(t, 0.2 + i * 0.3, 0.3)}>
                {line}
              </text>
            ))}
          </g>
        )}
      </svg>
      <aside className="sim-side">
        <label className="sim-control">
          <span>Document</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {Object.entries(DOCS).map(([k, d]) => (
              <option key={k} value={k}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        {stage <= 1 && <Stat label="Page angle" value={`${angle.toFixed(1)}°`} tone={straight === 1 ? "ok" : "bad"} />}
        {stage === 2 && <Stat label="ResNet says" value={`${doc.label} · ${Math.round(Math.max(...doc.probs) * 100)}%`} tone="ok" />}
        {stage >= 4 && stage <= 5 && (
          <Stat label="Fields with errors" value={stage === 5 && t > 2.4 ? "0" : doc.fields.filter((f) => f.ocr !== f.text).length} tone={stage === 5 && t > 2.4 ? "ok" : "bad"} />
        )}
        <p className="sim-hint">Names and numbers are made up.</p>
      </aside>
    </div>
  );
}
