import Link from "next/link";
import {
  LegalList,
  LegalSection,
  MarketingLegalPage,
} from "@/features/marketing/marketing-legal";

const EFFECTIVE_DATE = "July 20, 2026";

export function MarketingPrivacyPage() {
  return (
    <MarketingLegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      effectiveDate={EFFECTIVE_DATE}
    >
      <LegalSection title="Overview">
        <p>
          Product Agent (“Product Agent,” “we,” “us,” or “our”) is an AI marketing
          workspace for commerce teams, available at{" "}
          <a
            href="https://product.ag"
            className="text-foreground underline-offset-4 hover:underline"
          >
            product.ag
          </a>
          . This Privacy Policy explains what information we collect when you use
          the Service, how we use it, and the choices you have.
        </p>
        <p>
          By using the Service, you agree to this Privacy Policy. If you do not
          agree, please do not use the Service.
        </p>
      </LegalSection>

      <LegalSection title="Information we collect">
        <p className="font-medium text-foreground">Account and profile</p>
        <LegalList
          items={[
            "Email address, password (if you sign up with email), and display name.",
            "Profile details you provide, such as avatar images.",
            "If you sign in with Google, identity information Google provides through our authentication provider (typically email and profile basics).",
            "Notification preferences, including whether you opt in to product and marketing emails.",
          ]}
        />

        <p className="mt-6 font-medium text-foreground">Workspace and product data</p>
        <LegalList
          items={[
            "Workspace settings (name, plan, membership roles, security settings such as MFA requirements).",
            "Product catalog data you create or import (titles, descriptions, prices, images, SKUs, variants, inventory, collections, and related marketing intelligence).",
            "Campaigns, creatives, goals, insights, jobs, and other content you generate or store in a workspace.",
            "Workspace invites (invitee email, role, and invite metadata).",
          ]}
        />

        <p className="mt-6 font-medium text-foreground">Authentication and security</p>
        <LegalList
          items={[
            "Session information needed to keep you signed in.",
            "Optional multi-factor authentication (TOTP) factors you enroll.",
            "Session audit events such as login and revoke actions, which may include IP address and user agent.",
          ]}
        />

        <p className="mt-6 font-medium text-foreground">Billing and wallet</p>
        <LegalList
          items={[
            "Workspace billing plan, seat counts, and wallet balances.",
            "Payment and subscription records processed by Stripe (for example customer identifiers, payment method references, and transaction history). We do not store full card numbers on our servers.",
          ]}
        />

        <p className="mt-6 font-medium text-foreground">Connected services</p>
        <LegalList
          items={[
            "OAuth tokens and account identifiers when you connect commerce platforms (such as Shopify, WooCommerce, BigCommerce, Amazon, or Squarespace) or advertising accounts (such as Google Ads), so we can import catalogs and manage connected marketing activity on your behalf.",
            "Product and account data retrieved from those connections.",
          ]}
        />

        <p className="mt-6 font-medium text-foreground">AI chat and agent usage</p>
        <LegalList
          items={[
            "Messages and product/workspace context you send to the agent are processed by our servers to generate responses and take actions you request.",
            "Conversation history is stored in your browser (local storage) on your device, not as a durable server-side chat archive. Messages are still transmitted to us (and, when AI is enabled, to model providers) when you send them.",
            "Model preference and similar UI state may also be stored locally in your browser.",
          ]}
        />

        <p className="mt-6 font-medium text-foreground">
          Merchant measurement (Product Plugin)
        </p>
        <p>
          If you install our optional Product Plugin on a merchant site, the plugin
          may collect measurement events from that site (for example event type,
          page URL, referrer, user agent, IP address, session or visitor
          identifiers, and related event payload data), subject to the tags and
          consent settings you configure.
        </p>

        <p className="mt-6 font-medium text-foreground">
          Information we do not collect by default
        </p>
        <p>
          The Product Agent web app does not currently embed third-party product
          analytics trackers (such as advertising pixels or general website
          analytics suites) for our own marketing site usage.
        </p>
      </LegalSection>

      <LegalSection title="How we use information">
        <LegalList
          items={[
            "Provide, operate, and secure the Service (accounts, workspaces, catalogs, creatives, billing, and support).",
            "Authenticate users, enforce workspace access controls, and operate optional MFA.",
            "Process payments, subscriptions, and AI usage metering.",
            "Send transactional messages (for example authentication emails and workspace invites).",
            "Send optional product or marketing communications when you have opted in.",
            "Import and sync catalogs or advertising data from services you connect.",
            "Generate AI outputs (chat replies, creatives, media, and related job results) from the content and context you provide.",
            "Improve reliability, prevent abuse, and comply with law.",
          ]}
        />
      </LegalSection>

      <LegalSection title="AI processing">
        <p>
          When AI features are enabled, prompts and related content (including chat
          messages, product details, creative briefs, and similar workspace
          context) may be sent to our AI gateway and underlying model or media
          providers to produce responses, images, audio, or video. Usage may be
          attributed to your workspace for billing.
        </p>
        <p>
          If AI gateway credentials are not configured in an environment, the
          Service may fall back to limited offline/deterministic behavior that
          does not call external models.
        </p>
      </LegalSection>

      <LegalSection title="Cookies and similar technologies">
        <LegalList
          items={[
            "Authentication cookies managed by our auth provider to maintain your session.",
            "An active-workspace cookie so we can remember which workspace you are using.",
            "Short-lived cookies used during OAuth connection flows (for CSRF/state protection).",
            "Local storage for agent conversations, UI preferences, and similar client-side state.",
          ]}
        />
        <p>
          These technologies are primarily required for the Service to function.
          You can clear local storage and cookies in your browser, which may sign
          you out or remove locally stored chat history.
        </p>
      </LegalSection>

      <LegalSection title="How we share information">
        <p>
          We share information with service providers that help us operate Product
          Agent, including:
        </p>
        <LegalList
          items={[
            <>
              <span className="text-foreground">Supabase</span> — authentication,
              database, and file storage.
            </>,
            <>
              <span className="text-foreground">Stripe</span> — payments,
              subscriptions, and wallet top-ups.
            </>,
            <>
              <span className="text-foreground">Resend</span> — workspace invite
              emails (when configured).
            </>,
            <>
              <span className="text-foreground">Vercel AI Gateway</span> and
              underlying model providers — AI chat and creative generation.
            </>,
            <>
              <span className="text-foreground">Media providers</span> such as
              ElevenLabs and Runway — text-to-speech and video generation for
              creatives, when those features are used.
            </>,
            <>
              <span className="text-foreground">Background job infrastructure</span>{" "}
              (for example Trigger.dev) — asynchronous campaign, creative, and
              related jobs.
            </>,
            <>
              <span className="text-foreground">Commerce and ads platforms</span>{" "}
              you choose to connect — to import data and perform requested
              actions.
            </>,
            <>
              <span className="text-foreground">Google</span> — if you use Google
              sign-in or Google Ads connections.
            </>,
          ]}
        />
        <p>
          We may also disclose information if required by law, to protect rights
          and safety, or in connection with a merger, acquisition, or asset
          transfer.
        </p>
        <p>
          We do not sell your personal information.
        </p>
      </LegalSection>

      <LegalSection title="Storage and retention">
        <LegalList
          items={[
            "Account, workspace, product, billing, and connection data are retained while your account or workspace is active and as needed to operate the Service.",
            "Uploaded assets (product images, avatars, creative media) are stored in our storage provider and may be accessible via public URLs depending on bucket configuration.",
            "Agent chat history retained in your browser remains until you clear it or clear site data.",
            "Plugin measurement events, if collected, are retained as needed for the measurement features you enable.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Security">
        <p>
          We use industry-standard safeguards appropriate to our Service,
          including encrypted transport, access controls (including row-level
          security in our database), and encryption of certain third-party
          connection secrets at rest. No method of transmission or storage is
          completely secure.
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <LegalList
          items={[
            "Update profile, notification, and security settings in the app.",
            "Disconnect commerce or ads integrations from workspace settings.",
            "Clear browser local storage to remove locally stored conversations.",
            "Request account or data deletion by contacting us (see below).",
            "For Product Plugin installs, configure consent categories and use available opt-out controls on merchant sites.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Children">
        <p>
          The Service is intended for business use and is not directed to children
          under 16. We do not knowingly collect personal information from
          children.
        </p>
      </LegalSection>

      <LegalSection title="International users">
        <p>
          We may process and store information in the United States and other
          countries where we or our processors operate. If you access the Service
          from outside those locations, you understand that information may be
          transferred to and processed in those countries.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          We may update this Privacy Policy from time to time. We will change the
          effective date above and, when appropriate, provide additional notice in
          the Service. Continued use after an update means you accept the revised
          policy.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about privacy or this policy: reach us through{" "}
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
            href="/terms"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Terms of Service
          </Link>
          .
        </p>
      </LegalSection>
    </MarketingLegalPage>
  );
}
