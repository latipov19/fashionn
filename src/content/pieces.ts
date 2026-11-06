import type { Piece } from "./types";

/**
 * Brief section 13.3. These seed the database. After seeding, the database is the
 * source of truth for every piece field. All values are placeholders.
 */
export const pieces: Piece[] = [
  {
    slug: "lintel-coat",
    peg: "I.01",
    name: "Lintel Coat",
    category: "Coats",
    room: "I",
    hour: "morning",
    frameClass: "wide",
    hang: "sleeveBar",
    priceUsd: 920,
    sizes: [
      "S",
      "M",
      "L",
      "XL"
    ],
    colourways: [
      {
        id: "chalk",
        name: "Chalk",
        hex: "#DAD2C2",
        lining: "#8A8172"
      },
      {
        id: "soot",
        name: "Soot",
        hex: "#202224",
        lining: "#3A3C3F"
      },
      {
        id: "slate",
        name: "Slate",
        hex: "#5C7282",
        lining: "#2F3B44"
      }
    ],
    clothId: "wool-twill-540",
    description: "A long coat cut from straight panels in heavy wool twill. It falls in broad, slow folds and closes with three horn buttons.",
    cut: {
      template: "tee",
      lengthCm: 118,
      bodyWidthCm: 66,
      spanCm: 142,
      sleeveDepthCm: 34,
      neckWidthCm: 20,
      neckDropCm: 10
    },
    gatherPct: 6,
    seed: 1101,
    details: [
      {
        kind: "seam",
        path: "shoulder"
      },
      {
        kind: "seam",
        path: "side"
      },
      {
        kind: "hem",
        cm: 5
      },
      {
        kind: "collar",
        style: "shawl"
      },
      {
        kind: "placket",
        widthCm: 7
      },
      {
        kind: "button",
        count: 3,
        diaMm: 28,
        hex: "#3B2E25"
      },
      {
        kind: "pocket",
        style: "patch",
        xCm: 16,
        yCm: 62,
        wCm: 19,
        hCm: 21
      }
    ]
  },
  {
    slug: "jamb-jacket",
    peg: "I.02",
    name: "Jamb Jacket",
    category: "Jackets",
    room: "I",
    hour: "morning",
    frameClass: "wide",
    hang: "sleeveBar",
    priceUsd: 540,
    sizes: [
      "S",
      "M",
      "L",
      "XL"
    ],
    colourways: [
      {
        id: "putty",
        name: "Putty",
        hex: "#BFB39C",
        lining: "#6F6656"
      },
      {
        id: "harbour",
        name: "Harbour",
        hex: "#526D8A",
        lining: "#2B3A4A"
      }
    ],
    clothId: "wool-herringbone-430",
    description: "A boxy jacket in wool herringbone with a short, square body. Two patch pockets sit low and hold their shape.",
    cut: {
      template: "tee",
      lengthCm: 68,
      bodyWidthCm: 62,
      spanCm: 134,
      sleeveDepthCm: 28,
      neckWidthCm: 19,
      neckDropCm: 9
    },
    gatherPct: 5,
    seed: 1102,
    details: [
      {
        kind: "seam",
        path: "shoulder"
      },
      {
        kind: "seam",
        path: "side"
      },
      {
        kind: "hem",
        cm: 3
      },
      {
        kind: "collar",
        style: "camp"
      },
      {
        kind: "placket",
        widthCm: 4
      },
      {
        kind: "button",
        count: 5,
        diaMm: 22,
        hex: "#3B2E25"
      },
      {
        kind: "pocket",
        style: "patch",
        xCm: 14,
        yCm: 44,
        wCm: 17,
        hCm: 18
      }
    ]
  },
  {
    slug: "transom-cape",
    peg: "I.03",
    name: "Transom Cape",
    category: "Coats",
    room: "I",
    hour: "morning",
    frameClass: "wide",
    hang: "shoulderRod",
    priceUsd: 680,
    sizes: [
      "One size"
    ],
    colourways: [
      {
        id: "oat",
        name: "Oat",
        hex: "#CDBFA5",
        lining: "#7C7260"
      },
      {
        id: "fir",
        name: "Fir",
        hex: "#617A68",
        lining: "#2F3D34"
      }
    ],
    clothId: "wool-hopsack-380",
    description: "A single wide rectangle of wool hopsack with a slit for the head and a soft funnel neck. It has no sleeves and no fastening.",
    cut: {
      template: "rect",
      lengthCm: 96,
      bodyWidthCm: 136,
      spanCm: 136,
      sleeveDepthCm: 0,
      neckWidthCm: 24,
      neckDropCm: 12
    },
    gatherPct: 8,
    seed: 1103,
    details: [
      {
        kind: "seam",
        path: "centreBack"
      },
      {
        kind: "hem",
        cm: 4
      },
      {
        kind: "collar",
        style: "funnel"
      }
    ]
  },
  {
    slug: "purlin-vest",
    peg: "I.04",
    name: "Purlin Vest",
    category: "Jackets",
    room: "I",
    hour: "morning",
    frameClass: "mid",
    hang: "shoulderRod",
    priceUsd: 340,
    sizes: [
      "S",
      "M",
      "L",
      "XL"
    ],
    colourways: [
      {
        id: "flax",
        name: "Flax",
        hex: "#C9B78F",
        lining: "#7A6D50"
      },
      {
        id: "black",
        name: "Black",
        hex: "#1E1E1F",
        lining: "#3A3A3C"
      }
    ],
    clothId: "cotton-canvas-340",
    description: "A plain sleeveless layer in cotton canvas, stiff enough to stand a little away from the body. Wear it over a shirt or under a coat.",
    cut: {
      template: "vest",
      lengthCm: 70,
      bodyWidthCm: 58,
      spanCm: 58,
      sleeveDepthCm: 0,
      neckWidthCm: 20,
      neckDropCm: 16
    },
    gatherPct: 3,
    seed: 1104,
    details: [
      {
        kind: "seam",
        path: "shoulder"
      },
      {
        kind: "seam",
        path: "side"
      },
      {
        kind: "hem",
        cm: 2.5
      },
      {
        kind: "placket",
        widthCm: 3.5
      },
      {
        kind: "button",
        count: 4,
        diaMm: 20,
        hex: "#B9A68A"
      },
      {
        kind: "pocket",
        style: "patch",
        xCm: 12,
        yCm: 46,
        wCm: 16,
        hCm: 15
      }
    ]
  },
  {
    slug: "mullion-shirt",
    peg: "II.01",
    name: "Mullion Shirt",
    category: "Shirts",
    room: "II",
    hour: "noon",
    frameClass: "wide",
    hang: "sleeveBar",
    priceUsd: 240,
    sizes: [
      "S",
      "M",
      "L",
      "XL"
    ],
    colourways: [
      {
        id: "white",
        name: "White",
        hex: "#EFEBE3",
        lining: "#A9A399"
      },
      {
        id: "pale-blue",
        name: "Pale Blue",
        hex: "#BCCBD8",
        lining: "#7C8A96"
      }
    ],
    clothId: "cotton-poplin-120",
    description: "A band-collar shirt in fine cotton poplin, cut with wide flat sleeves. The cloth is light, so it falls in small, close folds.",
    cut: {
      template: "tee",
      lengthCm: 76,
      bodyWidthCm: 58,
      spanCm: 138,
      sleeveDepthCm: 24,
      neckWidthCm: 17,
      neckDropCm: 7
    },
    gatherPct: 8,
    seed: 2101,
    details: [
      {
        kind: "seam",
        path: "yoke"
      },
      {
        kind: "seam",
        path: "side"
      },
      {
        kind: "hem",
        cm: 1
      },
      {
        kind: "collar",
        style: "band"
      },
      {
        kind: "placket",
        widthCm: 3
      },
      {
        kind: "button",
        count: 7,
        diaMm: 11,
        hex: "#E5DECF"
      }
    ]
  },
  {
    slug: "clerestory-overshirt",
    peg: "II.02",
    name: "Clerestory Overshirt",
    category: "Shirts",
    room: "II",
    hour: "noon",
    frameClass: "wide",
    hang: "sleeveBar",
    priceUsd: 360,
    sizes: [
      "S",
      "M",
      "L",
      "XL"
    ],
    colourways: [
      {
        id: "sand",
        name: "Sand",
        hex: "#C8B596",
        lining: "#786C58"
      },
      {
        id: "rust",
        name: "Rust",
        hex: "#B25A32",
        lining: "#5E2F1A"
      }
    ],
    clothId: "linen-twill-260",
    description: "An overshirt in linen twill, heavier than a shirt and lighter than a jacket. It softens with wear and keeps its square shape.",
    cut: {
      template: "tee",
      lengthCm: 74,
      bodyWidthCm: 62,
      spanCm: 136,
      sleeveDepthCm: 27,
      neckWidthCm: 18,
      neckDropCm: 8
    },
    gatherPct: 7,
    seed: 2102,
    details: [
      {
        kind: "seam",
        path: "shoulder"
      },
      {
        kind: "seam",
        path: "side"
      },
      {
        kind: "hem",
        cm: 2
      },
      {
        kind: "collar",
        style: "camp"
      },
      {
        kind: "placket",
        widthCm: 3.5
      },
      {
        kind: "button",
        count: 6,
        diaMm: 16,
        hex: "#3B2E25"
      },
      {
        kind: "pocket",
        style: "patch",
        xCm: 13,
        yCm: 26,
        wCm: 13,
        hCm: 14
      }
    ]
  },
  {
    slug: "frieze-tunic",
    peg: "II.03",
    name: "Frieze Tunic",
    category: "Shirts",
    room: "II",
    hour: "noon",
    frameClass: "wide",
    hang: "sleeveBar",
    priceUsd: 280,
    sizes: [
      "S",
      "M",
      "L"
    ],
    colourways: [
      {
        id: "natural",
        name: "Natural",
        hex: "#D8CDB8",
        lining: "#847B6A"
      },
      {
        id: "madder",
        name: "Madder",
        hex: "#B0503F",
        lining: "#5C2820"
      }
    ],
    clothId: "linen-plain-190",
    description: "A long tunic in plain-weave linen with a wide, open neck. Four straight panels and nothing else.",
    cut: {
      template: "tee",
      lengthCm: 96,
      bodyWidthCm: 64,
      spanCm: 130,
      sleeveDepthCm: 30,
      neckWidthCm: 22,
      neckDropCm: 11
    },
    gatherPct: 8,
    seed: 2103,
    details: [
      {
        kind: "seam",
        path: "shoulder"
      },
      {
        kind: "seam",
        path: "side"
      },
      {
        kind: "hem",
        cm: 2
      }
    ]
  },
  {
    slug: "spandrel-top",
    peg: "II.04",
    name: "Spandrel Top",
    category: "Shirts",
    room: "II",
    hour: "noon",
    frameClass: "mid",
    hang: "shoulderRod",
    priceUsd: 190,
    sizes: [
      "XS",
      "S",
      "M",
      "L"
    ],
    colourways: [
      {
        id: "ivory",
        name: "Ivory",
        hex: "#E7DFCF",
        lining: "#9C9484"
      },
      {
        id: "ochre",
        name: "Ochre",
        hex: "#B98A34",
        lining: "#6A4E1C"
      }
    ],
    clothId: "linen-plain-190",
    description: "A sleeveless top in plain-weave linen with a straight hem. It is cut square and sits away from the body.",
    cut: {
      template: "vest",
      lengthCm: 60,
      bodyWidthCm: 52,
      spanCm: 52,
      sleeveDepthCm: 0,
      neckWidthCm: 22,
      neckDropCm: 9
    },
    gatherPct: 5,
    seed: 2104,
    details: [
      {
        kind: "seam",
        path: "shoulder"
      },
      {
        kind: "seam",
        path: "side"
      },
      {
        kind: "hem",
        cm: 1.5
      }
    ]
  },
  {
    slug: "arcade-trouser",
    peg: "III.01",
    name: "Arcade Trouser",
    category: "Trousers",
    room: "III",
    hour: "evening",
    frameClass: "mid",
    hang: "waistBar",
    priceUsd: 380,
    sizes: [
      "28",
      "30",
      "32",
      "34",
      "36"
    ],
    colourways: [
      {
        id: "stone",
        name: "Stone",
        hex: "#A79D8C",
        lining: "#615A4E"
      },
      {
        id: "clay",
        name: "Clay",
        hex: "#8A5A44",
        lining: "#4C3126"
      },
      {
        id: "pewter",
        name: "Pewter",
        hex: "#7E8186",
        lining: "#45474A"
      }
    ],
    clothId: "wool-gabardine-280",
    description: "A wide, straight trouser in dense wool gabardine. The leg falls without a break from waist to hem.",
    cut: {
      template: "trouser",
      lengthCm: 104,
      bodyWidthCm: 42,
      spanCm: 58,
      sleeveDepthCm: 0,
      neckWidthCm: 0,
      neckDropCm: 0
    },
    gatherPct: 3,
    seed: 3101,
    details: [
      {
        kind: "waistband",
        heightCm: 5
      },
      {
        kind: "fly"
      },
      {
        kind: "seam",
        path: "inseam"
      },
      {
        kind: "seam",
        path: "side"
      },
      {
        kind: "hem",
        cm: 4
      },
      {
        kind: "button",
        count: 1,
        diaMm: 18,
        hex: "#3B2E25"
      }
    ]
  },
  {
    slug: "nave-dress",
    peg: "III.02",
    name: "Nave Dress",
    category: "Dresses",
    room: "III",
    hour: "evening",
    frameClass: "wide",
    hang: "sleeveBar",
    priceUsd: 640,
    sizes: [
      "XS",
      "S",
      "M",
      "L"
    ],
    colourways: [
      {
        id: "pearl",
        name: "Pearl",
        hex: "#E3DACB",
        lining: "#9A9182"
      },
      {
        id: "garnet",
        name: "Garnet",
        hex: "#7A1F2B",
        lining: "#431118"
      }
    ],
    clothId: "silk-satin-210",
    description: "A long dress in silk satin, cut as a single flat T and tied at the waist. Light runs down each fold in a long, narrow line.",
    cut: {
      template: "tee",
      lengthCm: 132,
      bodyWidthCm: 54,
      spanCm: 122,
      sleeveDepthCm: 26,
      neckWidthCm: 20,
      neckDropCm: 8
    },
    gatherPct: 8,
    seed: 3102,
    details: [
      {
        kind: "seam",
        path: "shoulder"
      },
      {
        kind: "seam",
        path: "side"
      },
      {
        kind: "hem",
        cm: 1
      },
      {
        kind: "tie",
        lengthCm: 150
      }
    ]
  },
  {
    slug: "apse-skirt",
    peg: "III.03",
    name: "Apse Skirt",
    category: "Skirts",
    room: "III",
    hour: "evening",
    frameClass: "mid",
    hang: "waistBar",
    priceUsd: 320,
    sizes: [
      "XS",
      "S",
      "M",
      "L"
    ],
    colourways: [
      {
        id: "camel",
        name: "Camel",
        hex: "#B08A5B",
        lining: "#66502F"
      },
      {
        id: "ash",
        name: "Ash",
        hex: "#8C8C88",
        lining: "#4E4E4B"
      }
    ],
    clothId: "wool-gabardine-280",
    description: "A wrap skirt in wool gabardine, made from one wide flat panel. It closes at the side with two buttons.",
    cut: {
      template: "skirt",
      lengthCm: 86,
      bodyWidthCm: 72,
      spanCm: 72,
      sleeveDepthCm: 0,
      neckWidthCm: 0,
      neckDropCm: 0
    },
    gatherPct: 7,
    seed: 3103,
    details: [
      {
        kind: "waistband",
        heightCm: 4
      },
      {
        kind: "seam",
        path: "side"
      },
      {
        kind: "hem",
        cm: 3
      },
      {
        kind: "button",
        count: 2,
        diaMm: 18,
        hex: "#3B2E25"
      }
    ]
  },
  {
    slug: "cornice-scarf",
    peg: "III.04",
    name: "Cornice Scarf",
    category: "Accessories",
    room: "III",
    hour: "evening",
    frameClass: "small",
    hang: "overBar",
    priceUsd: 160,
    sizes: [
      "One size"
    ],
    colourways: [
      {
        id: "saffron",
        name: "Saffron",
        hex: "#D19A2A",
        lining: "#D19A2A"
      },
      {
        id: "rose-clay",
        name: "Rose Clay",
        hex: "#B56F5E",
        lining: "#B56F5E"
      }
    ],
    clothId: "silk-wool-twill-110",
    description: "A long scarf in fine wool and silk twill with a short fringe at each end. Hung over a bar, it collapses into tight folds.",
    cut: {
      template: "rect",
      lengthCm: 140,
      bodyWidthCm: 45,
      spanCm: 45,
      sleeveDepthCm: 0,
      neckWidthCm: 0,
      neckDropCm: 0
    },
    gatherPct: 10,
    seed: 3104,
    details: [
      {
        kind: "fringe",
        cm: 3
      }
    ]
  }
];
