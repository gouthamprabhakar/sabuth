import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Sabuth · Prabhakar Law Group',description:'Your court diary, case register, and next dates in one private workspace.',icons:{icon:'/favicon.svg',apple:'/icon-192.png'},manifest:'/manifest.webmanifest',appleWebApp:{capable:true,statusBarStyle:'default',title:'Sabuth'}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#f7f8fa'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
