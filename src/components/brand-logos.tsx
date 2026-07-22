import type { SVGProps } from "react";
import Bigcommerce from "@thesvg/react/bigcommerce";
import Shopify from "@thesvg/react/shopify";
import Squarespace from "@thesvg/react/squarespace";
import Woocommerce from "@thesvg/react/woocommerce";

type BrandLogoProps = SVGProps<SVGSVGElement>;

/** https://thesvg.org/icon/shopify */
export function ShopifyLogo({ className, ...props }: BrandLogoProps) {
  return (
    <Shopify variant="mono" aria-hidden="true" className={className} {...props} />
  );
}

/** https://thesvg.org/icon/woocommerce */
export function WooCommerceLogo({ className, ...props }: BrandLogoProps) {
  return (
    <Woocommerce
      variant="mono"
      aria-hidden="true"
      className={className}
      {...props}
    />
  );
}

/** https://thesvg.org/icon/bigcommerce */
export function BigCommerceLogo({ className, ...props }: BrandLogoProps) {
  return (
    <Bigcommerce
      variant="mono"
      aria-hidden="true"
      className={className}
      {...props}
    />
  );
}

/**
 * Smile mark from https://thesvg.org/icon/amazon.
 * Upstream ships a wordmark with a broken 24×24 viewBox; crop to the smile
 * so it remains legible in the onboarding icon slot.
 */
export function AmazonLogo({ className, ...props }: BrandLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="80 115 330 70"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path
        fill="#FF9900"
        d="M374.006 142.184c-35 25.797-85.729 39.561-129.406 39.561-61.242 0-116.376-22.651-158.087-60.325-3.278-2.962-.341-7 3.591-4.693 45.015 26.191 100.673 41.947 158.166 41.947 38.775 0 81.43-8.022 120.65-24.67 5.925-2.516 10.88 3.88 5.086 8.18"
      />
      <path
        fill="#FF9900"
        d="M388.557 125.536c-4.457-5.715-29.573-2.7-40.846-1.363-3.434.42-3.959-2.57-.865-4.719 20.003-14.078 52.827-10.015 56.654-5.296 3.828 4.745-.996 37.648-19.793 53.352-2.884 2.411-5.637 1.127-4.352-2.072 4.22-10.539 13.685-34.16 9.202-39.902"
      />
    </svg>
  );
}

/** https://thesvg.org/icon/squarespace */
export function SquarespaceLogo({ className, ...props }: BrandLogoProps) {
  return (
    <Squarespace
      variant="mono"
      aria-hidden="true"
      className={className}
      {...props}
    />
  );
}
