
export interface WPPost {
  id: number;
  title: string;
  excerpt: string;
  content: string;
  featured_image: string;
  date: string;
  category: 'route' | 'blog';
  difficulty?: 'Easy' | 'Moderate' | 'Hard';
  distance?: string;
  duration?: string;
}

export interface UserDocument {
  id: string;
  type: 'Passport' | 'Visa' | 'License' | 'Permit';
  status: 'Pending' | 'Verified' | 'Rejected';
  uploadDate: string;
  fileName: string;
}

export interface RiderLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  isMe: boolean;
  batteryLevel?: number;
}

export interface PhotoItem {
  id: string;
  url: string;
  thumbnail: string;
  timestamp: string;
  tripCode: string;
}

export enum AppTab {
  HOME = 'home',
  ROUTES = 'routes',
  MAP = 'map',
  DOCS = 'docs',
  AI = 'ai',
  GALLERY = 'gallery',
  ADMIN = 'admin'
}
