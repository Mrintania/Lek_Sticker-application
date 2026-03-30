import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/layout/Sidebar'

export const metadata: Metadata = {
  title: 'ระบบบริหารจัดการ | เล็กสติ๊กเกอร์',
  description: 'ระบบบริหารจัดการพนักงานสำหรับร้านเล็กสติ๊กเกอร์',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          {/* pt-14 = mobile top bar height; lg:pt-0 = no top bar on desktop */}
          <main className="flex-1 overflow-auto min-w-0 pt-14 lg:pt-0">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
