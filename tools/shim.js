/* ===== CAMADA ESTÁTICA: responde às consultas do dashboard ao vivo a partir do cubo gravado =====
   O restante da página é IDÊNTICO à versão ao vivo (BigQuery). Esta camada faz o papel do conector:
   claude.use("mcp").watchTool(servidor, ferramenta, {query}, handler) -> calcula a resposta no navegador.
   Cubo X: linhas [m,dia,cl,loja,equipe,corretor,veiculo,bairro,tipo,cond,lanc,cod,dorm,area,nome,cc,kc,valor,n]
   m: 0 leads, 1 oportunidade, 2 visita, 3 proposta, 4 fechamento, 5 vendas, 6 qualquer evento de dados, 7 qualquer evento do histórico */
(function(){
const MNAME=["leads","oportunidade","visitas","proposta","fechamento","vendas"],MK=[...MNAME.map((n,k)=>[n,k]),["agenciamentos",8],["placas",9]],IDX={loja:3,equipe:4,corretor:5,veiculo:6,bairro:7,tipo:8,cond:9,lanc:10,cod:11,dorm:12,area:13};
const COLIDX={nome_agencia_usuario:3,nome_equipe_usuario:4,nome_usuario:5,veiculocaptacao_dn:6,bairro_imovel:7,Bairro:7,categoria_imovel:8,Categoria:8,Empreendimento:9,condominio_imovel:9,Lancamento:10,lancamento_imovel:10,CodigoEmImovel:11,Dormitorios:12,dormitorios_imovel:12,AreaPrivativa:13,areaprivativa_imovel:13,nomecliente_dn:14};
let C=null;
const U=Date.UTC,dIdx=s=>Math.round((U(+s.slice(0,4),+s.slice(5,7)-1,+s.slice(8,10))-U(2020,0,1))/864e5),dIso=n=>new Date(U(2020,0,1)+n*864e5).toISOString().slice(0,10);
const unesc=s=>s.replace(/\\(.)/g,"$1");
function prep(c){C=c;C.X=c.rows;C.D=c.dict;C.K=c.K||{}}
const S=(k,i)=>C.D[k][i];
function filters(q,extraRe){const out=[],re=/\bAND\s+(?:\w+\.)?(nome_agencia_usuario|nome_equipe_usuario|nome_usuario|veiculocaptacao_dn)\s*=\s*'((?:[^'\\]|\\.)*)'/g;let m;const seen=new Set();
 while((m=re.exec(q))){const k=m[1]+"="+m[2];if(seen.has(k))continue;seen.add(k);const ci=COLIDX[m[1]],val=unesc(m[2]);out.push([ci,C.D[["","","","loja","equipe","corretor","veiculo"][ci]].indexOf(val)])}return out}
const okF=(r,F)=>{for(let i=0;i<F.length;i++)if(r[F[i][0]]!==F[i][1])return false;return true};
const dims=(r,i)=>{const v=S(["","","","loja","equipe","corretor","veiculo","bairro","tipo","cond","lanc","cod","dorm","area","nome"][i],r[i]);return v};
const lab=(r,i,sem)=>dims(r,i)||sem;
function range(q){const m=/BETWEEN DATE '(\d{4}-\d\d-\d\d)' AND DATE '(\d{4}-\d\d-\d\d)'/.exec(q);return m?[dIdx(m[1]),dIdx(m[2])]:[0,1e9]}
const cnt=(set)=>set.size;
const mult=(map,k,fn)=>{let v=map.get(k);if(v===undefined){v=fn();map.set(k,v)}return v};
const monthStart=n=>{const d=new Date(U(2020,0,1)+n*864e5);return d.toISOString().slice(0,7)+"-01"};
const weekStart=n=>{const d=new Date(U(2020,0,1)+n*864e5),w=(d.getUTCDay()+6)%7;return dIso(n-w)};

