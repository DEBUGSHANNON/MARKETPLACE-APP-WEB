import { CampusZone, Listing } from '../types/marketplace';

export const UTM_COLLEGES = [
  'Kolej Rahman Putra (KRP)',
  'Kolej Tun Fatimah (KTF)',
  'Kolej Tun Razak (KTR)',
  'Kolej Tun Hussein Onn (KTHO)',
  'Kolej Tun Dr. Ismail (KTDI)',
  'Kolej Perdana (KP)',
  'Kolej 9 dan 10 (K9 & K10)',
  'Kolej Datin Seri Endon (KDSE)',
  "Kolej Dato' Onn Jaafar (KDOJ)",
  'Off-Campus / Taman Universiti',
];

export const UTM_CAMPUS_ZONES: CampusZone[] = [
  {
    id: 'psz',
    name: 'Perpustakaan Sultanah Zanariah (PSZ)',
    shortName: 'PSZ Library',
    area: 'Academic Core',
    lat: 1.5597,
    lng: 103.6378,
    mapX: 48,
    mapY: 44,
  },
  {
    id: 'meranti',
    name: 'Arked Meranti Food Court',
    shortName: 'Arked Meranti',
    area: 'Central Hub',
    lat: 1.5608,
    lng: 103.6352,
    mapX: 38,
    mapY: 36,
  },
  {
    id: 'n28',
    name: 'Faculty of Computing (N28)',
    shortName: 'N28 Computing',
    area: 'Lingkaran Ilmu',
    lat: 1.5642,
    lng: 103.6384,
    mapX: 55,
    mapY: 22,
  },
  {
    id: 'l50',
    name: 'Dewan Kuliah L50',
    shortName: 'L50 Lecture Hall',
    area: 'Academic Core',
    lat: 1.5579,
    lng: 103.6396,
    mapX: 60,
    mapY: 54,
  },
  {
    id: 'tasik',
    name: 'Tasik Ilmu Promenade',
    shortName: 'Tasik Ilmu',
    area: 'Central Park',
    lat: 1.5588,
    lng: 103.6345,
    mapX: 33,
    mapY: 52,
  },
  {
    id: 'ktr',
    name: 'Kolej Tun Razak (KTR) Courtyard',
    shortName: 'KTR Courtyard',
    area: 'Residential Zone',
    lat: 1.5562,
    lng: 103.6318,
    mapX: 20,
    mapY: 68,
  },
  {
    id: 'krp',
    name: 'Kolej Rahman Putra (KRP) Gate',
    shortName: 'KRP Gate',
    area: 'Residential Zone',
    lat: 1.5632,
    lng: 103.6431,
    mapX: 76,
    mapY: 30,
  },
  {
    id: 'kp',
    name: 'Kolej Perdana (KP) Arked',
    shortName: 'KP Arked',
    area: 'East Campus',
    lat: 1.5546,
    lng: 103.6458,
    mapX: 82,
    mapY: 72,
  },
];

export const STUDIO_PRESET_IMAGES = [
  {
    label: 'Scientific Calculator',
    url: '/src/assets/images/utm_scientific_calculator_1795092763968.jpg',
    category: 'Electronics' as const,
  },
  {
    label: '75% Mechanical Keyboard',
    url: '/src/assets/images/utm_mechanical_keyboard_1795092763999.jpg',
    category: 'Electronics' as const,
  },
  {
    label: 'CS & Engineering Textbooks',
    url: '/src/assets/images/utm_engineering_textbooks_1795092764049.jpg',
    category: 'Books' as const,
  },
  {
    label: 'Campus Commuter Bicycle',
    url: '/src/assets/images/utm_campus_bicycle_1795092763969.jpg',
    category: 'Mobility' as const,
  },
  {
    label: 'Desk Lamp & IPS Monitor',
    url: '/src/assets/images/utm_desk_lamp_monitor_1795092763882.jpg',
    category: 'Lifestyle' as const,
  },
  {
    label: 'Botanical ANC Headphones',
    url: '/src/assets/images/utm_studio_headphones_1795092763824.jpg',
    category: 'Electronics' as const,
  },
];

