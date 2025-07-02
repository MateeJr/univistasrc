// Utility to map driver icon label to corresponding PNG filename in public folder
export function getIconPath(icon: string | undefined): string {
  switch (icon) {
    case 'Sepeda Motor':
      return '/sepedamotor.png';
    case 'Mobil':
      return '/mobil.png';
    case 'Mobil Kecil':
      return '/mobilkecil.png';
    case 'Truk':
      return '/truck.png';
    case 'Truk Besar':
      return '/truckbesar.png';
    default:
      return '/truck.png';
  }
}

// return pixel size where original is base value; truck stays base, others 1.5x
export function scaledSize(base:number, iconLabel:string|undefined){
  return !iconLabel || iconLabel==='Truk' ? base : Math.round(base*1.5);
}