/* 1. Funil (Overview) e Comparativo */
function qFunil(q){const per=[];let m=/SELECT 'atual' per,DATE '(\d{4}-\d\d-\d\d)' d1,DATE '(\d{4}-\d\d-\d\d)' d2/.exec(q);per.push(["atual",dIdx(m[1]),dIdx(m[2])]);
 m=/SELECT 'anterior',DATE '(\d{4}-\d\d-\d\d)',DATE '(\d{4}-\d\d-\d\d)'/.exec(q);if(m)per.push(["anterior",dIdx(m[1]),dIdx(m[2])]);
 const F=filters(q),out=[],lo=Math.min(...per.map(p=>p[1])),hi=Math.max(...per.map(p=>p[2]));
 per.forEach(([nm,a,b])=>{const u=MNAME.map(()=>new Set()),t=MNAME.map(()=>0),neg=new Map();
  for(const r of C.X){const k=r[0];if(k>5||r[1]<a||r[1]>b||!okF(r,F))continue;if(r[2]>=0)u[k].add(r[2]);t[k]+=r[18];if(k===5&&r[2]>=0){const o=neg.get(r[2]);if(o===undefined||r[17]>o)neg.set(r[2],r[17])}}
  MNAME.forEach((n,k)=>out.push([nm,n,u[k].size,t[k]]));let s=0;neg.forEach(v=>s+=v);out.push([nm,"vgv",Math.round(s),neg.size]);
  [["agenciamentos",8],["placas",9]].forEach(([n,km])=>{const z=new Set();let tt=0;for(const r of C.X){if(r[0]!==km||r[1]<a||r[1]>b||!okF(r,F))continue;z.add(r[2]);tt+=r[18]}out.push([nm,n,z.size,tt])})});return out}

/* 2. Evolução */
function qEvo(q){const [a,b]=range(q),F=filters(q),B=/DATE_TRUNC\(dt,WEEK\(MONDAY\)\)/.test(q)?weekStart:/DATE_TRUNC\(dt,MONTH\)/.test(q)?monthStart:dIso,mp=new Map();
 for(const r of C.X){const k=r[0];if((k>5&&k<8)||k>9||r[2]<0||r[1]<a||r[1]>b||!okF(r,F))continue;const key=(k<6?MNAME[k]:k===8?"agenciamentos":"placas")+"|"+B(r[1]);mult(mp,key,()=>new Set()).add(r[2])}
 const o=[];mp.forEach((s,key)=>{const [m,bk]=key.split("|");o.push([bk,m,s.size])});return o}

/* 3. Veículos · Vendas */
function qVeic(q){const [a,b]=range(q),F=filters(q),neg=new Map();
 for(const r of C.X){if(r[0]!==5||r[2]<0||r[1]<a||r[1]>b||!okF(r,F))continue;const o=mult(neg,r[2],()=>({v:-1,ve:"",ba:"",ti:"",dm:""})),mx=(x,y)=>y&&(!x||y>x)?y:x;
  o.ve=mx(o.ve,dims(r,6));o.ba=mx(o.ba,dims(r,7));o.ti=mx(o.ti,dims(r,8));const dm=dims(r,12);o.dm=dm&&(!o.dm||(+dm>+o.dm||isNaN(+dm)&&dm>o.dm))?dm:o.dm;if(r[17]>o.v)o.v=r[17]}
 const g=new Map();neg.forEach(o=>{const key=[o.ve||"(sem veículo)",o.ba||"-",o.ti||"-",o.dm||"-"].join("|"),x=mult(g,key,()=>[0,0]);x[0]++;x[1]+=Math.max(o.v,0)});
 const o=[];g.forEach((x,k)=>{const p=k.split("|");o.push([p[0],p[1],p[2],p[3],x[0],Math.round(x[1]*100)/100])});o.sort((x,y)=>x[0].localeCompare(y[0],"en")||y[5]-x[5]);return o.slice(0,300)}

