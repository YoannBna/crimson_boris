import { ModuleSection } from '@/components/ModuleSection'
import { Card, Item, Tag, Em, Note } from '@/components/primitives'
import { QUOTES, ETF_GRIDS, MARKETS_AS_OF } from '@/data/markets'
import { LiveQuotes } from '@/components/LiveQuotes'
import { AsymmetryPanel } from './finance/AsymmetryPanel'
import { useMarkets } from '@/lib/useBoris'

function asOfLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
}

export function M02Radar() {
  const markets = useMarkets()

  return (
    <ModuleSection id="m2" num="02" title="RADAR FINANCIER">
      <div className="grid g2">
        <Card full title="◈ Cotations en direct — surveillance des seuils">
          <LiveQuotes snapshot={markets} />
        </Card>

        <AsymmetryPanel snapshot={markets} />

        <Card title="■ Chocs macroeconomiques">
          <Item title={<><Tag kind="crit">Fed</Tag>Dissension inedite depuis 10 ans</>}>
            FOMC du 29 juillet : statu quo vote <Em>9 – 3</Em>, trois presidents regionaux reclamant{' '}
            <Em>+25 pb</Em>. Les minutes du <Em>19 aout</Em> confirment que de nombreux autres
            responsables jugent un resserrement necessaire si l'inflation ne reflue pas.
          </Item>
          <Item title={<><Tag kind="crit">BCE</Tag>Premiere hausse en trois ans</>}>
            11 juin 2026 : <Em>+25 pb</Em> sur les trois taux (effectif le 17 juin). Depot{' '}
            <Em>2,25 %</Em> · Refi <Em>2,40 %</Em> · Pret marginal <Em>2,65 %</Em>. Motif : pressions
            inflationnistes issues du Moyen-Orient. Nouvelle hausse evoquee pour la rentree.
          </Item>
          <Item title={<><Tag kind="hot">Energie</Tag>Brent au-dessus de 91 $</>}>
            Variable directrice du cycle : elle commande simultanement les taux et la prime de risque
            actions.
          </Item>
          <Item title={<><Tag kind="hot">Taux longs</Tag>Envolee des rendements</>}>
            Rendements longs eleves, compression des multiples. Double contrainte : banques centrales
            restrictives + besoins de financement souverains.
          </Item>
        </Card>

        <Card title="■ Indices & niveaux techniques">
          <table>
            <thead>
              <tr>
                <th>Actif</th>
                <th className="n">Niveau</th>
                <th className="n">Var.</th>
                <th>Lecture</th>
              </tr>
            </thead>
            <tbody>
              {QUOTES.map((q) => (
                <tr key={q.symbol}>
                  <td className="sym">{q.symbol}</td>
                  <td className="n">{q.level}</td>
                  <td className={`n ${q.tone}`}>{q.change}</td>
                  <td className="fl">{q.reading}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Note>
            Support majeur du CAC : <b>8 560</b> puis <b>8 500</b>. Rupture confirmee des 8 500 =
            invalidation de la structure haussiere de l'ete.
            <br />
            <br />
            Snapshot statique arrete au <b>{asOfLabel(MARKETS_AS_OF)}</b> — cotations non connectees a
            ce stade.
          </Note>
        </Card>

        <Card title="● Actifs stables — preservation">
          <Item title={<><Tag kind="ok">Pilier</Tag>Or — ~4 400 $ / once</>}>
            Sortie de la congestion des 4 100 $. Le 5 aout : <Em>+4,4 %</Em> a 4 253 $, puis 4 262 $.
            Objectif <Em>4 850 $</Em> si franchissement des 4 450 $. Soutiens : dollar faible, achats
            de banques centrales — la Coree du Sud a annonce son <Em>premier achat en 13 ans</Em>.
          </Item>
          <Item title={<><Tag kind="hot">Prudence</Tag>Obligations souveraines</>}>
            Statut de refuge degrade tant que le biais reste au resserrement : le risque de duration
            joue contre le porteur. Court terme prefere au long terme jusqu'a stabilisation du Brent.
          </Item>
          <Item title={<><Tag kind="ok">Devises</Tag>Dollar — affaiblissement</>}>
            Proche de plus bas de trois mois face au yen debut aout ; euro a 1,16. Un dollar faible
            soutient mecaniquement l'or et les emergents.
          </Item>
        </Card>

        <Card title="▲ Actifs en tendance — velocite">
          <Item title={<><Tag kind="crit">-43 % / an</Tag>Bitcoin — 64 339 $</>}>
            Capitalisation <Em>1,33 T$</Em>. Rebond de <Em>+2,6 %</Em> le 19 aout apres l'annonce d'un
            projet de regulation SEC, mais l'actif reste <Em>43 % sous</Em> son niveau d'il y a un an
            (112 926 $). Le rebond est un flux, pas une tendance.
          </Item>
          <Item title={<><Tag kind="hot">Crypto</Tag>Ethereum ~1 900 $ · XRP defend 1 $</>}>
            Seuils psychologiques bas testes. Correlation elevee au calendrier reglementaire americain.
          </Item>
          <Item title={<><Tag kind="crit">Fragilite</Tag>Semi-conducteurs & IA</>}>
            STMicroelectronics <Em>-1,1 %</Em>. Le doute porte sur le <Em>financement</Em> des
            investissements des geants tech, pas sur la demande. Point de bascule du narratif IA.
          </Item>
          <Item title={<><Tag kind="hot">Rotation</Tag>Ecarts sectoriels du 19/08</>}>
            Stellantis <Em>+3,22 %</Em> · Danone <Em>-2,97 %</Em> · Societe Generale <Em>-1,6 %</Em>,
            Credit Agricole en repli — les banques subissent la deformation de la courbe.
          </Item>
        </Card>
      </div>

      <div className="grid g3" style={{ marginTop: 14 }}>
        {ETF_GRIDS.map((g) => (
          <Card key={g.name} title={g.title}>
            <div className="etf">
              <div className="etf-top">
                <span className="etf-name">{g.name}</span>
                <span className={`etf-sig ${g.signalCls}`}>{g.signal}</span>
              </div>
              <div className="bar">
                <span style={{ width: `${g.conviction}%` }} />
              </div>
              <div className="etf-d">{g.body}</div>
            </div>
          </Card>
        ))}
      </div>
    </ModuleSection>
  )
}
