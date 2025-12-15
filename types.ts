export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
}

export interface Scene {
  id: string;
  projectId: string;
  name: string;
  description: string;
  sequenceOrder: number;
}

export type AssetType = 'image' | 'video';

export interface Asset {
  id: string;
  sceneId: string;
  projectId: string;
  type: AssetType;
  url: string; // Base64 or Blob URL
  prompt: string;
  createdAt: number;
  width?: number;
  height?: number;
}

export enum GenerationType {
  TEXT_TO_IMAGE = 'TEXT_TO_IMAGE',
  IMAGE_TO_IMAGE = 'IMAGE_TO_IMAGE',
  TEXT_TO_VIDEO = 'TEXT_TO_VIDEO'
}

export type ViewState = 
  | { type: 'DASHBOARD' }
  | { type: 'PROJECT_DETAILS'; projectId: string }
  | { type: 'SCENE_DETAILS'; projectId: string; sceneId: string }
  | { type: 'GENERATOR'; projectId?: string; sceneId?: string; image?: string; mode?: GenerationType; prompt?: string };