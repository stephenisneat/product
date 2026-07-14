import type {
  Artifact,
  Campaign,
  PerformancePoint,
  Product,
  ProductIntelligence,
} from "@/domain";

const now = "2026-07-10T16:00:00.000Z";
const earlier = "2026-06-01T12:00:00.000Z";
const DEMO_OWNER = "demo-user";

export const DEMO_USER = {
  id: DEMO_OWNER,
  email: "demo@product.ag",
  name: "Demo Merchant",
  isDemo: true,
} as const;

export const seedProducts: Product[] = [
  {
    id: "prod_aurora_bottle",
    title: "Aurora Insulated Bottle",
    handle: "aurora-insulated-bottle",
    description:
      "A double-wall vacuum bottle built for all-day temperature control with a leak-proof lid and matte finish.",
    status: "active",
    price: 48,
    currency: "USD",
    images: [
      "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80",
    ],
    channels: ["shopify", "meta", "google"],
    sku: "AUR-750-BLK",
    category: "Drinkware",
    syncedAt: now,
    createdAt: earlier,
    updatedAt: now,
    ownerId: DEMO_OWNER,
  },
  {
    id: "prod_linen_throw",
    title: "Coastal Linen Throw",
    handle: "coastal-linen-throw",
    description:
      "Soft stonewashed linen throw for living rooms and weekends away. Breathable, pre-washed, and available in three coastal neutrals.",
    status: "active",
    price: 128,
    currency: "USD",
    images: [
      "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=800&q=80",
    ],
    channels: ["shopify", "pinterest"],
    sku: "LIN-THR-SAND",
    category: "Home",
    syncedAt: now,
    createdAt: earlier,
    updatedAt: now,
    ownerId: DEMO_OWNER,
  },
  {
    id: "prod_trail_pack",
    title: "Summit Day Pack 22L",
    handle: "summit-day-pack-22l",
    description:
      "A lightweight 22L day pack with hydration sleeve, weather-resistant shell, and organizational pockets for urban trails and weekend hikes.",
    status: "active",
    price: 98,
    currency: "USD",
    images: [
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80",
    ],
    channels: ["shopify", "meta", "tiktok"],
    sku: "SUM-22-OLIVE",
    category: "Bags",
    syncedAt: now,
    createdAt: earlier,
    updatedAt: now,
    ownerId: DEMO_OWNER,
  },
  {
    id: "prod_ceramic_mug",
    title: "Kiln Ceramic Mug Set",
    handle: "kiln-ceramic-mug-set",
    description:
      "Hand-glazed stoneware mugs sold as a set of two. Thick-walled for heat retention with an ergonomic handle.",
    status: "active",
    price: 42,
    currency: "USD",
    images: [
      "https://images.unsplash.com/photo-1514228742587-6b1554078585?w=800&q=80",
    ],
    channels: ["shopify"],
    sku: "KILN-MUG-2",
    category: "Kitchen",
    syncedAt: now,
    createdAt: earlier,
    updatedAt: now,
    ownerId: DEMO_OWNER,
  },
  {
    id: "prod_desk_lamp",
    title: "Arc Task Lamp",
    handle: "arc-task-lamp",
    description:
      "Adjustable aluminum task lamp with warm/cool tunable LED and a weighted base for studio desks.",
    status: "draft",
    price: 159,
    currency: "USD",
    images: [
      "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&q=80",
    ],
    channels: ["shopify"],
    sku: "ARC-LAMP-01",
    category: "Lighting",
    syncedAt: now,
    createdAt: earlier,
    updatedAt: now,
    ownerId: DEMO_OWNER,
  },
];

