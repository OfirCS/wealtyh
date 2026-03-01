'use client';

import dynamic from 'next/dynamic';

const HomeClient = dynamic(() => import('@/components/app/HomeClient'), {
  ssr: false,
});

export default function Page() {
  return <HomeClient />;
}
