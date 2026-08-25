import { ModuleSection } from '@/components/ModuleSection'
import { Card, Note } from '@/components/primitives'
import type { OperatorProfile } from '@shared/config'

/**
 * Veille et anticipation.
 *
 * Le module ne porte aucun contenu editorial : il restitue les flux que
 * l'operateur a declares. Sans flux, il le dit — plutot que d'afficher
 * une actualite qui ne serait celle de personne.
 */
export function M01Actualites({ profile }: { profile: OperatorProfile }) {
  const feeds = profile.feeds

  return (
    <ModuleSection id="m1" num="01" title="VEILLE & ANTICIPATION">
      <div className="grid g2">
        <Card full title="◆ Flux surveilles">
          {feeds.length === 0 ? (
            <div className="standby">
              <div className="g">◆</div>
              <div className="m">AUCUN FLUX DECLARE</div>
              <div className="s">
                Boris n'invente pas d'actualite. Declare les flux <b>RSS</b> ou <b>Atom</b> que
                tu veux suivre dans la configuration, et ils seront releves a chaque cycle,
                classes par recurrence et croises avec le radar financier.
              </div>
            </div>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Etat</th>
                  </tr>
                </thead>
                <tbody>
                  {feeds.map((f) => (
                    <tr key={f}>
                      <td className="sym">{hostOf(f)}</td>
                      <td className="fl">en attente du prochain cycle</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Note>
                {feeds.length} flux declare(s). Les titres sont releves localement ; aucune
                donnee de lecture n'est transmise a qui que ce soit.
              </Note>
            </>
          )}
        </Card>

        <Card full title="⚠ Scenarios de risque">
          <div className="standby">
            <div className="g">⚠</div>
            <div className="m">GRILLE VIERGE</div>
            <div className="s">
              Cette grille croise evenements, actifs et objectifs personnels. Elle se remplit a
              mesure que les flux et les seuils de marche produisent des signaux — et reste
              propre a chaque operateur.
            </div>
          </div>
        </Card>
      </div>
    </ModuleSection>
  )
}

/** Nom d'hote lisible, a defaut de l'URL complete. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
