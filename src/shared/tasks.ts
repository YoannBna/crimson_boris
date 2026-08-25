import type { DueClass } from './types'

/**
 * Definition des actions requises.
 *
 * Vide par defaut : les taches appartiennent a l'operateur, pas a
 * l'application. Elles arrivent par le connecteur de courrier une fois
 * celui-ci configure, ou sont saisies a la main.
 */
export interface TaskDef {
  id: string
  label: string
  detail: string
  due: string
  dueCls: DueClass
  /** ISO — echeance reelle, quand elle existe. Sert a la regle `deadline-shift`. */
  dueDate?: string
}

export const TASK_DEFS: TaskDef[] = []
