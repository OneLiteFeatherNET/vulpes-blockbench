import { testConnection, type ConnectionResult } from '../environment/connection-test';
import { isProfileId, requiresConfirmation, type ProfileId } from '../environment/profiles';
import type { EnvironmentService } from '../environment/service';
import { validateBaseUrl, type UrlRejection } from '../environment/validation';
import { notify } from './notify';

export interface FormValues {
  readonly active: ProfileId;
  readonly dev: string;
  readonly prod: string;
}

const BUTTON_TEST = 0;
const CONFIRM_INDEX = 1;
const CANCEL_INDEX = 2;

/** Reads the form. Blockbench returns untrusted values, so each field is checked. */
function readForm(raw: Record<string, unknown>): FormValues | undefined {
  const active = raw['active'];
  const dev = raw['dev'];
  const prod = raw['prod'];
  if (!isProfileId(active) || typeof dev !== 'string' || typeof prod !== 'string') {
    return undefined;
  }
  return { active, dev, prod };
}

function rejectionText(reason: UrlRejection): string {
  switch (reason) {
    case 'unparseable':
      return 'it is not a valid URL';
    case 'protocol':
      return 'it must start with http:// or https://';
    case 'query-or-fragment':
      return 'it must not contain a query string or a fragment';
    case 'prod-requires-https':
      return 'production must use https (http is allowed only for localhost and 127.0.0.1)';
  }
}

function describeResult(result: ConnectionResult, baseUrl: string): string {
  switch (result.kind) {
    case 'ok':
      return `Connected to ${baseUrl} (HTTP ${String(result.status)}).`;
    case 'http-error':
      return `Vulpes at ${baseUrl} answered HTTP ${String(result.status)}.`;
    case 'network-error':
      return `No response from ${baseUrl}. A CORS block is one possible cause. (${result.message})`;
  }
}

async function runTest(form: FormValues): Promise<void> {
  const checked = validateBaseUrl(form[form.active], form.active);
  if (!checked.ok) {
    notify(`Cannot test: ${rejectionText(checked.reason)}.`);
    return;
  }
  if (checked.value === '') {
    notify(`${form.active === 'prod' ? 'Prod' : 'Dev'} is not configured. Enter its URL first.`);
    return;
  }
  notify(describeResult(await testConnection(checked.value, fetch), checked.value));
}

/**
 * Asks once for confirmation before the active environment becomes Prod. The
 * dialog offers no way to continue without an answer.
 */
export function askProdConfirmation(onConfirm: () => void, onCancel: () => void): void {
  const dialog = new Dialog('vulpes_confirm_prod', {
    title: 'Switch to Prod? Saves will go to the production backend.',
    buttons: ['Switch to Prod', 'Cancel'],
    confirmIndex: 0,
    cancelIndex: 1,
    onConfirm: () => {
      onConfirm();
    },
    onCancel: () => {
      onCancel();
    },
  });
  dialog.show();
}

/**
 * Opens the settings dialog. `prefill` reopens it with the values the designer
 * entered when a save was rejected, so nothing is lost.
 */
export function openSettingsDialog(
  service: EnvironmentService,
  onApplied: () => void,
  prefill?: FormValues,
): void {
  const snapshot = service.snapshot();
  const values: FormValues = prefill ?? {
    active: snapshot.active,
    dev: snapshot.baseUrls.dev,
    prod: snapshot.baseUrls.prod,
  };
  const dialog = new Dialog('vulpes_settings', {
    title: 'Vulpes settings',
    form: {
      active: {
        label: 'Active environment',
        type: 'select',
        options: { dev: 'Dev', prod: 'Prod' },
        value: values.active,
      },
      dev: { label: 'Dev URL', type: 'text', value: values.dev },
      prod: { label: 'Prod URL', type: 'text', value: values.prod },
    },
    buttons: ['Test connection', 'Save', 'Cancel'],
    confirmIndex: CONFIRM_INDEX,
    cancelIndex: CANCEL_INDEX,
    onButton(index) {
      if (index !== BUTTON_TEST) {
        return;
      }
      const form = readForm(dialog.getFormResult());
      if (form !== undefined) {
        void runTest(form);
      }
    },
    onConfirm(raw) {
      const form = readForm(raw);
      if (form !== undefined) {
        applyForm(service, form, onApplied);
      }
    },
  });
  dialog.show();
}

function applyForm(service: EnvironmentService, form: FormValues, onApplied: () => void): void {
  const dev = validateBaseUrl(form.dev, 'dev');
  const prod = validateBaseUrl(form.prod, 'prod');
  if (!dev.ok) {
    notify(`Dev URL: ${rejectionText(dev.reason)}.`);
    openSettingsDialog(service, onApplied, form);
    return;
  }
  if (!prod.ok) {
    notify(`Prod URL: ${rejectionText(prod.reason)}.`);
    openSettingsDialog(service, onApplied, form);
    return;
  }
  const before = service.snapshot().active;
  service.setBaseUrl('dev', dev.value);
  service.setBaseUrl('prod', prod.value);
  if (requiresConfirmation(before, form.active)) {
    askProdConfirmation(
      () => {
        service.switchTo('prod', true);
        onApplied();
      },
      onApplied,
    );
    return;
  }
  service.switchTo(form.active, true);
  onApplied();
}
