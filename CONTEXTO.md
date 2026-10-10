# Contexto · dashboards por equipe

## Escopo
Sistema separado do dashboard gerencial (repo `paulollaque12/test-creativeimob`). Cada equipe vê só seus dados: Overview e Comparativo; só o filtro Corretor (Loja/Equipe/Veículo removidos). Equipes sem dashboard: "(sem equipe)", Aluguel, Coordenação Geral.

## Segurança (repo público)
- Filtrar no navegador NÃO protege. Por isso cada equipe tem seu próprio `data.enc.json`, fatiado por equipe (`r[4]==índice da equipe`) e cifrado com a senha da equipe. O HTML não contém dado nenhum.
- Dicionários recompactados por equipe (sem nomes/lojas/corretores de outras equipes). `K` (cliente→corretores) restrito aos clientes da equipe; corretores de fora viram ids anônimos (só contam, para manter os números idênticos ao gerencial).
- Senha = `<slug>-<token>`; token = 8 caracteres de HMAC-SHA256(slug, segredo mestre) em base32 minúsculo. Segredo mestre (`EQUIPES_MESTRE`) e senha do cubo gerencial (`DASH_SENHA`) ficam só no prompt da tarefa agendada; nunca em arquivo/commit/mensagem.
- Para rotacionar todas as senhas: trocar o segredo mestre na tarefa e rodar de novo; avisar as equipes.

## Arquivos
- `fonte/dashboard-gralha-funil.html`: cópia do HTML ao vivo do gerencial (v44). `tools/shim.js`: idem (responde as consultas a partir do cubo). Se o gerencial mudar de layout/lógica, copiar de novo os dois e regerar.
- `tools/build_equipes.py`: decifra o cubo gerencial, fatia, cifra por equipe e gera `docs/<slug>/index.html` + `data.enc.json`. Transformações do HTML: nav só com Overview/Comparativo (painéis dos outros ficam ocultos no DOM para não quebrar o JS), remove filtros loja/equipe/veículo (incl. c1/c2), remove `$("f-veiculo").parentElement.hidden=pr;`, título com o nome da equipe, loader com senha (`sessionStorage` chave `gpw-<slug>`).
- Validação do piloto (Equipe 1): Overview (cards, funil, tabela), filtro de corretor e Comparativo idênticos ao gerencial filtrado por EQUIPE 1.
