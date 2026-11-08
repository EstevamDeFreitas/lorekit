export interface StoryDraftAttachment {
  id: string;
  file: File;
  uploaded: boolean;
}

export interface StoryDraftLine {
  id: string;
  sceneId: string;
  sceneTitle: string;
  speakerId: string;
  revisionId: string;
  speakerName: string;
  speakerColor: string;
  text: string;
  attachments: StoryDraftAttachment[];
}

export interface StoryDraft {
  accountId: string;
  text: string;
  sceneId: string;
  speakerId: string;
  queuedMessages: StoryDraftLine[];
  editingDraftId?: string | null;
  draftEditOrigin?: { sceneId: string; speakerId: string } | null;
  attachments?: StoryDraftAttachment[];
}
