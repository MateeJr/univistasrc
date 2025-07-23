/**
 * Utility functions for getting street names from coordinates using Mapbox Geocoding API
 */

/**
 * Get street name from coordinates using Mapbox reverse geocoding
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Promise<string> - Street name or fallback message
 */
export const getStreetName = async (lat: number, lng: number): Promise<string> => {
  try {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      return "Token Mapbox tidak tersedia";
    }

    // Using Mapbox Geocoding v5 API for better compatibility
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=address,street&limit=1&access_token=${token}`
    );

    if (!response.ok) {
      // Try fallback to OpenStreetMap Nominatim free service
      return await fetchFromNominatim(lat,lng);
    }

    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      // For v5, place_name often already contains street + city etc. We'll shorten to first comma segment.
      let placeName: string = feature.place_name || '';
      if (placeName.includes(',')) {
        placeName = placeName.split(',')[0]; // only street portion
      }
      return placeName || 'Alamat tidak diketahui';
    }
    // Try fallback to Nominatim
    return await fetchFromNominatim(lat,lng);
  } catch (error) {
    console.error('Error fetching street name:', error);
    return await fetchFromNominatim(lat,lng,true);
  }
};

/**
 * Cache for street names to avoid repeated API calls
 */
const streetNameCache = new Map<string, string>();

/**
 * Get street name with caching to reduce API calls
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Promise<string> - Street name or fallback message
 */
// Helper: fetch from Nominatim
const fetchFromNominatim = async (lat:number,lng:number, silent=false): Promise<string> => {
  try{
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'UnivistaApp/1.0 (contact@example.com)' }} as any);
    if(!res.ok) return 'Alamat tidak ditemukan';
    const data = await res.json();
    const road = data.address?.road || data.name || data.display_name || 'Alamat tidak diketahui';
    return road;
  }catch(err){
    if(!silent) console.error('Nominatim fallback failed', err);
    return 'Alamat tidak ditemukan';
  }
};

export const getCachedStreetName = async (lat: number, lng: number): Promise<string> => {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  
  if (streetNameCache.has(key)) {
    return streetNameCache.get(key)!;
  }
  
  const streetName = await getStreetName(lat, lng);
  streetNameCache.set(key, streetName);
  
  return streetName;
};
