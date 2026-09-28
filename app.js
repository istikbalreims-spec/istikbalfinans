
const KEY="istikbal_finans_web_v1";
const defaultData={
  products:[],shipments:[],expenses:[],
  cash:{bank:0,cash:0},
  settings:{target:75000,buffer:10000,vat:20}
};

let db=load();

function load(){
  try{
    const raw=localStorage.getItem(KEY);
    return raw?Object.assign(structuredClone(defaultData),JSON.parse(raw)):structuredClone(defaultData);
  }catch(e){return structuredClone(defaultData)}
}
function save(){localStorage.setItem(KEY,JSON.stringify(db));renderAll()}
function euro(n){return new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(Number(n||0))}
function num(v){return Number(String(v??"").replace(",",".").replace(/\s/g,""))||0}
function id(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function today(){return new Date().toISOString().slice(0,10)}
function plusDays(d){const x=new Date();x.setDate(x.getDate()+d);return x.toISOString().slice(0,10)}

document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");document.getElementById(b.dataset.tab).classList.add("active");
}));

function productCalc(p){
  const saleHT=num(p.saleTTC)/(1+num(p.vat)/100);
  const cost=num(p.purchaseHT)+num(p.logistics)+num(p.delivery)+num(p.assembly)+num(p.fee)+num(p.other);
  const profit=saleHT-cost;
  const margin=saleHT?profit/saleHT*100:0;
  return {saleHT,cost,profit,margin};
}
function shipmentCalc(s){
  const logistics=num(s.transport)+num(s.customs)+num(s.local)+num(s.unloading)+num(s.other);
  return {logistics,perM3:num(s.volume)?logistics/num(s.volume):0,total:num(s.goods)+logistics};
}

