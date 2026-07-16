import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Product Agent",
    template: "%s · Product Agent",
  },
  description:
    "Import your products. Product Agent creates, manages, and improves their marketing everywhere.",
  metadataBase: new URL("https://product.ag"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-black font-sans text-foreground">
        <TooltipProvider>
          {children}
          <Toaster richColors closeButton position="bottom-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
