import type { Metadata } from "next";
import QueryProvider from "@/providers/QueryProvider";
import "./globals.css";
import "./scrollbar.css";

export const metadata: Metadata = {
  title: {
    default: "Neewly",
    template: "%s · Neewly",
  },
  description:
    "Buy better leads, fund your wallet, and automate distribution — all in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
