// Planet Radio: songs streamed from YouTube through its official embedded
// player — nothing is downloaded or hosted here. Every video below is an
// official upload (artist, label or VEVO channel), checked against YouTube's
// oEmbed endpoint. Add your own with the "My mix" box in the music panel, or
// edit these lists.

export const STATIONS = [
  {
    id: "nepali",
    name: "Nepali",
    tagline: "Sajjan Raj Vaidya, Bipul Chettri, 1974 AD",
    colors: ["#dc143c", "#2b4fd8"],
    tracks: [
      { id: "hbX0BTGpkFw", title: "Chautari", artist: "Sajjan Raj Vaidya" },
      { id: "mqhyXNj1JVA", title: "Aashish", artist: "Bipul Chettri" },
      { id: "Kni9OFsh8UM", title: "Hawaijahaj", artist: "Sajjan Raj Vaidya" },
      { id: "nw-9nBJ_Tzk", title: "Eh Saathi", artist: "Bipul Chettri" },
      { id: "WUfeSOe1PJ4", title: "Behuli", artist: "Sajjan Raj Vaidya" },
      { id: "zb6Ndo0WyVg", title: "Katai Uslai", artist: "Bipul Chettri" },
      { id: "UMPwJ9AJdog", title: "Nepali Ho", artist: "1974 AD" },
      { id: "ucOBod97Q_Y", title: "Phutki Jaaney Jovan", artist: "Sajjan Raj Vaidya" },
      { id: "MEopSZOPQPY", title: "Bhawana", artist: "Bipul Chettri" },
      { id: "17l66cbys_M", title: "Suna Kaanchi", artist: "Sajjan Raj Vaidya" },
      { id: "tELlvq18e4g", title: "Wildfire / Dadhelo", artist: "Bipul Chettri" },
    ],
  },
  {
    id: "hindi",
    name: "Hindi",
    tagline: "Arijit Singh and friends",
    colors: ["#ff9933", "#138808"],
    tracks: [
      { id: "P7yRYiBiV3g", title: "Kesariya", artist: "Arijit Singh · Brahmāstra" },
      { id: "RguA0jevrAc", title: "Saware", artist: "Arijit Singh · Phantom" },
      { id: "Z1wN6_mCYbw", title: "Lambiyaan Si Judaiyaan", artist: "Arijit Singh · Raabta" },
      { id: "uIZMKRzxH5E", title: "Darkhaast", artist: "Arijit Singh & Sunidhi Chauhan · Shivaay" },
      { id: "c19t5ORk8Xo", title: "Baaton Ko Teri", artist: "Arijit Singh · All Is Well" },
      { id: "LlVxeiIoslk", title: "Meet", artist: "Arijit Singh · Simran" },
      { id: "Uuce4UaHGQg", title: "Aur Mohabbat Kitni Karoon", artist: "Arijit Singh · Metro…In Dino" },
    ],
  },
  {
    id: "english",
    name: "English",
    tagline: "Coldplay, Ed Sheeran, Imagine Dragons",
    colors: ["#5b3cc4", "#2fd6ff"],
    tracks: [
      { id: "VPRjCeoBqrI", title: "A Sky Full of Stars", artist: "Coldplay" },
      { id: "2Vv-BfVoq4g", title: "Perfect", artist: "Ed Sheeran" },
      { id: "w5tWYmIOWGk", title: "On Top of the World", artist: "Imagine Dragons" },
      { id: "k4V3Mo61fJM", title: "Fix You", artist: "Coldplay" },
      { id: "dvgZkm1xWPE", title: "Viva La Vida", artist: "Coldplay" },
    ],
  },
];

export const watchUrl = (track) => `https://www.youtube.com/watch?v=${track.id}`;
