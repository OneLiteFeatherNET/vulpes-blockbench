import { describe, expect, it } from 'vitest';
import type { AssetSummary, ProjectSummary } from '../../../src/api/dto';
import type { SessionView } from '../../../src/live/session-state';
import type { ModelPage, PanelEnvironment, PanelLink, PanelResult, VulpesPanelHost } from '../../../src/ui/panel/host';
import {
  createPanelController,
  environmentView,
  matchesSearch,
  type PanelController,
  type PanelViewState,
  visibleModels,
} from '../../../src/ui/panel/panel-state';

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

/** A promise the test settles by hand, so the order of answers is explicit. */
function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function ok<T>(value: T): PanelResult<T> {
  return { ok: true, value };
}

function fail(message: string): PanelResult<never> {
  return { ok: false, error: { message } };
}

function project(id: string, displayName = id): ProjectSummary {
  return { id, displayName, key: `key-${id}` };
}

function model(id: string, key = `key-${id}`, fileName = `${id}.bbmodel`): AssetSummary {
  return { id, key, fileName, size: 1, sha1: 'a'.repeat(40) };
}

interface FakeHost {
  readonly host: VulpesPanelHost;
  readonly views: PanelViewState[];
  readonly modelCalls: { projectId: string; page: number }[];
  readonly opened: { projectId: string; model: AssetSummary }[];
  readonly changeListeners: (() => void)[];
  unsubscribed: boolean;
  testCount: number;
  saveCount: number;
  env: PanelEnvironment;
  link: PanelLink | undefined;
  /** Answers the next call of listProjects. */
  nextProjects: () => Promise<PanelResult<readonly ProjectSummary[]>>;
  /** Answers each call of listModels. */
  nextModels: (projectId: string, page: number) => Promise<PanelResult<ModelPage>>;
  openResult: () => Promise<void>;
  testResult: () => Promise<void>;
  session: SessionView;
  environmentAvailable: boolean;
  backendAvailable: boolean;
  startResult: PanelResult<void>;
  joinResult: PanelResult<void>;
  startCount: number;
  joinCount: number;
  leaveCount: number;
}

function fakeHost(env: PanelEnvironment = { id: 'dev', configured: true }): FakeHost {
  // One object: the host closures and the test read and write the same fields.
  const fake: Omit<FakeHost, 'host'> = {
    views: [],
    modelCalls: [],
    opened: [],
    changeListeners: [],
    unsubscribed: false,
    testCount: 0,
    saveCount: 0,
    env,
    link: undefined,
    nextProjects: () => Promise.resolve(ok([])),
    nextModels: () => Promise.resolve(ok({ items: [], hasMore: false })),
    openResult: () => Promise.resolve(),
    testResult: () => Promise.resolve(),
    session: { kind: 'none' },
    environmentAvailable: true,
    backendAvailable: true,
    startResult: ok(undefined),
    joinResult: ok(undefined),
    startCount: 0,
    joinCount: 0,
    leaveCount: 0,
  };
  const host: VulpesPanelHost = {
    activeEnvironment: () => fake.env,
    testConnection: () => {
      fake.testCount++;
      return fake.testResult();
    },
    listProjects: () => fake.nextProjects(),
    listModels: (projectId, page) => {
      fake.modelCalls.push({ projectId, page });
      return fake.nextModels(projectId, page);
    },
    openModel: (projectId, opened) => {
      fake.opened.push({ projectId, model: opened });
      return fake.openResult();
    },
    saveCurrentAsNew: () => {
      fake.saveCount++;
    },
    currentLink: () => fake.link,
    liveSnapshot: () => ({ environmentAvailable: fake.environmentAvailable, backendAvailable: fake.backendAvailable, session: fake.session }),
    startLive: () => {
      fake.startCount++;
      return fake.startResult;
    },
    joinLive: () => {
      fake.joinCount++;
      return fake.joinResult;
    },
    leaveLive: () => {
      fake.leaveCount++;
    },
    onChange: (listener) => {
      fake.changeListeners.push(listener);
      return () => {
        fake.unsubscribed = true;
      };
    },
  };
  return Object.assign(fake, { host });
}

function controllerFor(fake: FakeHost): PanelController {
  return createPanelController(fake.host, (view) => {
    fake.views.push(view);
  });
}

function lastView(fake: FakeHost): PanelViewState {
  const view = fake.views.at(-1);
  if (view === undefined) {
    throw new Error('no view was rendered');
  }
  return view;
}