/* 4. Corretores com venda (%, lista por cliente) */
function qCorV(q){const [a,b]=range(q),F=filters(q),at=new Set(),vd=new Set(),vdv=new Map(),cli=new Map();
 for(const r of C.X){if(r[1]<a||r[1]>b||!okF(r,F))continue;if(r[0]===6&&r[15]>=0)at.add(r[15]);
  if(r[0]===5){if(r[15]>=0){vd.add(r[15]);mult(vdv,dims(r,6)||"(sem veículo)",()=>new Set()).add(r[15])}
   if(r[16]>=0){const o=mult(cli,r[16],()=>({ve:"",nm:""}));if(dims(r,6)&&(!o.ve||dims(r,6)>o.ve))o.ve=dims(r,6);const n=dims(r,14);if(n&&(!o.nm||n>o.nm))o.nm=n}}}
 const out=[["ativos",null,at.size,null],["vendas",null,vd.size,null]];vdv.forEach((s,k)=>out.push(["vendas_v",k,s.size,null]));
 const tot=new Set(),totv=new Map(),L=[];cli.forEach((o,c)=>{const cors=C.K[String(c)]||[],v=o.ve||"(sem veículo)";cors.forEach(x=>{tot.add(x);mult(totv,v,()=>new Set()).add(x)});L.push([S("cl",c),cors.length,v])});
 out.push(["tot",null,tot.size,null]);totv.forEach((s,k)=>out.push(["tot_v",k,s.size,null]));
 L.sort((x,y)=>y[1]-x[1]||(x[0]<y[0]?-1:1));L.slice(0,500).forEach(x=>out.push(["cli",x[0],x[1],x[2]]));return out}

/* 5. Desempenho por dimensão */
function qDim(q){const [a,b]=range(q),F=filters(q),m=/SELECT COALESCE\(NULLIF\(CAST\((\w+) AS STRING\),''\),'\(vazio\)'\) d,CodigoCliente cl FROM `nitro_dados\.vw_consolidado_clientes_capturados_gralha`/.exec(q),di=COLIDX[m[1]],
 st={},neg={},tot={};MNAME.forEach(n=>{st[n]=new Map();tot[n]=new Set()});const vmax=new Map(),vtot=new Map();
 for(const r of C.X){const k=r[0];if(k>5||r[2]<0||r[1]<a||r[1]>b||!okF(r,F))continue;const d=dims(r,di)||"(vazio)",n=MNAME[k];
  mult(st[n],d,()=>new Set()).add(r[2]);tot[n].add(r[2]);
  if(k===5){const kk=d+"\u0001"+r[2],o=vmax.get(kk);if(o===undefined||r[17]>o)vmax.set(kk,r[17]);const o2=vtot.get(r[2]);if(o2===undefined||r[17]>o2)vtot.set(r[2],r[17])}}
 const rows=[],sum=new Map();MNAME.forEach(n=>{st[n].forEach((s,d)=>{if(n==="vendas")return;rows.push([d,n,s.size,null]);sum.set(d,(sum.get(d)||0)+s.size)});if(n!=="vendas")rows.push(["__tot",n,tot[n].size,null])});
 const vv=new Map();vmax.forEach((v,kk)=>{const d=kk.split("\u0001")[0],x=mult(vv,d,()=>[0,0]);x[0]++;x[1]+=v});vv.forEach((x,d)=>{rows.push([d,"vendas",x[0],x[1]]);sum.set(d,(sum.get(d)||0)+x[0])});let tv=0;vtot.forEach(v=>tv+=v);rows.push(["__tot","vendas",vtot.size,tv]);
 const keep=[...sum.keys()].sort((x,y)=>sum.get(y)-sum.get(x)||(x<y?-1:1)).slice(0,250),ok=new Set(keep);ok.add("__tot");return rows.filter(r=>ok.has(r[0]))}

/* 6. Opções dos filtros */
function qOpts(){const s={loja:new Set(),equipe:new Set(),corretor:new Set(),veiculo:new Set()};for(const r of C.X){if(r[0]!==6)continue;for(const k in s){const v=dims(r,IDX[k]);if(v)s[k].add(v)}}
 const o=[];for(const k of ["corretor","equipe","loja","veiculo"])[...s[k]].sort().forEach(v=>o.push([k,v]));return o}

