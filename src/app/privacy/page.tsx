import type { Metadata } from "next";
import { MarketingPrivacyPage } from "@/features/marketing/marketing-privacy";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Product Agent collects, uses, and shares information when you use the Service.",
};

export default function PrivacyPage() {
  return <MarketingPrivacyPage />;
}
