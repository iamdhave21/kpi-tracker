'use client'
import dynamic from 'next/dynamic'
const KPIApp = dynamic(() => import('@/components/KPIApp'), { ssr: false })
export default function Page() { return <KPIApp /> }
