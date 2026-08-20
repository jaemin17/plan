import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "计划",
  description: "一个用于逐步建立个人计划流程的网站。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
