import { app, Menu, Tray, type MenuItemConstructorOptions } from 'electron'
import type { CoreStatus, Settings, TriggerSource } from '@shared/types'
import { trayIcon } from './trayIcon'

const INTERVAL_CHOICES = [15, 30, 60]
const COOLDOWN_CHOICES = [60, 240, 720]

export interface TrayActions {
  reveal: () => void
  purge: () => void
  refresh: (trigger: TriggerSource) => void
  setActive: (active: boolean) => void
  updateSettings: (patch: Partial<Settings>) => void
  quit: () => void
}

let tray: Tray | null = null

export function createTray(status: CoreStatus, actions: TrayActions): void {
  tray = new Tray(trayIcon())
  tray.setToolTip('Crimson Boris')
  tray.on('click', () => tray?.popUpContextMenu())
  updateTray(status, actions)
}

export function updateTray(status: CoreStatus, actions: TrayActions): void {
  if (!tray) return

  // Pastille dans la barre de menus tant qu'un signal critique tient.
  tray.setTitle(status.active && status.severity === 'critical' ? ' ●' : '')
  tray.setToolTip(
    status.severity === 'critical'
      ? `Crimson Boris — ${status.hits.length} signal(aux) critique(s)`
      : 'Crimson Boris'
  )

  const template: MenuItemConstructorOptions[] = [
    {
      label: status.active
        ? status.running
          ? 'Cycle en cours…'
          : `Actif — prochain cycle ${clock(status.nextCycle)}`
        : 'Suspendu',
      enabled: false
    },
    {
      label: `Dernier cycle : ${clock(status.lastCycle)} (${TRIGGER_FR[status.lastTrigger]})`,
      enabled: false
    }
  ]

  if (status.hits.length > 0) {
    template.push({ type: 'separator' }, { label: 'SIGNAUX', enabled: false })
    for (const h of status.hits) {
      template.push({ label: `  ${h.label}`, toolTip: h.detail, click: actions.reveal })
    }
  }

  template.push(
    { type: 'separator' },
    { label: 'Ouvrir Boris', accelerator: 'CmdOrCtrl+Shift+B', click: actions.reveal },
    {
      label: 'Rafraichir maintenant',
      enabled: status.active && !status.running,
      click: () => actions.refresh('manual')
    },
    { type: 'separator' },
    {
      label: 'Suspendre Boris',
      type: 'checkbox',
      checked: !status.active,
      click: () => actions.setActive(!status.active)
    },
    {
      label: 'Cadence',
      submenu: INTERVAL_CHOICES.map<MenuItemConstructorOptions>((m) => ({
        label: `${m} minutes`,
        type: 'radio',
        checked: status.settings.intervalMinutes === m,
        click: () => actions.updateSettings({ intervalMinutes: m })
      }))
    },
    {
      label: 'S’imposer si critique',
      type: 'checkbox',
      checked: status.settings.revealOnCritical,
      click: () => actions.updateSettings({ revealOnCritical: !status.settings.revealOnCritical })
    },
    {
      label: 'Ne pas insister avant',
      enabled: status.settings.revealOnCritical,
      submenu: COOLDOWN_CHOICES.map<MenuItemConstructorOptions>((m) => ({
        label: m >= 60 ? `${m / 60} h` : `${m} minutes`,
        type: 'radio',
        checked: status.settings.revealCooldownMinutes === m,
        click: () => actions.updateSettings({ revealCooldownMinutes: m })
      }))
    },
    {
      label: 'Lancer a l’ouverture de session',
      type: 'checkbox',
      checked: status.settings.launchAtLogin,
      click: () => actions.updateSettings({ launchAtLogin: !status.settings.launchAtLogin })
    },
    { type: 'separator' },
    { label: 'Effacer toutes mes donnees…', click: actions.purge },
    { label: 'Quitter Boris', accelerator: 'CmdOrCtrl+Q', click: actions.quit }
  )

  tray.setContextMenu(Menu.buildFromTemplate(template))
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}

const TRIGGER_FR: Record<TriggerSource, string> = {
  boot: 'demarrage',
  interval: 'cycle',
  resume: 'sortie de veille',
  unlock: 'deverrouillage',
  active: 'retour operateur',
  'clock-jump': 'saut d’horloge',
  manual: 'manuel'
}

function clock(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/** Applique le reglage de lancement au demarrage au niveau du systeme. */
export function applyLaunchAtLogin(enabled: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    // Boris demarre masque : la barre de menus est sa presence par defaut.
    openAsHidden: true,
    args: ['--hidden']
  })
}
