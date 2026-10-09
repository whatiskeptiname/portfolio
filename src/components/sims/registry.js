// Which simulation belongs to which case study (ids from src/content/resume.js);
// `three` marks the 3D scenes.
import Surgery from "./Surgery";
import Inference from "./Inference";
import Forecasting from "./Forecasting";
import SchemaMapping from "./SchemaMapping";
import Greenhouse from "./Greenhouse";
import Tables from "./Tables";
import CatDox from "./CatDox";
import { STAGES } from "./stages";

export const SIMS = {
  surgery: { Component: Surgery, stages: STAGES.surgery, three: true },
  inference: { Component: Inference, stages: STAGES.inference, three: true },
  forecasting: { Component: Forecasting, stages: STAGES.forecasting },
  "schema-mapping": { Component: SchemaMapping, stages: STAGES["schema-mapping"] },
  greenhouse: { Component: Greenhouse, stages: STAGES.greenhouse, three: true },
  tables: { Component: Tables, stages: STAGES.tables },
  catdox: { Component: CatDox, stages: STAGES.catdox },
};