export const seedIntelligence: ProductIntelligence[] = [
  {
    productId: "prod_aurora_bottle",
    positioning:
      "The everyday premium bottle for people who refuse lukewarm coffee and disposable plastic.",
    audience: "Urban professionals and outdoor-curious shoppers aged 25–40",
    valueProps: [
      "24-hour cold / 12-hour hot retention",
      "Leak-proof commute lid",
      "Matte finishes that hide wear",
    ],
    objections: ["Price vs big-box bottles", "Weight when full"],
    tone: "Confident, clean, quietly premium",
    updatedAt: now,
  },
  {
    productId: "prod_linen_throw",
    positioning:
      "Coastal calm for modern living rooms—linen that softens with every wash.",
    audience: "Home design enthusiasts shopping elevated basics",
    valueProps: ["Stonewashed softness", "Three coastal neutrals", "Year-round weight"],
    objections: ["Wrinkle expectation of linen", "Care instructions"],
    tone: "Warm, editorial, uncluttered",
    updatedAt: now,
  },
  {
    productId: "prod_trail_pack",
    positioning:
      "One pack for city-to-trail days—organized, light, weather-ready.",
    audience: "Weekend hikers and urban explorers",
    valueProps: ["22L sweet-spot capacity", "Hydration compatible", "Weather-resistant shell"],
    objections: ["Competition from heritage outdoor brands"],
    tone: "Practical, energetic, trustworthy",
    updatedAt: now,
  },
  {
    productId: "prod_ceramic_mug",
    positioning: "Mugs with kiln character—everyday ritual objects, not disposable ware.",
    audience: "Gift buyers and coffee ritualists",
    valueProps: ["Hand-glazed uniqueness", "Heat-retaining walls", "Gift-ready set of two"],
    objections: ["Fragility perception", "Dishwasher questions"],
    tone: "Craft-forward, intimate",
    updatedAt: now,
  },
  {
    productId: "prod_desk_lamp",
    positioning: "Precision light for focused work without visual clutter.",
    audience: "Remote workers and studio makers",
    valueProps: ["Tunable warm/cool LED", "Stable weighted base", "Minimal aluminum arc"],
    objections: ["Desk footprint", "Premium pricing"],
    tone: "Technical but human",
    updatedAt: now,
  },
];

export const seedCampaigns: Campaign[] = [
  {
    id: "camp_aurora_summer",
    productId: "prod_aurora_bottle",
    name: "Aurora Summer Commute",
    status: "active",
    channels: ["meta", "google"],
    objective: "Drive add-to-cart for insulated bottle during heat season",
    updatedAt: now,
  },
  {
    id: "camp_throw_refresh",
    productId: "prod_linen_throw",
    name: "Living Room Refresh",
    status: "draft",
    channels: ["pinterest", "meta"],
    objective: "Build consideration with lifestyle creative",
    updatedAt: now,
  },
  {
    id: "camp_pack_weekends",
    productId: "prod_trail_pack",
    name: "Weekend Trails",
    status: "active",
    channels: ["meta", "tiktok"],
    objective: "Prospect new outdoor audiences with short-form demo creatives",
    updatedAt: now,
  },
];

export const seedArtifacts: Artifact[] = [
  {
    id: "art_aurora_ad_01",
    productId: "prod_aurora_bottle",
    type: "ad_copy",
    status: "proposed",
    title: "Meta primary text — commute cool",
    summary: "Ad copy emphasizing leak-proof lid and all-day cold retention.",
    payload: {
      headline: "Still cold at 5pm",
      primaryText:
        "Aurora keeps your drink at temperature through meetings, trains, and late desks. Matte black. Leak-proof. Built to replace plastic.",
      cta: "Shop Aurora",
      channel: "meta",
    },
    createdBy: "agent",
    createdAt: now,
    updatedAt: now,
  },
];

export function buildPerformanceSeries(productId: string): PerformancePoint[] {
  const base =
    productId === "prod_aurora_bottle"
      ? 1.4
      : productId === "prod_trail_pack"
        ? 1.1
        : productId === "prod_linen_throw"
          ? 0.9
          : 0.6;

  const days = [
    "2026-07-01",
    "2026-07-02",
    "2026-07-03",
    "2026-07-04",
    "2026-07-05",
    "2026-07-06",
    "2026-07-07",
    "2026-07-08",
    "2026-07-09",
    "2026-07-10",
    "2026-07-11",
    "2026-07-12",
    "2026-07-13",
    "2026-07-14",
  ];

  return days.map((date, index) => {
    const wave = 1 + Math.sin(index / 2.2) * 0.25;
    const impressions = Math.round(4200 * base * wave);
    const clicks = Math.round(impressions * 0.028);
    const spend = Number((clicks * 1.15 * base).toFixed(2));
    const conversions = Math.round(clicks * 0.09);
    const revenue = Number((conversions * (48 * base)).toFixed(2));
    return { date, impressions, clicks, spend, conversions, revenue };
  });
}