describe('environmentView', () => {
  it('flags Prod and leaves Dev unflagged', () => {
    expect(environmentView({ id: 'prod', configured: true }).flagged).toBe(true);
    expect(environmentView({ id: 'dev', configured: true }).flagged).toBe(false);
  });

  it('keeps the configured state of the environment', () => {
    const unconfigured: PanelEnvironment = { id: 'prod', configured: false };
    expect(environmentView(unconfigured).configured).toBe(false);
  });
});

describe('matchesSearch', () => {
  const sample = model('m1', 'Castle/Gate', 'Gate_Model.bbmodel');

  it('matches the key ignoring case', () => {
    expect(matchesSearch(sample, 'castle/GATE')).toBe(true);
  });

  it('matches the file name ignoring case', () => {
    expect(matchesSearch(sample, 'gate_model')).toBe(true);
  });

  it('matches everything for an empty or blank query', () => {
    expect(matchesSearch(sample, '')).toBe(true);
    expect(matchesSearch(sample, '   ')).toBe(true);
  });

  it('rejects a query that matches neither key nor file name', () => {
    expect(matchesSearch(sample, 'tower')).toBe(false);
  });
});

describe('visibleModels', () => {
  it('keeps the order of the loaded models', () => {
    const items = [model('a', 'x/a'), model('b', 'x/b'), model('c', 'y/c')];
    expect(visibleModels(items, 'x/').map((entry) => entry.id)).toEqual(['a', 'b']);
  });
});

