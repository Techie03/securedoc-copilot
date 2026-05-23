'use client';

import { useEffect, useState } from 'react';

export type DevicePlatform = 'ios' | 'android' | 'desktop';

export function useDevicePlatform() {
  const [platform, setPlatform] = useState<DevicePlatform>('desktop');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios');
    } else if (/android/.test(ua)) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }
  }, []);

  return platform;
}