export const SHOWCASE_LISTINGS: Listing[] = [
  {
    id: 'showcase-casio-fx570ex',
    title: 'Casio fx-570EX ClassWiz Calculator',
    description:
      'Essential UTM engineering & calculus exam-approved calculator. Crisp high-res natural textbook display, original slide cover included, fresh battery installed.',
    price: 58,
    category: 'Electronics',
    type: 'item',
    condition: 'Like New',
    campusZone: 'Perpustakaan Sultanah Zanariah (PSZ)',
    imageUrl: '/src/assets/images/utm_scientific_calculator_1795092763968.jpg',
    sellerId: 'utm-showcase-1',
    sellerName: 'Aiman Hakim',
    sellerVerifiedUtm: true,
    status: 'available',
    isShowcase: true,
  },
  {
    id: 'showcase-custom-keyboard',
    title: '75% Wireless Mechanical Keyboard (Sage)',
    description:
      'Compact hot-swappable aluminum 75% keyboard with tactile switches and sage-cream PBT keycaps. Includes coiled aviator USB-C cable and 2.4GHz dongle.',
    price: 215,
    category: 'Electronics',
    type: 'item',
    condition: 'Like New',
    campusZone: 'Faculty of Computing (N28)',
    imageUrl: '/src/assets/images/utm_mechanical_keyboard_1795092763999.jpg',
    sellerId: 'utm-showcase-2',
    sellerName: 'Mei Ling Tan',
    sellerVerifiedUtm: true,
    status: 'available',
    isShowcase: true,
  },
  {
    id: 'showcase-cs-textbooks',
    title: 'Data Structures & Systems Hardcover Set',
    description:
      'Clean hardcover bundle for SECP/SECR year 1-2 courses. Zero torn pages, minimal pencil margin notes, ready for quick handover outside N28 or PSZ.',
    price: 65,
    category: 'Books',
    type: 'item',
    condition: 'Good',
    campusZone: 'Dewan Kuliah L50',
    imageUrl: '/src/assets/images/utm_engineering_textbooks_1795092764049.jpg',
    sellerId: 'utm-showcase-3',
    sellerName: 'Farah Nadia',
    sellerVerifiedUtm: true,
    status: 'available',
    isShowcase: true,
  },
  {
    id: 'showcase-commuter-bike',
    title: 'Forest Green Campus Commuter Bicycle',
    description:
      'Lightweight single-speed commuter frame built for Skudai hills between KTR, Arked Meranti, and L50. Includes rear rack pannier bag and front LED headlamp.',
    price: 380,
    category: 'Mobility',
    type: 'item',
    condition: 'Good',
    campusZone: 'Kolej Tun Razak (KTR) Courtyard',
    imageUrl: '/src/assets/images/utm_campus_bicycle_1795092763969.jpg',
    sellerId: 'utm-showcase-4',
    sellerName: 'Daniel Raj',
    sellerVerifiedUtm: true,
    status: 'available',
    isShowcase: true,
  },
  {
    id: 'showcase-desk-monitor-lamp',
    title: '24" Frameless IPS Monitor + Architect Lamp',
    description:
      'Final-year student dorm desk clearance bundle. 24-inch 1080p IPS USB-C/HDMI display paired with an articulated brushed aluminum studio desk lamp.',
    price: 290,
    category: 'Lifestyle',
    type: 'item',
    condition: 'Like New',
    campusZone: 'Kolej Perdana (KP) Arked',
    imageUrl: '/src/assets/images/utm_desk_lamp_monitor_1795092763882.jpg',
    sellerId: 'utm-showcase-5',
    sellerName: 'Syafiqah Azman',
    sellerVerifiedUtm: true,
    status: 'available',
    isShowcase: true,
  },
  {
    id: 'showcase-anc-headphones',
    title: 'Botanical Cream Wireless ANC Headphones',
    description:
      'Comfortable over-ear active noise cancellation for PSZ quiet study sessions. 35-hour battery life, multipoint Bluetooth, USB-C fast charging.',
    price: 165,
    category: 'Electronics',
    type: 'item',
    condition: 'Like New',
    campusZone: 'Arked Meranti Food Court',
    imageUrl: '/src/assets/images/utm_studio_headphones_1795092763824.jpg',
    sellerId: 'utm-showcase-6',
    sellerName: 'Wei Jie Lim',
    sellerVerifiedUtm: true,
    status: 'available',
    isShowcase: true,
  },
];

export const UTM_ALLOWED_DOMAIN = '@graduate.utm.my';

export function isUtmStudentEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(UTM_ALLOWED_DOMAIN);
}

export function resolveAssetUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('/src/assets/')) {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    return `${base}${url}`;
  }
  return url;
}

export function formatMYR(amount: number): string {
  return `RM ${Number(amount || 0).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