function renderAll(){
  renderProducts();renderShipments();renderExpenses();renderCash();renderDashboard();renderSettings();
}
function renderProducts(){
  const el=document.getElementById("productRows");
  if(!db.products.length){el.innerHTML='<tr><td colspan="7" class="empty">Henüz ürün eklenmedi.</td></tr>';return}
  el.innerHTML=db.products.map(p=>{
    const c=productCalc(p);
    return `<tr>
      <td><strong>${esc(p.name)}</strong><br><small>${esc(p.code||"")}</small></td>
      <td>${euro(p.purchaseHT)}</td><td>${euro(p.saleTTC)}</td><td>${euro(c.cost)}</td>
      <td>${euro(c.profit)}</td><td>${c.margin.toFixed(1)}%</td>
      <td><button class="small-btn" onclick="editProduct('${p.id}')">Düzelt</button>
      <button class="small-btn danger" onclick="removeItem('products','${p.id}')">Sil</button></td></tr>`
  }).join("")
}
function renderShipments(){
  const el=document.getElementById("shipmentRows");
  if(!db.shipments.length){el.innerHTML='<tr><td colspan="7" class="empty">Henüz sevkiyat eklenmedi.</td></tr>';return}
  el.innerHTML=db.shipments.map(s=>{
    const c=shipmentCalc(s);
    return `<tr><td><strong>${esc(s.name)}</strong><br><small>${esc(s.date||"")}</small></td>
    <td>${euro(s.goods)}</td><td>${euro(c.logistics)}</td><td>${num(s.volume).toFixed(1)} m³</td>
    <td>${euro(c.perM3)}</td><td>${euro(c.total)}</td>
    <td><button class="small-btn" onclick="editShipment('${s.id}')">Düzelt</button>
    <button class="small-btn danger" onclick="removeItem('shipments','${s.id}')">Sil</button></td></tr>`
  }).join("")
}
function renderExpenses(){
  const el=document.getElementById("expenseRows");
  const rows=[...db.expenses].sort((a,b)=>(a.due||"").localeCompare(b.due||""));
  if(!rows.length){el.innerHTML='<tr><td colspan="8" class="empty">Henüz ödeme eklenmedi.</td></tr>';return}
  el.innerHTML=rows.map(x=>`<tr>
    <td>${esc(x.due)}</td><td>${esc(x.category)}</td><td>${esc(x.supplier||"")}</td><td>${esc(x.description||"")}</td>
    <td>${euro(x.amount)}</td><td><span class="tag ${x.priority==="Zorunlu"||x.priority==="Yüksek"?"high":""}">${esc(x.priority)}</span></td>
    <td><span class="tag ${x.status==="Ödendi"?"paid":""}">${esc(x.status)}</span></td>
    <td>${x.status!=="Ödendi"?`<button class="small-btn" onclick="markPaid('${x.id}')">Ödendi</button>`:""}
    <button class="small-btn danger" onclick="removeItem('expenses','${x.id}')">Sil</button></td></tr>`).join("")
}
function renderCash(){
  document.getElementById("bankVal").textContent=euro(db.cash.bank);
  document.getElementById("cashVal").textContent=euro(db.cash.cash);
  const total=num(db.cash.bank)+num(db.cash.cash);
  document.getElementById("totalCashVal").textContent=euro(total);

  const end=plusDays(60);
  const rows=db.expenses.filter(x=>x.status!=="Ödendi" && x.due>=today() && x.due<=end)
    .sort((a,b)=>a.due.localeCompare(b.due));
  let running=total;
  const el=document.getElementById("cashProjection");
  if(!rows.length){el.innerHTML='<div class="empty">Önümüzdeki 60 gün için kayıtlı ödeme yok.</div>';return}
  el.innerHTML=rows.map(x=>{running-=num(x.amount);return `<div class="projection-row"><span>${esc(x.due)}</span><span>${esc(x.supplier||x.description||x.category)}</span><strong>${euro(running)}</strong></div>`}).join("")
}
function renderDashboard(){
  const cash=num(db.cash.bank)+num(db.cash.cash);
  const todayD=today(), d30=plusDays(30);
  const unpaid=db.expenses.filter(x=>x.status!=="Ödendi");
  const due30=unpaid.filter(x=>x.due>=todayD && x.due<=d30).reduce((a,x)=>a+num(x.amount),0);
  const compulsory=unpaid.filter(x=>["Zorunlu","Yüksek"].includes(x.priority)).reduce((a,x)=>a+num(x.amount),0);

  // Products are catalogue-level profitability, not actual sales. Use zero actual sales until integration.
  const monthSales=0, monthProfit=0;
  const reserved=compulsory+num(db.settings.buffer);
  const free=cash-reserved;

  document.getElementById("kpiCash").textContent=euro(cash);
  document.getElementById("kpiReserved").textContent=euro(reserved);
  document.getElementById("kpiFree").textContent=euro(free);
  document.getElementById("kpiSales").textContent=euro(monthSales);
  document.getElementById("kpiProfit").textContent=euro(monthProfit);
  document.getElementById("kpiDue30").textContent=euro(due30);

  const adv=[];
  adv.push(`<p>Bankada ve kasada toplam <strong>${euro(cash)}</strong> görünüyor.</p>`);
  adv.push(`<p>Zorunlu/yüksek öncelikli ödemeler ve güvenlik rezervi için yaklaşık <strong>${euro(reserved)}</strong> ayır.</p>`);
  if(free<0) adv.push(`<p class="bad">Serbest nakit <strong>${euro(free)}</strong>. Yeni stok veya ertelenebilir giderleri sınırlamak gerekiyor.</p>`);
  else if(free<num(db.settings.buffer)) adv.push(`<p class="warn">Serbest para <strong>${euro(free)}</strong>. Büyük ödeme yapmadan önce 30 günlük takvimi kontrol et.</p>`);
  else adv.push(`<p class="ok">Tahmini serbest para <strong>${euro(free)}</strong>. Güvenlik tamponunun üzerindesin.</p>`);
  if(due30>cash) adv.push(`<p class="bad">Önümüzdeki 30 günlük ödemeler mevcut nakitten <strong>${euro(due30-cash)}</strong> fazla.</p>`);
  else adv.push(`<p>Önümüzdeki 30 gün kayıtlı ödeme toplamı <strong>${euro(due30)}</strong>.</p>`);
  adv.push(`<p>Satış cirosu ve gerçek tahsilatlar sonraki aşamada mevcut müşteri programından otomatik çekilecek.</p>`);
  document.getElementById("advisor").innerHTML=adv.join("");

  const rows=unpaid.sort((a,b)=>a.due.localeCompare(b.due)).slice(0,8);
  document.getElementById("upcoming").innerHTML=rows.length?rows.map(x=>`<div class="up-row"><span>${esc(x.due)}</span><span>${esc(x.supplier||x.description||x.category)}</span><strong>${euro(x.amount)}</strong></div>`).join(""):'<div class="empty">Yaklaşan ödeme yok.</div>';
}
function renderSettings(){
  document.getElementById("setTarget").value=db.settings.target;
  document.getElementById("setBuffer").value=db.settings.buffer;
  document.getElementById("setVat").value=db.settings.vat;
}
function saveSettings(){
  db.settings.target=num(document.getElementById("setTarget").value);
  db.settings.buffer=num(document.getElementById("setBuffer").value);
  db.settings.vat=num(document.getElementById("setVat").value);
  save();alert("Ayarlar kaydedildi.");
}

