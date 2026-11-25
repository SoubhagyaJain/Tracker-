import type { Metadata } from 'next';
import '@fontsource-variable/geist';
import '@xyflow/react/dist/style.css';
import './globals.css';
import { CareerShell } from '@/components/shell';

export const metadata:Metadata={title:'AI Career OS — 2027',description:'A personal, local-first career workspace for the 2027 Applied AI roadmap.'};
export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body><CareerShell>{children}</CareerShell></body></html>;
}
