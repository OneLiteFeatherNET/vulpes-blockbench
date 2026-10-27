// Blockbench globals used by the plugin. Hand-written on purpose: the
// blockbench-types package pulls in electron and other large dependencies.
// Add a declaration here together with the code that first uses it.
//
// Each member below was checked against the Blockbench source (JannisX11/blockbench,
// master): Setting and Settings in js/interface/settings.ts, BarMenu and MenuBar in
// js/interface/menu_bar.ts, CustomMenuItem in js/interface/menu.ts, Action in
// js/interface/actions.ts, Dialog in js/interface/dialog.ts, ToastNotification in
// js/interface/toast_notification.ts.

interface VulpesPluginOptions {
  title: string;
  author: string;
  description: string;
  version: string;
  variant: 'desktop';
  onload: () => void;
  onunload: () => void;
}

declare const Plugin: {
  register: (id: string, options: VulpesPluginOptions) => void;
};

interface SettingOptions {
  name: string;
  category: string;
  type: 'text' | 'select';
  value: string;
  description?: string;
  options?: Record<string, string>;
  plugin?: string;
  onChange?: () => void;
}

declare class Setting {
  constructor(id: string, data: SettingOptions);
  value: string;
  delete(): void;
}

declare const settings: Record<string, Setting | undefined>;

declare const Settings: {
  addCategory: (id: string, data: { name?: string; open?: boolean }) => void;
  saveLocalStorages: () => void;
};

interface CustomMenuItem {
  name: string;
  icon: string;
  click: () => void;
}

declare class BarMenu {
  constructor(id: string, structure: CustomMenuItem[], options?: { name?: string; icon?: string });
  delete(): void;
}

declare const MenuBar: {
  addMenu: (menu: BarMenu, position?: number | string) => void;
  update: () => void;
};

interface ActionOptions {
  name: string;
  icon: string;
  click: () => void;
}

declare class Action {
  constructor(id: string, data: ActionOptions);
  setName: (name: string) => void;
}

type FormField =
  | { label: string; type: 'text'; value: string }
  | { label: string; type: 'select'; value: string; options: Record<string, string> };

interface DialogOptions {
  title: string;
  form?: Record<string, FormField>;
  buttons?: string[];
  confirmIndex?: number;
  cancelIndex?: number;
  onConfirm?: (formResult: Record<string, unknown>) => void;
  onCancel?: () => void;
  onButton?: (index: number) => void;
}

declare class Dialog {
  constructor(id: string, options: DialogOptions);
  show(): this;
  hide(): this;
  close(): void;
  getFormResult(): Record<string, unknown>;
}

declare class ToastNotification {
  constructor(id: string, options: { text: string; expire?: number });
  delete(): void;
}
