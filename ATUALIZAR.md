# Rotina diária (após o gerencial, ~07:20 America/Sao_Paulo)
1. Clonar `test-creativeimob` (raso) e conferir que `docs/data.enc.json` foi atualizado hoje (a rotina gerencial roda 06:52). Se o cubo não avançou (campo `ultimo` igual ao dos dados das equipes), parar sem publicar.
2. Clonar/atualizar `gralha-equipes`. `pip install --break-system-packages cryptography`.
3. `DASH_SENHA=... EQUIPES_MESTRE=... python3 -I tools/build_equipes.py --cubo <repo gerencial>/docs/data.enc.json`
4. Conferir: 15 pastas com `ultimo` = último dia do gerencial, linhas > 0 e sem queda > 2% por equipe. Qualquer falha: não publicar.
5. `git add docs && git commit -m "dados ate AAAA-MM-DD"` e push para main. Só mexer em `docs/`.
6. **Login unico (desde 05/11/2026)**: depois do passo 3, gerar TAMBEM so os dados das 15 equipes para o site do gerencial (a pagina `gralha.creativeimob.app` abre em "modo equipe" com usuario + senha da equipe e le `equipes/<slug>/data.enc.json`):
   `DASH_SENHA=... EQUIPES_MESTRE=... python3 -I tools/build_equipes.py --cubo <repo gerencial>/docs/data.enc.json --so-dados --saida <repo gerencial>/docs/equipes`
   Conferir 15 arquivos `docs/equipes/<slug>/data.enc.json`. Commit no repo GERENCIAL (`test-creativeimob`, so `docs/equipes/`), mensagem "equipes: dados ate AAAA-MM-DD", `git pull --rebase` antes do push. O usuario de cada equipe e o slug sem hifen (ex.: `equipe1`, `equipebope`); a senha continua sendo a mesma de antes. Os links antigos (`.../gralha-equipes/<slug>/`) continuam sendo gerados ate o usuario mandar desligar.