function openModal(title,html){document.getElementById("modalTitle").textContent=title;document.getElementById("modalBody").innerHTML=html;document.getElementById("modal").classList.remove("hidden")}
function closeModal(){document.getElementById("modal").classList.add("hidden")}

function openProductModal(p=null){
  p=p||{id:"",code:"",name:"",purchaseHT:0,saleTTC:0,vat:db.settings.vat,logistics:0,delivery:0,assembly:0,fee:0,other:0};
  openModal(p.id?"Ürünü Düzenle":"Yeni Ürün",`
  <div class="form-grid">
    <label>Model kodu<input id="pCode" value="${attr(p.code)}"></label>
    <label>Model adı<input id="pName" value="${attr(p.name)}"></label>
    <label>Alış fiyatı HT (€)<input id="pPurchase" type="number" step="0.01" value="${p.purchaseHT}"></label>
    <label>Satış fiyatı TTC (€)<input id="pSale" type="number" step="0.01" value="${p.saleTTC}"></label>
    <label>TVA %<input id="pVat" type="number" value="${p.vat}"></label>
    <label>Lojistik payı (€)<input id="pLog" type="number" step="0.01" value="${p.logistics}"></label>
    <label>Teslimat maliyeti (€)<input id="pDelivery" type="number" step="0.01" value="${p.delivery}"></label>
    <label>Montaj maliyeti (€)<input id="pAssembly" type="number" step="0.01" value="${p.assembly}"></label>
    <label>Ödeme komisyonu (€)<input id="pFee" type="number" step="0.01" value="${p.fee}"></label>
    <label>Diğer maliyet (€)<input id="pOther" type="number" step="0.01" value="${p.other}"></label>
  </div>
  <div class="form-actions"><button class="secondary" onclick="closeModal()">Vazgeç</button><button onclick="saveProduct('${p.id}')">Kaydet</button></div>`)
}
function saveProduct(existingId){
  const obj={id:existingId||id(),code:val("pCode"),name:val("pName"),purchaseHT:num(val("pPurchase")),saleTTC:num(val("pSale")),vat:num(val("pVat")),logistics:num(val("pLog")),delivery:num(val("pDelivery")),assembly:num(val("pAssembly")),fee:num(val("pFee")),other:num(val("pOther"))};
  if(!obj.name){alert("Model adı gerekli.");return}
  const i=db.products.findIndex(x=>x.id===existingId); if(i>=0)db.products[i]=obj;else db.products.push(obj);
  closeModal();save()
}
function editProduct(i){openProductModal(db.products.find(x=>x.id===i))}

