import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pathfinder',
    short_name: 'Pathfinder',
    description: 'The family budget that builds itself.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F5F4F0',
    theme_color: '#F5F4F0',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
