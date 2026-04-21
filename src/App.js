import React, { useState, useMemo, useEffect } from 'react';

export default function App() {
  // --- 核心狀態 (保留所有強大功能) ---
  const [activeTab, setActiveTab] = useState('combined'); 
  const [toastMsg, setToastMsg] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [livePrices, setLivePrices] = useState({});

  const [stockForm, setStockForm] = useState({ ticker: '', buyPrice: '', shares: '', commission: '', owner: 'me' });
  const [cashForm, setCashForm] = useState({ amount: '', note: '', type: 'deposit' });
  const [sellModal, setSellModal] = useState({ isOpen: false, stockId: null, ticker: '', maxShares: 0, sharesToSell: '', sellPrice: '', commission: '' });

  // --- 記憶體功能 ---
  const [cashBalance, setCashBalance] = useState(() => {
    const saved = localStorage.getItem('my_cashBalance');
    return saved !== null ? JSON.parse(saved) : 0;
  });
  useEffect(() => { localStorage.setItem('my_cashBalance', JSON.stringify(cashBalance)); }, [cashBalance]);

  const [portfolio, setPortfolio] = useState(() => {
    const saved = localStorage.getItem('my_portfolio');
    return saved !== null ? JSON.parse(saved) : [];
  });
  useEffect(() => { localStorage.setItem('my_portfolio', JSON.stringify(portfolio)); }, [portfolio]);

  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem('my_logs');
    return saved !== null ? JSON.parse(saved) : [];
  });
  useEffect(() => { localStorage.setItem('my_logs', JSON.stringify(logs)); }, [logs]);

  // --- 輔助函數 ---
  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const getPnlColor = (value) => {
    if (value > 0) return 'text-rose-400'; 
    if (value < 0) return 'text-emerald-400'; 
    return 'text-gray-400';
  };

  const formatMoney = (num) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);

  // --- 邏輯處理 ---
  const handleCashAction = (e) => {
    e.preventDefault();
    const amt = parseFloat(cashForm.amount);
    if (isNaN(amt) || amt <= 0) return showToast('❌ 金額必須大於 0');
    const finalAmt = cashForm.type === 'deposit' ? amt : -amt;
    setCashBalance(prev => prev + finalAmt);
    const now = Date.now();
    setLogs([{
      id: now, timestamp: now, type: cashForm.type === 'deposit' ? '存入' : '提領',
      detail: cashForm.note || (cashForm.type === 'deposit' ? '美金帳戶存入' : '美金帳戶提領'),
      amount: finalAmt, date: new Date(now).toLocaleString()
    }, ...logs]);
    setCashForm({ ...cashForm, amount: '', note: '' });
    showToast('✨ 現金操作成功');
  };

  const addStock = (e) => {
    e.preventDefault();
    const buyPrice = parseFloat(stockForm.buyPrice);
    const shares = parseFloat(stockForm.shares);
    const commission = parseFloat(stockForm.commission) || 0;
    if (isNaN(buyPrice) || buyPrice <= 0 || isNaN(shares) || shares <= 0) return showToast('❌ 單價與股數必須大於 0');
    if (commission < 0) return showToast('❌ 手續費不可為負數');

    const totalCost = (buyPrice * shares) + commission;
    const now = Date.now();
    const newStock = {
      id: now.toString(), ticker: stockForm.ticker.toUpperCase(),
      buyPrice, shares, commission, owner: stockForm.owner,
      timestamp: now, date: new Date(now).toLocaleString()
    };
    setPortfolio([...portfolio, newStock]);
    setCashBalance(prev => prev - totalCost); 
    setLogs([{
      id: now, timestamp: now, type: '買入',
      detail: `${newStock.owner === 'me' ? '我' : '爸爸'} 買入 ${newStock.ticker} ${newStock.shares} 股`,
      amount: -totalCost, date: new Date(now).toLocaleString()
    }, ...logs]);
    if (!livePrices[newStock.ticker]) setLivePrices(prev => ({ ...prev, [newStock.ticker]: newStock.buyPrice }));
    setStockForm({ ticker: '', buyPrice: '', shares: '', commission: '', owner: 'me' });
    showToast('✨ 買入成功並已扣款');
  };

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
    const now = Date.now();
    if (sellShares === target.shares) {
      setPortfolio(portfolio.filter(p => p.id !== target.id));
    } else {
      setPortfolio(portfolio.map(p => p.id === target.id ? { ...p, shares: p.shares - sellShares } : p));
    }
    setCashBalance(prev => prev + proceeds); 
    setLogs([{
      id: now, timestamp: now, type: '賣出',
      detail: `賣出 ${target.ticker} ${sellShares} 股 (成交價: ${sellPrice})`,
      amount: proceeds, date: new Date(now).toLocaleString()
    }, ...logs]);
    setSellModal({ ...sellModal, isOpen: false });
    showToast('✨ 賣出成功，資金已回流');
  };

  const fetchRealTimePrices = async () => {
    const tickers = [...new Set(portfolio.map(p => p.ticker))];
    if (tickers.length === 0) return showToast('💡 目前沒有持股可以更新');
    setIsUpdating(true);
    const API_KEY = 'd7j38fpr01qp3g1rkso0d7j38fpr01qp3g1rksog'; 
    try {
      const updatedPrices = { ...livePrices };
      await Promise.all(tickers.map(async (ticker) => {
        try {
          const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${API_KEY}`);
          const data = await response.json();
          if (data && data.c && data.c > 0) updatedPrices[ticker] = data.c;
        } catch (err) { console.error(err); }
      }));
      setLivePrices(updatedPrices);
      showToast('🔄 即時報價更新完成');
    } catch (error) {
      showToast('❌ 更新失敗，請檢查網路狀態');
    } finally {
      setIsUpdating(false);
    }
  };

  const currentStocks = useMemo(() => {
    if (activeTab === 'me' || activeTab === 'dad') return portfolio.filter(p => p.owner === activeTab);
    return portfolio;
  }, [portfolio, activeTab]);

  const stats = useMemo(() => {
    return currentStocks.reduce((acc, curr) => {
      const cost = (curr.buyPrice * curr.shares); 
      const curPrice = livePrices[curr.ticker] || curr.buyPrice;
      const val = curPrice * curr.shares;
      return { cost: acc.cost + cost, value: acc.value + val, pnl: acc.pnl + (val - cost) };
    }, { cost: 0, value: 0, pnl: 0 });
  }, [currentStocks, livePrices]);

  return (
    <div className="min-h-screen bg-[#050505] text-gray-200 font-sans relative pb-24 selection:bg-blue-500/30">
      
      {/* 頂部漸層光暈裝飾 */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-900/20 to-transparent pointer-events-none" />

      {toastMsg && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] bg-white/10 backdrop-blur-xl border border-white/20 text-white px-6 py-3 rounded-full shadow-2xl font-medium tracking-wide flex items-center gap-2 animate-bounce">
          {toastMsg}
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-8 p-4 md:p-8 relative z-10">
        
        {/* Header 區塊 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pt-4">
          <div>
            <h1 className="text-2xl font-light tracking-widest text-white/90">Portfolio<span className="font-bold text-blue-500">.</span></h1>
            <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest">美股資產儀表板</p>
          </div>
          
          <div className="flex bg-[#111] p-1.5 rounded-full border border-white/5 shadow-inner">
            {[
              { id: 'combined', label: '綜合' },
              { id: 'me', label: '我的' },
              { id: 'dad', label: '爸爸' },
              { id: 'cash', label: '現金' },
              { id: 'history', label: '日誌' }
            ].map(tab => (
              <button
                key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-2 rounded-full text-xs font-semibold tracking-wider transition-all duration-300 ${
                  activeTab === tab.id 
                  ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' 
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 核心數據卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-gradient-to-br from-[#151515] to-[#0a0a0a] border border-white/5 rounded-3xl p-7 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-all" />
            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2">
              {activeTab === 'combined' ? '資產總市值 (含現金)' : '持股市值 (不含現金)'}
            </p>
            <h2 className="text-4xl font-light text-white tracking-tight">
              {formatMoney(stats.value + (activeTab === 'combined' ? cashBalance : 0))}
            </h2>
          </div>
          <div className="bg-gradient-to-br from-[#151515] to-[#0a0a0a] border border-white/5 rounded-3xl p-7 shadow-xl relative overflow-hidden">
             <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 ${stats.pnl >= 0 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2">未實現損益</p>
            <div className="flex items-baseline gap-3">
              <h2 className={`text-4xl font-light tracking-tight ${getPnlColor(stats.pnl)}`}>
                {stats.pnl >= 0 ? '+' : ''}{formatMoney(stats.pnl)}
              </h2>
              <span className={`text-sm font-semibold px-2 py-1 rounded-lg ${stats.pnl >= 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                {stats.cost > 0 ? (stats.pnl / stats.cost * 100).toFixed(2) : '0.00'}%
              </span>
            </div>
          </div>
          <div className="bg-gradient-to-br from-[#151515] to-[#0a0a0a] border border-white/5 rounded-3xl p-7 shadow-xl relative overflow-hidden">
            <div className="absolute left-0 top-0 w-1 h-full bg-blue-600/50" />
            <p className="text-[10px] uppercase font-bold text-blue-500/70 tracking-widest mb-2">美金帳戶餘額</p>
            <h2 className="text-4xl font-light text-white tracking-tight">{formatMoney(cashBalance)}</h2>
          </div>
        </div>

        {/* 下半部操作區 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* 左側表單區 */}
          <div className="lg:col-span-1 space-y-6">
            {activeTab === 'cash' ? (
              <div className="bg-[#111] border border-white/5 p-6 rounded-3xl shadow-lg">
                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> 現金管理
                </h3>
                <form onSubmit={handleCashAction} className="space-y-4">
                  <div className="flex bg-[#0a0a0a] p-1 rounded-xl border border-white/5">
                    <button type="button" onClick={()=>setCashForm({...cashForm, type:'deposit'})} className={`flex-1 py-2.5 rounded-lg text-xs font-semibold tracking-wider transition-all ${cashForm.type==='deposit' ? 'bg-[#222] text-white shadow-md':'text-gray-500'}`}>存入 (+)</button>
                    <button type="button" onClick={()=>setCashForm({...cashForm, type:'withdraw'})} className={`flex-1 py-2.5 rounded-lg text-xs font-semibold tracking-wider transition-all ${cashForm.type==='withdraw' ? 'bg-[#222] text-white shadow-md':'text-gray-500'}`}>提領 (-)</button>
                  </div>
                  <input required type="number" step="any" min="0.01" value={cashForm.amount} onChange={e=>setCashForm({...cashForm, amount: e.target.value})} placeholder="金額 (USD)" className="w-full bg-[#0a0a0a] border border-white/5 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-blue-500 transition-colors text-white placeholder:text-gray-600" />
                  <input value={cashForm.note} onChange={e=>setCashForm({...cashForm, note: e.target.value})} placeholder="備註事項" className="w-full bg-[#0a0a0a] border border-white/5 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-blue-500 transition-colors text-white placeholder:text-gray-600" />
                  <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 rounded-xl transition-all shadow-[0_4px_20px_rgba(37,99,235,0.2)] active:scale-[0.98]">確認執行</button>
                </form>
              </div>
            ) : (
              <div className="bg-[#111] border border-white/5 p-6 rounded-3xl shadow-lg">
                <h3 className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> 新增持股
                </h3>
                <form onSubmit={addStock} className="space-y-4">
                  <input required value={stockForm.ticker} onChange={e=>setStockForm({...stockForm, ticker: e.target.value})} placeholder="股票代號 (例: TSLA)" className="w-full bg-[#0a0a0a] border border-white/5 rounded-xl px-4 py-3.5 text-sm font-bold tracking-widest uppercase outline-none focus:border-rose-500 transition-colors text-white placeholder:text-gray-600 placeholder:font-normal" />
                  <div className="grid grid-cols-2 gap-3">
                    <input required type="number" step="any" min="0.001" value={stockForm.buyPrice} onChange={e=>setStockForm({...stockForm, buyPrice: e.target.value})} placeholder="買入單價" className="bg-[#0a0a0a] border border-white/5 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-rose-500 text-white placeholder:text-gray-600" />
                    <input required type="number" step="any" min="0.001" value={stockForm.shares} onChange={e=>setStockForm({...stockForm, shares: e.target.value})} placeholder="股數" className="bg-[#0a0a0a] border border-white/5 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-rose-500 text-white placeholder:text-gray-600" />
                  </div>
                  <div className="relative">
                    <input type="number" step="any" min="0" value={stockForm.commission} onChange={e=>setStockForm({...stockForm, commission: e.target.value})} placeholder="手續費 (USD)" className="w-full bg-[#0a0a0a] border border-white/5 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-rose-500 text-white placeholder:text-gray-600" />
                  </div>
                  <div className="relative">
                    <select value={stockForm.owner} onChange={e=>setStockForm({...stockForm, owner: e.target.value})} className="w-full bg-[#0a0a0a] border border-white/5 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-rose-500 text-white appearance-none cursor-pointer">
                      <option value="me">持有者：我的帳戶</option>
                      <option value="dad">持有者：爸爸的帳戶</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600 text-xs">▼</div>
                  </div>
                  <button className="w-full bg-rose-600 hover:bg-rose-500 text-white font-semibold py-3.5 rounded-xl transition-all shadow-[0_4px_20px_rgba(225,29,72,0.2)] active:scale-[0.98]">確認買入</button>
                </form>
              </div>
            )}

            <div className="px-2">
              <p className="text-[10px] text-gray-600 leading-relaxed text-center">所有交易款項將自動連動美金現金帳戶。餘額不足將以負數顯示。</p>
            </div>
          </div>

          {/* 右側列表區 */}
          <div className="lg:col-span-3">
            <div className="bg-[#111] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
              {activeTab === 'history' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[#0a0a0a] text-gray-500 border-b border-white/5">
                      <tr>
                        <th className="px-6 py-5 font-bold uppercase tracking-widest text-[10px]">時間</th>
                        <th className="px-6 py-5 font-bold uppercase tracking-widest text-[10px]">類別</th>
                        <th className="px-6 py-5 font-bold uppercase tracking-widest text-[10px]">詳細項目</th>
                        <th className="px-6 py-5 text-right font-bold uppercase tracking-widest text-[10px]">金額變動</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {logs.map(log => (
                        <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-4 text-gray-500 font-mono text-xs whitespace-nowrap">{log.date}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                              log.type.includes('入') ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                              log.type.includes('賣') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}>{log.type}</span>
                          </td>
                          <td className="px-6 py-4 text-gray-300 font-medium">{log.detail}</td>
                          <td className={`px-6 py-4 text-right font-mono text-sm ${log.amount >= 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                            {log.amount >= 0 ? '+' : ''}{log.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {logs.length === 0 && <div className="py-24 text-center text-gray-600 font-medium tracking-widest text-sm">尚無任何交易紀錄</div>}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#0a0a0a]">
                    <h3 className="font-bold text-xs uppercase tracking-widest text-gray-400 pl-2">Portfolio Details</h3>
                    <button 
                      onClick={fetchRealTimePrices} disabled={isUpdating}
                      className={`text-[10px] bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full border border-white/10 transition-all font-bold tracking-widest flex items-center gap-2 text-white ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
                    >
                      <span className={isUpdating ? 'animate-spin inline-block' : ''}>⟳</span> 
                      {isUpdating ? 'SYNCING...' : 'SYNC PRICES'}
                    </button>
                  </div>
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[#0a0a0a] text-gray-500 border-b border-white/5">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest">標的</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-right">報價 / 成本</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-right">市值 / 總成本</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-right">未實現損益</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {currentStocks.map(stock => {
                        const cur = livePrices[stock.ticker] || stock.buyPrice;
                        const cost = (stock.buyPrice * stock.shares); 
                        const val = cur * stock.shares;
                        const pnl = val - cost;
                        const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

                        return (
                          <tr key={stock.id} className="hover:bg-white/[0.02] transition-colors group">
                            <td className="px-6 py-5">
                              <div className="font-light text-white text-lg tracking-wider uppercase">{stock.ticker}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="bg-white/5 px-2 py-0.5 rounded text-[9px] text-gray-400 font-bold tracking-widest uppercase">{stock.owner === 'me' ? 'Mine' : 'Dad'}</span>
                                <span className="font-mono text-[10px] text-blue-400">{stock.shares.toLocaleString()} SHRS</span>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-right">
                              <div className="text-white font-mono text-sm">{formatMoney(cur)}</div>
                              <div className="text-[10px] text-gray-500 font-mono mt-0.5">Avg: {formatMoney(stock.buyPrice)}</div>
                            </td>
                            <td className="px-6 py-5 text-right">
                              <div className="text-gray-200 font-medium text-sm">{formatMoney(val)}</div>
                              <div className="text-[10px] text-gray-500 font-mono mt-0.5">Cost: {formatMoney(cost)}</div>
                            </td>
                            <td className={`px-6 py-5 text-right ${getPnlColor(pnl)}`}>
                              <div className="font-mono font-medium text-sm">{pnl >= 0 ? '+' : ''}{formatMoney(pnl)}</div>
                              <div className="text-[10px] font-bold mt-0.5 opacity-80">{pnlPct.toFixed(2)}%</div>
                            </td>
                            <td className="px-6 py-5 text-center">
                              <button onClick={() => openSellModal(stock)} className="opacity-0 group-hover:opacity-100 bg-white/5 text-gray-300 hover:bg-rose-500/20 hover:text-rose-400 px-5 py-2 rounded-full text-[10px] font-bold tracking-widest transition-all border border-transparent hover:border-rose-500/30">
                                SELL
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {currentStocks.length === 0 && <div className="py-24 text-center text-gray-600 font-medium tracking-widest text-sm">持股清單為空</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 賣出視窗 (Glassmorphism Modal) */}
      {sellModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-white/10 p-8 rounded-3xl shadow-2xl w-full max-w-sm relative">
            <button onClick={() => setSellModal({...sellModal, isOpen: false})} className="absolute top-5 right-5 text-gray-500 hover:text-white transition-colors text-lg">✕</button>
            <h3 className="text-xl font-light text-white mb-1">Sell <span className="font-bold">{sellModal.ticker}</span></h3>
            <p className="text-xs text-gray-500 mb-6 tracking-widest uppercase">Max Avail: <span className="font-mono text-blue-400">{sellModal.maxShares}</span></p>
            
            <form onSubmit={handleSellStock} className="space-y-5">
              <div>
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-2">Shares to Sell</label>
                <input required type="number" step="any" min="0.001" max={sellModal.maxShares} value={sellModal.sharesToSell} onChange={e=>setSellModal({...sellModal, sharesToSell: e.target.value})} className="w-full bg-[#0a0a0a] border border-white/5 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-rose-500 text-white font-mono" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-2">Price (USD)</label>
                <input required type="number" step="any" min="0.001" value={sellModal.sellPrice} onChange={e=>setSellModal({...sellModal, sellPrice: e.target.value})} className="w-full bg-[#0a0a0a] border border-white/5 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-rose-500 text-white font-mono" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-2">Commission</label>
                <input required type="number" step="any" min="0" value={sellModal.commission} onChange={e=>setSellModal({...sellModal, commission: e.target.value})} placeholder="0" className="w-full bg-[#0a0a0a] border border-white/5 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-rose-500 text-white font-mono" />
              </div>
              <button className="w-full bg-rose-600 hover:bg-rose-500 text-white font-semibold py-3.5 rounded-xl transition-all shadow-[0_4px_20px_rgba(225,29,72,0.2)] active:scale-[0.98] mt-2">
                確認賣出
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
