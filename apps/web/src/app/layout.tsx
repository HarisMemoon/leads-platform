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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700&family=Manrope:wght@500;600;700;800&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
