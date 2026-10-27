// Blockbench globals used by the sidebar panel. Hand-written like blockbench.d.ts; the
// checked source is js/interface/panels.ts (Panel constructor line 124, delete line 1090,
// `vue` line 221). `tl` and `Blockbench.addCSS` are declared in blockbench.d.ts.

/** The part of a Vue 2 options object that the panel uses. Blockbench supplies Vue. */
interface VuePanelComponent {
  data?: () => object;
  methods?: Record<string, (...args: never[]) => unknown>;
  template: string;
}

interface PanelOptions {
  name?: string;
  icon: string;
  growable?: boolean;
  resizable?: boolean;
  default_position?: { slot: 'left_bar' | 'right_bar'; height?: number; width?: number };
  component?: VuePanelComponent;
}

declare class Panel {
  constructor(id: string, data: PanelOptions);
  readonly id: string;
  /** The Vue instance Blockbench mounted for `component`. */
  readonly vue?: { $destroy(): void };
  delete(): void;
}
