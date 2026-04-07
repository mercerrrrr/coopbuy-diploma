import "./globals.css";
import localFont from "next/font/local";

const manrope = localFont({
  src: [
    {
      path: "./fonts/DejaVuSans.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/DejaVuSans-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata = {
  title: "CoopBuy",
  description: "ИС для организации совместных закупок в удалённых населённых пунктах",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru" className={manrope.variable}>
      <body className="min-h-[100dvh] bg-[color:var(--cb-bg)] text-[color:var(--cb-text)] antialiased font-(family-name:--font-manrope)">
        {children}
      </body>
    </html>
  );
}
