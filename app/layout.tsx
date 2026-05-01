import type { Metadata } from 'next'
import { Young_Serif, Instrument_Sans } from 'next/font/google'
import './globals.css'

const youngSerif = Young_Serif({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})

const instrumentSans = Instrument_Sans({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Premia — Deal intelligence for deal professionals',
  description: "Type a sector and geography. Premia tells you if you're early, on time, or late.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${youngSerif.variable} ${instrumentSans.variable}`}>
      <body>{children}</body>
    </html>
  )
}