describe('panel controller', () => {
  it('shows not configured and sends no request when the environment has no URL', async () => {
    const fake = fakeHost({ id: 'prod', configured: false });
    const controller = controllerFor(fake);

    await controller.refresh();

    expect(lastView(fake).projects.status).toBe('not_configured');
    expect(lastView(fake).environment.configured).toBe(false);
    expect(fake.modelCalls).toEqual([]);
  });

  it('selects the first project and loads its first page of models', async () => {
    const fake = fakeHost();
    fake.nextProjects = () => Promise.resolve(ok([project('p1'), project('p2')]));
    fake.nextModels = () => Promise.resolve(ok({ items: [model('m1')], hasMore: false }));
    const controller = controllerFor(fake);

    await controller.refresh();

    expect(lastView(fake).selectedProjectId).toBe('p1');
    expect(fake.modelCalls).toEqual([{ projectId: 'p1', page: 0 }]);
    expect(lastView(fake).models.items.map((entry) => entry.id)).toEqual(['m1']);
  });

  it('keeps the selected project on refresh when it is still listed', async () => {
    const fake = fakeHost();
    fake.nextProjects = () => Promise.resolve(ok([project('p1'), project('p2')]));
    const controller = controllerFor(fake);
    await controller.refresh();
    await controller.selectProject('p2');

    await controller.refresh();

    expect(lastView(fake).selectedProjectId).toBe('p2');
  });

  it('picks the first project on refresh when the selected one disappeared', async () => {
    const fake = fakeHost();
    fake.nextProjects = () => Promise.resolve(ok([project('p1'), project('p2')]));
    const controller = controllerFor(fake);
    await controller.refresh();
    await controller.selectProject('p2');
    fake.nextProjects = () => Promise.resolve(ok([project('p1')]));

    await controller.refresh();

    expect(lastView(fake).selectedProjectId).toBe('p1');
  });

  it('reports a failed project list with its message and no selection', async () => {
    const fake = fakeHost();
    fake.nextProjects = () => Promise.resolve(fail('HTTP 404'));
    const controller = controllerFor(fake);

    await controller.refresh();

    expect(lastView(fake).projects.status).toBe('error');
    expect(lastView(fake).projects.error).toBe('HTTP 404');
    expect(lastView(fake).selectedProjectId).toBeUndefined();
  });

  it('ignores a project list that arrives after the environment changed', async () => {
    const fake = fakeHost({ id: 'dev', configured: true });
    const staleProjects = deferred<PanelResult<readonly ProjectSummary[]>>();
    const freshProjects = deferred<PanelResult<readonly ProjectSummary[]>>();
    const pending = [staleProjects.promise, freshProjects.promise];
    fake.nextProjects = () => pending.shift() ?? Promise.resolve(ok([]));
    fake.nextModels = () => Promise.resolve(ok({ items: [], hasMore: false }));
    const controller = controllerFor(fake);

    const firstLoad = controller.refresh();
    fake.env = { id: 'prod', configured: true };
    const switched = controller.onHostChange();
    freshProjects.resolve(ok([project('prod-1')]));
    await switched;
    staleProjects.resolve(ok([project('dev-1')]));
    await firstLoad;

    expect(lastView(fake).environment.id).toBe('prod');
    expect(lastView(fake).projects.items.map((entry) => entry.id)).toEqual(['prod-1']);
  });

  it('appends the next page on "load more" and stops when there is no more', async () => {
    const fake = fakeHost();
    fake.nextProjects = () => Promise.resolve(ok([project('p1')]));
    fake.nextModels = (_projectId, page) =>
      Promise.resolve(page === 0 ? ok({ items: [model('m1')], hasMore: true }) : ok({ items: [model('m2')], hasMore: false }));
    const controller = controllerFor(fake);
    await controller.refresh();

    await controller.loadMore();

    expect(fake.modelCalls).toEqual([
      { projectId: 'p1', page: 0 },
      { projectId: 'p1', page: 1 },
    ]);
    expect(lastView(fake).models.items.map((entry) => entry.id)).toEqual(['m1', 'm2']);
    expect(lastView(fake).models.hasMore).toBe(false);
  });

  it('ignores "load more" while a page is still loading', async () => {
    const fake = fakeHost();
    fake.nextProjects = () => Promise.resolve(ok([project('p1')]));
    const page1 = deferred<PanelResult<ModelPage>>();
    const pending = [Promise.resolve(ok({ items: [model('m1')], hasMore: true })), page1.promise];
    fake.nextModels = () => pending.shift() ?? Promise.resolve(ok({ items: [], hasMore: false }));
    const controller = controllerFor(fake);
    await controller.refresh();

    const first = controller.loadMore();
    await controller.loadMore();
    page1.resolve(ok({ items: [model('m2')], hasMore: false }));
    await first;

    expect(fake.modelCalls).toHaveLength(2);
  });

  it('keeps the loaded models and reports the error when a later page fails', async () => {
    const fake = fakeHost();
    fake.nextProjects = () => Promise.resolve(ok([project('p1')]));
    const pending = [
      Promise.resolve(ok({ items: [model('m1')], hasMore: true })),
      Promise.resolve(fail('Network error')),
    ];
    fake.nextModels = () => pending.shift() ?? Promise.resolve(ok({ items: [], hasMore: false }));
    const controller = controllerFor(fake);
    await controller.refresh();

    await controller.loadMore();

    expect(lastView(fake).models.status).toBe('error');
    expect(lastView(fake).models.error).toBe('Network error');
    expect(lastView(fake).models.items.map((entry) => entry.id)).toEqual(['m1']);
    expect(lastView(fake).models.hasMore).toBe(true);
  });

  it('drops the models of the previous project and ignores its late page', async () => {
    const fake = fakeHost();
    fake.nextProjects = () => Promise.resolve(ok([project('p1'), project('p2')]));
    const lateP1 = deferred<PanelResult<ModelPage>>();
    const pending = [
      Promise.resolve(ok({ items: [model('m1')], hasMore: false })),
      lateP1.promise,
      Promise.resolve(ok({ items: [model('n1')], hasMore: false })),
    ];
    fake.nextModels = () => pending.shift() ?? Promise.resolve(ok({ items: [], hasMore: false }));
    const controller = controllerFor(fake);
    await controller.refresh();

    const switching = controller.selectProject('p1');
    await controller.selectProject('p2');
    lateP1.resolve(ok({ items: [model('late')], hasMore: false }));
    await switching;

    expect(lastView(fake).selectedProjectId).toBe('p2');
    expect(lastView(fake).models.items.map((entry) => entry.id)).toEqual(['n1']);
  });

  it('does not select a project that is not listed', async () => {
    const fake = fakeHost();
    fake.nextProjects = () => Promise.resolve(ok([project('p1')]));
    const controller = controllerFor(fake);
    await controller.refresh();
    const callsBefore = fake.modelCalls.length;

    await controller.selectProject('unknown');

    expect(lastView(fake).selectedProjectId).toBe('p1');
    expect(fake.modelCalls).toHaveLength(callsBefore);
  });

  it('filters the visible models by the search and keeps all loaded models', async () => {
    const fake = fakeHost();
    fake.nextProjects = () => Promise.resolve(ok([project('p1')]));
    fake.nextModels = () =>
      Promise.resolve(ok({ items: [model('m1', 'Castle/Gate', 'gate.bbmodel'), model('m2', 'Forest/Tree', 'tree.bbmodel')], hasMore: false }));
    const controller = controllerFor(fake);
    await controller.refresh();

    controller.setSearch('TREE');

    expect(lastView(fake).visibleModels.map((entry) => entry.id)).toEqual(['m2']);
    expect(lastView(fake).models.items).toHaveLength(2);
    expect(lastView(fake).search).toBe('TREE');
  });

  it('opens the model of the selected project and clears the busy flag afterwards', async () => {
    const fake = fakeHost();
    fake.nextProjects = () => Promise.resolve(ok([project('p1')]));
    fake.nextModels = () => Promise.resolve(ok({ items: [model('m1')], hasMore: false }));
    const controller = controllerFor(fake);
    await controller.refresh();
    const gate = deferred<undefined>();
    fake.openResult = () => gate.promise;

    const opening = controller.openModel(model('m1'));
    expect(lastView(fake).openingModelId).toBe('m1');
    gate.resolve(undefined);
    await opening;

    expect(fake.opened.map((entry) => [entry.projectId, entry.model.id])).toEqual([['p1', 'm1']]);
    expect(lastView(fake).openingModelId).toBeUndefined();
  });

  it('does not open a model while no project is selected', async () => {
    const fake = fakeHost({ id: 'dev', configured: false });
    const controller = controllerFor(fake);
    await controller.refresh();

    await controller.openModel(model('m1'));

    expect(fake.opened).toEqual([]);
  });

  it('shows the testing flag while the connection test runs', async () => {
    const fake = fakeHost();
    const gate = deferred<undefined>();
    fake.testResult = () => gate.promise;
    const controller = controllerFor(fake);

    const testing = controller.testConnection();
    expect(lastView(fake).testing).toBe(true);
    gate.resolve(undefined);
    await testing;

    expect(fake.testCount).toBe(1);
    expect(lastView(fake).testing).toBe(false);
  });

  it('delegates "save to Vulpes" to the host', () => {
    const fake = fakeHost();
    controllerFor(fake).saveCurrentAsNew();

    expect(fake.saveCount).toBe(1);
  });

  it('shows the link of the current Blockbench project after a host change', async () => {
    const fake = fakeHost();
    fake.nextProjects = () => Promise.resolve(ok([project('p1')]));
    const controller = controllerFor(fake);
    await controller.refresh();
    expect(lastView(fake).link).toEqual({ kind: 'none' });

    fake.link = { environment: 'dev', key: 'Castle/Gate' };
    await controller.onHostChange();

    expect(lastView(fake).link).toEqual({ kind: 'linked', environment: 'dev', key: 'Castle/Gate' });
  });

  it('does not list projects again when only the link changed', async () => {
    const fake = fakeHost();
    fake.nextProjects = () => Promise.resolve(ok([project('p1')]));
    const controller = controllerFor(fake);
    await controller.refresh();
    const listsBefore = fake.modelCalls.length;

    fake.link = { environment: 'dev', key: 'k' };
    await controller.onHostChange();

    expect(fake.modelCalls).toHaveLength(listsBefore);
    expect(lastView(fake).selectedProjectId).toBe('p1');
  });

  it('reloads and clears the selection when the environment switches', async () => {
    const fake = fakeHost({ id: 'dev', configured: true });
    fake.nextProjects = () => Promise.resolve(ok([project('p1')]));
    const controller = controllerFor(fake);
    await controller.refresh();
    await controller.selectProject('p1');
    fake.env = { id: 'prod', configured: true };
    fake.nextProjects = () => Promise.resolve(ok([project('p9')]));

    await controller.onHostChange();

    expect(lastView(fake).environment.id).toBe('prod');
    expect(lastView(fake).selectedProjectId).toBe('p9');
    expect(lastView(fake).models.items).toEqual([]);
  });

  it('marks Prod as flagged in the environment view', async () => {
    const fake = fakeHost({ id: 'prod', configured: true });
    const controller = controllerFor(fake);
    await controller.refresh();

    expect(lastView(fake).environment.flagged).toBe(true);
  });

  it('starts from the host state through current()', () => {
    const fake = fakeHost({ id: 'dev', configured: true });
    fake.link = { environment: 'dev', key: 'x' };
    const controller = controllerFor(fake);

    expect(controller.current().link).toEqual({ kind: 'linked', environment: 'dev', key: 'x' });
  });
});

