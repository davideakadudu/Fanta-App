const positions = [
  { key: 'P', name: 'PORTIERI', count: 3, color: '#d9e0da' },
  { key: 'D', name: 'DIFENSORI', count: 8, color: '#198b4a' },
  { key: 'C', name: 'CENTROCAMPISTI', count: 8, color: '#aeb8b0' },
  { key: 'A', name: 'ATTACCANTI', count: 6, color: '#f52d2a' },
];
const TOTAL = 300;
let roster = JSON.parse(localStorage.getItem('asta300-roster') || '[]');
let market = JSON.parse(localStorage.getItem('asta300-market') || '[]');
let soldElsewhere = JSON.parse(localStorage.getItem('asta300-sold-elsewhere') || '[]');
let favorites = JSON.parse(localStorage.getItem('asta300-favorites') || '[]');
let selectedPosition = null, selectedPlayer = null, mode = 0, roleFilter = 'ALL', showSold = false;
const CLOUD_URL = 'https://lpbnsvoghjthswibxtdq.supabase.co';
const CLOUD_KEY = 'sb_publishable_dWjiqm-hQhVhOwxpcIVkew_jOog_WHA';
const cloud = window.supabase?.createClient(CLOUD_URL, CLOUD_KEY);
let cloudUser = null, cloudTimer = null, hydratingCloud = false;
const modes = [
  { name: 'Bilanciato', values: { P:[12,5,2], D:[18,12,8,5,3,2,1,1], C:[32,22,15,10,6,4,2,1], A:[50,35,22,14,10,8] } },
  { name: 'Attacco pesante', values: { P:[8,3,1], D:[11,7,5,3,2,1,1,1], C:[20,14,10,7,5,2,1,1], A:[75,50,35,20,12,5] } },
  { name: 'Rosa solida', values: { P:[18,8,3], D:[25,16,11,8,5,3,2,1], C:[35,24,17,10,7,4,2,1], A:[40,27,15,9,5,4] } },
];
const $ = (s) => document.querySelector(s);
const clean = (value) => String(value ?? '').trim();
const key = (value) => clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const byPosition = (position) => roster.filter((p) => p.position === position);
const spent = () => roster.reduce((sum, p) => sum + p.price, 0);
const money = (n) => `${Math.max(0, Math.round(n))}M`;
const esc = (text) => clean(text).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[c]));
function setSyncStatus(text, synced = false) { const status = $('#syncStatus'); status.textContent = text; status.classList.toggle('synced', synced); }
function buildCloudState() { return { roster, market, soldElsewhere, favorites, mode }; }
function queueCloudSave() {
  if (!cloudUser || hydratingCloud || !cloud) return;
  clearTimeout(cloudTimer); setSyncStatus('Sincronizzazione in corso…');
  cloudTimer = setTimeout(async () => {
    const { error } = await cloud.from('auction_states').upsert({ user_id: cloudUser.id, state: buildCloudState(), updated_at: new Date().toISOString() });
    setSyncStatus(error ? 'Salvataggio cloud non riuscito' : 'Sincronizzato sul cloud', !error);
  }, 450);
}
function save() { localStorage.setItem('asta300-roster', JSON.stringify(roster)); localStorage.setItem('asta300-market', JSON.stringify(market)); localStorage.setItem('asta300-sold-elsewhere', JSON.stringify(soldElsewhere)); localStorage.setItem('asta300-favorites', JSON.stringify(favorites)); queueCloudSave(); }
function setAuthUi() { const button = $('#authButton'); if (cloudUser) { button.textContent = `☁ ${cloudUser.email}`; button.classList.add('connected'); setSyncStatus('Sincronizzato sul cloud', true); } else { button.textContent = 'Accedi per sincronizzare'; button.classList.remove('connected'); setSyncStatus('Salvataggio locale'); } }
async function loadCloudState() {
  if (!cloudUser || !cloud) return;
  setSyncStatus('Caricamento dati cloud…');
  const { data, error } = await cloud.from('auction_states').select('state').eq('user_id', cloudUser.id);
  if (error) { setSyncStatus('Impossibile caricare il cloud'); return; }
  const state = data?.[0]?.state;
  if (!state) { queueCloudSave(); return; }
  hydratingCloud = true;
  roster = Array.isArray(state.roster) ? state.roster : [];
  market = Array.isArray(state.market) ? state.market : [];
  soldElsewhere = Array.isArray(state.soldElsewhere) ? state.soldElsewhere : [];
  favorites = Array.isArray(state.favorites) ? state.favorites : [];
  mode = Number.isInteger(state.mode) ? state.mode : 0;
  localStorage.setItem('asta300-roster', JSON.stringify(roster)); localStorage.setItem('asta300-market', JSON.stringify(market)); localStorage.setItem('asta300-sold-elsewhere', JSON.stringify(soldElsewhere)); localStorage.setItem('asta300-favorites', JSON.stringify(favorites));
  render(); hydratingCloud = false; setSyncStatus('Sincronizzato sul cloud', true);
}
async function initCloud() {
  if (!cloud) { setSyncStatus('Sincronizzazione non disponibile'); return; }
  const { data: { session } } = await cloud.auth.getSession();
  cloudUser = session?.user || null; setAuthUi(); if (cloudUser) await loadCloudState();
  cloud.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_IN') { cloudUser = session?.user || null; setAuthUi(); loadCloudState(); } if (event === 'SIGNED_OUT') { cloudUser = null; setAuthUi(); } });
}
function mapRole(value) { const role = key(value); if (['p','por','portiere','portieri'].includes(role)) return 'P'; if (['d','dif','difensore','difensori'].includes(role)) return 'D'; if (['c','cen','centrocampista','centrocampisti','m'].includes(role)) return 'C'; if (['a','att','attaccante','attaccanti','w','t'].includes(role)) return 'A'; return ''; }
function headerValue(row, names) { const found = Object.keys(row).find(h => names.includes(key(h))); return found ? clean(row[found]) : ''; }
function parseRows(rows) {
  return rows.map((row, index) => {
    const officialId = headerValue(row, ['id']);
    const name = headerValue(row, ['nome', 'giocatore', 'calciatore', 'player', 'nomegiocatore']);
    const position = mapRole(headerValue(row, ['ruolo', 'r', 'posizione', 'role']));
    const team = headerValue(row, ['squadra', 'team', 'club']);
    const quote = headerValue(row, ['quotazione', 'qt', 'qta', 'fvm', 'valore']);
    return name && position ? { id: officialId ? `fc-${officialId}` : `${key(name)}-${position}-${index}`, name, position, team, quote } : null;
  }).filter(Boolean);
}
function rowsFromWorksheet(sheet) {
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const headerIndex = grid.findIndex(row => row.some(cell => key(cell) === 'nome') && row.some(cell => ['r', 'ruolo'].includes(key(cell))));
  if (headerIndex < 0) return [];
  const headers = grid[headerIndex].map(clean);
  return grid.slice(headerIndex + 1).map(cells => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
}
function isTaken(player) { return soldElsewhere.includes(player.id) || roster.some(p => p.marketId === player.id || (key(p.name) === key(player.name) && p.position === player.position)); }
function isFavorite(player) { return favorites.includes(player.id); }
function valuesFor(position) { return modes[mode].values[position]; }
function positionCap(position) { return valuesFor(position).reduce((sum, value) => sum + value, 0); }
function liveValues(position) {
  const targets = valuesFor(position), players = byPosition(position), paid = players.reduce((sum, player) => sum + player.price, 0), remaining = targets.slice(players.length), delta = positionCap(position) - paid - remaining.reduce((sum, value) => sum + value, 0), share = remaining.length ? delta / remaining.length : 0;
  return targets.map((target, index) => index < players.length ? { target, paid: players[index].price, live: players[index].price } : { target, live: Math.max(1, Math.round(target + share)) });
}
function renderGrid() {
  $('#squadGrid').innerHTML = positions.map(pos => {
    const players = byPosition(pos.key);
    const slots = Array.from({ length: pos.count }, (_, i) => {
      const player = players[i];
      return player ? `<button class="player-slot filled" data-index="${roster.indexOf(player)}" title="Clicca per annullare l'acquisto"><span class="player-name">${esc(player.name)}</span><span class="price">${money(player.price)}</span></button>` : `<button class="player-slot" data-position="${pos.key}"><span>Slot libero</span><span class="add-mark">+</span></button>`;
    }).join('');
    return `<article class="group" style="--group:${pos.color}"><div class="group-header"><div><b class="group-name">${pos.key} · ${pos.name}</b><div class="group-bar"><span style="width:${players.length / pos.count * 100}%"></span></div></div><span class="group-need">${players.length}/${pos.count}</span></div>${slots}</article>`;
  }).join('');
  document.querySelectorAll('[data-position]').forEach(el => el.addEventListener('click', () => openDialog(el.dataset.position)));
  document.querySelectorAll('[data-index]').forEach(el => el.addEventListener('click', () => removePlayer(Number(el.dataset.index))));
}
function renderAllocation() {
  $('#allocationList').innerHTML = positions.map(pos => {
    const committed = byPosition(pos.key).reduce((sum, p) => sum + p.price, 0);
    const slots = pos.count - byPosition(pos.key).length;
    const cap = positionCap(pos.key);
    const fund = Math.max(0, cap - committed);
    const next = liveValues(pos.key).find(value => value.paid === undefined);
    const guide = next?.live || 0;
    const pct = Math.min(100, committed / cap * 100);
    return `<div class="allocation-row" style="--group:${pos.color}"><b>${pos.key}</b><div class="bar" title="${money(committed)} spesi su ${money(cap)}"><span style="width:${pct}%"></span></div><p><strong>${money(committed)} / ${money(cap)}</strong><em>fondo ${money(fund)} · guida ${money(guide)}</em></p></div>`;
  }).join('');
  $('#modeButton').textContent = `${modes[mode].name}⌄`;
}
function renderPricebook() {
  const labels = ['Top / titolare', '2ª scelta', '3ª scelta', '4ª scelta', '5ª scelta', '6ª scelta', '7ª scelta', '8ª scelta'];
  $('#pricebookList').innerHTML = positions.map(pos => {
    const players = byPosition(pos.key), values = liveValues(pos.key);
    const rows = values.map((value, index) => {
      const player = players[index];
      const text = player ? esc(player.name) : labels[index];
      const valueText = player ? `${money(value.paid)} pagati` : `${money(value.live)} tetto live`;
      const detail = player ? `guida iniziale ${money(value.target)}` : `guida iniziale ${money(value.target)}`;
      return `<div class="price-slot ${player ? 'filled' : ''}"><span class="price-slot-index">${index + 1}</span><span class="price-slot-name">${text}</span><span class="price-slot-value">${valueText}<small>${detail}</small></span></div>`;
    }).join('');
    return `<article class="price-group" style="--group:${pos.color}"><div class="price-group-head"><b>${pos.key} · ${pos.name}</b><span>${money(positionCap(pos.key))} piano</span></div>${rows}</article>`;
  }).join('');
}
function renderStats() {
  const totalSpent = spent(), remaining = TOTAL - totalSpent, count = roster.length, remainingSlots = 25 - count;
  $('#budgetRemaining').textContent = Math.max(0, remaining); $('#budgetSpent').textContent = `${totalSpent}M spesi`; $('#budgetFill').style.width = `${Math.min(100, totalSpent / TOTAL * 100)}%`; $('#rosterCount').innerHTML = `${count}<span>/25</span>`;
  const avg = remainingSlots ? (remaining / remainingSlots).toFixed(1).replace('.', ',') : '0,0'; $('#avgAvailable').innerHTML = `${avg.split(',')[0]}<span>,${avg.split(',')[1]}</span>`;
  const attackers = byPosition('A').length; let title = 'PRONTI PER L’ASTA', text = 'La tua strategia è bilanciata.';
  if (remaining < 0) { title = 'BUDGET SUPERATO'; text = 'Rimuovi un acquisto per correggere il budget.'; } else if (count === 25) { title = 'ROSA COMPLETA'; text = 'Hai chiuso l’asta con tutti gli slot coperti.'; } else if (remainingSlots <= 5) { title = 'CHIUSURA D’ASTA'; text = 'Conserva margine per gli ultimi slot.'; } else if (attackers < 2 && count > 8) { title = 'ATTACCO DA COPRIRE'; text = 'Non rimandare troppo le tue priorità offensive.'; }
  $('#statusTitle').textContent = title; $('#statusText').textContent = text;
}
function renderAdvice() {
  const remaining = TOTAL - spent(), count = roster.length;
  let title = 'Costruisci la base', text = 'Definisci il tetto per i tuoi obiettivi prima che partano i rilanci.', action = 'OBIETTIVO: <b>2 ATTACCANTI TOP</b>';
  const overspent = positions.map(p => ({ ...p, spent: byPosition(p.key).reduce((s, x) => s + x.price, 0), cap: positionCap(p.key) })).find(p => p.spent > p.cap + 5);
  if (remaining < 0) { title = 'Frena subito'; text = 'Hai superato i 300M. Correggi la rosa prima di segnare un altro acquisto.'; action = 'AZIONE: <b>RIMUOVI UN ACQUISTO</b>'; } else if (count === 25) { title = 'Asta chiusa'; text = 'Rosa completa: rivedi i prezzi pagati e tieni questa struttura come riferimento.'; action = 'RISULTATO: <b>25/25 SLOT COPERTI</b>'; } else if (overspent) { title = `Proteggi il budget ${overspent.name.toLowerCase()}`; text = `Hai già superato il tetto guida del reparto. Il prossimo acquisto deve andare in un altro ruolo.`; action = `ATTENZIONE: <b>${overspent.key} SOPRA PIANO</b>`; } else if (byPosition('A').length < 2 && count >= 8) { title = 'Sblocca l’attacco'; text = 'In una lega da 10 le punte affidabili diminuiscono in fretta. Prenota almeno un profilo da bonus.'; action = 'PRIORITÀ: <b>UN ATTACCANTE TITOLARE</b>'; } else if (remaining < 55) { title = 'Ora compra minuti'; text = 'Con un budget ridotto, cerca titolari stabili e non inseguire rilanci emotivi.'; action = 'REGOLA: <b>MAI OLTRE IL TUO TETTO</b>'; }
  $('#adviceTitle').textContent = title; $('#adviceText').textContent = text; $('#adviceAction').innerHTML = action;
}
function renderFavorites() {
  const chosen = market.filter(player => isFavorite(player));
  $('#favoritesBook').hidden = !chosen.length;
  if (!chosen.length) return;
  const groups = positions.map(pos => {
    const players = chosen.filter(player => player.position === pos.key);
    const cards = players.length ? players.map(player => `<div class="favorite-chip ${isTaken(player) ? 'sold' : ''}"><strong>${esc(player.name)}</strong><span>${esc(player.team || '')}</span><button data-unfavorite-id="${player.id}" title="Rimuovi dai preferiti">×</button></div>`).join('') : '<p>Nessun preferito</p>';
    return `<section class="favorite-role" style="--group:${pos.color}"><h4>${pos.key} · ${pos.name}<span>${players.length}</span></h4><div class="favorites-list">${cards}</div></section>`;
  }).join('');
  $('#favoritesBook').innerHTML = `<h3>★ Taccuino preferiti · ${chosen.length}</h3><div class="favorite-role-grid">${groups}</div>`;
  document.querySelectorAll('[data-unfavorite-id]').forEach(el => el.addEventListener('click', () => { favorites = favorites.filter(id => id !== el.dataset.unfavoriteId); save(); renderMarket(); }));
}
function renderMarket() {
  const search = key($('#playerSearch').value); const base = showSold ? market.filter(p => soldElsewhere.includes(p.id)) : market.filter(p => !isTaken(p)); const filtered = base.filter(p => (roleFilter === 'ALL' || p.position === roleFilter) && (!search || key(`${p.name} ${p.team}`).includes(search)));
  $('#listDescription').textContent = market.length ? `${market.length} giocatori importati · gli acquistati vengono rimossi in tempo reale.` : 'Carica l’Excel esportato da Fantacalcio.it per iniziare.';
  $('#listCount').textContent = `${filtered.length} ${showSold ? 'passati' : 'disponibili'}`; $('#soldCount').textContent = soldElsewhere.length; $('#soldToggle').classList.toggle('active', showSold);
  $('#marketList').innerHTML = market.length ? (filtered.length ? filtered.map(p => `<div class="market-row" style="--group:${positions.find(x => x.key === p.position).color}"><b class="market-position">${p.position}</b><b class="market-player">${esc(p.name)}</b><span class="market-team">${esc(p.team || '—')}</span><span class="market-quote">${esc(p.quote ? `Qt. ${p.quote}` : '')}</span><div class="market-actions">${showSold ? `<button data-restore-id="${p.id}">Ripristina</button>` : `<button data-market-id="${p.id}">Mia rosa</button><button class="sold-button" data-sold-id="${p.id}">Venduto</button>`}<button class="favorite-button ${isFavorite(p) ? 'active' : ''}" data-favorite-id="${p.id}" title="${isFavorite(p) ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}">${isFavorite(p) ? '★' : '☆'}</button></div></div>`).join('') : '<div class="empty-list"><b>Nessun giocatore in questo elenco</b><p>Prova a cambiare filtro o ricerca.</p></div>') : '<div class="empty-list"><span>↥</span><b>Importa la lista ufficiale</b><p>Accettiamo file .xlsx, .xls e .csv. I giocatori acquistati spariscono automaticamente da qui.</p></div>';
  document.querySelectorAll('[data-market-id]').forEach(el => el.addEventListener('click', () => { const player = market.find(p => p.id === el.dataset.marketId); openDialog(player.position, player); }));
  document.querySelectorAll('[data-sold-id]').forEach(el => el.addEventListener('click', () => { soldElsewhere.push(el.dataset.soldId); save(); renderMarket(); }));
  document.querySelectorAll('[data-restore-id]').forEach(el => el.addEventListener('click', () => { soldElsewhere = soldElsewhere.filter(id => id !== el.dataset.restoreId); save(); renderMarket(); }));
  document.querySelectorAll('[data-favorite-id]').forEach(el => el.addEventListener('click', () => { const id = el.dataset.favoriteId; favorites = favorites.includes(id) ? favorites.filter(item => item !== id) : [...favorites, id]; save(); renderMarket(); }));
  renderFavorites();
}
function render() { renderGrid(); renderStats(); renderAllocation(); renderAdvice(); renderPricebook(); renderMarket(); }
function openDialog(position, player = null) { selectedPosition = position; selectedPlayer = player; const p = positions.find(x => x.key === position); $('#dialogPosition').textContent = `${p.key} · ${p.name}`; $('#dialogTitle').textContent = player ? 'Segna acquisto' : 'Registra acquisto'; $('#playerName').value = player?.name || ''; $('#playerName').readOnly = !!player; $('#playerPrice').value = ''; $('#selectedPlayerInfo').hidden = !player; $('#selectedPlayerInfo').textContent = player ? `${player.team || 'Squadra non indicata'}${player.quote ? ` · quotazione ${player.quote}` : ''}` : ''; $('#playerDialog').showModal(); setTimeout(() => $('#playerPrice').focus(), 50); }
function removePlayer(index) { const p = roster[index]; if (confirm(`Annullare l'acquisto di ${p.name}? Tornerà nella lista disponibile.`)) { roster.splice(index, 1); save(); render(); } }
async function importList(file) {
  if (!window.XLSX) { alert('Impossibile caricare il lettore Excel. Verifica la connessione e riprova.'); return; }
  try { const data = await file.arrayBuffer(); const workbook = XLSX.read(data, { type: 'array' }); const rows = rowsFromWorksheet(workbook.Sheets[workbook.SheetNames[0]]); const parsed = parseRows(rows); if (!parsed.length) throw new Error('Colonne non riconosciute'); market = parsed; save(); render(); } catch (error) { alert('Non sono riuscito a leggere questa lista. Serve un foglio con le colonne Nome e R/Ruolo (facoltative: Squadra e Quotazione).'); }
}
$('#playerForm').addEventListener('submit', e => { if (e.submitter?.value === 'cancel') return; e.preventDefault(); const name = $('#playerName').value.trim(), price = Number($('#playerPrice').value); if (!name || !price || price < 1) return; roster.push({ name, price, position: selectedPosition, marketId: selectedPlayer?.id || null }); save(); $('#playerDialog').close(); render(); });
$('#addPlayerButton').addEventListener('click', () => { const first = positions.find(p => byPosition(p.key).length < p.count); if (first) openDialog(first.key); });
$('#resetButton').addEventListener('click', () => { if (roster.length && confirm('Azzerare tutti gli acquisti registrati?')) { roster = []; save(); render(); } });
$('#modeButton').addEventListener('click', () => { mode = (mode + 1) % modes.length; renderAllocation(); renderPricebook(); renderAdvice(); });
$('#excelInput').addEventListener('change', e => { if (e.target.files[0]) importList(e.target.files[0]); e.target.value = ''; });
$('#playerSearch').addEventListener('input', renderMarket);
$('#roleTabs').addEventListener('click', e => { if (!e.target.dataset.filter) return; roleFilter = e.target.dataset.filter; document.querySelectorAll('#roleTabs button').forEach(b => b.classList.toggle('active', b === e.target)); renderMarket(); });
$('#soldToggle').addEventListener('click', () => { showSold = !showSold; renderMarket(); });
$('#authButton').addEventListener('click', async () => {
  if (cloudUser) { if (confirm(`Disconnettere ${cloudUser.email}?`)) await cloud.auth.signOut(); return; }
  $('#authMessage').textContent = ''; $('#authDialog').showModal(); setTimeout(() => $('#authEmail').focus(), 50);
});
$('#authForm').addEventListener('submit', async e => {
  if (e.submitter?.value === 'cancel') return;
  e.preventDefault(); const email = $('#authEmail').value.trim(); if (!email || !cloud) return;
  $('#authSubmit').disabled = true; $('#authMessage').classList.remove('error'); $('#authMessage').textContent = 'Invio del link…';
  const redirect = location.protocol === 'file:' ? undefined : `${location.origin}${location.pathname}`;
  const { error } = await cloud.auth.signInWithOtp({ email, options: redirect ? { emailRedirectTo: redirect } : {} });
  $('#authSubmit').disabled = false; $('#authMessage').textContent = error ? error.message : 'Link inviato: controlla la tua email.'; $('#authMessage').classList.toggle('error', !!error);
});
render();
initCloud();
