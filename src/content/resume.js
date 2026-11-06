// Structured résumé content (source: public/Susan_Ghimire_CV.pdf).
// Drives the Experience, Case studies, Toolbox and Background sections, and
// the Career district + skill billboards in the 3D city.
//
// Dates are "YYYY-MM"; end: null means "present".

export const summary =
  "Machine Learning Engineer with hands-on experience shipping MLOps pipelines and LLM-powered features, backed by deep computer vision work across surgical AI, 3D reconstruction, and model optimization.";

// Headline numbers for the hero. Keep them short.
export const highlights = [
  { value: "7×", label: "faster inference after model optimization" },
  { value: "40k+", label: "surgical images annotated at 90%+ accuracy" },
  { value: "30 → 6–9", label: "cameras needed in a surgical capture rig" },
];

// What an employer gets, in a line each; the results behind them are in the case
// studies. `work` links to one; `figure` names its picture in
// components/site/figureMap.js.
export const strengths = [
  {
    title: "Faster models, same accuracy",
    figure: "prune",
    work: "inference",
    line: "I prune, quantize and distill models until they run fast on the hardware they're meant for.",
  },
  {
    title: "ML that reaches production",
    figure: "pipeline",
    work: "schema-mapping",
    line: "API-driven pipelines and YAML config, so a model's behaviour changes without touching code.",
  },
  {
    title: "Vision and 3D on real problems",
    figure: "rig",
    work: "surgery",
    line: "Detection, segmentation and 3D reconstruction, delivered for a surgical client.",
  },
  {
    title: "AI features business teams can use",
    figure: "ask",
    work: "forecasting",
    line: "LLMs on top of demand forecasts, so people get answers in plain language.",
  },
  {
    title: "Someone who lifts the team",
    figure: "team",
    line: "Supervised 11 capstone ML projects for 30+ fellows, with every milestone on track.",
  },
];

export const skills = [
  { category: "Languages", items: ["Python", "C/C++", "SQL"] },
  {
    category: "ML frameworks",
    items: ["PyTorch", "TensorFlow/Keras", "Scikit-Learn", "NumPy", "SciPy", "Pandas", "Matplotlib", "OpenCV", "Open3D"],
  },
  {
    category: "Model optimization",
    items: ["NVIDIA ModelOpt", "TensorRT", "ONNX", "CoreML", "Quantization", "Knowledge Distillation"],
  },
  { category: "Inference & serving", items: ["NVIDIA Triton", "FastAPI", "Pydantic", "gRPC"] },
  { category: "Agentic AI & GenAI", items: ["Google ADK", "LLMs", "RAG", "Diffusion Models", "GroundingDINO", "SAM"] },
  { category: "MLOps", items: ["Hydra", "MLflow", "AWS SageMaker", "Docker", "GitHub Actions", "CI/CD"] },
  {
    category: "Computer vision & 3D",
    items: ["NeRF Studio", "Gaussian Splatting", "Photogrammetry", "Structure-from-Motion", "MMDetection", "YOLO", "Vision Transformers"],
  },
  { category: "Annotation", items: ["Label Studio", "CVAT"] },
  { category: "Hardware & embedded", items: ["Arduino", "Raspberry Pi", "ROS2"] },
];

// The order the Work section shows the case studies in. The first and last tiles are
// wide, so they go to the wide 3D scenes; the upright document projects get normal tiles.
export const caseStudyOrder = ["surgery", "inference", "forecasting", "schema-mapping", "tables", "catdox", "greenhouse"];

// The skills above in the order the work happens, for the Toolbox section.
export const buildPath = [
  { stage: "Label", categories: ["Annotation"] },
  { stage: "Build", categories: ["ML frameworks", "Computer vision & 3D", "Agentic AI & GenAI"] },
  { stage: "Optimize", categories: ["Model optimization"] },
  { stage: "Serve", categories: ["Inference & serving"] },
  { stage: "Operate", categories: ["MLOps"] },
];
export const alongside = ["Languages", "Hardware & embedded"];

// Roles, newest first. `projects` reference ids in `caseStudies`.
export const roles = [
  {
    id: "consultant",
    title: "Machine Learning Engineer (Consultant)",
    org: "AI Inference Acceleration Pipeline",
    location: "Remote, Ireland",
    start: "2025-12",
    end: "2026-02",
    projects: ["inference"],
  },
  {
    id: "fusemachines",
    title: "Machine Learning Engineer",
    org: "Fusemachines Nepal",
    location: "Nepal",
    start: "2022-06",
    end: null,
    projects: ["surgery", "schema-mapping", "forecasting", "greenhouse", "tables"],
  },
  {
    id: "ta",
    title: "Teaching Assistant",
    org: "Fusemachines Nepal",
    location: "Nepal",
    start: "2024-05",
    end: "2024-10",
    highlights: [
      "Supervised 11 capstone ML projects across CV, NLP, and forecasting for a cohort of 30+ fellows, keeping 100% of milestones on track across six modules.",
      "Ran weekly TA sessions on core ML concepts and hands-on labs in computer vision, NLP, and forecasting, with applications in education and agriculture.",
    ],
  },
];