describe('live section', () => {
  function linkedFake(): FakeHost {
    const fake = fakeHost();
    fake.link = { environment: 'dev', key: 'Castle/Gate' };
    return fake;
  }

  it('shows the hint to save first and no session action while the project is not linked', () => {
    const fake = fakeHost();
    const controller = controllerFor(fake);

    expect(controller.current().live.state).toEqual({ kind: 'not-linked' });
  });

  it('offers to start a session for a linked model without a registered session', () => {
    const controller = controllerFor(linkedFake());

    expect(controller.current().live.state).toEqual({ kind: 'idle' });
  });

  it('moves from none to available when another host registers a session', async () => {
    const fake = linkedFake();
    const controller = controllerFor(fake);

    fake.session = { kind: 'available', host: 'localhost', token: 'token-1' };
    await controller.onHostChange();

    expect(lastView(fake).live.state).toEqual({ kind: 'available', host: 'localhost' });
  });

  it('moves from available to joining to joined when the designer joins', async () => {
    const fake = linkedFake();
    const controller = controllerFor(fake);
    fake.session = { kind: 'available', host: 'localhost', token: 'token-1' };
    await controller.onHostChange();

    controller.joinLive();
    expect(fake.joinCount).toBe(1);
    fake.session = { kind: 'joining', host: 'localhost', token: 'token-1' };
    await controller.onHostChange();
    expect(lastView(fake).live.state).toEqual({ kind: 'joining' });

    fake.session = { kind: 'joined', host: 'localhost', token: 'token-1' };
    await controller.onHostChange();
    expect(lastView(fake).live.state).toEqual({ kind: 'joined' });
  });

  it('shows the participant count while this instance hosts the session', async () => {
    const fake = linkedFake();
    const controller = controllerFor(fake);

    fake.session = { kind: 'hosting', token: 'token-1', participants: 3 };
    await controller.onHostChange();

    expect(lastView(fake).live.state).toEqual({ kind: 'hosting', participants: 3 });
  });

  it('shows that live editing is not available in this environment and starts nothing', () => {
    const fake = linkedFake();
    fake.environmentAvailable = false;
    const controller = controllerFor(fake);

    controller.startLive();

    expect(fake.startCount).toBe(0);
    expect(controller.current().live.state).toEqual({ kind: 'unavailable', reason: 'environment' });
  });

  it('shows that live editing is not available on this backend and joins nothing', async () => {
    const fake = linkedFake();
    const controller = controllerFor(fake);
    fake.session = { kind: 'available', host: 'localhost', token: 'token-1' };
    await controller.onHostChange();
    fake.backendAvailable = false;

    controller.joinLive();
    await controller.onHostChange();

    expect(fake.joinCount).toBe(0);
    expect(lastView(fake).live.state).toEqual({ kind: 'unavailable', reason: 'backend' });
  });

  it('forwards a start to the host once', () => {
    const fake = linkedFake();
    const controller = controllerFor(fake);

    controller.startLive();

    expect(fake.startCount).toBe(1);
  });

  it('keeps the state and shows the message when the host refuses the start', () => {
    const fake = linkedFake();
    fake.startResult = fail('Link this project to Vulpes first');
    const controller = controllerFor(fake);

    controller.startLive();

    expect(controller.current().live.state).toEqual({ kind: 'idle' });
    expect(controller.current().live.error).toBe('Link this project to Vulpes first');
  });

  it('starts nothing while a session is already running', async () => {
    const fake = linkedFake();
    fake.session = { kind: 'hosting', token: 'token-1', participants: 1 };
    const controller = controllerFor(fake);
    await controller.onHostChange();

    controller.startLive();

    expect(fake.startCount).toBe(0);
  });

  it('joins nothing when no session is available', () => {
    const fake = linkedFake();
    const controller = controllerFor(fake);

    controller.joinLive();

    expect(fake.joinCount).toBe(0);
  });

  it('forwards leave to the host while a session is running', async () => {
    const fake = linkedFake();
    fake.session = { kind: 'hosting', token: 'token-1', participants: 2 };
    const controller = controllerFor(fake);
    await controller.onHostChange();

    controller.leaveLive();

    expect(fake.leaveCount).toBe(1);
  });

  it('forwards nothing on leave while no session is running', () => {
    const fake = linkedFake();
    const controller = controllerFor(fake);

    controller.leaveLive();

    expect(fake.leaveCount).toBe(0);
  });
});
