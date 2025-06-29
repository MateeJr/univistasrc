/**
 * Calculate the bearing (direction) between two geographic coordinates
 * @param lat1 Latitude of the first point
 * @param lng1 Longitude of the first point  
 * @param lat2 Latitude of the second point
 * @param lng2 Longitude of the second point
 * @returns Bearing in degrees (0-360, where 0 is north)
 */
export function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;

  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  
  // Normalize to 0-360 degrees
  bearing = (bearing + 360) % 360;
  
  return bearing;
}

/**
 * Calculate distance between two geographic coordinates in meters
 * @param lat1 Latitude of the first point
 * @param lng1 Longitude of the first point
 * @param lat2 Latitude of the second point
 * @param lng2 Longitude of the second point
 * @returns Distance in meters
 */
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Smooth angle transition to avoid sudden jumps
 * @param currentAngle Current angle in degrees
 * @param targetAngle Target angle in degrees
 * @param smoothingFactor Factor for smoothing (0-1, where 1 = no smoothing)
 * @returns Smoothed angle in degrees
 */
export function smoothAngle(currentAngle: number, targetAngle: number, smoothingFactor: number = 0.3): number {
  // Normalize angles to 0-360
  currentAngle = (currentAngle + 360) % 360;
  targetAngle = (targetAngle + 360) % 360;
  
  // Calculate the shortest angular distance
  let diff = targetAngle - currentAngle;
  if (diff > 180) {
    diff -= 360;
  } else if (diff < -180) {
    diff += 360;
  }
  
  // Apply smoothing
  const newAngle = currentAngle + (diff * smoothingFactor);
  
  return (newAngle + 360) % 360;
}
