import React, { useState, useMemo, useEffect } from 'react';

export default function App() {
  const [activeTab, setActiveTab] = useState('combined'); 
  const [toastMsg, setToastMsg] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [livePrices, setLivePrices] = useState({});
  const [stockForm, setStockForm] = useState({ ticker: '', buyPrice: '', shares: '', commission: '', owner: 'me' });
  const [cashForm, setCashForm] = useState({ amount: '', note: '', type: 'deposit' });
  const [sellModal, setSellModal] = useState({ isOpen: false, stockId: null, ticker: '', maxShares: 0, sharesToSell: '', sellPrice: '', commission: '' });

  // 🧠 LocalStorage 記憶功能
  const [cashBalance, setCashBalance] = useState(() => {
    const saved = localStorage.getItem('v3_cash');
    return saved !== null ? JSON.parse(saved) : 0;
  });
  useEffect(() => { localStorage.setItem('v3_cash', JSON.stringify(cashBalance)); }, [cashBalance]);

  const [portfolio, setPortfolio] = useState(() => {
    const saved = localStorage.getItem('v3_portfolio');
    return saved !== null ? JSON.parse(saved) : [];
  });
  useEffect(() => { localStorage.setItem('v3_portfolio', JSON.stringify(portfolio)); }, [portfolio]);

  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem('v3_logs');
    return saved !== null ? JSON.parse(saved) : [];
  });
  useEffect(() => { localStorage.setItem('v3_logs', JSON.stringify(logs)); }, [logs]);

  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000); };
  const getPnlColor = (value) => { if (value > 0) return 'text-rose-400'; if (value < 0) return 'text-emerald-400'; return 'text-gray-400'; };
  const formatMoney = (num) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);

  const handleCashAction = (e) => {
    e.preventDefault();
    const amt = parseFloat(cashForm.amount);
    if (isNaN(amt) || amt <= 0) return showToast('❌ 金額必須大於 0');
    const finalAmt = cashForm.type === 'deposit' ? amt : -amt;
    setCashBalance(prev => prev + finalAmt);
    const now = Date.now();
    setLogs([{ id: now, timestamp: now, type: cashForm.type === 'deposit' ? '存入' : '提領', detail: cashForm.note || (cashForm.type === 'deposit' ? '現金存入' : '現金提領'), amount: finalAmt, date: new Date(now).toLocaleString() }, ...logs]);
    setCashForm({ ...cashForm, amount: '', note: '' });
    showToast('✨ 動作已紀錄');
  };

  const addStock = (e) => {
    e.preventDefault();
    const buyPrice = parseFloat(stockForm.buyPrice);
    const shares = parseFloat(stockForm.shares);
    const commission = parseFloat(stockForm.commission) || 0;
    if (isNaN(buyPrice) || buyPrice <= 0 || isNaN(shares) || shares <= 0) return showToast('❌ 數值錯誤');
    const totalCost = (buyPrice * shares) + commission;
    const now = Date.now();
    const newStock = { id: now.toString(), ticker: stockForm.ticker.toUpperCase(), buyPrice, shares, commission, owner: stockForm.owner, date: new Date(now).toLocaleString() };
    setPortfolio([...portfolio, newStock]);
    setCashBalance(prev => prev - totalCost);
    setLogs([{ id: now, type: '買入', detail: `${newStock.owner === 'me' ? '我' : '爸爸'} 買入 ${newStock.ticker}`, amount: -totalCost, date: new Date(now).toLocaleString() }, ...logs]);
    setStockForm({ ticker: '', buyPrice: '', shares: '', commission: '', owner: 'me' });
    showToast('✨ 買入成功');
  };

  // ⚠️ 剛剛漏掉的就是這段打開賣出視窗的功能！已經補上！
  const openSellModal = (stock) => {
    setSellModal({
      isOpen: true, stockId: stock.id, ticker: stock.ticker, maxShares: stock.shares,
      sharesToSell: stock.shares, sellPrice: livePrices[stock.ticker] || stock.buyPrice, commission: '' 
    });
  };

  const handleSellStock = (e) => {
    e.preventDefault();
    const target = portfolio.find(p => p.id === sellModal.stockId);
    if (!target) return;
    const sellShares = parseFloat(sellModal.sharesToSell);
    const sellPrice = parseFloat(sellModal.sellPrice);
    const sellCommission = parseFloat(sellModal.commission) || 0;

    if (isNaN(sellShares) || sellShares <= 0 || sellShares > target.shares) return showToast(`❌ 賣出股數必須介於 0 到 ${target.shares} 之間`);
    if (isNaN(sellPrice) || sellPrice <= 0) return showToast('❌ 賣出單價必須大於 0');
    if (sellCommission < 0) return showToast('❌ 手續費不可為負數');

    const proceeds = (sellPrice * sellShares) - sellCommission;
    if (sellShares === target.shares) { setPortfolio(portfolio.filter(p => p.id !== target.id)); } 
    else { setPortfolio(portfolio.map(p => p.id === target.id ? { ...p, shares: p.shares - sellShares } : p)); }
    setCashBalance(prev => prev + proceeds);
    setLogs([{ id: Date.now(), type: '賣出', detail: `賣出 ${target.ticker} ${sellShares}股`, amount: proceeds, date: new Date().toLocaleString() }, ...logs]);
    setSellModal({ ...sellModal, isOpen: false });
    showToast('✨ 賣出成功');
  };

  const fetchRealTimePrices = async () => {
    const tickers = [...new Set(portfolio.map(p => p.ticker))];
    if (tickers.length === 0) return showToast('💡 目前無持股');
    setIsUpdating(true);
    const API_KEY = 'd7j38fpr01qp3g1rkso0d7j38fpr01qp3g1rksog';
    try {
      const updatedPrices = { ...livePrices };
      await Promise.all(tickers.map(async (t) => {
        const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${t}&token=${API_KEY}`);
        const data = await res.json();
        if (data && data.c) updatedPrices[t] = data.c;
      }));
      setLivePrices(updatedPrices);
      showToast('🔄 價格更新完成');
    } catch (e) { showToast('❌ 更新失敗'); } finally { setIsUpdating(false); }
  };

  const currentStocks = useMemo(() => activeTab === 'me' || activeTab === 'dad' ? portfolio.filter(p => p.owner === activeTab) : portfolio, [portfolio, activeTab]);
  const stats = useMemo(() => currentStocks.reduce((acc, curr) => {
    const cost = curr.buyPrice * curr.shares;
    const val = (livePrices[curr.ticker] || curr.buyPrice) * curr.shares;
    return { cost: acc.cost + cost, value: acc.value + val, pnl: acc.pnl + (val - cost) };
  }, { cost: 0, value: 0, pnl: 0 }), [currentStocks, livePrices]);

  return (
    <div className="min-h-screen bg-[#050505] text-gray-200 font-sans pb-24">
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
        {toastMsg && <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] bg-white/10 backdrop-blur-xl border border-white/20 px-6 py-3 rounded-full animate-bounce">{toastMsg}</div>}
        <header className="flex flex-col md:flex-row justify-between items-end gap-4">
          <div><h1 className="text-2xl font-light tracking-widest text-white">PORTFOLIO<span className="text-blue-500">.</span></h1><p className="text-[10px] text-gray-500 uppercase tracking-widest">美國市場資產管理</p></div>
          <nav className="flex bg-[#111] p-1 rounded-full border border-white/5 shadow-inner">
            {['combined', 'me', 'dad', 'cash', 'history'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${activeTab === t ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500'}`}>
                {t === 'combined' ? '綜合' : t === 'me' ? '我的' : t === 'dad' ? '爸爸' : t === 'cash' ? '現金' : '日誌'}
              </button>
            ))}
          </nav>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-gradient-to-br from-[#151515] to-[#0a0a0a] border border-white/5 rounded-3xl p-7 shadow-xl">
            <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">{activeTab === 'combined' ? '總市值 (含現金)' : '持股市值'}</p>
            <h2 className="text-3xl font-light">{formatMoney(stats.value + (activeTab === 'combined' ? cashBalance : 0))}</h2>
          </div>
          <div className="bg-gradient-to-br from-[#151515] to-[#0a0a0a] border border-white/5 rounded-3xl p-7 shadow-xl">
            <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">未實現損益</p>
            <h2 className={`text-3xl font-light ${getPnlColor(stats.pnl)}`}>{stats.pnl >= 0 ? '+' : ''}{formatMoney(stats.pnl)} <span className="text-sm">({stats.cost > 0 ? (stats.pnl / stats.cost * 100).toFixed(2) : '0.00'}%)</span></h2>
          </div>
          <div className="bg-gradient-to-br from-[#151515] to-[#0a0a0a] border border-white/5 rounded-3xl p-7 shadow-xl border-l-2 border-l-blue-600">
            <p className="text-[10px] text-blue-500 font-bold uppercase mb-2">現金餘額</p>
            <h2 className="text-3xl font-light">{formatMoney(cashBalance)}</h2>
          </div>
        </section>

        <main className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1">
            {activeTab === 'cash' ? (
              <form onSubmit={handleCashAction} className="bg-[#111] border border-white/5 p-6 rounded-3xl space-y-4">
                <div className="flex bg-black p-1 rounded-xl border border-white/5">
                  <button type="button" onClick={()=>setCashForm({...cashForm, type:'deposit'})} className={`flex-1 py-2 rounded-lg text-xs ${cashForm.type==='deposit'?'bg-[#222] text-white':'text-gray-500'}`}>存入</button>
                  <button type="button" onClick={()=>setCashForm({...cashForm, type:'withdraw'})} className={`flex-1 py-2 rounded-lg text-xs ${cashForm.type==='withdraw'?'bg-[#222] text-white':'text-gray-500'}`}>提領</button>
                </div>
                <input required type="number" step="any" min="0.01" value={cashForm.amount} onChange={e=>setCashForm({...cashForm, amount: e.target.value})} placeholder="金額 (USD)" className="w-full bg-black border border-white/5 rounded-xl px-4 py-3 text-sm" />
                <input value={cashForm.note} onChange={e=>setCashForm({...cashForm, note: e.target.value})} placeholder="備註" className="w-full bg-black border border-white/5 rounded-xl px-4 py-3 text-sm" />
                <button className="w-full bg-blue-600 py-3 rounded-xl font-bold hover:bg-blue-500 transition-colors">執行</button>
              </form>
            ) : (
              <form onSubmit={addStock} className="bg-[#111] border border-white/5 p-6 rounded-3xl space-y-4">
                <input required value={stockForm.ticker} onChange={e=>setStockForm({...stockForm, ticker: e.target.value})} placeholder="股票代號 (例: APLD)" className="w-full bg-black border border-white/5 rounded-xl px-4 py-3 text-sm font-bold uppercase" />
                <div className="grid grid-cols-2 gap-2"><input required type="number" step="any" min="0.001" value={stockForm.buyPrice} onChange={e=>setStockForm({...stockForm, buyPrice: e.target.value})} placeholder="單價" className="bg-black border border-white/5 rounded-xl px-4 py-3 text-sm" /><input required type="number" step="any" min="0.001" value={stockForm.shares} onChange={e=>setStockForm({...stockForm, shares: e.target.value})} placeholder="股數" className="bg-black border border-white/5 rounded-xl px-4 py-3 text-sm" /></div>
                <input type="number" step="any" min="0" value={stockForm.commission} onChange={e=>setStockForm({...stockForm, commission: e.target.value})} placeholder="手續費 (USD)" className="w-full bg-black border border-white/5 rounded-xl px-4 py-3 text-sm" />
                <select value={stockForm.owner} onChange={e=>setStockForm({...stockForm, owner: e.target.value})} className="w-full bg-black border border-white/5 rounded-xl px-4 py-3 text-sm"><option value="me">我的帳戶</option><option value="dad">爸爸的帳戶</option></select>
                <button className="w-full bg-rose-600 py-3 rounded-xl font-bold hover:bg-rose-500 transition-colors">買入股票</button>
              </form>
            )}
          </aside>

          <article className="lg:col-span-3">
            <div className="bg-[#111] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#0a0a0a]">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">持股明細</h3>
                <button onClick={fetchRealTimePrices} disabled={isUpdating} className="text-[10px] bg-white/5 px-4 py-2 rounded-full border border-white/10 font-bold hover:bg-white/10 transition-all">{isUpdating ? '同步中...' : '同步現價'}</button>
              </div>
              <table className="w-full text-sm text-left">
                <thead className="bg-[#0a0a0a] text-gray-500 text-[10px] uppercase font-bold"><tr><th className="px-6 py-4">標的</th><th className="px-6 py-4 text-right">現價 / 買價</th><th className="px-6 py-4 text-right">市值</th><th className="px-6 py-4 text-right">損益</th><th className="px-6 py-4 text-center">操作</th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {currentStocks.map(s => {
                    const cur = livePrices[s.ticker] || s.buyPrice;
                    const val = cur * s.shares;
                    const pnl = val - (s.buyPrice * s.shares);
                    return (
                      <tr key={s.id} className="hover:bg-white/[0.02]">
                        <td className="px-6 py-5"><div className="font-bold text-white tracking-widest uppercase">{s.ticker}</div><div className="text-[10px] text-gray-500">{s.owner === 'me' ? 'Mine' : 'Dad'} · {s.shares}股</div></td>
                        <td className="px-6 py-5 text-right font-mono"><div className="text-white">{formatMoney(cur)}</div><div className="text-[10px] text-gray-600">Avg: {formatMoney(s.buyPrice)}</div></td>
                        <td className="px-6 py-5 text-right font-mono text-white">{formatMoney(val)}</td>
                        <td className={`px-6 py-5 text-right font-mono font-bold ${getPnlColor(pnl)}`}>{pnl >= 0 ? '+' : ''}{formatMoney(pnl)}</td>
                        <td className="px-6 py-5 text-center"><button onClick={() => openSellModal(s)} className="text-[10px] bg-white/5 px-3 py-1.5 rounded-full hover:bg-rose-500/20 hover:text-rose-400 border border-transparent hover:border-rose-500/20">賣出</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {currentStocks.length === 0 && <div className="py-20 text-center text-gray-700 text-xs tracking-widest">目前清單為空</div>}
            </div>
          </article>
        </main>
      </div>

      {sellModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-white/10 p-8 rounded-3xl w-full max-w-sm relative">
            <button onClick={() => setSellModal({...sellModal, isOpen: false})} className="absolute top-5 right-5 text-gray-500 text-xl hover:text-white">✕</button>
            <h3 className="text-xl font-bold text-white mb-6">賣出 {sellModal.ticker}</h3>
            <form onSubmit={handleSellStock} className="space-y-4">
              <input required type="number" step="any" min="0.001" max={sellModal.maxShares} value={sellModal.sharesToSell} onChange={e=>setSellModal({...sellModal, sharesToSell: e.target.value})} placeholder="賣出股數" className="w-full bg-black border border-white/5 rounded-xl px-4 py-3 text-sm text-white" />
              <input required type="number" step="any" min="0.001" value={sellModal.sellPrice} onChange={e=>setSellModal({...sellModal, sellPrice: e.target.value})} placeholder="成交價格 (USD)" className="w-full bg-black border border-white/5 rounded-xl px-4 py-3 text-sm text-white" />
              <input required type="number" step="any" min="0" value={sellModal.commission} onChange={e=>setSellModal({...sellModal, commission: e.target.value})} placeholder="賣出手續費" className="w-full bg-black border border-white/5 rounded-xl px-4 py-3 text-sm text-white" />
              <button className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-bold text-white mt-4 transition-colors">確認賣出</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
