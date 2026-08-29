import { contextBridge, ipcRenderer } from 'electron'
import type {
  BorisAPI,
  CoreStatus,
  MarketSnapshot,
  MtgAPI,
  Settings,
  TaskState
} from '@shared/types'
import type { ChosenArt, SimConfig } from '@shared/mtg'
import type { Change, ForgeAPI, PoolQuery } from '@shared/forge'
import type { ConfigAPI, ConnectorId, OperatorProfile } from '@shared/config'
import type { VersionInfo } from '@shared/version'

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const handler = (_e: unknown, payload: T): void => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => { ipcRenderer.off(channel, handler) }
}

const mtg: MtgAPI = {
  getDeck: () => ipcRenderer.invoke('mtg:deck'),
  importFromFolder: () => ipcRenderer.invoke('mtg:import-folder'),
  importDialog: () => ipcRenderer.invoke('mtg:import-dialog'),
  decksDir: () => ipcRenderer.invoke('mtg:decks-dir'),
  getLastRun: () => ipcRenderer.invoke('mtg:last-run'),
  runSim: (config: Partial<SimConfig>) => ipcRenderer.invoke('mtg:run-sim', config),
  getSuggestions: () => ipcRenderer.invoke('mtg:suggestions'),
  getStyleUpgrades: (names?: string[]) => ipcRenderer.invoke('mtg:style', names),

  getPrintings: (name: string) => ipcRenderer.invoke('mtg:printings', name),
  getArts: () => ipcRenderer.invoke('mtg:arts'),
  chooseArt: (art: Omit<ChosenArt, 'chosenAt'>) => ipcRenderer.invoke('mtg:choose-art', art),
  clearArt: (cardName: string) => ipcRenderer.invoke('mtg:clear-art', cardName)
}

const forge: ForgeAPI = {
  getWorkbench: () => ipcRenderer.invoke('forge:workbench'),
  advise: () => ipcRenderer.invoke('forge:advise'),
  searchPool: (query: PoolQuery) => ipcRenderer.invoke('forge:search', query),
  planDirectives: (text: string) => ipcRenderer.invoke('forge:plan', text),
  addChange: (change: Omit<Change, 'id'>) => ipcRenderer.invoke('forge:add', change),
  dropChange: (id: string) => ipcRenderer.invoke('forge:drop', id),
  clearChanges: () => ipcRenderer.invoke('forge:clear'),
  exportPlan: () => ipcRenderer.invoke('forge:export'),
  applyPlan: () => ipcRenderer.invoke('forge:apply'),
  history: () => ipcRenderer.invoke('forge:history'),
  revertTo: (versionId: number) => ipcRenderer.invoke('forge:revert', versionId)
}

const config: ConfigAPI = {
  get: () => ipcRenderer.invoke('config:get'),
  saveProfile: (p: Partial<OperatorProfile>) => ipcRenderer.invoke('config:profile', p),
  // La valeur part vers le process principal et n'en revient jamais.
  setSecret: (c: ConnectorId, key: string, value: string) =>
    ipcRenderer.invoke('config:secret', c, key, value),
  clearConnector: (c: ConnectorId) => ipcRenderer.invoke('config:clear', c),
  skipConnector: (c: ConnectorId) => ipcRenderer.invoke('config:skip', c),
  complete: () => ipcRenderer.invoke('config:complete'),
  purge: () => ipcRenderer.invoke('config:purge')
}

const api: BorisAPI = {
  config,
  getVersion: () => ipcRenderer.invoke('version:get'),
  checkVersion: () => ipcRenderer.invoke('version:check'),
  downloadUpdate: () => ipcRenderer.invoke('version:download'),
  installUpdate: () => ipcRenderer.invoke('version:install'),
  openReleases: () => ipcRenderer.invoke('version:open-releases'),
  onVersion: (cb: (v: VersionInfo) => void) => subscribe('version:changed', cb),
  mtg,
  forge,
  getStatus: () => ipcRenderer.invoke('core:status'),
  refreshNow: () => ipcRenderer.invoke('core:refresh'),
  setActive: (active: boolean) => ipcRenderer.invoke('core:set-active', active),
  updateSettings: (patch: Partial<Settings>) =>
    ipcRenderer.invoke('core:update-settings', patch),
  onStatus: (cb: (s: CoreStatus) => void) => subscribe('core:status-changed', cb),

  getTasks: () => ipcRenderer.invoke('tasks:list') as Promise<TaskState[]>,
  setTaskDone: (id: string, done: boolean) =>
    ipcRenderer.invoke('tasks:set-done', id, done) as Promise<TaskState[]>,

  getMarkets: () => ipcRenderer.invoke('markets:get') as Promise<MarketSnapshot | null>,
  onMarkets: (cb: (s: MarketSnapshot) => void) => subscribe('core:markets', cb)
}

contextBridge.exposeInMainWorld('boris', api)
