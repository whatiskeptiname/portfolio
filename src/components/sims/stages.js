// What each simulation stage shows and says, and which CV line it rests on
// (`cv` indexes the case study's highlights). Durations in seconds.

export const STAGES = {
  surgery: [
    { title: "Capture rig", duration: 4, cv: 2, text: "A total knee replacement, ringed by cameras. Each patch of the scene needs at least two views to reconstruct; the ring shows where it gets them. Fewer cameras means less to sync, store and process, but only while coverage holds." },
    { title: "Prompt detection", duration: 3, cv: 4, text: "GroundingDINO finds the bone saw from a plain-text prompt, with no class-specific training: type what you're looking for, get a box." },
    { title: "SAM segmentation", duration: 3, cv: 4, text: "SAM turns the box into a pixel-accurate mask of the saw, separating it from the bone, the implant and the tissue round it." },
    { title: "Tracking", duration: 4, cv: 4, text: "MMDetection-based tracking follows the saw frame to frame as it shapes the femur: markerless surgical tracking, no fiducials on the tools." },
    { title: "3D reconstruction", duration: 5, cv: 3, text: "Gaussian splats rebuild the knee, implant and all, from the multi-view capture. The optimised pipeline renders novel views in 7–20 minutes instead of hours." },
  ],
  inference: [
    { title: "Baseline", duration: 2.5, cv: 0, text: "A dense vision model at full precision: every neuron, every weight, FP32. Accurate, but slow on the GPU." },
    { title: "Prune", duration: 3, cv: 0, text: "Structured pruning removes the neurons that contribute least, halving the parameter count." },
    { title: "Sparsify", duration: 3, cv: 0, text: "Sparsity zeroes out small weights in a pattern NVIDIA GPUs can skip, so whole multiplications disappear." },
    { title: "Quantize", duration: 3, cv: 0, text: "Weights and activations drop from 32-bit floats to 8-bit integers. Together that's about 7× faster, but accuracy slips to 80.26%." },
    { title: "Distil", duration: 4, cv: 1, text: "A teacher-student stage after optimisation: the original model teaches the compressed one, recovering accuracy to 82.88% at half the parameters." },
    { title: "Ship to Triton", duration: 4.5, cv: 2, text: "Separately, ZipVoice (123M params) went PyTorch → ONNX → TensorRT with FP16 and dynamic shapes, served on Triton at 2.84× faster with no quality loss." },
  ],
  forecasting: [
    { title: "Baseline", duration: 3, cv: 0, text: "The forecast with today's price: twelve months of revenue, with the seasonal lift into the holidays." },
    { title: "Price change", duration: 4, cv: 0, text: "Move the price and the engine ripples it through demand (via price elasticity) into units and revenue, so pricing teams see the effect before committing." },
    { title: "Business numbers", duration: 4, cv: 1, text: "Post-forecast calculations turn the curve into numbers analysts use as-is: month-on-month change, cumulative year-to-date and the delta against baseline." },
    { title: "Ask the forecast", duration: 6, cv: 2, text: "An LLM layer answers questions about the results in plain language, closing the gap between model output and a pricing decision." },
  ],
  "schema-mapping": [
    { title: "Two schemas", duration: 2.5, cv: 0, text: "A source system's columns on the left, the canonical model on the right. Names rarely line up: cust_nm, dob, amt_usd…" },
    { title: "1 · Name similarity", duration: 3, cv: 0, text: "Stage one compares the names themselves, character by character. It catches near-misses like e_mail_addr → email, but not abbreviations." },
    { title: "2 · Type profiling", duration: 3, cv: 0, text: "Stage two profiles the values: dates, money, codes, phone numbers. A date column can only become a date field." },
    { title: "3 · Meaning", duration: 3, cv: 0, text: "Stage three matches on meaning (dob means birth date, amt means amount), using known synonyms." },
    { title: "Mapped", duration: 3.5, cv: 0, text: "The stages vote with weights. Out of the box, 7 of 10 columns land on the right field (70%); the rest are flagged for review rather than guessed." },
    { title: "YAML config", duration: 6, cv: 1, text: "Weights, thresholds and strategies live in a YAML config, so a team can tune the engine to their data without touching code. Try the sliders." },
  ],
  greenhouse: [
    { title: "Map the greenhouse", duration: 5, cv: 0, text: "The robot drives the aisles and builds a map of the greenhouse as it goes. Grey is still unknown." },
    { title: "Detect flowers in 3D", duration: 3.5, cv: 0, text: "Object detection finds flowers in the camera image; depth puts each one at a 3D position the arm can reach." },
    { title: "Pollinate", duration: 5, cv: 0, text: "It visits each open flower in turn and pollinates it; done flowers turn gold." },
    { title: "Lower the plants", duration: 5, cv: 0, text: "Tomato vines keep growing up their strings. The robot recognises the hooks and lowers each plant to keep the crop in reach." },
  ],
  tables: [
    { title: "Generate data", duration: 4, cv: 0, text: "Real receipts are scarce, so the dataset is generated and augmented: rotated, noisy, blurred and warped copies teach the models to cope with phone photos." },
    { title: "Label", duration: 3, cv: 0, text: "Tables, rows and cells are labelled in Label Studio and CVAT to train and evaluate on." },
    { title: "Detect the table", duration: 2.5, cv: 0, text: "A fine-tuned Cascade TabNet finds where the table is on the receipt." },
    { title: "Recover structure", duration: 3, cv: 0, text: "TabStructNet recovers the rows and columns, so every cell is known by its position." },
    { title: "Read it out", duration: 4, cv: 0, text: "With the structure known, each cell's text lands in the right row and column: a clean table ready for accounting." },
  ],
  catdox: [
    { title: "Skewed scan", duration: 2.5, cv: 1, text: "Scans arrive rotated and warped. Before any model sees them, the pipeline finds distinctive keypoints on the page." },
    { title: "SIFT alignment", duration: 3.5, cv: 1, text: "SIFT keypoints are matched against a template of the document and the page is warped straight, so the later models see a clean, upright page." },
    { title: "Classify", duration: 2.5, cv: 0, text: "A ResNet decides which kind of document it is, which tells the pipeline which fields to look for." },
    { title: "Find the fields", duration: 2.5, cv: 0, text: "DiT layout detection draws a box round every field on the page." },
    { title: "OCR", duration: 3.5, cv: 0, text: "A Devanagari-tuned OCR reads each field, Nepali and English, with the occasional misread character." },
    { title: "ByT5 correction", duration: 3, cv: 1, text: "A ByT5 correction layer fixes character-level errors after OCR, so nobody has to clean the output by hand." },
    { title: "Key-value output", duration: 4, cv: 0, text: "The result: structured fields ready for a finance system." },
  ],
};