function openShipmentModal(s=null){
  s=s||{id:"",name:"Konteyner",date:today(),goods:0,transport:0,customs:0,local:0,unloading:0,other:0,volume:85};
  openModal(s.id?"Sevkiyatı Düzenle":"Yeni Sevkiyat",`
  <div class="form-grid">
    <label>Sevkiyat adı<input id="sName" value="${attr(s.name)}"></label>
    <label>Tarih<input id="sDate" type="date" value="${s.date}"></label>
    <label>Ürün bedeli HT (€)<input id="sGoods" type="number" step="0.01" value="${s.goods}"></label>
    <label>Uluslararası nakliye (€)<input id="sTransport" type="number" step="0.01" value="${s.transport}"></label>
    <label>Gümrük / evrak (€)<input id="sCustoms" type="number" step="0.01" value="${s.customs}"></label>
    <label>Yerel nakliye (€)<input id="sLocal" type="number" step="0.01" value="${s.local}"></label>
    <label>İndirme / yükleme (€)<input id="sUnload" type="number" step="0.01" value="${s.unloading}"></label>
    <label>Diğer (€)<input id="sOther" type="number" step="0.01" value="${s.other}"></label>
    <label>Toplam hacim m³<input id="sVol" type="number" step="0.1" value="${s.volume}"></label>
  </div>
  <div class="form-actions"><button class="secondary" onclick="closeModal()">Vazgeç</button><button onclick="saveShipment('${s.id}')">Kaydet</button></div>`)
}
function saveShipment(existingId){
  const o={id:existingId||id(),name:val("sName"),date:val("sDate"),goods:num(val("sGoods")),transport:num(val("sTransport")),customs:num(val("sCustoms")),local:num(val("sLocal")),unloading:num(val("sUnload")),other:num(val("sOther")),volume:num(val("sVol"))};
  const i=db.shipments.findIndex(x=>x.id===existingId);if(i>=0)db.shipments[i]=o;else db.shipments.push(o);closeModal();save()
}
function editShipment(i){openShipmentModal(db.shipments.find(x=>x.id===i))}

function openExpenseModal(){
  openModal("Yeni Ödeme / Gider",`
  <div class="form-grid">
    <label>Vade tarihi<input id="eDue" type="date" value="${today()}"></label>
    <label>Kategori<select id="eCat"><option>Tedarikçi</option><option>Kira</option><option>Maaş</option><option>TVA / Vergi</option><option>URSSAF</option><option>Kredi</option><option>Depo</option><option>Araç / Yakıt</option><option>Reklam</option><option>Enerji</option><option>Diğer</option></select></label>
    <label>Kime / Firma<input id="eSupplier"></label>
    <label>Tutar TTC (€)<input id="eAmount" type="number" step="0.01"></label>
    <label class="full">Açıklama<input id="eDesc"></label>
    <label>Öncelik<select id="ePriority"><option>Zorunlu</option><option>Yüksek</option><option>Normal</option><option>Ertelenebilir</option></select></label>
    <label>Durum<select id="eStatus"><option>Ödenecek</option><option>Ödendi</option></select></label>
  </div>
  <div class="form-actions"><button class="secondary" onclick="closeModal()">Vazgeç</button><button onclick="saveExpense()">Kaydet</button></div>`)
}
function saveExpense(){
  db.expenses.push({id:id(),due:val("eDue"),category:val("eCat"),supplier:val("eSupplier"),amount:num(val("eAmount")),description:val("eDesc"),priority:val("ePriority"),status:val("eStatus")});closeModal();save()
}
function markPaid(i){const x=db.expenses.find(x=>x.id===i);if(x){x.status="Ödendi";save()}}
function removeItem(collection,i){if(confirm("Bu kaydı silmek istiyor musun?")){db[collection]=db[collection].filter(x=>x.id!==i);save()}}

function openCashModal(){
  openModal("Banka / Kasa Güncelle",`
    <div class="form-grid">
      <label>Banka bakiyesi (€)<input id="cBank" type="number" step="0.01" value="${db.cash.bank}"></label>
      <label>Kasa bakiyesi (€)<input id="cCash" type="number" step="0.01" value="${db.cash.cash}"></label>
    </div>
    <div class="form-actions"><button class="secondary" onclick="closeModal()">Vazgeç</button><button onclick="saveCash()">Kaydet</button></div>`)
}
function saveCash(){db.cash.bank=num(val("cBank"));db.cash.cash=num(val("cCash"));closeModal();save()}

function val(i){return document.getElementById(i).value}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function attr(s){return esc(s)}

document.getElementById("btnExport").onclick=()=>{
  const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="istikbal_finans_yedek_"+today()+".json";a.click();URL.revokeObjectURL(a.href)
}
document.getElementById("importFile").onchange=e=>{
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();r.onload=()=>{try{db=JSON.parse(r.result);save();alert("Yedek yüklendi.")}catch{alert("Dosya okunamadı.")}};r.readAsText(f)
}
document.getElementById("btnReset").onclick=()=>{if(confirm("Tüm finans verileri silinsin mi?")){db=structuredClone(defaultData);save()}}

renderAll();
