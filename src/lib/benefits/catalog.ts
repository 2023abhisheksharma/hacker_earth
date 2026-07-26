// Catalog of Indian bank credit/debit cards and the insurance/protection
// benefits bundled with them. This is the "entitlement" knowledge base the
// engine matches transactions against.

export interface CatalogBenefit {
  type: import("../types").BenefitType;
  title: string;
  description: string;
  coverageLimit: number; // INR
  windowDays: number;
  conditions: {
    mcc?: string[]; // restrict to these MCC groups
    minAmount?: number; // INR
    categories?: import("../types").TxnCategory[];
    channels?: string[]; // online | in-store
    keywords?: string[]; // merchant keyword hints
  };
}

export interface CatalogCard {
  bankName: string;
  cardName: string;
  cardType: "credit" | "debit";
  network: import("../types").CardNetwork;
  benefits: CatalogBenefit[];
}

export const CARD_CATALOG: CatalogCard[] = [
  {
    bankName: "HDFC Bank",
    cardName: "Infinia Credit Card",
    cardType: "credit",
    network: "Visa",
    benefits: [
      {
        type: "purchase_protection",
        title: "Purchase Protection",
        description: "Covers damage/theft of items bought on the card within 90 days.",
        coverageLimit: 50000,
        windowDays: 90,
        conditions: { minAmount: 5000, categories: ["electronics", "shopping"] },
      },
      {
        type: "return_protection",
        title: "Return Protection",
        description: "Refund if a merchant refuses return within 90 days of purchase.",
        coverageLimit: 25000,
        windowDays: 90,
        conditions: { minAmount: 2000, categories: ["electronics", "shopping"] },
      },
      {
        type: "travel_delay",
        title: "Travel Delay Cover",
        description: "INR 1,500 for every 4 hours of flight delay on ticketed flights.",
        coverageLimit: 15000,
        windowDays: 21,
        conditions: { categories: ["travel"], minAmount: 3000 },
      },
      {
        type: "lost_baggage",
        title: "Lost Baggage Insurance",
        description: "Up to INR 50,000 for checked-in baggage lost by the airline.",
        coverageLimit: 50000,
        windowDays: 21,
        conditions: { categories: ["travel"], minAmount: 3000 },
      },
      {
        type: "extended_warranty",
        title: "Extended Warranty",
        description: "Doubles manufacturer warranty up to 1 extra year on electronics.",
        coverageLimit: 75000,
        windowDays: 60,
        conditions: { categories: ["electronics"], minAmount: 5000 },
      },
    ],
  },
  {
    bankName: "ICICI Bank",
    cardName: "Amazon Pay Credit Card",
    cardType: "credit",
    network: "Visa",
    benefits: [
      {
        type: "purchase_protection",
        title: "Purchase Protection",
        description: "Damage or theft cover on Amazon purchases within 90 days.",
        coverageLimit: 30000,
        windowDays: 90,
        conditions: { minAmount: 3000, categories: ["shopping", "electronics"], keywords: ["amazon"] },
      },
      {
        type: "return_protection",
        title: "Return Protection",
        description: "Refund for items merchants refuse to take back.",
        coverageLimit: 15000,
        windowDays: 90,
        conditions: { minAmount: 1500, categories: ["shopping"] },
      },
      {
        type: "extended_warranty",
        title: "Extended Warranty",
        description: "Extra 1 year warranty on eligible electronics.",
        coverageLimit: 40000,
        windowDays: 60,
        conditions: { categories: ["electronics"], minAmount: 3000 },
      },
    ],
  },
  {
    bankName: "Axis Bank",
    cardName: "Magnus Credit Card",
    cardType: "credit",
    network: "Mastercard",
    benefits: [
      {
        type: "purchase_protection",
        title: "Purchase Protection",
        description: "Covers accidental damage or theft within 90 days.",
        coverageLimit: 75000,
        windowDays: 90,
        conditions: { minAmount: 5000, categories: ["electronics", "shopping"] },
      },
      {
        type: "travel_delay",
        title: "Travel Delay Insurance",
        description: "INR 2,000 per 4-hour delay on flights paid with the card.",
        coverageLimit: 20000,
        windowDays: 21,
        conditions: { categories: ["travel"], minAmount: 5000 },
      },
      {
        type: "lost_baggage",
        title: "Lost Baggage Cover",
        description: "Up to INR 75,000 for lost checked-in baggage.",
        coverageLimit: 75000,
        windowDays: 21,
        conditions: { categories: ["travel"], minAmount: 5000 },
      },
      {
        type: "air_accident",
        title: "Air Accident Insurance",
        description: "INR 1 Crore air accident cover on ticketed flights.",
        coverageLimit: 10000000,
        windowDays: 30,
        conditions: { categories: ["travel"], minAmount: 5000 },
      },
      {
        type: "extended_warranty",
        title: "Extended Warranty",
        description: "Extended manufacturer warranty up to 1 additional year.",
        coverageLimit: 100000,
        windowDays: 60,
        conditions: { categories: ["electronics"], minAmount: 5000 },
      },
    ],
  },
  {
    bankName: "SBI Card",
    cardName: "Elite Credit Card",
    cardType: "credit",
    network: "Visa",
    benefits: [
      {
        type: "purchase_protection",
        title: "Purchase Protection",
        description: "Damage/theft cover on purchases within 90 days.",
        coverageLimit: 40000,
        windowDays: 90,
        conditions: { minAmount: 4000, categories: ["electronics", "shopping"] },
      },
      {
        type: "return_protection",
        title: "Return Protection",
        description: "Refund when merchant declines return within 90 days.",
        coverageLimit: 20000,
        windowDays: 90,
        conditions: { minAmount: 2000, categories: ["shopping"] },
      },
      {
        type: "travel_delay",
        title: "Travel Delay Cover",
        description: "INR 1,000 per 4 hours of delay.",
        coverageLimit: 10000,
        windowDays: 21,
        conditions: { categories: ["travel"], minAmount: 2500 },
      },
      {
        type: "lost_baggage",
        title: "Lost Baggage Cover",
        description: "Up to INR 40,000 for lost checked-in baggage.",
        coverageLimit: 40000,
        windowDays: 21,
        conditions: { categories: ["travel"], minAmount: 2500 },
      },
    ],
  },
  {
    bankName: "Kotak Mahindra",
    cardName: "Zen Credit Card",
    cardType: "credit",
    network: "Visa",
    benefits: [
      {
        type: "purchase_protection",
        title: "Purchase Protection",
        description: "Damage/theft cover within 90 days.",
        coverageLimit: 35000,
        windowDays: 90,
        conditions: { minAmount: 3000, categories: ["electronics", "shopping"] },
      },
      {
        type: "return_protection",
        title: "Return Protection",
        description: "Refund on refused returns within 90 days.",
        coverageLimit: 15000,
        windowDays: 90,
        conditions: { minAmount: 1500, categories: ["shopping"] },
      },
      {
        type: "travel_delay",
        title: "Travel Delay Insurance",
        description: "INR 1,200 per 4 hours delay.",
        coverageLimit: 12000,
        windowDays: 21,
        conditions: { categories: ["travel"], minAmount: 3000 },
      },
    ],
  },
];

export function findCatalogCard(bankName: string, cardName: string): CatalogCard | undefined {
  return CARD_CATALOG.find(
    (c) => c.bankName === bankName && c.cardName === cardName
  );
}

export function allCatalogBenefits(): { card: CatalogCard; benefit: CatalogBenefit }[] {
  const out: { card: CatalogCard; benefit: CatalogBenefit }[] = [];
  for (const card of CARD_CATALOG) {
    for (const benefit of card.benefits) {
      out.push({ card, benefit });
    }
  }
  return out;
}
