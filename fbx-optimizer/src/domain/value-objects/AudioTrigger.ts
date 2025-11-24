export interface AudioTrigger {
  id: string;
  clipUuid: string; // Keep for backward compatibility, but will use clipName for matching
  clipName: string; // Use name for matching since UUID changes after optimization
  frame: number;
}

