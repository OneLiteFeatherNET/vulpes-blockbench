// The plugin's own strings. English is the source and German the translation. Both
// tables are registered with Blockbench, so every string goes through `tl()`. The
// placeholders %0, %1 ... are filled by `tl()` from the parameters.

export interface TranslationTables {
  readonly en: Record<string, string>;
  readonly de: Record<string, string>;
}

export const coreTranslations: TranslationTables = {
  en: {
    'vulpes.problem.project_not_found': 'The project no longer exists in Vulpes. Pick another project.',
    'vulpes.problem.model_deleted': 'The model was deleted in Vulpes. Use "Save as copy" to keep your work.',
    'vulpes.problem.violation': '%0',
    'vulpes.problem.file_rejected': 'Vulpes rejected the model file: %0',
    'vulpes.problem.validation': 'Vulpes rejected the request.',
    'vulpes.problem.validation_detail': 'Vulpes rejected the request: %0',
    'vulpes.problem.key_conflict':
      'A model or texture with this key already exists. Choose another key. If an earlier save may have succeeded, open the model from Vulpes instead.',
    'vulpes.problem.changed': 'The model changed in Vulpes since it was opened.',
    'vulpes.problem.plugin_bug': 'This is a plugin bug (HTTP %0): %1',
    'vulpes.problem.internal': 'Vulpes failed on its side. Trace ID: %0.',
    'vulpes.problem.too_large': 'The model is larger than 8 MB. Reduce the embedded textures.',
    'vulpes.problem.sign_in': 'Sign in again.',
    'vulpes.problem.http_status': 'Vulpes answered HTTP %0.',
    'vulpes.problem.http_title': 'Vulpes answered HTTP %0: %1',
    'vulpes.problem.unreachable': 'Vulpes cannot be reached (%0). Local work is kept.',
    'vulpes.problem.unexpected': 'Vulpes sent a response this plugin cannot read (HTTP %0).',
    'vulpes.problem.refused': 'Nothing was sent: this model has no version tag from Vulpes. Open it from Vulpes again.',
  },
  de: {
    'vulpes.problem.project_not_found': 'Das Projekt existiert in Vulpes nicht mehr. Wähle ein anderes Projekt.',
    'vulpes.problem.model_deleted': 'Das Modell wurde in Vulpes gelöscht. Mit „Als Kopie speichern“ bleibt deine Arbeit erhalten.',
    'vulpes.problem.violation': '%0',
    'vulpes.problem.file_rejected': 'Vulpes hat die Modelldatei abgelehnt: %0',
    'vulpes.problem.validation': 'Vulpes hat die Anfrage abgelehnt.',
    'vulpes.problem.validation_detail': 'Vulpes hat die Anfrage abgelehnt: %0',
    'vulpes.problem.key_conflict':
      'Unter diesem Schlüssel gibt es bereits ein Modell oder eine Textur. Wähle einen anderen Schlüssel. Wenn ein früheres Speichern erfolgreich war, öffne das Modell stattdessen aus Vulpes.',
    'vulpes.problem.changed': 'Das Modell hat sich in Vulpes seit dem Öffnen geändert.',
    'vulpes.problem.plugin_bug': 'Das ist ein Fehler im Plugin (HTTP %0): %1',
    'vulpes.problem.internal': 'Vulpes ist auf seiner Seite ausgefallen. Trace-ID: %0.',
    'vulpes.problem.too_large': 'Das Modell ist größer als 8 MB. Verkleinere die eingebetteten Texturen.',
    'vulpes.problem.sign_in': 'Melde dich erneut an.',
    'vulpes.problem.http_status': 'Vulpes antwortete mit HTTP %0.',
    'vulpes.problem.http_title': 'Vulpes antwortete mit HTTP %0: %1',
    'vulpes.problem.unreachable': 'Vulpes ist nicht erreichbar (%0). Die lokale Arbeit bleibt erhalten.',
    'vulpes.problem.unexpected': 'Vulpes hat eine Antwort gesendet, die das Plugin nicht lesen kann (HTTP %0).',
    'vulpes.problem.refused': 'Nichts wurde gesendet: Dieses Modell hat keine Versionsmarke von Vulpes. Öffne es erneut aus Vulpes.',
  },
};
