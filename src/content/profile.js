// Everything personal on the site lives here. Edit freely — empty fields and
// empty lists are simply not rendered.
export const profile = {
  name: "Susan Ghimire",
  github: "whatiskeptiname",
  location: "Kathmandu, Nepal",
  role: "Machine Learning Engineer",
  tagline: "I ship MLOps pipelines and LLM features, and make vision models fast — from surgical AI to 3D reconstruction.",
  // A paragraph or two about you. Each string is one paragraph.
  about: [
    "I'm a Machine Learning Engineer at Fusemachines in Kathmandu. Most of my work lives where computer vision meets production: reconstructing surgical scenes with NeRF and Gaussian Splatting, segmenting instruments with GroundingDINO and SAM, and squeezing models through TensorRT and Triton until they run several times faster.",
    "It started with robots. As president of my college robotics club I built ROS rovers and a Pixhawk delivery drone, and my GitHub is still full of the Arduino bots from that era — they make up the C++ district in the 3D city.",
  ],
  // { label, href } — shown in the hero and contact sections.
  links: [
    { label: "GitHub", href: "https://github.com/whatiskeptiname" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/susangmree" },
  ],
  email: "susangmree@gmail.com", // leave empty to hide
  resumeUrl: "Susan_Ghimire_CV.pdf", // file in /public — leave empty to hide
  // Work history, skills etc. live in ./resume.js.
};

// How repositories from src/data/repos.json are curated.
export const projectConfig = {
  // Repo names to feature, in order. If empty, the most-starred repos are used.
  featured: [],
  featuredCount: 6,
  // Repo names never shown anywhere.
  hidden: ["whatiskeptiname", "demo", "myName"],
  hideForks: true,
  hideArchived: false,
  // Per-repo tweaks: { description, title, demo, image }
  overrides: {
    // "Mobile-AQI-Device": { demo: "https://…", image: "aqi.jpg" },
  },
};
