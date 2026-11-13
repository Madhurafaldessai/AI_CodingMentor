import './globals.css';
import './landing-refresh.css';
import type { Metadata, Viewport } from 'next';
export const metadata: Metadata = { title: 'ByteBloom — Grow your code', description: 'An adaptive coding mentor that lives inside your editor.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><head><script dangerouslySetInnerHTML={{__html:"(function(){try{var t=localStorage.getItem('bb-theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()"}} /></head><body>{children}</body></html>; }