/* 7. Daily */
const qUlt=()=>[[C.ultimo]];
function qDaily(q){const m=/IF\(dt=DATE '(\d{4}-\d\d-\d\d)',cl,NULL\)\) a1,COUNT\(DISTINCT IF\(dt=DATE '(\d{4}-\d\d-\d\d)',cl,NULL\)\) a2,COUNT\(DISTINCT IF\(dt BETWEEN DATE '(\d{4}-\d\d-\d\d)' AND DATE '(\d{4}-\d\d-\d\d)',cl,NULL\)\) mtd,COUNT\(DISTINCT IF\(dt BETWEEN DATE '(\d{4}-\d\d-\d\d)' AND DATE '(\d{4}-\d\d-\d\d)',cl,NULL\)\) pm/.exec(q),
 d1=dIdx(m[1]),d2=dIdx(m[2]),ms=dIdx(m[3]),pms=dIdx(m[5]),pme=dIdx(m[6]),F=filters(q),out=[],mk=()=>({a1:new Set(),a2:new Set(),mtd:new Set(),pm:new Set(),ult:-1}),
 add=(g,r)=>{const c=r[2];if(r[1]===d1)g.a1.add(c);if(r[1]===d2)g.a2.add(c);if(r[1]>=ms&&r[1]<=d1)g.mtd.add(c);if(r[1]>=pms&&r[1]<=pme)g.pm.add(c);if(r[1]>g.ult)g.ult=r[1]};
 MK.forEach(([n,k])=>{const T=mk(),E=new Map(),CO=new Map();
  for(const r of C.X){if(r[0]!==k||r[2]<0||r[1]<pms||r[1]>d1||!okF(r,F))continue;const eq=lab(r,4,"(vazio)"),co=lab(r,5,"(vazio)");add(T,r);add(mult(E,eq,mk),r);add(mult(CO,eq+"\u0001"+co,mk),r)}
  const row=(eq,co,g)=>out.push([n,eq,co,g.a1.size,g.a2.size,g.mtd.size,g.pm.size,g.ult<0?null:dIso(g.ult)]);
  CO.forEach((g,key)=>{const p=key.split("\u0001");row(p[0],p[1],g)});E.forEach((g,eq)=>row(eq,null,g));row(null,null,T)});return out}

/* 8. Ranking: % de corretores com vendas por equipe e mês */
function qRank(q){const [a,b]=range(q),act=new Map(),ven=new Map(),push=(map,key,c)=>mult(map,key,()=>new Set()).add(c);
 for(const r of C.X){if(r[0]!==6&&r[0]!==5||r[15]<0||r[1]<a||r[1]>b)continue;const mo=monthStart(r[1]),eq=lab(r,4,"(sem equipe)");
  const keys=[mo+"|"+eq,"|"+eq,mo+"|",""];keys.forEach(k=>{if(r[0]===6)push(act,k,r[15]);else push(ven,k,r[15])})}
 const out=[];act.forEach((s,k)=>{const [mo,eq]=k===""?["",""]:k.split("|");out.push([mo||null,eq||null,s.size,(ven.get(k)||new Set()).size])});return out}

/* 9. Conversão por corretor */
function qConv(q){const [a,b]=range(q),F=filters(q),mp=new Map(),tt=new Map();
 for(const r of C.X){const k=r[0];if(k>5||r[2]<0||r[1]<a||r[1]>b||!okF(r,F))continue;const n=lab(r,5,"(sem corretor)");mult(mp,n+"|"+MNAME[k],()=>new Set()).add(r[2]);mult(tt,MNAME[k],()=>new Set()).add(r[2])}
 const out=[];mp.forEach((s,key)=>{const i=key.lastIndexOf("|");out.push([key.slice(0,i),key.slice(i+1),s.size])});tt.forEach((s,m)=>out.push([null,m,s.size]));return out}

/* 10. Funis por loja */
function qLojas(q){const [a,b]=range(q),mp=new Map();
 for(const r of C.X){const k=r[0];if(k>5||r[2]<0||r[1]<a||r[1]>b)continue;const n=dims(r,3);if(!n)continue;mult(mp,n+"|"+MNAME[k],()=>new Set()).add(r[2])}
 const out=[];mp.forEach((s,key)=>{const i=key.lastIndexOf("|");out.push([key.slice(0,i),key.slice(i+1),s.size])});return out}

