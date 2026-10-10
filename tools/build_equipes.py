#!/usr/bin/env python3
"""Gera um dashboard por equipe (Overview + Comparativo, filtro so de Corretor) a partir do cubo gerencial.

Uso:  DASH_SENHA=<senha do cubo gerencial> python tools/build_equipes.py --cubo <data.enc.json do repo gerencial> [--so "EQUIPE 1"]
Saida: docs/<slug>/index.html + docs/<slug>/data.enc.json (cubo FATIADO e cifrado com a senha da equipe)
Senha da equipe = <slug>-<token>, token = 8 letras/digitos derivados por HMAC-SHA256 do slug com o segredo mestre
(env EQUIPES_MESTRE). Ex.: equipe-evolucao-k7f3q9xz. Senhas e segredo NUNCA sao gravados em arquivo/commit.
"""
import argparse, base64, hashlib, hmac, json, os, re, sys, unicodedata, zlib

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EQUIPES = ["EQUIPE 1", "EQUIPE BOPE", "EQUIPE CHAMPIONS", "EQUIPE ELITE", "EQUIPE EVOLUÇÃO", "EQUIPE EXUPÉRY",
           "EQUIPE IRON", "EQUIPE MAGNITUDE", "EQUIPE META", "EQUIPE NEXO", "EQUIPE SKY", "EQUIPE SUPREME",
           "EQUIPE SYNERGIA", "EQUIPE VÉRTICE", "EQUIPE ÁGUIAS"]

def slug(nome):
    s = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

def senha_equipe(nome, mestre):
    sl = slug(nome)
    tok = base64.b32encode(hmac.new(mestre.encode(), sl.encode(), hashlib.sha256).digest()).decode().lower()[:8]
    return f"{sl}-{tok}"

def bonito(nome):
    return " ".join(w.capitalize() if not w.isdigit() else w for w in nome.lower().split())

def decifrar(arq, senha):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    j = json.load(open(arq)); b = base64.b64decode
    k = hashlib.pbkdf2_hmac("sha256", senha.encode(), b(j["salt"]), j["it"], 32)
    return json.loads(zlib.decompress(AESGCM(k).decrypt(b(j["iv"]), b(j["ct"]), None)))

def cifrar(obj, senha, saida):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    raw = zlib.compress(json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), 9)
    salt, iv, it = os.urandom(16), os.urandom(12), 250000
    key = hashlib.pbkdf2_hmac("sha256", senha.encode("utf-8"), salt, it, 32)
    ct = AESGCM(key).encrypt(iv, raw, None)
    b = lambda x: base64.b64encode(x).decode()
    os.makedirs(os.path.dirname(saida), exist_ok=True)
    json.dump({"v": 1, "it": it, "salt": b(salt), "iv": b(iv), "ct": b(ct)}, open(saida, "w"), separators=(",", ":"))

# colunas de linha: 0 m,1 dia,2 cl,3 loja,4 equipe,5 corretor,6 veiculo,7 bairro,8 tipo,9 cond,10 lanc,11 cod,12 dorm,13 area,14 nome,15 cc,16 kc,17 valor,18 n
DIMCOL = {"loja": 3, "equipe": 4, "corretor": 5, "veiculo": 6, "bairro": 7, "tipo": 8, "cond": 9, "lanc": 10,
          "cod": 11, "dorm": 12, "area": 13, "nome": 14}

def fatiar(c, nome):
    """Cubo so com as linhas da equipe; dicionarios recompactados (nada de outras equipes) e K restrito."""
    eq = c["dict"]["equipe"]; assert nome in eq, f"equipe {nome!r} nao existe no cubo"
    ie = eq.index(nome)
    rows = [r for r in c["rows"] if r[4] == ie]
    mp = {k: {} for k in list(DIMCOL) + ["cl", "cc"]}
    nd = {k: [] for k in mp}
    def m(k, i):
        if i < 0: return i
        d = mp[k]
        if i not in d:
            d[i] = len(nd[k]); nd[k].append(c["dict"][k][i])
        return d[i]
    out = []
    for r in rows:
        r = list(r)
        for k, col in DIMCOL.items(): r[col] = m(k, r[col])
        r[2] = m("cl", r[2]); r[16] = m("cl", r[16]); r[15] = m("cc", r[15])
        out.append(r)
    # K: so clientes presentes nas vendas da equipe; corretores de outras equipes viram placeholders anonimos (so contam)
    K, anon = {}, {}
    def mk(x):
        if x in mp["cc"]: return mp["cc"][x]
        if x not in anon:
            nd["cc"].append(""); anon[x] = len(nd["cc"]) - 1
        return anon[x]
    for old, new in mp["cl"].items():
        v = c["K"].get(str(old))
        if v is not None: K[str(new)] = [mk(x) for x in v]
    return {**{k: c[k] for k in ("v", "gerado", "ultimo", "d0", "desde") if k in c},
            "dict": nd, "rows": out, "K": K}

