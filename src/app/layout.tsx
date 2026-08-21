import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Next",
  description: "Turn scattered thoughts into your next step.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
