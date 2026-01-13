import "./globals.css";
import { Manrope } from "next/font/google";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
});

export const metadata = {
  title: "CoopBuy Diploma",
  description: "ИС для организации совместных закупок в удалённых населённых пунктах",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru" className={manrope.variable}>
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
        {children}
      </body>
    </html>
  );
}
