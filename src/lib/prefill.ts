// Claim Pre-fill Engine
// Given a detected benefit + transaction + user, produce the set of fields
// the bank portal claim form needs, already filled with available data.

import { BANK_PORTALS, BENEFIT_TYPES } from "./constants";
import type { ClaimFormField, PreFilledClaim } from "./types";

interface PrefillInput {
  benefitType: import("./types").BenefitType;
  bankName: string;
  cardName: string;
  cardLast4: string;
  transaction: {
    amount: number;
    merchant: string;
    date: Date;
    category: string;
  };
  user: {
    name?: string;
    email: string;
    phone?: string;
  };
  coverageAmount: number;
}

export function prefillClaim(input: PrefillInput): PreFilledClaim {
  const portal = BANK_PORTALS[input.bankName] ?? BANK_PORTALS["HDFC Bank"];
  const info = BENEFIT_TYPES[input.benefitType];
  const txnDate = input.transaction.date;
  const txnDateStr = txnDate.toISOString().slice(0, 10);

  const baseFields: ClaimFormField[] = [
    { key: "cardholder_name", label: "Cardholder Name", type: "text", value: input.user.name ?? "", required: true, placeholder: "As on card" },
    { key: "email", label: "Email", type: "email", value: input.user.email, required: true },
    { key: "mobile", label: "Mobile Number", type: "tel", value: input.user.phone ?? "", required: true, placeholder: "10-digit mobile" },
    { key: "card_last4", label: "Card Last 4 Digits", type: "text", value: input.cardLast4, required: true },
    { key: "card_name", label: "Card Variant", type: "text", value: input.cardName, required: true },
    { key: "merchant", label: "Merchant Name", type: "text", value: input.transaction.merchant, required: true },
    { key: "txn_date", label: "Transaction Date", type: "date", value: txnDateStr, required: true },
    { key: "txn_amount", label: "Transaction Amount (INR)", type: "number", value: String(input.transaction.amount), required: true },
    { key: "claim_amount", label: "Claim Amount (INR)", type: "number", value: String(input.coverageAmount), required: true },
  ];

  // Benefit-specific fields
  const benefitFields: ClaimFormField[] = [];
  switch (input.benefitType) {
    case "purchase_protection":
      benefitFields.push(
        { key: "incident_date", label: "Date of Damage/Theft", type: "date", value: txnDateStr, required: true },
        { key: "incident_desc", label: "Incident Description", type: "textarea", value: `Item purchased from ${input.transaction.merchant} on ${txnDateStr} for ₹${input.transaction.amount} was damaged/stolen within the 90-day cover window.`, required: true },
        { key: "item_category", label: "Item Category", type: "select", value: "Electronics", options: ["Electronics", "Appliances", "Jewellery", "Apparel", "Other"] },
      );
      break;
    case "return_protection":
      benefitFields.push(
        { key: "return_attempt_date", label: "Date Return Refused", type: "date", value: txnDateStr, required: true },
        { key: "return_reason", label: "Reason Merchant Refused", type: "textarea", value: `Merchant ${input.transaction.merchant} refused return within the eligible 90-day window.`, required: true },
      );
      break;
    case "travel_delay":
      benefitFields.push(
        { key: "flight_number", label: "Flight Number", type: "text", value: "", required: true, placeholder: "e.g. 6E-123" },
        { key: "delay_duration", label: "Delay Duration (hours)", type: "number", value: "4", required: true },
        { key: "incident_desc", label: "Delay Description", type: "textarea", value: `Flight booked via ${input.transaction.merchant} on ${txnDateStr} was delayed beyond 4 hours.`, required: true },
      );
      break;
    case "lost_baggage":
      benefitFields.push(
        { key: "flight_number", label: "Flight Number", type: "text", value: "", required: true, placeholder: "e.g. AI-456" },
        { key: "baggage_tag", label: "Baggage Tag Number", type: "text", value: "", required: true },
        { key: "incident_desc", label: "Loss Description", type: "textarea", value: `Checked-in baggage lost/delayed on flight ticketed via ${input.transaction.merchant} on ${txnDateStr}.`, required: true },
      );
      break;
    case "extended_warranty":
      benefitFields.push(
        { key: "product_name", label: "Product Name", type: "text", value: input.transaction.merchant, required: true },
        { key: "warranty_expiry", label: "Original Warranty Expiry", type: "date", value: new Date(txnDate.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), required: true },
        { key: "fault_desc", label: "Fault Description", type: "textarea", value: `Product purchased on ${txnDateStr} developed a fault after the manufacturer warranty expired.`, required: true },
      );
      break;
    case "air_accident":
      benefitFields.push(
        { key: "flight_number", label: "Flight Number", type: "text", value: "", required: true },
        { key: "incident_date", label: "Date of Incident", type: "date", value: txnDateStr, required: true },
        { key: "incident_desc", label: "Incident Description", type: "textarea", value: "", required: true },
      );
      break;
  }

  // Documents always needed: invoice + id proof + supporting
  void info;

  return {
    benefitType: input.benefitType,
    bankName: input.bankName,
    portalUrl: portal.url,
    fields: [...baseFields, ...benefitFields],
    documents: [
      { filename: "invoice.jpg", fileType: "image" },
      { filename: "id-proof.pdf", fileType: "pdf" },
      { filename: "statement.txt", fileType: "text" },
    ],
  };
}
