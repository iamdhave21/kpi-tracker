import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co https://*.supabase.io; connect-src 'self' https://*.supabase.co https://*.supabase.io wss://*.supabase.co; img-src 'self' data: blob:;"
          }
        ]
      }
    ]
  }
};

export default nextConfig;