// Professional projects. `weight` sets building height in the 3D city.
export const caseStudies = [
  {
    id: "surgery",
    title: "AI-Assisted Surgery",
    org: "Fusemachines · US orthopedic healthcare client",
    metric: { value: "hours → 7–20 min", label: "novel view synthesis render time" },
    tags: ["NeRF", "Gaussian Splatting", "GroundingDINO", "SAM", "MMDetection", "SageMaker", "MLflow"],
    weight: 40,
    highlights: [
      "Deployed an AWS MLOps pipeline for saliency detection in surgical videos, using SageMaker for inference and MLflow for experiment tracking, versioning, and automated deployments.",
      "Built an annotation tool for salient region detection, reaching over 90% annotation accuracy across a 40k+ image dataset covering object detection and occlusion scenarios.",
      "Cut novel view synthesis rendering from hours down to 7-20 minutes, and trimmed the multi-camera capture rig from 30 cameras to 6-9 without losing scene coverage.",
      "Reconstructed static and dynamic 3D surgical scenes with NeRF and Gaussian Splatting, and built an interactive tool for blending splats with 3D meshes, with playback and navigation for 4D visualization.",
      "Shipped prompt-based surgical instrument segmentation with GroundingDINO and SAM, plus tracking via MMDetection, as part of a markerless surgical tracking system.",
    ],
  },
  {
    id: "inference",
    title: "AI Inference Acceleration",
    org: "Consultant · Remote, Ireland",
    metric: { value: "7×", label: "faster inference within 2% of baseline accuracy" },
    tags: ["TensorRT", "ONNX", "Triton", "Quantization", "Distillation", "FP16"],
    weight: 34,
    highlights: [
      "Pruned, sparsified, and quantized vision models, hitting up to 7x faster inference on NVIDIA GPUs within 2% of baseline accuracy.",
      "Recovered accuracy from 80.26% to 82.88% by adding a teacher-student distillation stage after optimization, at half the original parameter count.",
      "Ported ZipVoice (123M params) from PyTorch through ONNX to TensorRT with FP16 and dynamic shapes, served via Triton at 2.84x faster inference without quality loss.",
    ],
  },
  {
    id: "forecasting",
    title: "Demand Forecasting",
    org: "Fusemachines",
    tags: ["Forecasting", "LLMs", "Pricing"],
    weight: 22,
    highlights: [
      "Built a forecasting engine that models how price changes ripple through sales and revenue, giving pricing teams a data-backed view before committing to changes.",
      "Added post-forecast MoM change, cumulative YTD performance, and baseline impact deltas, so analysts get business-ready numbers without extra processing.",
      "Plugged in an LLM so users can ask questions about forecast results in plain language.",
    ],
  },
  {
    id: "schema-mapping",
    title: "Database Schema Mapping",
    org: "Fusemachines",
    metric: { value: "70%", label: "mapping accuracy out of the box" },
    tags: ["Matching", "APIs", "YAML config"],
    weight: 20,
    highlights: [
      "Built a 3-stage AI mapping engine that maps source data schemas to a canonical model through an API-driven pipeline, hitting 70% mapping accuracy out of the box.",
      "Added a YAML-based config layer so model parameters, feature weights, and matching strategies can be swapped without changing code.",
    ],
  },
  {
    id: "greenhouse",
    title: "Autonomous Greenhouse Robot",
    org: "Fusemachines",
    tags: ["Robotics", "3D detection", "Mapping"],
    weight: 18,
    highlights: [
      "Worked on computer vision for an autonomous greenhouse robot handling pollination and plant-lowering tasks, mapping the greenhouse and applying object detection and recognition in 3D.",
    ],
  },
  {
    id: "tables",
    title: "Table Detection & Document Analysis",
    org: "Fusemachines",
    tags: ["Cascade TabNet", "TabStructNet", "Label Studio", "CVAT"],
    weight: 14,
    highlights: [
      "Fine-tuned Cascade TabNet and TabStructNet for table detection and structure recognition on financial receipts, covering dataset generation, augmentation, and labeling in Label Studio and CVAT.",
    ],
  },
  {
    id: "catdox",
    title: "CatDox",
    org: "GIBL Hackathon · Apr 2025",
    metric: { value: "Award", label: "“extremely useful” category" },
    tags: ["ResNet", "DiT", "OCR", "ByT5", "SIFT"],
    weight: 24,
    highlights: [
      "Document processing pipeline for finance chaining ResNet classification, DiT layout detection, and Devanagari-tuned OCR to pull key-value fields from scanned Nepali and English documents such as passports, PAN cards, and account forms.",
      "Added SIFT-based alignment before inference and a ByT5 correction layer after OCR, so skewed scans and messy character errors need no manual cleanup.",
    ],
  },
];

// Everything else, shown in "Background" and as landmarks in the city.
export const background = [
  {
    id: "education",
    kind: "Education",
    title: "Bachelor's in Computer Engineering",
    org: "Tribhuvan University",
    start: "2017-11",
    end: "2022-04",
    weight: 16,
  },
  {
    id: "robotics-club",
    kind: "Leadership",
    title: "President, Robotics Club",
    org: "Kathmandu Engineering College",
    start: "2021-03",
    end: "2022-05",
    weight: 12,
    highlights: [
      "Built terrestrial robots with ROS, Raspberry Pi, GPS, and radio controls, and developed a quadcopter delivery system on Pixhawk.",
      "Led IoT and robotics workshops, designed smart home automation systems, and coordinated hackathons and technical events.",
    ],
  },
  {
    id: "fellowship",
    kind: "Fellowship",
    title: "Microdegree in ML, DL, CV, NLP",
    org: "Fusemachines AI Fellowship 2022",
    start: "2022-03",
    end: "2024-01",
    weight: 10,
    highlights: [
      "Structured microdegree covering supervised and unsupervised learning, CNNs, RNNs, transformers, object detection, 3D reconstruction, and sequence modeling.",
    ],
  },
  {
    id: "guidebook",
    kind: "Publication",
    title: "Insights on Simulation and Modelling",
    org: "Co-authored guidebook",
    start: "2023-12",
    end: "2023-12",
    weight: 8,
    highlights: [
      "Co-authored a simulation and modelling guidebook with a professor for Bachelor of Computer Engineering students, adopted in an active course.",
    ],
  },
];