/* 11. Resultados (Equipes / Loja / Corretor) */
function qRes(q){const [a,b]=range(q),dm=/COALESCE\(NULLIF\(CAST\((\w+) AS STRING\),''\),'([^']*)'\) d,CodigoCorretor cor,'cap' m/.exec(q),di=COLIDX[dm[1]],sem=dm[2],
 G=new Map(),mk=()=>({c:new Set(),cap:0,vis:0,pro:0,ven:new Set(),neg:new Map()}),T=mk();
 const add=(g,r)=>{if(r[15]>=0)g.c.add(r[15]);if(r[0]===0)g.cap+=r[18];if(r[0]===2)g.vis+=r[18];if(r[0]===3)g.pro+=r[18];if(r[0]===5&&r[2]>=0){g.ven.add(r[2]);const o=g.neg.get(r[2]);if(o===undefined||r[17]>o)g.neg.set(r[2],r[17])}};
 for(const r of C.X){if(r[0]>7||r[1]<a||r[1]>b)continue;const d=dims(r,di)||sem;add(mult(G,d,mk),r);add(T,r)}
 const val=g=>{let s=0;g.neg.forEach(v=>s+=v);return s},row=(d,g)=>[d,g.c.size,g.cap,g.vis,g.pro,g.ven.size,val(g)],out=[];G.forEach((g,d)=>out.push(row(d,g)));out.push(row(null,T));return out}


/* 12. Produto (imoveis): m8 cadastrados, m9 com placa, m10 vendidos (data da venda), m11 vendidos com placa. dims: loja/equipe/corretor do captador, bairro (7), celula "i|j" (13) */
function perOf(q){const per=[];let m=/SELECT 'atual' per,DATE '(\d{4}-\d\d-\d\d)' d1,DATE '(\d{4}-\d\d-\d\d)' d2/.exec(q);per.push(["atual",dIdx(m[1]),dIdx(m[2])]);
 m=/SELECT 'anterior',DATE '(\d{4}-\d\d-\d\d)',DATE '(\d{4}-\d\d-\d\d)'/.exec(q);if(m)per.push(["anterior",dIdx(m[1]),dIdx(m[2])]);return per}
function qProd1(q){const F=filters(q),out=[];perOf(q).forEach(([nm,a,b])=>{const s={8:new Set(),9:new Set(),10:new Set(),11:new Set()};
 for(const r of C.X){const k=r[0];if(k<8||r[1]<a||r[1]>b||!okF(r,F))continue;s[k].add(r[2])}
 out.push([nm,"cad",s[8].size],[nm,"pl",s[9].size],[nm,"vend",s[10].size],[nm,"vend_pl",s[11].size])});return out}
function qProd2(q){const [a,b]=range(q),F=filters(q),PS=0.004,pick=k=>{const m=new Map();for(const r of C.X){if(r[0]!==k||r[1]<a||r[1]>b||!okF(r,F))continue;if(!m.has(r[2]))m.set(r[2],r)}return m},
 cad=pick(8),pl=pick(9),vd=pick(10),vp=pick(11),ev=[];cad.forEach((r,c)=>ev.push([r,0,pl.has(c)]));vd.forEach((r,c)=>ev.push([r,1,vp.has(c)]));
 const mk=()=>[0,0,0,0,0,0,0],grp=(kf)=>{const g=new Map();ev.forEach(([r,t,p])=>{const o=mult(g,kf(r),mk);o[t?2:0]++;if(p)o[t?3:1]++;
   const cs=dims(r,13);if(cs){const [i,j]=cs.split("|");o[4]+=(+i+.5)*PS;o[5]+=(+j+.5)*PS;o[6]++}});return g},out=[],ROW=(k,x,y,o,c)=>[k,x,y,o[0],o[1],o[2],o[3],c&&o[6]?o[4]/o[6]:null,c&&o[6]?o[5]/o[6]:null];
 [["loja",3,"(sem loja)"],["equipe",4,"(sem equipe)"],["corretor",5,"(sem corretor)"]].forEach(([k,di,sem])=>grp(r=>lab(r,di,sem)).forEach((o,n)=>out.push(ROW(k,n,null,o,false))));
 const t=mk();ev.forEach(([r,tt,p])=>{t[tt?2:0]++;if(p)t[tt?3:1]++});out.push(ROW("tot",null,null,t,false));
 [...grp(r=>lab(r,7,"(sem bairro)")).entries()].sort((x,y)=>(y[1][0]+y[1][2])-(x[1][0]+x[1][2])||(x[0]<y[0]?-1:1)).slice(0,60).forEach(([n,o])=>out.push(ROW("bai",n,null,o,true)));
 const cells=new Map();ev.forEach(([r,tt,p])=>{const cs=dims(r,13);if(!cs)return;const o=mult(cells,cs,mk);o[tt?2:0]++;if(p)o[tt?3:1]++});
 cells.forEach((o,cs)=>{const [i,j]=cs.split("|");out.push(ROW("cell",i,j,o,false))});
 const bg=new Map();for(const r of C.X){if(r[0]!==8)continue;const cs=dims(r,13);if(cs)mult(bg,cs,()=>new Set()).add(r[2])}
 bg.forEach((st,cs)=>{const [i,j]=cs.split("|");out.push(["bg",i,j,st.size,0,0,0,null,null])});return out}

