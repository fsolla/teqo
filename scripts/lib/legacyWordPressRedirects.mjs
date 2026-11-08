/**
 * Legacy WordPress permalinks (`jorgesolla.com.br/<YYYY>/<MM>/<DD>/<slug>/`)
 * redirected to the canonical Teqo article path.
 *
 * Snapshot: WordPress REST `/wp-json/wp/v2/posts?per_page=100` on 2026-11-08 —
 * 43 published posts, latest 2026-08-17. Destinations are the current
 * `post.type` + `post.category` of the same slug in the production database.
 * The unit test pins the count, shape and uniqueness; if the WordPress archive
 * changes before the cutover, update this list and re-run it.
 */
export const legacyWordPressPostRedirects = [
  {
    source: '/2024/07/22/apresentacao-do-plano-de-restauracao-arquitetonica-da-famed-ufba',
    destination:
      '/noticia/educacao/apresentacao-do-plano-de-restauracao-arquitetonica-da-famed-ufba',
  },
  {
    source:
      '/2024/07/22/obra-de-ampliacao-do-sistema-de-abastecimento-do-rio-paraguacu-itirucu-jaguaquara',
    destination:
      '/noticia/desenvolvimento/obra-de-ampliacao-do-sistema-de-abastecimento-do-rio-paraguacu-itirucu-jaguaquara',
  },
  {
    source:
      '/2024/07/22/solla-e-indicado-em-estudo-da-arko-advice-como-um-politico-da-elite-parlamentar',
    destination:
      '/noticia/politica/solla-e-indicado-em-estudo-da-arko-advice-como-um-politico-da-elite-parlamentar',
  },
  {
    source: '/2024/07/24/jorge-solla-apresenta-pec-que-eleva-pensao-por-morte',
    destination:
      '/noticia/direitos-trabalhistas/jorge-solla-apresenta-pec-que-eleva-pensao-por-morte',
  },
  {
    source: '/2024/07/24/portaria-autoriza-retorno-de-mais-de-300-servidores-a-funasa',
    destination: '/noticia/saude/portaria-autoriza-retorno-de-mais-de-300-servidores-a-funasa',
  },
  {
    source: '/2024/07/24/solla-comemora-anuncio-de-construcao-de-novo-campus-federal-em-jequie',
    destination:
      '/noticia/educacao/solla-comemora-anuncio-de-construcao-de-novo-campus-federal-em-jequie',
  },
  {
    source: '/2024/07/26/entrevista-solla-fala-sobre-a-retomada-dos-investimentos-publicos-no-pais',
    destination:
      '/noticia/desenvolvimento/entrevista-solla-fala-sobre-a-retomada-dos-investimentos-publicos-no-pais',
  },
  {
    source: '/2026/02/20/solla-desembarca-na-india-em-missao-oficial-com-lula-pela-asia',
    destination: '/noticia/saude/solla-desembarca-na-india-em-missao-oficial-com-lula-pela-asia',
  },
  {
    source: '/2026/02/23/da-asia-solla-manifesta-apoio-a-servidores-demitidos-por-bruno-reis',
    destination:
      '/noticia/direitos-trabalhistas/da-asia-solla-manifesta-apoio-a-servidores-demitidos-por-bruno-reis',
  },
  {
    source:
      '/2026/02/24/governo-lula-corrige-erro-de-antecessor-diz-solla-sobre-suspensao-da-importacao-de-cacau',
    destination:
      '/noticia/desenvolvimento/governo-lula-corrige-erro-de-antecessor-diz-solla-sobre-suspensao-da-importacao-de-cacau',
  },
  {
    source:
      '/2026/02/24/missao-internacional-com-solla-lula-e-jeronimo-fortalece-producao-de-medicamentos-estrategicos-e-projeta-a-bahia-como-polo-de-biofarmacos',
    destination:
      '/noticia/saude/missao-internacional-com-solla-lula-e-jeronimo-fortalece-producao-de-medicamentos-estrategicos-e-projeta-a-bahia-como-polo-de-biofarmacos',
  },
  {
    source:
      '/2026/02/26/solla-articula-agenda-de-dirigentes-da-ufba-no-ministerio-da-cultura-para-viabilizar-reforma-de-alas-da-faculdade-de-medicina',
    destination:
      '/noticia/educacao/solla-articula-agenda-de-dirigentes-da-ufba-no-ministerio-da-cultura-para-viabilizar-reforma-de-alas-da-faculdade-de-medicina',
  },
  {
    source:
      '/2026/02/28/pt-de-jacobina-celebra-aniversario-com-presenca-de-jorge-solla-e-do-secretario-do-governo-lula-julio-pinheiro',
    destination:
      '/noticia/politica/pt-de-jacobina-celebra-aniversario-com-presenca-de-jorge-solla-e-do-secretario-do-governo-lula-julio-pinheiro',
  },
  {
    source:
      '/2026/03/03/com-presenca-de-solla-e-aliados-aniversario-do-pt-de-jacobina-reune-liderancas-e-reafirma-compromisso-o-desenvolvimento-da-bahia',
    destination:
      '/noticia/politica/com-presenca-de-solla-e-aliados-aniversario-do-pt-de-jacobina-reune-liderancas-e-reafirma-compromisso-o-desenvolvimento-da-bahia',
  },
  {
    source:
      '/2026/03/04/solla-participa-das-celebracoes-pelos-218-anos-da-faculdade-de-medicina-da-ufba',
    destination:
      '/noticia/educacao/solla-participa-das-celebracoes-pelos-218-anos-da-faculdade-de-medicina-da-ufba',
  },
  {
    source:
      '/2026/03/04/solla-rebate-ataques-de-ze-coca-e-destaca-investimentos-do-mandato-em-itirucu-e-na-regiao-de-jequie',
    destination:
      '/noticia/politica/solla-rebate-ataques-de-ze-coca-e-destaca-investimentos-do-mandato-em-itirucu-e-na-regiao-de-jequie',
  },
  {
    source:
      '/2026/03/06/camara-aprova-pec-da-seguranca-publica-e-solla-destaca-avanco-da-proposta-do-governo-lula',
    destination:
      '/noticia/seguranca/camara-aprova-pec-da-seguranca-publica-e-solla-destaca-avanco-da-proposta-do-governo-lula',
  },
  {
    source:
      '/2026/03/17/articulacao-de-solla-fortalece-pt-com-filiacao-da-lideranca-sindical-zilar-portela',
    destination:
      '/noticia/politica/articulacao-de-solla-fortalece-pt-com-filiacao-da-lideranca-sindical-zilar-portela',
  },
  {
    source:
      '/2026/03/17/solla-articula-no-mec-avancos-para-expansao-da-educacao-superior-e-da-educacao-profissional-na-bahia',
    destination:
      '/noticia/educacao/solla-articula-no-mec-avancos-para-expansao-da-educacao-superior-e-da-educacao-profissional-na-bahia',
  },
  {
    source:
      '/2026/03/18/solla-protocola-pec-para-garantir-controle-estatal-sobre-petroleo-e-derivados-no-brasil',
    destination:
      '/noticia/desenvolvimento/solla-protocola-pec-para-garantir-controle-estatal-sobre-petroleo-e-derivados-no-brasil',
  },
  {
    source:
      '/2026/03/20/ao-lado-de-camilo-santana-jorge-solla-acompanha-avancos-da-educacao-federal-em-barreiras-e-pocoes',
    destination:
      '/noticia/educacao/ao-lado-de-camilo-santana-jorge-solla-acompanha-avancos-da-educacao-federal-em-barreiras-e-pocoes',
  },
  {
    source:
      '/2026/03/20/articulada-por-solla-filiacao-de-zilar-portela-ao-pt-marca-lancamento-de-pre-candidatura-a-deputada-estadual',
    destination:
      '/noticia/politica/articulada-por-solla-filiacao-de-zilar-portela-ao-pt-marca-lancamento-de-pre-candidatura-a-deputada-estadual',
  },
  {
    source:
      '/2026/03/22/recomprar-a-refinaria-de-mataripe-e-defender-a-bahia-e-a-soberania-do-brasil',
    destination:
      '/noticia/desenvolvimento/recomprar-a-refinaria-de-mataripe-e-defender-a-bahia-e-a-soberania-do-brasil',
  },
  {
    source: '/2026/03/31/emenda-de-solla-garante-maquinas-de-costura-a-associacao-de-fibromialgia',
    destination:
      '/noticia/saude/emenda-de-solla-garante-maquinas-de-costura-a-associacao-de-fibromialgia',
  },
  {
    source: '/2026/04/01/federacao-brasil-esperanca-exige-defesa-do-nosso-projeto-politico',
    destination:
      '/noticia/politica/federacao-brasil-esperanca-exige-defesa-do-nosso-projeto-politico',
  },
  {
    source: '/2026/04/01/fim-da-escala-6x1-tambem-e-questao-de-saude',
    destination: '/noticia/direitos-trabalhistas/fim-da-escala-6x1-tambem-e-questao-de-saude',
  },
  {
    source: '/2026/04/14/fora-trump-em-defesa-da-saude-e-da-paz',
    destination: '/noticia/saude/fora-trump-em-defesa-da-saude-e-da-paz',
  },
  {
    source: '/2026/04/16/solla-comemora-25-anos-da-politica-nacional-de-sangue-neste-16-de-abril',
    destination:
      '/noticia/saude/solla-comemora-25-anos-da-politica-nacional-de-sangue-neste-16-de-abril',
  },
  {
    source:
      '/2026/05/05/solla-leva-comissao-da-camara-para-nova-visita-tecnica-ao-estaleiro-enseada',
    destination:
      '/noticia/desenvolvimento/solla-leva-comissao-da-camara-para-nova-visita-tecnica-ao-estaleiro-enseada',
  },
  {
    source:
      '/2026/05/08/com-solla-comissao-acompanha-retomada-da-producao-no-enseada-em-maragogipe',
    destination:
      '/noticia/desenvolvimento/com-solla-comissao-acompanha-retomada-da-producao-no-enseada-em-maragogipe',
  },
  {
    source:
      '/2026/05/08/solla-conduz-cffc-em-visita-tecnica-a-primeira-faculdade-de-medicina-do-brasil',
    destination:
      '/noticia/educacao/solla-conduz-cffc-em-visita-tecnica-a-primeira-faculdade-de-medicina-do-brasil',
  },
  {
    source:
      '/2026/05/11/solla-reforca-luta-por-cumprimento-do-piso-da-enfermagem-em-audiencia-na-camara',
    destination:
      '/noticia/saude/solla-reforca-luta-por-cumprimento-do-piso-da-enfermagem-em-audiencia-na-camara',
  },
  {
    source: '/2026/05/14/audiencia-publica-debate-plano-nacional-de-cultura',
    destination: '/noticia/cultura/audiencia-publica-debate-plano-nacional-de-cultura',
  },
  {
    source:
      '/2026/05/28/clube-2004-celebra-a-democracia-com-o-lancamento-da-pre-candidatura-de-jorge-solla-a-deputado-federal',
    destination:
      '/noticia/politica/clube-2004-celebra-a-democracia-com-o-lancamento-da-pre-candidatura-de-jorge-solla-a-deputado-federal',
  },
  {
    source: '/2026/06/10/programa-de-governo-participativo-reune-multidao-em-periperi',
    destination: '/noticia/politica/programa-de-governo-participativo-reune-multidao-em-periperi',
  },
  {
    source: '/2026/06/12/governo-da-bahia-anuncia-pacote-de-quase-r-2-bi',
    destination: '/noticia/desenvolvimento/governo-da-bahia-anuncia-pacote-de-quase-r-2-bi',
  },
  {
    source: '/2026/06/20/solla-e-jeronimo-inauguram-mercado-publico-de-ubata',
    destination: '/noticia/desenvolvimento/solla-e-jeronimo-inauguram-mercado-publico-de-ubata',
  },
  {
    source: '/2026/07/02/lula-jeronimo-e-solla-inauguram-hospital-do-litoral-norte-da-bahia',
    destination:
      '/noticia/saude/lula-jeronimo-e-solla-inauguram-hospital-do-litoral-norte-da-bahia',
  },
  {
    source:
      '/2026/07/02/solla-exalta-primeiro-ano-de-salvador-como-capital-do-brasil-no-2-de-julho',
    destination:
      '/noticia/cultura/solla-exalta-primeiro-ano-de-salvador-como-capital-do-brasil-no-2-de-julho',
  },
  {
    source: '/2026/07/31/chapada-diamantina-recebe-caravana-liderada-pelo-deputado-jorge-solla',
    destination:
      '/noticia/politica/chapada-diamantina-recebe-caravana-liderada-pelo-deputado-jorge-solla',
  },
  {
    source:
      '/2026/08/02/lula-reforca-o-time-de-jeronimo-wagner-rui-e-jorge-solla-na-convencao-estadual-do-pt',
    destination:
      '/noticia/politica/lula-reforca-o-time-de-jeronimo-wagner-rui-e-jorge-solla-na-convencao-estadual-do-pt',
  },
  {
    source:
      '/2026/08/11/o-pt-tem-que-disputar-o-programa-de-governo-conclamou-jorge-solla-em-plenaria',
    destination:
      '/noticia/politica/o-pt-tem-que-disputar-o-programa-de-governo-conclamou-jorge-solla-em-plenaria',
  },
  {
    source:
      '/2026/08/17/bruno-reis-foi-covarde-detonou-solla-ao-rebater-o-prefeito-sobre-saude-de-salvador',
    destination:
      '/noticia/politica/bruno-reis-foi-covarde-detonou-solla-ao-rebater-o-prefeito-sobre-saude-de-salvador',
  },
]
