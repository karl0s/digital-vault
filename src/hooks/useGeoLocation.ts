import { useState, useEffect } from 'react';

interface GeoLocation {
  city: string | null;
  countryName: string | null;
  region: string | null;
}

const CACHE_KEY = 'vault_geo';

export function useGeoLocation(): GeoLocation | null {
  const [geo, setGeo] = useState<GeoLocation | null>(null);

  useEffect(() => {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      setGeo(JSON.parse(cached));
      return;
    }

    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(data => {
        const result: GeoLocation = {
          city: data.city || null,
          countryName: data.country_name || null,
          region: data.region || null,
        };
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(result));
        setGeo(result);
      })
      .catch(() => {});
  }, []);

  return geo;
}
