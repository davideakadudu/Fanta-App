const positions = [
  { key: 'P', name: 'PORTIERI', count: 3, color: '#d9e0da' },
  { key: 'D', name: 'DIFENSORI', count: 8, color: '#198b4a' },
  { key: 'C', name: 'CENTROCAMPISTI', count: 8, color: '#aeb8b0' },
  { key: 'A', name: 'ATTACCANTI', count: 6, color: '#f52d2a' },
];
const TOTAL = 300;
const LEAGUE_TEAMS = 10;
const ROLE_DEMAND = { P: 3, D: 8, C: 8, A: 6 };
const ROLE_MAX_BID = { P: 24, D: 38, C: 65, A: 125 };
const VALUATION_CONFIG = {
  fvmScale: 1000,
  maxPremium: 1.10,
  thresholds: { bargain: 0.80, good: 0.95, fair: 1.05 },
  marketLearning: { fullConfidenceSamples: 5, minMultiplier: 0.80, maxMultiplier: 1.25 },
  competition: {
    comparableMin: 0.80,
    comparableMax: 1.25,
    alreadyCoveredWeight: 0.35,
    partialAffordabilityThreshold: 0.80,
    partialAffordabilityWeight: 0.40,
    minMultiplier: 0.94,
    maxMultiplier: 1.15,
    neutralPressure: 1,
    fullPositivePressure: 3,
    minimumTrackingConfidence: 0.20,
  },
  combinedMultiplier: { min: 0.75, max: 1.40 },
};
const defaultLeagueTeams = () => Array.from({ length: LEAGUE_TEAMS }, (_, index) => ({ id: `team-${index + 1}`, name: index === 0 ? 'Corazzata Dudonkin' : `Squadra ${index + 1}`, isMine: index === 0 }));
function normalizeLeagueTeams(value) {
  const defaults = defaultLeagueTeams(); const saved = Array.isArray(value) ? value : [];
  const mineIndex = Math.max(0, saved.findIndex(team => team?.isMine));
  return defaults.map((team, index) => {
    const previous = saved[index] || {};
    return { id: String(previous.id ?? '').trim() || team.id, name: String(previous.name ?? '').trim() || team.name, isMine: index === mineIndex };
  });
}
let roster = JSON.parse(localStorage.getItem('asta300-roster') || '[]');
let market = JSON.parse(localStorage.getItem('asta300-market') || '[]');
let soldElsewhere = JSON.parse(localStorage.getItem('asta300-sold-elsewhere') || '[]');
let auctionSales = JSON.parse(localStorage.getItem('asta300-auction-sales') || '[]');
auctionSales = Array.isArray(auctionSales) ? auctionSales : [];
let leagueTeams = normalizeLeagueTeams(JSON.parse(localStorage.getItem('asta300-league-teams') || 'null'));
let favorites = JSON.parse(localStorage.getItem('asta300-favorites') || '[]');
let theme = localStorage.getItem('asta300-theme') === 'light' ? 'light' : 'dark';
let selectedPosition = null, selectedPlayer = null, selectedSalePlayer = null, mode = 0, roleFilter = 'ALL', showSold = false;
let guideRoleFilter = 'ALL', guideTierFilter = 'TOP';
const CLOUD_URL = 'https://lpbnsvoghjthswibxtdq.supabase.co';
const CLOUD_KEY = 'sb_publishable_dWjiqm-hQhVhOwxpcIVkew_jOog_WHA';
const cloud = window.supabase?.createClient(CLOUD_URL, CLOUD_KEY);
let cloudUser = null, cloudTimer = null, hydratingCloud = false;
const modes = [
  { name: 'Bilanciato', values: { P:[12,5,3], D:[18,12,8,5,3,2,1,1], C:[30,22,15,10,6,4,2,1], A:[55,38,20,12,9,6] } },
  { name: 'Attacco pesante', values: { P:[8,4,3], D:[13,9,6,4,3,2,2,1], C:[24,16,11,7,4,2,1,0], A:[80,48,22,12,10,8] } },
  { name: 'Rosa solida', values: { P:[18,8,4], D:[28,18,12,8,5,4,3,2], C:[38,26,18,12,8,5,2,1], A:[34,22,12,6,4,2] } },
];
const templateCaps = modes.map(mode => Object.fromEntries(positions.map(pos => [pos.key, mode.values[pos.key].reduce((sum, value) => sum + value, 0)])));
let allocationCaps = JSON.parse(localStorage.getItem('asta300-allocation-caps') || 'null') || { ...templateCaps[mode] };
const guideTierNotes = { TOP: 'Profilo su cui investire: non inseguire oltre il piano.', 1: 'Nucleo della rosa: acquisto prioritario.', 2: 'Rapporto qualità/prezzo: rilancia con disciplina.', 3: 'Rotazione e upside: investimento controllato.', 4: 'Ultimo slot o scommessa: prezzo minimo.' };
const guideRows = [
  ['P','TOP','Svilar · Martinez Jo. · Butez · Maignan'], ['P','1','Vicario · Carnesecchi · Meret · De Gea · Mandas'], ['P','2','Caprile · Falcone · Okoye · Skorupski · Muric'], ['P','3','Stankovic F. · Bijlow · Thiam · Palmisani · Daffara'], ['P','4','Corvi · Desplanches · Turati · Provedel · Milinkovic-Savic V.'],
  ['D','TOP','Dimarco · Wesley · Bremer · Bisseck · Mancini'], ['D','1','Molina · Akanji · Bastoni · Cambiaso · Chalobah · Di Lorenzo · Kalulu · N’Dicka · Pavlovic · Rrahmani · Scalvini · Solet · Spence · Spinazzola · Yan Couto · Ramon'], ['D','2','Dodò · Gila · Hermoso · Hien · Idzes · Kristensen T. · Lucumì · Mina · Miranda J. · Norton-Cuffy · Tiago Gabriel · Buongiorno'], ['D','3','Ahanor · Bellanova · Bernasconi · Celik · Coco · Comuzzo · Delprato · Doekhi · Dragusin · Gabbia · Jimenez A. · Koulierakis · Marusic · Nuno Tavares · Vasquez · Zappacosta · Zortea'], ['D','4','Valeri · Kamara H. · Gallo · Gaspar K. · Mangas · Marcandalli · Obert · Veiga D. · Vitik · Bella-Kotchap'],
  ['C','TOP','Calhanoglu · McTominay · Orsolini · Paz N. · Pulisic · Rabiot'], ['C','1','Atta · Barella · Baturina · Da Cunha · De Bruyne · Frattesi · Koné M. · Mastantuono · McKennie · Modric · Moreira · Mora · Perrone · Politano · Rowe · Sucic P. · Taylor K. · Thorstvedt · Vlasic · Zaccagni · Zaniolo · Zielinski'], ['C','2','Alajbegovic · Baldanzi · Bernardeschi · Casadei · Conceicao · Cristante · Diouf · Ederson D.S. · Ekkelenkamp · Fagioli · Gaetano · Gudmundsson A. · Isaksen · Rodriguez Je. · Lobotka · Locatelli · Mandragora · Odgaard · Pasalic · Saelemaekers · Samardzic'], ['C','3','Adopo · Chukwueze · Fazzini · Ferguson · Jones C. · Karlstrom · Ndour · Pessina · Pisilli · Thuram K.'], ['C','4','Calò · Cambiaghi · Cancellieri · Coulibaly L. · Oristanio · Pobega · Rovella · Schmid · Sow · Unai Gomez'],
  ['A','TOP','Malen · Martinez L. · Thuram'], ['A','1','Davis K. · Douvikas · Dovbyk · Dybala · Hojlund · Kean · Kolo Muani · Ramos G. · Scamacca · Simeone · Yildiz'], ['A','2','Santos A. · Boga · Castro S. · De Ketelaere · Berardi · Colombo · Laurientè · Leao · Nkunku · Noslin · Pinamonti · Raspadori · Esposito F.P. · Soulè'], ['A','3','Adams A. · Adams C. · Bonny · Cutrone · David · Diao · Krstovic · Maldini · Pellegrino M. · Tourè E. · Vitinha O. · Yeboah J. · Zapata D.'], ['A','4','Bowie · Camarda · Dia · Ekhator · Geubbels · Ghedjemis · Kevin Carlos · Piccoli · Raimondo · Ratkov · Romero D. · Rrahmani Al.'],
];
const guidePlayers = guideRows.flatMap(([position, tier, names]) => names.split(' · ').map(name => ({ position, tier, name, team: '', tag: tier === 'TOP' || tier === '1' ? 'high' : tier === '2' ? 'value' : 'sleeper', note: guideTierNotes[tier] })));
const lowCostPlayers = [
  ['P','Stankovic F.','Venezia','Portiere da modificatore e titolare; buona soluzione economica.','Non usarlo come unico portiere se vuoi sicurezza.'], ['A','Yeboah J.','Venezia','Esterno creativo, possibile rigorista; doppia cifra gol+assist in B.','Concorrenza di Adams: prezzo da terzo/quarto slot.'], ['A','Adams A.','Venezia','Terminale con possibile priorità sui rigori; upside da titolare.','Neopromossa: rendimento meno prevedibile.'], ['D','Bella-Kotchap','Venezia','Centrale titolare da voto, utile in una difesa lunga.','Pochi bonus: prezzo minimo.'], ['C','Calò','Frosinone','Piazzati e possibile rigorista, titolarità alta: ottimo per voto.','Non proiettarlo ai numeri della Serie B.'], ['A','Ghedjemis','Frosinone','Esterno offensivo, ottima annata in B e possibile rigorista.','Da prendere come sesto slot, non come titolare fisso.'], ['C','Schmid','Frosinone','Minutaggio e gioco tra le linee: low-cost da bonus.','Adattamento alla Serie A da valutare.'], ['A','Kvernadze','Frosinone','Profilo tecnico a prezzo molto basso; scommessa di rottura.','Rischio titolarità/minuti.'], ['D','Gallo','Lecce','Titolare costante: copertura da 6 e possibile assist.','Ceiling bonus limitato.'], ['D','Tiago Gabriel','Lecce','Centrale con potenziale modificatore e pericolo sui piazzati.','Mercato e condizioni da controllare fino all’asta.'], ['A','N’Dri','Lecce','Esterno titolare nel 4-2-3-1: possibile sorpresa da +3/+1.','Prima esperienza da riferimento offensivo.'], ['A','Geubbels / Stulic','Lecce','Gerarchie e opzioni rigoristi: prendine uno al prezzo giusto.','Evita di pagarli come titolari certi: ballottaggio.'], ['D','Valeri','Parma','Titolare e piazzati: uno dei migliori ultimi slot difensivi.','Non inseguire oltre la quarta fascia.'], ['A','Cutrone','Monza','Titolare e opzione rigori: possibile attaccante low-cost più solido.','Contesto squadra e ceiling da monitorare.'], ['D','Mangas','Monza','Esterno titolare da prezzo basso, utile per copertura.','Pochi dati in Serie A.'], ['P','Mascardi','Torino','Se resta titolare, chiamata da 1M con forte vantaggio.','Gerarchia portieri non definitiva.'],
].map(([position, name, team, note, risk]) => ({ position, name, team, note, risk }));
const $ = (s) => document.querySelector(s);
const clean = (value) => String(value ?? '').trim();
const key = (value) => clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const byPosition = (position) => roster.filter((p) => p.position === position);
const spent = () => roster.reduce((sum, p) => sum + p.price, 0);
const money = (n) => `${Math.max(0, Math.round(n))}M`;
const esc = (text) => clean(text).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[c]));
const quoteNumber = (value) => {
  const parsed = Number(String(value ?? '').replace(',', '.').replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};
const optionalNumber = (value) => clean(value) === '' ? null : quoteNumber(value);
const canonicalMarketId = (id) => clean(id).replace(/^fc-/i, '');
const sameMarketId = (first, second) => !!first && !!second && canonicalMarketId(first) === canonicalMarketId(second);
function calculateQuoteFallbackValue(player) {
  const rolePlayers = market.filter(item => item.position === player.position && quoteNumber(item.quote) > 0).sort((a, b) => quoteNumber(b.quote) - quoteNumber(a.quote));
  const rank = rolePlayers.findIndex(item => item.id === player.id);
  if (rank < 0) return 1;
  const contestedSlots = Math.min(rolePlayers.length, ROLE_DEMAND[player.position] * LEAGUE_TEAMS);
  const scarcity = Math.max(0, 1 - rank / Math.max(1, contestedSlots - 1));
  const marketCeiling = 1 + (ROLE_MAX_BID[player.position] - 1) * Math.pow(scarcity, 1.8);
  return Math.max(1, marketCeiling);
}
function median(values) {
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function getRoleMarketStats(position) {
  const comparableSales = auctionSales.filter(sale => sale.position === position && sale.source === 'fvm' && Number.isFinite(Number(sale.price)) && Number(sale.price) > 0 && Number.isFinite(Number(sale.baseValueAtSale)) && Number(sale.baseValueAtSale) > 0);
  const ratios = comparableSales.map(sale => Number(sale.price) / Number(sale.baseValueAtSale));
  if (!ratios.length) return { multiplier: 1, salesCount: 0, medianRatio: null };
  const medianRatio = median(ratios);
  const confidence = Math.min(1, ratios.length / VALUATION_CONFIG.marketLearning.fullConfidenceSamples);
  const learned = 1 + (medianRatio - 1) * confidence;
  return {
    multiplier: Math.max(VALUATION_CONFIG.marketLearning.minMultiplier, Math.min(VALUATION_CONFIG.marketLearning.maxMultiplier, learned)),
    salesCount: ratios.length,
    medianRatio,
  };
}
function calculateRoleMarketMultiplier(position) { return getRoleMarketStats(position).multiplier; }
function getMyTeam() { return leagueTeams.find(team => team.isMine) || leagueTeams[0]; }
function getPlayerBaseValue(player) {
  const fvm = optionalNumber(player?.fvm);
  return Number.isFinite(fvm) && fvm > 0 ? fvm * TOTAL / VALUATION_CONFIG.fvmScale : calculateQuoteFallbackValue(player);
}
function marketPlayerFor(id) { return market.find(player => sameMarketId(player.id, id)); }
function roleCounter(items) { return Object.fromEntries(positions.map(position => [position.key, items.filter(item => item.position === position.key).length])); }
function getTeamAuctionState(teamId) {
  const isMine = teamId === getMyTeam()?.id;
  const assets = isMine ? roster.map(player => ({ ...player, ...marketPlayerFor(player.marketId) })) : auctionSales.filter(sale => sale.ownerTeamId === teamId);
  const roleCounts = roleCounter(assets);
  const roleSlotsRemaining = Object.fromEntries(positions.map(position => [position.key, Math.max(0, position.count - roleCounts[position.key])]));
  const knownSpend = assets.reduce((sum, asset) => {
    const price = optionalNumber(asset.price);
    return price !== null && price > 0 ? sum + price : sum;
  }, 0);
  const unknownPriceCount = assets.filter(asset => { const price = optionalNumber(asset.price); return price === null || price <= 0; }).length;
  const remainingBudgetUpperBound = Math.max(0, TOTAL - knownSpend - unknownPriceCount);
  return {
    spent: knownSpend,
    remainingBudget: unknownPriceCount ? null : Math.max(0, TOTAL - knownSpend),
    remainingBudgetUpperBound,
    totalPlayers: assets.length,
    totalSlotsRemaining: Object.values(roleSlotsRemaining).reduce((sum, value) => sum + value, 0),
    roleCounts,
    roleSlotsRemaining,
    unknownPriceCount,
  };
}
function getTeamHardCap(teamId) {
  const state = getTeamAuctionState(teamId);
  return Math.max(0, Math.floor(state.remainingBudgetUpperBound - Math.max(0, state.totalSlotsRemaining - 1)));
}
function assetBaseValue(asset) {
  const current = marketPlayerFor(asset.marketId || asset.playerId || asset.id);
  if (current) return getPlayerBaseValue(current);
  const fvm = optionalNumber(asset.fvmAtSale);
  if (fvm !== null && fvm > 0) return fvm * TOTAL / VALUATION_CONFIG.fvmScale;
  const historicalBase = optionalNumber(asset.baseValueAtSale);
  return historicalBase !== null && historicalBase > 0 ? historicalBase : 0;
}
function getTeamRoleAssets(teamId, position) {
  const isMine = teamId === getMyTeam()?.id;
  const assets = isMine ? roster : auctionSales.filter(sale => sale.ownerTeamId === teamId);
  return assets.filter(asset => asset.position === position).map(asset => ({ ...asset, baseValue: assetBaseValue(asset) }));
}
function getComparableAvailablePlayers(player) {
  const targetBase = getPlayerBaseValue(player);
  const minimum = targetBase * VALUATION_CONFIG.competition.comparableMin;
  const maximum = targetBase * VALUATION_CONFIG.competition.comparableMax;
  return market.filter(candidate => candidate.position === player.position && !isTaken(candidate) && getPlayerBaseValue(candidate) >= minimum && getPlayerBaseValue(candidate) <= maximum);
}
function calculateCompetitionMultiplier(pressureRatio) {
  const config = VALUATION_CONFIG.competition;
  const raw = pressureRatio >= config.neutralPressure
    ? 1 + Math.min(1, (pressureRatio - config.neutralPressure) / Math.max(1, config.fullPositivePressure - config.neutralPressure)) * (config.maxMultiplier - 1)
    : 1 - Math.min(1, (config.neutralPressure - pressureRatio) / Math.max(1, config.neutralPressure)) * (1 - config.minMultiplier);
  return Math.max(config.minMultiplier, Math.min(config.maxMultiplier, raw));
}
function getCompetitionForPlayer(player, roleMarketMultiplier = calculateRoleMarketMultiplier(player.position)) {
  const comparablePlayers = getComparableAvailablePlayers(player);
  const opponentTeams = leagueTeams.filter(team => !team.isMine);
  const trackedOpponentTeamIds = new Set(auctionSales.map(sale => sale.ownerTeamId).filter(ownerTeamId => opponentTeams.some(team => team.id === ownerTeamId)));
  const trackedOpponentTeams = trackedOpponentTeamIds.size;
  const totalOpponentTeams = opponentTeams.length;
  const trackingConfidence = trackedOpponentTeams / Math.max(1, totalOpponentTeams);
  const effectiveConfidence = Math.max(VALUATION_CONFIG.competition.minimumTrackingConfidence, trackingConfidence);
  if (!trackedOpponentTeams) return { weightedDemand: 0, competitorCount: 0, comparablePlayersRemaining: comparablePlayers.length, pressureRatio: 1, rawCompetitionMultiplier: 1, competitionMultiplier: 1, trackedOpponentTeams, trackingConfidence, effectiveConfidence };
  const targetValue = getPlayerBaseValue(player) * roleMarketMultiplier;
  const weighted = leagueTeams.map(team => {
    const state = getTeamAuctionState(team.id);
    if (!state.roleSlotsRemaining[player.position]) return 0;
    const hardCap = getTeamHardCap(team.id);
    const affordability = hardCap >= targetValue ? 1 : hardCap >= targetValue * VALUATION_CONFIG.competition.partialAffordabilityThreshold ? VALUATION_CONFIG.competition.partialAffordabilityWeight : 0;
    if (!affordability) return 0;
    const alreadyCovered = getTeamRoleAssets(team.id, player.position).some(asset => asset.baseValue >= getPlayerBaseValue(player) * VALUATION_CONFIG.competition.comparableMin);
    return affordability * (alreadyCovered ? VALUATION_CONFIG.competition.alreadyCoveredWeight : 1);
  });
  const weightedDemand = weighted.reduce((sum, value) => sum + value, 0);
  const pressureRatio = weightedDemand / Math.max(1, comparablePlayers.length);
  const rawCompetitionMultiplier = calculateCompetitionMultiplier(pressureRatio);
  const competitionMultiplier = 1 + (rawCompetitionMultiplier - 1) * effectiveConfidence;
  return { weightedDemand, competitorCount: weighted.filter(value => value > 0).length, comparablePlayersRemaining: comparablePlayers.length, pressureRatio, rawCompetitionMultiplier, competitionMultiplier, trackedOpponentTeams, trackingConfidence, effectiveConfidence };
}
function calculateAuctionValue(baseValue, context = {}) {
  // V2+: qui potranno entrare budget avversari, domanda/offerta e scarsità dinamica.
  const multiplier = Number.isFinite(Number(context.combinedMultiplier)) ? Number(context.combinedMultiplier) : (Number.isFinite(Number(context.roleMarketMultiplier)) ? Number(context.roleMarketMultiplier) : calculateRoleMarketMultiplier(context.position));
  return baseValue * multiplier;
}
function personalHardCap(position) {
  const role = positions.find(item => item.key === position);
  if (!role) return 0;
  const totalSlotsAfterThisBid = Math.max(0, 24 - roster.length);
  const totalBudgetCap = TOTAL - spent() - totalSlotsAfterThisBid;
  const roleFund = positionCap(position) - committedFor(position);
  const roleSlotsAfterThisBid = Math.max(0, role.count - byPosition(position).length - 1);
  const roleBudgetCap = roleFund - roleSlotsAfterThisBid;
  return Math.max(0, Math.floor(Math.min(totalBudgetCap, roleBudgetCap)));
}
function calculatePlayerValuation(player, context = {}) {
  const fvm = optionalNumber(player?.fvm);
  const hasFvm = Number.isFinite(fvm) && fvm > 0;
  const baseValue = getPlayerBaseValue(player);
  const roleMarket = getRoleMarketStats(player.position);
  const competition = getCompetitionForPlayer(player, roleMarket.multiplier);
  const combinedMultiplier = Math.max(VALUATION_CONFIG.combinedMultiplier.min, Math.min(VALUATION_CONFIG.combinedMultiplier.max, roleMarket.multiplier * competition.competitionMultiplier));
  const auctionValue = calculateAuctionValue(baseValue, { ...context, position: player.position, roleMarketMultiplier: roleMarket.multiplier, combinedMultiplier });
  const marketMax = auctionValue * VALUATION_CONFIG.maxPremium;
  const maxBid = Math.max(0, Math.min(marketMax, personalHardCap(player.position)));
  return {
    baseValue,
    auctionValue,
    maxBid,
    status: getBidStatus(null, { auctionValue, maxBid }),
    factors: { source: hasFvm ? 'fvm' : 'quote-ranking-fallback', fvm, quote: optionalNumber(player?.quote), marketMax, roleMarketMultiplier: roleMarket.multiplier, roleSalesCount: roleMarket.salesCount, roleMedianRatio: roleMarket.medianRatio, rawCompetitionMultiplier: competition.rawCompetitionMultiplier, competitionMultiplier: competition.competitionMultiplier, trackedOpponentTeams: competition.trackedOpponentTeams, trackingConfidence: competition.trackingConfidence, effectiveConfidence: competition.effectiveConfidence, competitorCount: competition.competitorCount, weightedDemand: competition.weightedDemand, comparablePlayersRemaining: competition.comparablePlayersRemaining, pressureRatio: competition.pressureRatio, combinedMultiplier, context },
  };
}
function getBidStatus(currentBid, valuation) {
  const bid = optionalNumber(currentBid);
  if (!valuation || valuation.maxBid <= 0 || (bid !== null && bid > valuation.maxBid)) return 'STOP';
  if (bid === null) return valuation.maxBid < valuation.auctionValue ? 'STOP' : 'PREZZO GIUSTO';
  const ratio = bid / Math.max(1, valuation.auctionValue);
  if (ratio <= VALUATION_CONFIG.thresholds.bargain) return 'AFFARE';
  if (ratio <= VALUATION_CONFIG.thresholds.good) return 'BUON PREZZO';
  if (ratio <= VALUATION_CONFIG.thresholds.fair) return 'PREZZO GIUSTO';
  return 'CARO';
}
function setSyncStatus(text, synced = false) { const status = $('#syncStatus'); status.textContent = text; status.classList.toggle('synced', synced); }
function buildCloudState() { return { roster, market, soldElsewhere, auctionSales, leagueTeams, favorites, mode, allocationCaps, theme }; }
function queueCloudSave() {
  if (!cloudUser || hydratingCloud || !cloud) return;
  clearTimeout(cloudTimer); setSyncStatus('Sincronizzazione in corso…');
  cloudTimer = setTimeout(async () => {
    const { error } = await cloud.from('auction_states').upsert({ user_id: cloudUser.id, state: buildCloudState(), updated_at: new Date().toISOString() });
    setSyncStatus(error ? 'Salvataggio cloud non riuscito' : 'Sincronizzato sul cloud', !error);
  }, 450);
}
function save() { localStorage.setItem('asta300-roster', JSON.stringify(roster)); localStorage.setItem('asta300-market', JSON.stringify(market)); localStorage.setItem('asta300-sold-elsewhere', JSON.stringify(soldElsewhere)); localStorage.setItem('asta300-auction-sales', JSON.stringify(auctionSales)); localStorage.setItem('asta300-league-teams', JSON.stringify(leagueTeams)); localStorage.setItem('asta300-favorites', JSON.stringify(favorites)); localStorage.setItem('asta300-allocation-caps', JSON.stringify(allocationCaps)); localStorage.setItem('asta300-theme', theme); queueCloudSave(); }
function applyTheme() { const light = theme === 'light'; document.body.classList.toggle('light-theme', light); const button = $('#themeButton'); button.innerHTML = light ? '◐ <span>Tema scuro</span>' : '☼ <span>Tema chiaro</span>'; button.setAttribute('aria-pressed', String(light)); button.title = light ? 'Passa al tema scuro' : 'Passa al tema chiaro'; }
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
  auctionSales = Array.isArray(state.auctionSales) ? state.auctionSales : [];
  leagueTeams = normalizeLeagueTeams(state.leagueTeams);
  favorites = Array.isArray(state.favorites) ? state.favorites : [];
  mode = Number.isInteger(state.mode) ? state.mode : 0;
  allocationCaps = state.allocationCaps && positions.every(pos => Number.isFinite(Number(state.allocationCaps[pos.key]))) ? state.allocationCaps : { ...templateCaps[mode] };
  theme = state.theme === 'light' ? 'light' : theme;
  localStorage.setItem('asta300-roster', JSON.stringify(roster)); localStorage.setItem('asta300-market', JSON.stringify(market)); localStorage.setItem('asta300-sold-elsewhere', JSON.stringify(soldElsewhere)); localStorage.setItem('asta300-auction-sales', JSON.stringify(auctionSales)); localStorage.setItem('asta300-league-teams', JSON.stringify(leagueTeams)); localStorage.setItem('asta300-favorites', JSON.stringify(favorites)); localStorage.setItem('asta300-allocation-caps', JSON.stringify(allocationCaps)); localStorage.setItem('asta300-theme', theme);
  applyTheme(); render(); hydratingCloud = false; setSyncStatus('Sincronizzato sul cloud', true);
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
    const quote = optionalNumber(headerValue(row, ['qta', 'quotazione', 'qt', 'q']));
    const initialQuote = optionalNumber(headerValue(row, ['qti', 'quotazioneiniziale', 'qtiniziale']));
    const fvm = optionalNumber(headerValue(row, ['fvm']));
    return name && position ? { id: officialId || `${key(name)}-${position}-${index}`, name, position, team, quote, initialQuote, fvm } : null;
  }).filter(Boolean);
}
function rowsFromWorksheet(sheet) {
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const nameHeaders = ['nome', 'giocatore', 'calciatore', 'player', 'nomegiocatore', 'nomecalciatore'];
  const roleHeaders = ['r', 'ruolo', 'posizione', 'role'];
  const headerIndex = grid.findIndex(row => {
    const headers = row.map(key);
    return headers.some(header => nameHeaders.includes(header)) && headers.some(header => roleHeaders.includes(header));
  });
  if (headerIndex < 0) return [];
  const headers = grid[headerIndex].map(clean);
  return grid.slice(headerIndex + 1).map(cells => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
}
function reconcileImportedMarket(parsed) {
  const idMap = new Map();
  parsed.forEach(nextPlayer => {
    const previous = market.find(player => sameMarketId(player.id, nextPlayer.id)) || market.find(player => key(player.name) === key(nextPlayer.name) && player.position === nextPlayer.position);
    if (previous?.id && previous.id !== nextPlayer.id) idMap.set(previous.id, nextPlayer.id);
  });
  const remap = (id) => idMap.get(id) || id;
  favorites = favorites.map(remap);
  soldElsewhere = soldElsewhere.map(remap);
  auctionSales = auctionSales.map(sale => sale.playerId ? { ...sale, playerId: remap(sale.playerId) } : sale);
  roster = roster.map(player => player.marketId ? { ...player, marketId: remap(player.marketId) } : player);
  return parsed;
}
function isTaken(player) { return soldElsewhere.some(id => sameMarketId(id, player.id)) || roster.some(p => sameMarketId(p.marketId, player.id) || (key(p.name) === key(player.name) && p.position === player.position)); }
function auctionSaleFor(playerId) { return auctionSales.find(sale => sameMarketId(sale.playerId, playerId)); }
function isOpponentTeamId(teamId) { return leagueTeams.some(team => !team.isMine && team.id === teamId); }
function upsertAuctionSale(player, rawPrice, ownerTeamId = null) {
  const price = optionalNumber(rawPrice);
  const validPrice = price !== null && price > 0;
  const owner = isOpponentTeamId(ownerTeamId) ? ownerTeamId : null;
  if (!validPrice && !owner) return null;
  const valuation = calculatePlayerValuation(player);
  const previous = auctionSaleFor(player.id);
  const sale = {
    id: previous?.id || `sale-${canonicalMarketId(player.id)}`,
    playerId: player.id,
    name: player.name,
    position: player.position,
    team: player.team,
    ownerTeamId: owner,
    price: validPrice ? price : null,
    baseValueAtSale: validPrice ? valuation.baseValue : null,
    fvmAtSale: validPrice ? optionalNumber(player.fvm) : null,
    ratioToBase: validPrice ? price / Math.max(1, valuation.baseValue) : null,
    source: validPrice ? valuation.factors.source : null,
    soldAt: new Date().toISOString(),
  };
  auctionSales = [...auctionSales.filter(item => !sameMarketId(item.playerId, player.id)), sale];
  return sale;
}
function removeAuctionSale(playerId) { auctionSales = auctionSales.filter(sale => !sameMarketId(sale.playerId, playerId)); }
function markSoldElsewhere(player, price = null, ownerTeamId = null) {
  if (!soldElsewhere.some(id => sameMarketId(id, player.id))) soldElsewhere.push(player.id);
  const sale = upsertAuctionSale(player, price, ownerTeamId);
  if (!sale) removeAuctionSale(player.id);
}
function restoreMarketPlayer(playerId) {
  soldElsewhere = soldElsewhere.filter(id => !sameMarketId(id, playerId));
  removeAuctionSale(playerId);
}
function marketMovementLabel(position, multiplier = calculateRoleMarketMultiplier(position)) {
  const delta = (multiplier - 1) * 100;
  return Math.abs(delta) < 0.05 ? `MERCATO ${position} STABILE` : `MERCATO ${position} ${delta > 0 ? '+' : ''}${delta.toFixed(1).replace('.', ',')}%`;
}
function saleAdvice(sale) {
  const ratio = Number(sale?.ratioToBase);
  const change = Number.isFinite(ratio) ? `${ratio >= 1 ? '+' : ''}${((ratio - 1) * 100).toFixed(1).replace('.', ',')}%` : '';
  const owner = leagueTeams.find(team => team.id === sale?.ownerTeamId)?.name;
  return `<span class="bid-advice sale-advice" title="Prezzo registrato durante l’asta"><b>VENDUTO ${sale.price ? money(sale.price) : 'SENZA PREZZO'}</b><small>${sale.price ? `BASE ${money(sale.baseValueAtSale)}${change ? ` · ${change}` : ''}` : 'Prezzo non registrato'}${owner ? ` · ${esc(owner)}` : ''}</small></span>`;
}
function nameTokens(name) { return clean(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z]+/g) || []; }
function sameGuidePlayer(reference, player) {
  if (reference.position !== player.position) return false;
  return reference.name.split(' / ').some(option => {
    const wanted = nameTokens(option), actual = nameTokens(player.name);
    return wanted.length && wanted.every(token => token.length === 1 ? actual.some(value => value.startsWith(token)) : actual.includes(token));
  });
}
function isGuideUnavailable(reference) {
  const bought = roster.some(player => sameGuidePlayer(reference, player));
  const sold = market.some(player => sameGuidePlayer(reference, player) && soldElsewhere.some(id => sameMarketId(id, player.id)));
  return bought || sold;
}
function isFavorite(player) { return favorites.some(id => sameMarketId(id, player.id)); }
function valuesFor(position) {
  const base = modes[mode].values[position], templateCap = templateCaps[mode][position], cap = Number(allocationCaps[position]);
  const scaled = base.map(value => Math.max(1, Math.round(value / templateCap * cap)));
  const delta = Math.round(cap) - scaled.reduce((sum, value) => sum + value, 0);
  scaled[0] = Math.max(1, scaled[0] + delta);
  return scaled;
}
function positionCap(position) { return Math.round(Number(allocationCaps[position]) || 0); }
function committedFor(position) { return byPosition(position).reduce((sum, player) => sum + player.price, 0); }
function minimumPlanFor(position) { const group = positions.find(item => item.key === position); return committedFor(position) + group.count - byPosition(position).length; }
function planIsCustom() { return positions.some(pos => positionCap(pos.key) !== templateCaps[mode][pos.key]); }
function setAllocationCap(position, rawValue) {
  const otherPositions = positions.filter(pos => pos.key !== position);
  const otherMinimum = otherPositions.reduce((sum, pos) => sum + minimumPlanFor(pos.key), 0);
  const minimum = minimumPlanFor(position);
  const nextValue = Math.max(minimum, Math.min(TOTAL - otherMinimum, Math.round(Number(rawValue) || minimum)));
  const availableForOthers = TOTAL - nextValue;
  const otherCommitted = otherPositions.reduce((sum, pos) => sum + minimumPlanFor(pos.key), 0);
  const distributable = Math.max(0, availableForOthers - otherCommitted);
  const weights = otherPositions.map(pos => Math.max(1, positionCap(pos.key) - minimumPlanFor(pos.key)));
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  let assigned = 0;
  otherPositions.forEach((pos, index) => {
    const extra = index === otherPositions.length - 1 ? distributable - assigned : Math.round(distributable * weights[index] / weightTotal);
    allocationCaps[pos.key] = minimumPlanFor(pos.key) + extra;
    assigned += extra;
  });
  allocationCaps[position] = nextValue;
  save(); render();
}
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
  const planTotal = positions.reduce((sum, pos) => sum + positionCap(pos.key), 0);
  $('#allocationList').innerHTML = positions.map(pos => {
    const committed = committedFor(pos.key);
    const cap = positionCap(pos.key);
    const fund = Math.max(0, cap - committed);
    const next = liveValues(pos.key).find(value => value.paid === undefined);
    const guide = next?.live || 0;
    const pct = Math.min(100, committed / cap * 100);
    return `<div class="allocation-row" style="--group:${pos.color}"><b>${pos.key}</b><div class="bar" title="${money(committed)} spesi su ${money(cap)}"><span style="width:${pct}%"></span></div><label class="allocation-input" title="Modifica il budget del reparto"><input type="number" min="${minimumPlanFor(pos.key)}" max="${TOTAL}" value="${cap}" data-cap-position="${pos.key}" inputmode="numeric" /><span>M</span></label><p><strong>${money(committed)} / ${money(cap)}</strong><em>fondo ${money(fund)} · guida ${money(guide)}</em></p></div>`;
  }).join('');
  document.querySelectorAll('[data-cap-position]').forEach(input => input.addEventListener('change', () => setAllocationCap(input.dataset.capPosition, input.value)));
  $('#modeButton').textContent = `${planIsCustom() ? 'Piano personale' : modes[mode].name}⌄`;
  $('#allocationTotal').textContent = `${planTotal}/300M`;
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
      return `<div class="price-slot ${player ? 'filled' : ''}"><span class="price-slot-index">${index + 1}</span><span class="price-slot-name">${text}</span><span class="price-slot-value">${valueText}<small>${detail}</small>${player ? `<button class="price-remove" data-remove-index="${roster.indexOf(player)}" title="Rimuovi ${esc(player.name)} dalla rosa">× Rimuovi</button>` : ''}</span></div>`;
    }).join('');
    return `<article class="price-group" style="--group:${pos.color}"><div class="price-group-head"><b>${pos.key} · ${pos.name}</b><span>${money(positionCap(pos.key))} piano</span></div>${rows}</article>`;
  }).join('');
  document.querySelectorAll('[data-remove-index]').forEach(button => button.addEventListener('click', () => removePlayer(Number(button.dataset.removeIndex))));
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
  document.querySelectorAll('[data-unfavorite-id]').forEach(el => el.addEventListener('click', () => { favorites = favorites.filter(id => !sameMarketId(id, el.dataset.unfavoriteId)); save(); renderMarket(); }));
}
function guideMeta(tag) { return { high: ['priorità', 'Priorità'], value: ['valore', 'Qualità/prezzo'], sleeper: ['low', 'Low-cost'] }[tag]; }
function guideTierLabel(tier) { return tier === 'TOP' ? 'TOP' : `${tier}ª FASCIA`; }
function renderGuide() {
  const visible = guidePlayers.filter(player => !isGuideUnavailable(player) && (guideRoleFilter === 'ALL' || player.position === guideRoleFilter) && (guideTierFilter === 'ALL' || player.tier === guideTierFilter));
  $('#guideList').innerHTML = visible.map(player => {
    const role = positions.find(pos => pos.key === player.position); const [tagClass, tagText] = guideMeta(player.tag);
    return `<article class="guide-card" style="--group:${role.color}"><div class="guide-card-top"><span class="guide-role">${player.position} · ${role.name.slice(0, 3)}</span><span class="guide-tier">${guideTierLabel(player.tier)}</span></div><h3>${esc(player.name)}</h3><p class="guide-note">${esc(player.note)}</p><div class="guide-card-bottom"><span class="guide-tag ${tagClass}">${tagText}</span><button data-guide-search="${esc(player.name)}" data-guide-position="${player.position}">Cerca nel listone →</button></div></article>`;
  }).join('') || '<div class="empty-guide"><b>Nessun profilo in questa fascia</b><p>Prova a cambiare i filtri della guida.</p></div>';
  const lowCostAvailable = lowCostPlayers.filter(player => !isGuideUnavailable(player));
  $('#lowCostStatus').textContent = `${lowCostAvailable.length}/${lowCostPlayers.length} DISPONIBILI`;
  $('#lowCostList').innerHTML = lowCostAvailable.map(player => {
    const role = positions.find(pos => pos.key === player.position);
    return `<article class="guide-card low-cost-card" style="--group:${role.color}"><div class="guide-card-top"><span class="guide-role">${player.position} · LOW-COST</span><span class="guide-tier">${esc(player.team)}</span></div><h3>${esc(player.name)}</h3><p class="guide-note">${esc(player.note)}</p><p class="guide-risk">RISCHIO: ${esc(player.risk)}</p><div class="guide-card-bottom"><span class="guide-tag low">scommessa</span><button data-guide-search="${esc(player.name.split(' / ')[0])}" data-guide-position="${player.position}">Cerca nel listone →</button></div></article>`;
  }).join('') || '<div class="empty-guide"><b>Tutte le scommesse di questo scout sono già uscite</b><p>Controlla la guida per trovare il prossimo profilo da seguire.</p></div>';
  document.querySelectorAll('[data-guide-search]').forEach(button => button.addEventListener('click', () => {
    guideRoleFilter = button.dataset.guidePosition; guideTierFilter = 'ALL';
    $('#playerSearch').value = button.dataset.guideSearch; roleFilter = button.dataset.guidePosition;
    document.querySelectorAll('#roleTabs button').forEach(tab => tab.classList.toggle('active', tab.dataset.filter === roleFilter));
    renderGuide(); renderMarket(); $('#marketBoard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}
function renderMarket() {
  const search = key($('#playerSearch').value); const base = showSold ? market.filter(p => soldElsewhere.some(id => sameMarketId(id, p.id))) : market.filter(p => !isTaken(p)); const filtered = base.filter(p => (roleFilter === 'ALL' || p.position === roleFilter) && (!search || key(`${p.name} ${p.team}`).includes(search)));
  $('#listDescription').textContent = market.length ? `${market.length} giocatori importati · tetti calcolati per un’asta a ${LEAGUE_TEAMS}, budget 300M e base 1M.` : 'Carica l’Excel esportato da Fantacalcio.it per iniziare.';
  $('#listCount').textContent = `${filtered.length} ${showSold ? 'passati' : 'disponibili'}`; $('#soldCount').textContent = soldElsewhere.length; $('#soldToggle').classList.toggle('active', showSold);
  $('#marketLive').innerHTML = positions.map(position => {
    const stats = getRoleMarketStats(position.key);
    const countLabel = `${stats.salesCount} vendita${stats.salesCount === 1 ? '' : 'e'} FVM`;
    return `<div class="market-live-role" style="--group:${position.color}"><b>${position.key} · ${marketMovementLabel(position.key, stats.multiplier).replace(`MERCATO ${position.key} `, '')}</b><span>${stats.multiplier.toFixed(2).replace('.', ',')}× · ${countLabel}</span></div>`;
  }).join('');
  $('#marketList').innerHTML = market.length ? (filtered.length ? filtered.map(p => {
    const valuation = calculatePlayerValuation(p);
    const fvm = optionalNumber(p.fvm);
    const sale = auctionSaleFor(p.id);
    const advice = showSold && sale ? saleAdvice(sale) : `<span class="bid-advice" title="Valore asta e massimo personale: il MAX protegge il budget, non è un’offerta consigliata."><b>VAL ${money(valuation.auctionValue)} · MAX ${money(valuation.maxBid)}</b>${fvm ? `<small>FVM ${fvm}</small>` : ''}</span>`;
    return `<div class="market-row" style="--group:${positions.find(x => x.key === p.position).color}"><b class="market-position">${p.position}</b><b class="market-player">${esc(p.name)}</b><span class="market-team">${esc(p.team || '—')}</span><span class="market-quote">${esc(p.quote !== null && p.quote !== undefined ? `Qt. ${p.quote}` : 'Qt. —')}</span>${advice}<div class="market-actions">${showSold ? `<button data-restore-id="${p.id}">Ripristina</button>${sale ? `<button data-edit-sale-id="${p.id}">Modifica</button>` : ''}` : `<button data-market-id="${p.id}">Mia rosa</button><button class="sold-button" data-sold-id="${p.id}">Venduto</button>`}<button class="favorite-button ${isFavorite(p) ? 'active' : ''}" data-favorite-id="${p.id}" title="${isFavorite(p) ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}">${isFavorite(p) ? '★' : '☆'}</button></div></div>`;
  }).join('') : '<div class="empty-list"><b>Nessun giocatore in questo elenco</b><p>Prova a cambiare filtro o ricerca.</p></div>') : '<div class="empty-list"><span>↥</span><b>Importa la lista ufficiale</b><p>Accettiamo file .xlsx, .xls e .csv. I giocatori acquistati spariscono automaticamente da qui.</p></div>';
  document.querySelectorAll('[data-market-id]').forEach(el => el.addEventListener('click', () => { const player = market.find(p => p.id === el.dataset.marketId); openDialog(player.position, player); }));
  document.querySelectorAll('[data-sold-id]').forEach(el => el.addEventListener('click', () => { const player = market.find(p => sameMarketId(p.id, el.dataset.soldId)); if (player) openSaleDialog(player); }));
  document.querySelectorAll('[data-edit-sale-id]').forEach(el => el.addEventListener('click', () => { const player = market.find(p => sameMarketId(p.id, el.dataset.editSaleId)); if (player) openSaleDialog(player); }));
  document.querySelectorAll('[data-restore-id]').forEach(el => el.addEventListener('click', () => { restoreMarketPlayer(el.dataset.restoreId); save(); render(); }));
  document.querySelectorAll('[data-favorite-id]').forEach(el => el.addEventListener('click', () => { const id = el.dataset.favoriteId; favorites = isFavorite({ id }) ? favorites.filter(item => !sameMarketId(item, id)) : [...favorites, id]; save(); renderMarket(); }));
  renderFavorites();
}
function render() { renderGrid(); renderStats(); renderAllocation(); renderAdvice(); renderPricebook(); renderGuide(); renderMarket(); }
function updateBidStatus() {
  const status = $('#bidStatus');
  if (!selectedPlayer || optionalNumber($('#playerPrice').value) === null) { status.hidden = true; return; }
  const valuation = calculatePlayerValuation(selectedPlayer);
  const label = getBidStatus($('#playerPrice').value, valuation);
  status.hidden = false; status.textContent = label; status.className = `bid-status ${key(label)}`;
}
function openDialog(position, player = null) {
  selectedPosition = position; selectedPlayer = player; const p = positions.find(x => x.key === position); const valuation = player ? calculatePlayerValuation(player) : null;
  $('#dialogPosition').textContent = `${p.key} · ${p.name}`; $('#dialogTitle').textContent = player ? 'Segna acquisto' : 'Registra acquisto'; $('#playerName').value = player?.name || ''; $('#playerName').readOnly = !!player; $('#playerPrice').value = '';
  $('#selectedPlayerInfo').hidden = !player;
  const competitionDelta = (valuation?.factors.competitionMultiplier - 1) * 100;
  const competitionLabel = Math.abs(competitionDelta) < 0.05 ? 'CONCORRENZA STABILE' : `CONCORRENZA ${competitionDelta > 0 ? '+' : ''}${competitionDelta.toFixed(1).replace('.', ',')}%`;
  $('#selectedPlayerInfo').textContent = player ? `${player.team || 'Squadra non indicata'} · Qt. ${player.quote ?? '—'} · FVM ${player.fvm ?? '—'}\nBASE ${money(valuation.baseValue)}\n${marketMovementLabel(player.position, valuation.factors.roleMarketMultiplier)}\n${competitionLabel}\nVAL ${money(valuation.auctionValue)} · MAX ${money(valuation.maxBid)}\n${valuation.factors.competitorCount} squadre interessate · ${valuation.factors.comparablePlayersRemaining} alternative comparabili\ndati avversari ${valuation.factors.trackedOpponentTeams}/${LEAGUE_TEAMS - 1}` : '';
  $('#bidStatus').hidden = true; $('#playerDialog').showModal(); setTimeout(() => $('#playerPrice').focus(), 50);
}
function openSaleDialog(player) {
  selectedSalePlayer = player;
  const sale = auctionSaleFor(player.id);
  const valuation = calculatePlayerValuation(player);
  $('#saleTitle').textContent = sale ? 'Modifica vendita' : 'Segna venduto';
  $('#salePlayerInfo').textContent = `${player.name} · ${player.team || 'Squadra non indicata'}\nBASE ${money(valuation.baseValue)} · ${marketMovementLabel(player.position, valuation.factors.roleMarketMultiplier)}\nVAL ${money(valuation.auctionValue)} · MAX ${money(valuation.maxBid)}`;
  $('#salePrice').value = sale?.price ?? '';
  $('#saleOwnerTeam').innerHTML = `<option value="">Squadra non specificata</option>${leagueTeams.filter(team => !team.isMine).map(team => `<option value="${esc(team.id)}">${esc(team.name)}</option>`).join('')}`;
  $('#saleOwnerTeam').value = sale?.ownerTeamId || '';
  $('#saleSubmit').textContent = sale ? 'Aggiorna vendita' : 'Registra vendita';
  $('#saleDialog').showModal(); setTimeout(() => $('#salePrice').focus(), 50);
}
function teamBudgetLabel(state) { return state.remainingBudget === null ? `≤ ${money(state.remainingBudgetUpperBound)}` : money(state.remainingBudget); }
function renderLeagueDialog() {
  $('#leagueList').innerHTML = leagueTeams.map(team => {
    const state = getTeamAuctionState(team.id);
    const roles = positions.map(position => `${position.key} ${state.roleCounts[position.key]}/${position.count}`).join(' · ');
    return `<div class="league-team-row"><label><span>${team.isMine ? 'LA TUA SQUADRA' : 'SQUADRA AVVERSARIA'}</span><input data-league-team-id="${esc(team.id)}" value="${esc(team.name)}" maxlength="40" /></label><div><b>${teamBudgetLabel(state)}</b><small>${state.unknownPriceCount ? 'budget stimato' : 'budget residuo'} · ${roles}</small></div></div>`;
  }).join('');
  document.querySelectorAll('[data-league-team-id]').forEach(input => input.addEventListener('change', () => {
    const team = leagueTeams.find(item => item.id === input.dataset.leagueTeamId);
    if (!team) return;
    team.name = clean(input.value) || team.name; save(); renderLeagueDialog(); renderMarket();
  }));
}
function removePlayer(index) { const p = roster[index]; if (confirm(`Annullare l'acquisto di ${p.name}? Tornerà nella lista disponibile.`)) { roster.splice(index, 1); save(); render(); } }
async function importList(file) {
  if (!window.XLSX) { alert('Impossibile caricare il lettore Excel. Verifica la connessione e riprova.'); return; }
  try { const data = await file.arrayBuffer(); const workbook = XLSX.read(data, { type: 'array' }); const officialSheet = workbook.Sheets.Tutti || workbook.Sheets[workbook.SheetNames[0]]; const rows = rowsFromWorksheet(officialSheet); const parsed = parseRows(rows); if (!parsed.length) throw new Error('Colonne non riconosciute'); market = reconcileImportedMarket(parsed); save(); render(); } catch (error) { alert('Non sono riuscito a leggere questa lista. Servono il foglio Tutti e le colonne Id, R, Nome, Squadra, Qt.A, Qt.I e FVM.'); }
}
$('#playerForm').addEventListener('submit', e => { if (e.submitter?.value === 'cancel') return; e.preventDefault(); const name = $('#playerName').value.trim(), price = Number($('#playerPrice').value); if (!name || !price || price < 1) return; roster.push({ name, price, position: selectedPosition, marketId: selectedPlayer?.id || null }); save(); $('#playerDialog').close(); render(); });
$('#saleForm').addEventListener('submit', e => {
  if (e.submitter?.value === 'cancel' || !selectedSalePlayer) return;
  e.preventDefault();
  const ownerTeamId = $('#saleOwnerTeam').value || null;
  if (e.submitter?.value === 'without-price') markSoldElsewhere(selectedSalePlayer, null, ownerTeamId);
  else {
    const price = optionalNumber($('#salePrice').value);
    if (price === null || price < 1) { markSoldElsewhere(selectedSalePlayer, null, ownerTeamId); }
    else markSoldElsewhere(selectedSalePlayer, price, ownerTeamId);
  }
  save(); $('#saleDialog').close(); render();
});
$('#addPlayerButton').addEventListener('click', () => { const first = positions.find(p => byPosition(p.key).length < p.count); if (first) openDialog(first.key); });
$('#resetButton').addEventListener('click', () => { if (roster.length && confirm('Azzerare tutti gli acquisti registrati?')) { roster = []; save(); render(); } });
$('#modeButton').addEventListener('click', () => { mode = (mode + 1) % modes.length; allocationCaps = { ...templateCaps[mode] }; save(); render(); });
$('#excelInput').addEventListener('change', e => { if (e.target.files[0]) importList(e.target.files[0]); e.target.value = ''; });
$('#playerPrice').addEventListener('input', updateBidStatus);
$('#playerSearch').addEventListener('input', renderMarket);
$('#roleTabs').addEventListener('click', e => { if (!e.target.dataset.filter) return; roleFilter = e.target.dataset.filter; document.querySelectorAll('#roleTabs button').forEach(b => b.classList.toggle('active', b === e.target)); renderMarket(); });
$('#soldToggle').addEventListener('click', () => { showSold = !showSold; renderMarket(); });
$('#leagueButton').addEventListener('click', () => { renderLeagueDialog(); $('#leagueDialog').showModal(); });
$('#themeButton').addEventListener('click', () => { theme = theme === 'light' ? 'dark' : 'light'; applyTheme(); save(); });
$('#guideRoleFilters').addEventListener('click', e => { if (!e.target.dataset.guideRole) return; guideRoleFilter = e.target.dataset.guideRole; document.querySelectorAll('#guideRoleFilters button').forEach(button => button.classList.toggle('active', button === e.target)); renderGuide(); });
$('#guideTierFilters').addEventListener('click', e => { if (!e.target.dataset.guideTier) return; guideTierFilter = e.target.dataset.guideTier; document.querySelectorAll('#guideTierFilters button').forEach(button => button.classList.toggle('active', button === e.target)); renderGuide(); });
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
applyTheme();
render();
initCloud();