OLD_H1 = "<h1>Dashboard Performance CRM</h1>"
LOAD = r'''
const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function dec(e,pw){const k=await crypto.subtle.deriveKey({name:"PBKDF2",salt:b64(e.salt),iterations:e.it,hash:"SHA-256"},await crypto.subtle.importKey("raw",new TextEncoder().encode(pw),"PBKDF2",false,["deriveKey"]),{name:"AES-GCM",length:256},false,["decrypt"]),
 buf=await crypto.subtle.decrypt({name:"AES-GCM",iv:b64(e.iv)},k,b64(e.ct));return JSON.parse(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("deflate"))).text())}
function demoNote(c){try{const d=c.ultimo.split("-").reverse().join("/"),n=document.createElement("div");n.className="note";n.style.cssText="margin:-14px 0 14px";n.textContent="Dados atualizados diariamente · último dia da base: "+d;const t=document.querySelector(".tabs");t.parentNode.insertBefore(n,t)}catch(_){}}
function askPw(msg){return new Promise(ok=>{const o=document.createElement("div");o.style.cssText="position:fixed;inset:0;background:var(--bg);display:grid;place-items:center;z-index:99";o.innerHTML=`<form id="pwf" class="msg" style="max-width:360px;width:90%"><b>Dashboard protegido · __EQ__</b>${msg||"Digite a senha da equipe para abrir."}<br><br><input id="pw" type="password" autocomplete="current-password" aria-label="Senha" style="padding:10px 12px;border:1px solid var(--line);border-radius:10px;width:100%;box-sizing:border-box;font:inherit;background:var(--sf);color:var(--ink)"><br><br><button class="gh" type="submit" style="width:100%">Entrar</button></form>`;document.body.appendChild(o);document.getElementById("pw").focus();document.getElementById("pwf").onsubmit=e=>{e.preventDefault();const v=document.getElementById("pw").value;o.remove();ok(v)}})}
window.__cuboLoader=async()=>{const r=await fetch("data.enc.json",{cache:"default"});if(!r.ok)throw new Error("Dados indisponíveis (HTTP "+r.status+")");const e=await r.json();const SK="gpw-__SL__";let pw=null,msg="";try{pw=sessionStorage.getItem(SK)}catch(_){}
 for(;;){if(!pw)pw=await askPw(msg);try{const c=await dec(e,pw);try{sessionStorage.setItem(SK,pw)}catch(_){}demoNote(c);return c}catch(_){pw=null;msg="Senha incorreta. Tente de novo.";try{sessionStorage.removeItem(SK)}catch(_){}}}};'''

def html_equipe(live, shim, nome):
    h = live
    marker = "<script>\nconst DESDE="; assert marker in h
    # 1) tabs: so Overview e Comparativo (paineis dos demais ficam ocultos no DOM para nao quebrar o JS)
    nav = re.search(r'<nav class="tabs".*?</nav>', h, re.S).group(0)
    btn = lambda t: re.search(r'<button role="tab" id="tab-%s".*?</button>' % t, nav, re.S).group(0)
    h = h.replace(nav, '<nav class="tabs" role="tablist" aria-label="Abas do dashboard">' + btn("overview") + btn("cmp") + "</nav>", 1)
    # 2) filtros de loja / equipe / veiculo e os selects de loja/equipe do Comparativo: removidos da tela
    for i in ("f-loja", "f-equipe", "f-veiculo"):
        h, n = re.subn(r'<div><label for="%s">.*?</select></div>' % i, "", h, count=1, flags=re.S); assert n == 1, i
    for i in ("c1-loja", "c1-equipe", "c2-loja", "c2-equipe"):
        h, n = re.subn(r'<div><label for="%s">.*?</select></div>' % i, "", h, count=1, flags=re.S); assert n == 1, i
    # 3) JS que referenciava os elementos removidos
    h = h.replace('$("f-veiculo").parentElement.hidden=pr;', "", 1)
    # 4) titulo + loader com senha por equipe + shim
    h = h.replace(OLD_H1, "<h1>Dashboard Performance CRM <span style=\"color:var(--br);font-weight:600\">· %s</span></h1>" % bonito(nome), 1)
    h = h.replace("<title>Dashboard Performance CRM</title>", "<title>Dashboard %s</title>" % bonito(nome), 1)
    ld = LOAD.replace("__EQ__", bonito(nome)).replace("__SL__", slug(nome))
    h = h.replace(marker, "<script>" + ld + "</script>\n<script>" + shim + "</script>\n" + marker, 1)
    h = re.sub(r"<!-- v[^>]*-->", "<!-- equipes: " + slug(nome) + " -->", h, count=1)
    return h

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cubo", required=True); ap.add_argument("--so"); ap.add_argument("--saida", default=os.path.join(RAIZ, "docs"))
    ap.add_argument("--fonte", default=os.path.join(RAIZ, "fonte", "dashboard-gralha-funil.html"))
    ap.add_argument("--mostrar-senhas", action="store_true", help="imprime slug e senha de cada equipe (so no terminal)")
    a = ap.parse_args()
    sen, mestre = os.environ.get("DASH_SENHA"), os.environ.get("EQUIPES_MESTRE")
    assert sen and mestre and len(mestre) >= 16, "defina DASH_SENHA e EQUIPES_MESTRE (>=16 chars)"
    c = decifrar(a.cubo, sen)
    live = open(a.fonte, encoding="utf-8").read(); shim = open(os.path.join(RAIZ, "tools", "shim.js"), encoding="utf-8").read()
    for nome in ([a.so] if a.so else EQUIPES):
        f = fatiar(c, nome); sl = slug(nome); d = os.path.join(a.saida, sl)
        cifrar(f, senha_equipe(nome, mestre), os.path.join(d, "data.enc.json"))
        open(os.path.join(d, "index.html"), "w", encoding="utf-8").write(html_equipe(live, shim, nome))
        print(f"{sl}: linhas {len(f['rows'])} ate {f['ultimo']} | {os.path.getsize(os.path.join(d,'data.enc.json'))/1e6:.2f} MB" + (f" | senha {senha_equipe(nome, mestre)}" if a.mostrar_senhas else ""))

if __name__ == "__main__":
    main()
