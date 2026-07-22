import Link from "next/link";
import {
  LegalList,
  LegalSection,
  MarketingLegalPage,
} from "@/features/marketing/marketing-legal";

const EFFECTIVE_DATE = "July 20, 2026";

export function MarketingTermsPage() {
  return (
    <MarketingLegalPage
      eyebrow="Legal"
      title="Terms of Service"
      effectiveDate={EFFECTIVE_DATE}
    >
      <LegalSection title="Agreement">
        <p>
          These Terms of Service (“Terms”) govern access to and use of Product
          Agent (“Product Agent,” “we,” “us,” or “our”), the AI marketing
          workspace available at{" "}
          <a
            href="https://product.ag"
            className="text-foreground underline-offset-4 hover:underline"
          >
            product.ag
          </a>{" "}
          and related applications, APIs, and optional plugins (collectively, the
          “Service”).
        </p>
        <p>
          By creating an account, accessing, or using the Service, you agree to
          these Terms and our{" "}
          <Link
            href="/privacy"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Privacy Policy
          </Link>
          . If you are using the Service on behalf of an organization, you
          represent that you have authority to bind that organization.
        </p>
      </LegalSection>

      <LegalSection title="The Service">
        <p>
          Product Agent helps commerce teams import product catalogs, manage
          product intelligence, run an AI agent, create marketing campaigns and
          creatives, track goals and insights, connect storefronts and ad
          accounts, and meter AI usage through workspace plans and wallets.
        </p>
        <p>
          Features may vary by plan and by whether optional integrations (AI
          providers, payments, email, commerce connectors, media generation, or
          the Product Plugin) are configured for your environment.
        </p>
      </LegalSection>

      <LegalSection title="Accounts and workspaces">
        <LegalList
          items={[
            "You must provide accurate account information and keep credentials secure.",
            "You are responsible for activity under your account, including actions by workspace members you invite.",
            "Workspaces may have roles (such as owner, admin, or member) and optional MFA requirements set by workspace administrators.",
            "You must be old enough to form a binding contract and use the Service only for lawful business purposes.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Your content and connected data">
        <p>
          You retain ownership of content you submit to the Service (“Customer
          Content”), including product data, creatives, briefs, goals, and
          materials imported from connected platforms.
        </p>
        <p>
          You grant us a worldwide, non-exclusive license to host, process,
          transmit, display, and otherwise use Customer Content solely to provide
          and improve the Service as you direct — including sending content to AI
          and media providers when you use those features, and syncing with
          third-party platforms you connect.
        </p>
        <p>
          You represent that you have the rights needed to submit Customer Content
          and to authorize connections to third-party accounts, and that doing so
          does not violate law or third-party terms.
        </p>
      </LegalSection>

      <LegalSection title="AI features">
        <LegalList
          items={[
            "AI outputs may be inaccurate, incomplete, or unsuitable. You are responsible for reviewing outputs before publishing or relying on them.",
            "Chat messages and related context are processed to generate responses and may trigger workspace actions (such as creating insights, campaigns, creatives, or goals) based on your requests.",
            "Conversation history is primarily stored in your browser; messages are still processed by our servers when sent.",
            "AI usage may consume included plan allotments and/or wallet balance according to your workspace plan and metering rules.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Plans, billing, and wallet">
        <LegalList
          items={[
            "Paid plans are billed per seat on the intervals we offer (for example monthly or annual). Free plans may include limited AI usage.",
            "Wallet balances and included usage are used to meter AI and related billable activity. Unused included usage may roll over subject to plan limits.",
            "Payments are processed by Stripe. Taxes may apply where required.",
            "Fees are generally non-refundable except where required by law or expressly stated otherwise.",
            "We may change pricing or plan entitlements with notice; changes apply going forward.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Integrations and third-party services">
        <p>
          The Service may interoperate with third parties such as Supabase,
          Stripe, Resend, AI model providers, Trigger.dev, ElevenLabs, Runway,
          commerce platforms, and Google Ads. Your use of those services may be
          subject to their own terms and privacy policies. We are not responsible
          for third-party services you choose to connect or enable.
        </p>
      </LegalSection>

      <LegalSection title="Product Plugin">
        <p>
          If you install the optional Product Plugin on a merchant website, you
          are responsible for providing any required notices and obtaining any
          required consents from end users of that site, and for configuring
          tags and consent categories appropriately.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>You agree not to:</p>
        <LegalList
          items={[
            "Use the Service for unlawful, harmful, deceptive, or abusive purposes.",
            "Attempt to gain unauthorized access to the Service, other accounts, or underlying systems.",
            "Interfere with or disrupt the Service, including by overloading, scraping in a way that harms the Service, or circumventing rate limits or security controls.",
            "Upload malware or content you do not have rights to use.",
            "Use the Service to generate or distribute content that infringes others’ rights or violates applicable advertising or consumer laws.",
            "Resell or provide the Service to third parties except as expressly permitted.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Intellectual property">
        <p>
          Product Agent, including its software, design, branding, and
          documentation, is owned by us and our licensors. These Terms do not
          transfer any ownership of our intellectual property to you, other than
          the limited right to use the Service as permitted.
        </p>
      </LegalSection>

      <LegalSection title="Confidentiality">
        <p>
          You should not submit secrets you do not intend to store in the Service.
          Connection credentials you provide are used to operate integrations and
          are protected with safeguards described in our Privacy Policy, but you
          remain responsible for managing access within your organization.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimer of warranties">
        <p>
          THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM
          EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR
          IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
          AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE OR AI OUTPUTS
          WILL BE UNINTERRUPTED, ERROR-FREE, OR MEET YOUR REQUIREMENTS.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE AND OUR SUPPLIERS WILL NOT
          BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
          DAMAGES, OR FOR LOST PROFITS, REVENUE, DATA, OR GOODWILL, ARISING FROM
          YOUR USE OF THE SERVICE.
        </p>
        <p>
          OUR TOTAL LIABILITY FOR CLAIMS ARISING OUT OF OR RELATING TO THE SERVICE
          WILL NOT EXCEED THE AMOUNTS YOU PAID TO US FOR THE SERVICE IN THE
          TWELVE (12) MONTHS BEFORE THE CLAIM, OR ONE HUNDRED U.S. DOLLARS
          (US$100) IF YOU HAVE NOT PAID ANY AMOUNTS.
        </p>
      </LegalSection>

      <LegalSection title="Indemnity">
        <p>
          You will defend and indemnify us against claims arising from your
          Customer Content, your use of the Service, your connected third-party
          accounts, or your violation of these Terms or applicable law.
        </p>
      </LegalSection>

      <LegalSection title="Suspension and termination">
        <p>
          You may stop using the Service at any time. We may suspend or terminate
          access if you violate these Terms, if required for security or legal
          reasons, or if your account remains inactive. Upon termination,
          provisions that by nature should survive (including ownership,
          disclaimers, limitations, and indemnity) will survive.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          We may update these Terms from time to time. We will revise the
          effective date above and may provide additional notice in the Service.
          Continued use after changes become effective constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>
          These Terms are governed by the laws of the United States and the State
          of California, excluding conflict-of-law rules, unless mandatory local
          law provides otherwise. Courts in California will have exclusive
          jurisdiction over disputes, subject to applicable consumer protections.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these Terms: reach us through{" "}
          <a
            href="https://product.ag"
            className="text-foreground underline-offset-4 hover:underline"
          >
            product.ag
          </a>
          .
        </p>
        <p>
          See also our{" "}
          <Link
            href="/privacy"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>
    </MarketingLegalPage>
  );
}
