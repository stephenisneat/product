import type { Metadata } from "next";
import { MarketingTermsPage } from "@/features/marketing/marketing-terms";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms governing use of Product Agent, the AI marketing workspace for commerce teams.",
};

export default function TermsPage() {
  return <MarketingTermsPage />;
}
