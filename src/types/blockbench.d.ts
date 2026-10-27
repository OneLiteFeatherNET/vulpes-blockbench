// Blockbench globals used by the plugin. Hand-written on purpose: the
// blockbench-types package pulls in electron and other large dependencies.
// Add a declaration here together with the code that first uses it.
//
// Each member below was checked against the Blockbench 5.2 source, paths relative to
// its js/ directory: plugin metadata in plugin_loader.ts; Setting and Settings in
// interface/settings.ts; Action in interface/actions.ts; MenuBar.addAction in
// interface/menu_bar.ts; ModelLoader in io/model_loader.ts; Codec and Codecs in
// io/codec.ts and formats/bbmodel.js; the project fields in io/project.ts; Dialog and
// MessageBox in interface/dialog.ts; showQuickMessage and showMessageBox in api.ts;
// tl and Language in languages.ts; the event listeners in util/event_system.ts.

interface VulpesPluginOptions {
  title: string;
  author: string;
  description: string;
  about?: string;
  icon: string;
  tags?: [string, string?, string?];
  version: string;
  variant: 'desktop';
  min_version?: string;
  website?: string;
  repository?: string;
  bug_tracker?: string;
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
  /** Runs when the designer changes the value in the Settings or Preferences views. */
  onChange?: (value: string) => void;
}

declare class Setting {
  constructor(id: string, data: SettingOptions);
  value: string;
  delete(): void;
}

declare const settings: Record<string, Setting | undefined>;

declare const Settings: {
  saveLocalStorages: () => void;
};

interface ActionOptions {
  /** A translation key, or text. Blockbench passes it through tl(). */
  name: string;
  description?: string;
  icon: string;
  category?: string;
  click: (event?: Event) => void;
}

declare class Action {
  constructor(id: string, data: ActionOptions);
  delete(): void;
}

declare const MenuBar: {
  /** The first path segment names the menu. `#group` inserts at the end of that group. */
  addAction: (action: Action, path: string) => void;
};

interface ModelLoaderOptions {
  icon: string;
  name: string;
  description?: string;
  category?: string;
  show_on_start_screen?: boolean;
  onStart: () => void;
}

declare class ModelLoader {
  constructor(id: string, options: ModelLoaderOptions);
  delete(): void;
}

interface CodecOptions {
  name: string;
  remember: boolean;
  extension: string;
  compile: () => string;
  write: (content: string, path: string) => void;
  afterSave?: (path: string) => void;
}

declare class Codec {
  constructor(id: string, data: CodecOptions);
  delete(): void;
}

declare const Codecs: {
  project: {
    /** Returns the .bbmodel JSON as text. */
    compile(): string;
    /** Loads a parsed model into the current project. The path names the project; an empty path means no file. */
    parse(model: unknown, path: string): void;
  };
};

interface MessageBoxOptions {
  title: string;
  message?: string;
  icon?: string;
  buttons?: string[];
  confirm?: number;
  cancel?: number;
  /** Each command closes the box with its id as the first callback argument. */
  commands?: Record<string, string>;
}

declare const Blockbench: {
  showQuickMessage: (message: string, time?: number) => void;
  showMessageBox: (options: MessageBoxOptions, callback?: (button: number | string) => void) => void;
  /** Subscribes to a Blockbench event. The callback gets the event data, which is untrusted and must be checked. The returned object removes the listener. */
  on: (event: string, callback: (data: unknown) => void) => { delete(): void };
  /** Adds a stylesheet (js/api.ts:245). The returned handle removes it again. */
  addCSS: (css: string, layer?: string) => { delete(): void };
  /** Asks for one line of text. The callback gets the text, or a non-text value when the prompt is cancelled. */
  textPrompt: (title: string, value: string, callback: (text: unknown) => void) => void;
};

declare const Language: {
  addTranslations: (language: string, strings: Record<string, string>) => void;
};

/** Translates a key of the language tables. Parameters replace %0, %1 ... in the text. */
declare function tl(key: string, variables?: string | number | (string | number)[], defaultValue?: string): string;

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

/** A Blockbench project (ModelProject). The Vulpes link uses its export fields. */
interface BlockbenchProject {
  readonly uuid: string;
  name: string;
  saved: boolean;
  save_path: string;
  export_path: string;
  export_codec: string;
  /** The live edit session of the project, set by `new EditSession()` and by a joined model (js/io/project.ts:155). */
  EditSession?: EditSession | null;
  select(): void;
  close(force?: boolean): Promise<boolean>;
}

/** The open project, or none. */
declare const Project: BlockbenchProject | null | undefined;

declare const ModelProject: { readonly all: BlockbenchProject[] };

/** Creates a project in the given format id, or in free when the id is unknown, and selects it. */
declare function setupProject(format: string): boolean;
