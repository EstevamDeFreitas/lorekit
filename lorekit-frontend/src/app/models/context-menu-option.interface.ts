export interface ContextMenuOption {
  label: string;
  action: (id:string) => void;
  disabled?: boolean;
  customClass?: string;
  customIcon?: string;
}