/* 13. Insights: por periodo (atual/anterior) x metrica x dimensao (loja/equipe/corretor/tot) -> [per,m,k,n,u,v]; vendas leva o VGV (max por negocio) */
function qIns(q){const out=[],NM={0:"leads",1:"oportunidade",2:"visitas",3:"proposta",4:"fechamento",5:"vendas",8:"agenciamentos",9:"placas"};
 perOf(q).forEach(([nm,a,b])=>{const mp=new Map();
  for(const r of C.X){const k=r[0];if(!NM[k]||r[2]<0||r[1]<a||r[1]>b)continue;const lj=dims(r,3)||"(vazio)",eq=dims(r,4)||"(vazio)",co=dims(r,5)||"(vazio)";
   [["loja",lj],["equipe",eq],["corretor",co],["tot",""]].forEach(([kk,n])=>{const key=NM[k]+"\u0001"+kk+"\u0001"+n,o=mult(mp,key,()=>({s:new Set(),v:new Map()}));o.s.add(r[2]);if(k===5){const x=o.v.get(r[2]);if(x===undefined||r[17]>x)o.v.set(r[2],r[17])}})}
  mp.forEach((o,key)=>{const [m,kk,n]=key.split("\u0001");let v=0;o.v.forEach(x=>v+=x);out.push([nm,m,kk,n,o.s.size,v])})});return out}

function route(q){
 if(q.startsWith("/*ins*/"))return qIns(q);
 if(q.includes("'vend_pl'"))return qProd1(q);
 if(q.includes("'bai' k,bairro a"))return qProd2(q);
 if(q.includes("'leads' m,COUNT(DISTINCT c.CodigoCliente) u,COUNT(*) t FROM p JOIN"))return qFunil(q);
 if(q.includes("WITH e AS (SELECT")&&q.includes("'cap' m"))return qRes(q);
 if(q.includes("SELECT nome_agencia_usuario n,'leads' m"))return qLojas(q);
 if(q.includes("GROUPING SETS ((m,eq),(eq),(m),())"))return qRank(q);
 if(q.includes("n,'leads' m,COUNT(DISTINCT cl) u FROM (SELECT COALESCE(NULLIF(nome_usuario"))return qConv(q);
 if(q.includes("GROUPING SETS ((eq,cor),(eq),())"))return qDaily(q);
 if(q.startsWith("SELECT CAST(MAX(dt) AS STRING) l FROM"))return qUlt();
 if(q.includes("SELECT k,v FROM (SELECT 'loja' k"))return qOpts();
 if(q.includes("DENSE_RANK() OVER"))return qDim(q);
 if(q.startsWith("WITH vend AS"))return qCorV(q);
 if(q.startsWith("WITH n AS (SELECT CodigoNegocio,MAX(veiculocaptacao_dn) veic"))return qVeic(q);
 if(q.includes("COUNT(DISTINCT cl) u FROM (SELECT DATE(Data) dt,"))return qEvo(q);
 throw new Error("Consulta não suportada na versão estática");
}
window.__shimRoute=route;window.__shimPrep=prep;
const ready=()=>window.__cuboLoader().then(c=>{prep(c);return c});
window.claude={use:async()=>{const c=await ready();window.__cuboInfo=c;return{invalidate:async()=>{},
 watchTool(s,t,a,h){setTimeout(()=>{try{const rows=route(a.query);h({type:"result",result:{payload:{rows:rows.map(r=>({f:r.map(v=>({v:v===null||v===undefined?null:String(v)}))}))},cache:null}})}catch(e){console.error(e);h({type:"error",error:{code:"tool_error",message:String(e&&e.message||e)}})}},0);return()=>{}}}}};
})();
