import { Document } from '../../models/document.model';

export interface TreeViewNode {
  id: string;
  title: string;
  SubDocuments?: TreeViewNode[];
  Personalization?: Document['Personalization'];
}

export type TreeViewReparentRequest = {
  draggedId: string;
  newParentId: string | null;
};
