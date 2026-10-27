// Blockbench globals used by the plugin. Hand-written on purpose: the
// blockbench-types package pulls in electron and other large dependencies.
// Add a declaration here together with the code that first uses it.
//
// Each member below was checked against the Blockbench source (JannisX11/blockbench,
// master): Setting and Settings in js/interface/settings.ts, BarMenu and MenuBar in
// js/interface/menu_bar.ts, CustomMenuItem in js/interface/menu.ts, Action and its
// trigger in js/interface/actions.ts, Dialog (close, onButton, lines) in
// js/interface/dialog.ts, ToastNotification in js/interface/toast_notification.ts,
// Property (export: false) in js/util/property.ts, the project codec in
// js/formats/bbmodel.js (compile returns JSON text, parse), export_over in
// js/io/io.js, setupProject and ModelProject.close/select in js/io/project.ts.

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
  /** Runs on a click, a keybind and a menu entry alike (Action.trigger calls it). Replaceable. */
  click: (event?: Event) => unknown;
  delete(): void;
}

/** The built-in actions by id, for example `export_over` (Ctrl+S) and `save_project` (File > Save). */
declare const BarItems: Record<string, Action | undefined>;

type FormField =
  | { label: string; type: 'text'; value: string }
  | { label: string; type: 'select'; value: string; options: Record<string, string> };

interface DialogOptions {
  title: string;
  form?: Record<string, FormField>;
  lines?: string[];
  buttons?: string[];
  confirmIndex?: number;
  cancelIndex?: number;
  /** Returning false keeps the dialog open. */
  onConfirm?: (formResult: Record<string, unknown>) => boolean | void;
  onCancel?: () => boolean | void;
  /** Returning false keeps the dialog open. */
  onButton?: (index: number) => boolean | void;
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

/** A Blockbench project (ModelProject). The plugin stores its reference in `vulpes_remote`. */
interface BlockbenchProject {
  name: string;
  saved: boolean;
  /** Set by the plugin through a Property with export: false, so it is never written to the model JSON. */
  vulpes_remote?: unknown;
  select(): void;
  close(force?: boolean): Promise<boolean>;
}

/** The open project, or none. */
declare const Project: BlockbenchProject | null | undefined;

/** The class that projects are instances of. Only used as the target of a Property. */
declare const ModelProject: object;

/** Declares a property of projects. `export: false` keeps it out of the compiled JSON. */
declare class Property {
  constructor(target: object, type: 'object', name: string, options?: { export?: boolean });
  delete(): void;
}

declare const Codecs: {
  project: {
    /** Returns the .bbmodel JSON as text. Dispatches the save_project event on the way. */
    compile(): string;
    /** Loads a parsed model into the current project. An empty path means the project has no file. */
    parse(model: unknown, path: string): void;
  };
};

/** Creates a project in the given format id, or in free when the id is unknown, and selects it. */
declare function setupProject(format: string): boolean;

/** Translates a key of the language tables. Parameters replace %0, %1 ... in the text. */
declare function tl(key: string, variables?: string | number | (string | number)[], defaultValue?: string): string;
