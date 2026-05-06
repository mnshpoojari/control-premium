import type { Metadata } from 'next'
import { Young_Serif, Instrument_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const youngSerif = Young_Serif({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'block',
})

const instrumentSans = Instrument_Sans({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Premia — Deal intelligence for deal professionals',
  description: "Type a sector and geography. Premia tells you if you're early, on time, or late.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${youngSerif.variable} ${instrumentSans.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
