import React, { useState, useMemo, useEffect } from "react";

export default function App() {
  // --- 核心狀態 ---
  const [activeTab, setActiveTab] = useState("combined"); // 'me', 'dad', 'combined', 'cash', 'history'

  // 提示訊息 (取代 alert)
  const [toastMsg, setToastMsg] = useState("");

  // API 更新狀態
  const [isUpdating, setIsUpdating] = useState(false);

  // 美金現金帳戶餘額
  const [cashBalance, setCashBalance] = useState(0);

  // 初始持股
  const [portfolio, setPortfolio] = useState([]);

  // 即時現價
  const [livePrices, setLivePrices] = useState({});

  // 交易日誌
  const [logs, setLogs] = useState([]);

  // 表單狀態
  const [stockForm, setStockForm] = useState({
    ticker: "",
    buyPrice: "",
    shares: "",
    commission: "",
    owner: "me",
  });
  const [cashForm, setCashForm] = useState({
    amount: "",
    note: "",
    type: "deposit",
  });

  // 賣出視窗狀態
  const [sellModal, setSellModal] = useState({
    isOpen: false,
    stockId: null,
    ticker: "",
    maxShares: 0,
    sharesToSell: "",
    sellPrice: "",
    commission: "",
  });

  // --- 輔助函數 ---
  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  const getPnlColor = (value) => {
    if (value > 0) return "text-red-500";
    if (value < 0) return "text-green-500";
    return "text-gray-400";
  };

  const formatMoney = (num) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);

  // --- 邏輯處理 ---

  // 1. 現金操作 (存/取)
  const handleCashAction = (e) => {
    e.preventDefault();
    const amt = parseFloat(cashForm.amount);

    if (isNaN(amt) || amt <= 0) {
      return showToast("❌ 金額必須大於 0");
    }

    const finalAmt = cashForm.type === "deposit" ? amt : -amt;
    setCashBalance((prev) => prev + finalAmt);

    const now = Date.now();
    setLogs([
      {
        id: now,
        timestamp: now,
        type: cashForm.type === "deposit" ? "存入" : "提領",
        detail:
          cashForm.note ||
          (cashForm.type === "deposit" ? "美金帳戶存入" : "美金帳戶提領"),
        amount: finalAmt,
        date: new Date(now).toLocaleString(),
      },
      ...logs,
    ]);

    setCashForm({ ...cashForm, amount: "", note: "" });
    showToast("✅ 現金操作成功");
  };

  // 2. 買入股票
  const addStock = (e) => {
    e.preventDefault();
    const buyPrice = parseFloat(stockForm.buyPrice);
    const shares = parseFloat(stockForm.shares);
    const commission = parseFloat(stockForm.commission) || 0;

    if (isNaN(buyPrice) || buyPrice <= 0 || isNaN(shares) || shares <= 0) {
      return showToast("❌ 單價與股數必須大於 0");
    }
    if (commission < 0) {
      return showToast("❌ 手續費不可為負數");
    }

    const totalCost = buyPrice * shares + commission;
    const now = Date.now();

    const newStock = {
      id: now.toString(),
      ticker: stockForm.ticker.toUpperCase(),
      buyPrice: buyPrice,
      shares: shares,
      commission: commission,
      owner: stockForm.owner,
      timestamp: now,
      date: new Date(now).toLocaleString(),
    };

    setPortfolio([...portfolio, newStock]);
    setCashBalance((prev) => prev - totalCost);
    setLogs([
      {
        id: now,
        timestamp: now,
        type: "買入",
        detail: `${newStock.owner === "me" ? "我" : "爸爸"} 買入 ${
          newStock.ticker
        } ${newStock.shares} 股`,
        amount: -totalCost,
        date: new Date(now).toLocaleString(),
      },
      ...logs,
    ]);

    if (!livePrices[newStock.ticker]) {
      setLivePrices((prev) => ({
        ...prev,
        [newStock.ticker]: newStock.buyPrice,
      }));
    }
    setStockForm({
      ticker: "",
      buyPrice: "",
      shares: "",
      commission: "",
      owner: "me",
    });
    showToast("✅ 買入成功並已扣款");
  };

  // 3. 開啟賣出視窗
  const openSellModal = (stock) => {
    setSellModal({
      isOpen: true,
      stockId: stock.id,
      ticker: stock.ticker,
      maxShares: stock.shares,
      sharesToSell: stock.shares,
      sellPrice: livePrices[stock.ticker] || stock.buyPrice,
      commission: "",
    });
  };

  // 4. 執行賣出
  const handleSellStock = (e) => {
    e.preventDefault();
    const target = portfolio.find((p) => p.id === sellModal.stockId);
    if (!target) return;

    const sellShares = parseFloat(sellModal.sharesToSell);
    const sellPrice = parseFloat(sellModal.sellPrice);
    const sellCommission = parseFloat(sellModal.commission) || 0;

    if (isNaN(sellShares) || sellShares <= 0 || sellShares > target.shares) {
      return showToast(`❌ 賣出股數必須介於 0 到 ${target.shares} 之間`);
    }
    if (isNaN(sellPrice) || sellPrice <= 0) {
      return showToast("❌ 賣出單價必須大於 0");
    }
    if (sellCommission < 0) {
      return showToast("❌ 手續費不可為負數");
    }

    const proceeds = sellPrice * sellShares - sellCommission;
    const now = Date.now();

    if (sellShares === target.shares) {
      setPortfolio(portfolio.filter((p) => p.id !== target.id));
    } else {
      setPortfolio(
        portfolio.map((p) =>
          p.id === target.id ? { ...p, shares: p.shares - sellShares } : p
        )
      );
    }

    setCashBalance((prev) => prev + proceeds);
    setLogs([
      {
        id: now,
        timestamp: now,
        type: "賣出",
        detail: `賣出 ${target.ticker} ${sellShares} 股 (成交價: ${sellPrice})`,
        amount: proceeds,
        date: new Date(now).toLocaleString(),
      },
      ...logs,
    ]);

    setSellModal({ ...sellModal, isOpen: false });
    showToast("✅ 賣出成功，資金已回流");
  };

  // 5. 串接真實 API (使用你的 Finnhub API Key)
  const fetchRealTimePrices = async () => {
    const tickers = [...new Set(portfolio.map((p) => p.ticker))];
    if (tickers.length === 0) {
      return showToast("💡 目前沒有持股可以更新");
    }

    setIsUpdating(true);
    const API_KEY = "d7j38fpr01qp3g1rkso0d7j38fpr01qp3g1rksog";

    try {
      const updatedPrices = { ...livePrices };
      await Promise.all(
        tickers.map(async (ticker) => {
          try {
            const response = await fetch(
              `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${API_KEY}`
            );
            const data = await response.json();
            if (data && data.c && data.c > 0) {
              updatedPrices[ticker] = data.c;
            }
          } catch (err) {
            console.error(`獲取 ${ticker} 失敗:`, err);
          }
        })
      );

      setLivePrices(updatedPrices);
      showToast("🔄 已成功更新真實即時報價！");
    } catch (error) {
      console.error("API 請求發生錯誤:", error);
      showToast("❌ 更新失敗，請檢查網路狀態");
    } finally {
      setIsUpdating(false);
    }
  };

  // --- 計算統計 ---
  const currentStocks = useMemo(() => {
    if (activeTab === "me" || activeTab === "dad")
      return portfolio.filter((p) => p.owner === activeTab);
    return portfolio;
  }, [portfolio, activeTab]);

  const stats = useMemo(() => {
    return currentStocks.reduce(
      (acc, curr) => {
        const cost = curr.buyPrice * curr.shares;
        const curPrice = livePrices[curr.ticker] || curr.buyPrice;
        const val = curPrice * curr.shares;
        return {
          cost: acc.cost + cost,
          value: acc.value + val,
          pnl: acc.pnl + (val - cost),
        };
      },
      { cost: 0, value: 0, pnl: 0 }
    );
  }, [currentStocks, livePrices]);

  return (
    <div className="min-h-screen bg-[#0d0e12] text-slate-300 p-4 md:p-8 font-sans relative">
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-800 border border-slate-700 text-white px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 animate-bounce">
          {toastMsg}
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#1a1c23] border border-slate-800 rounded-3xl p-6 shadow-2xl transition-all hover:bg-[#202229]">
            <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-1">
              {activeTab === "combined"
                ? "資產總市值 (含現金)"
                : "持股市值 (不含現金)"}
            </p>
            <h2 className="text-3xl font-black text-white">
              {formatMoney(
                stats.value + (activeTab === "combined" ? cashBalance : 0)
              )}
            </h2>
          </div>
          <div className="bg-[#1a1c23] border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-1">
              未實現損益
            </p>
            <h2 className={`text-3xl font-black ${getPnlColor(stats.pnl)}`}>
              {stats.pnl >= 0 ? "+" : ""}
              {formatMoney(stats.pnl)}
            </h2>
            <div className="text-[10px] mt-1 text-slate-600 font-bold uppercase">
              報酬率:{" "}
              {stats.cost > 0
                ? ((stats.pnl / stats.cost) * 100).toFixed(2)
                : "0.00"}
              %
            </div>
          </div>
          <div className="bg-[#1a1c23] border border-slate-800 rounded-3xl p-6 shadow-2xl border-l-4 border-l-blue-600">
            <p className="text-[10px] uppercase font-black text-blue-500 tracking-widest mb-1">
              美金帳戶餘額
            </p>
            <h2 className="text-3xl font-black text-white">
              {formatMoney(cashBalance)}
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 bg-[#1a1c23]/50 p-1.5 rounded-2xl border border-slate-800 w-fit">
          {[
            { id: "combined", label: "綜合持股", icon: "👥" },
            { id: "me", label: "我的", icon: "👤" },
            { id: "dad", label: "爸爸", icon: "👤" },
            { id: "cash", label: "現金管理", icon: "💲" },
            { id: "history", label: "交易日誌", icon: "📝" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.id
                  ? "bg-slate-800 text-white shadow-lg"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-6">
            {activeTab === "cash" ? (
              <div className="bg-[#1a1c23] border border-slate-800 p-6 rounded-3xl shadow-xl">
                <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span>🔼</span> 現金存取
                </h3>
                <form onSubmit={handleCashAction} className="space-y-4">
                  <div className="flex bg-black p-1 rounded-xl border border-slate-800 font-bold">
                    <button
                      type="button"
                      onClick={() =>
                        setCashForm({ ...cashForm, type: "deposit" })
                      }
                      className={`flex-1 py-2 rounded-lg text-[10px] ${
                        cashForm.type === "deposit"
                          ? "bg-slate-800 text-white"
                          : "text-slate-600"
                      }`}
                    >
                      存入 (+)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCashForm({ ...cashForm, type: "withdraw" })
                      }
                      className={`flex-1 py-2 rounded-lg text-[10px] ${
                        cashForm.type === "withdraw"
                          ? "bg-slate-800 text-white"
                          : "text-slate-600"
                      }`}
                    >
                      提領 (-)
                    </button>
                  </div>
                  <input
                    required
                    type="number"
                    step="any"
                    min="0.01"
                    value={cashForm.amount}
                    onChange={(e) =>
                      setCashForm({ ...cashForm, amount: e.target.value })
                    }
                    placeholder="美金金額"
                    className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                  <input
                    value={cashForm.note}
                    onChange={(e) =>
                      setCashForm({ ...cashForm, note: e.target.value })
                    }
                    placeholder="備註 (例: 薪資存入)"
                    className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                  <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-95">
                    執行操作
                  </button>
                </form>
              </div>
            ) : (
              <div className="bg-[#1a1c23] border border-slate-800 p-6 rounded-3xl shadow-xl">
                <h3 className="text-sm font-black text-red-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span>➕</span> 新增持股
                </h3>
                <form onSubmit={addStock} className="space-y-4">
                  <input
                    required
                    value={stockForm.ticker}
                    onChange={(e) =>
                      setStockForm({ ...stockForm, ticker: e.target.value })
                    }
                    placeholder="股票代號 (例: TSLA)"
                    className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-sm font-black uppercase outline-none focus:border-red-500 transition-all"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      required
                      type="number"
                      step="any"
                      min="0.001"
                      value={stockForm.buyPrice}
                      onChange={(e) =>
                        setStockForm({ ...stockForm, buyPrice: e.target.value })
                      }
                      placeholder="成交單價"
                      className="bg-black border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-500"
                    />
                    <input
                      required
                      type="number"
                      step="any"
                      min="0.001"
                      value={stockForm.shares}
                      onChange={(e) =>
                        setStockForm({ ...stockForm, shares: e.target.value })
                      }
                      placeholder="股數"
                      className="bg-black border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-500"
                    />
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={stockForm.commission}
                      onChange={(e) =>
                        setStockForm({
                          ...stockForm,
                          commission: e.target.value,
                        })
                      }
                      placeholder="手續費 (USD)"
                      className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const s = parseFloat(stockForm.shares) || 0;
                        setStockForm({
                          ...stockForm,
                          commission: (s * 0.1).toFixed(2),
                        });
                      }}
                      className="absolute right-2 top-2 bottom-2 bg-slate-900 border border-slate-800 text-[9px] px-2 rounded-lg text-slate-500 font-bold hover:bg-slate-800"
                    >
                      試算
                    </button>
                  </div>
                  <select
                    value={stockForm.owner}
                    onChange={(e) =>
                      setStockForm({ ...stockForm, owner: e.target.value })
                    }
                    className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-500"
                  >
                    <option value="me">持有者：我</option>
                    <option value="dad">持有者：爸爸</option>
                  </select>
                  <button className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-900/20 active:scale-95">
                    確認買入並扣款
                  </button>
                </form>
              </div>
            )}

            <div className="bg-amber-950/20 border border-amber-900/30 p-4 rounded-2xl flex gap-3">
              <span className="text-xl shrink-0">⚠️</span>
              <p className="text-[10px] text-amber-200/70 leading-relaxed">
                買入將自動從美金帳戶扣款，賣出則撥回。若帳戶餘額不足會顯示負數。
              </p>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-[#1a1c23] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
              {activeTab === "history" ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-black text-slate-500">
                      <tr>
                        <th className="px-6 py-4 font-black uppercase tracking-widest">
                          時間
                        </th>
                        <th className="px-6 py-4 font-black uppercase tracking-widest">
                          類別
                        </th>
                        <th className="px-6 py-4 font-black uppercase tracking-widest">
                          詳細項目
                        </th>
                        <th className="px-6 py-4 text-right font-black uppercase tracking-widest">
                          金額變動 (USD)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {logs.map((log) => (
                        <tr
                          key={log.id}
                          className="hover:bg-white/5 transition-colors"
                        >
                          <td className="px-6 py-4 text-slate-500 font-mono whitespace-nowrap">
                            {log.date}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                log.type.includes("入")
                                  ? "bg-blue-500/20 text-blue-500"
                                  : log.type.includes("賣")
                                  ? "bg-emerald-500/20 text-emerald-500"
                                  : "bg-red-500/20 text-red-500"
                              }`}
                            >
                              {log.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-300 font-medium">
                            {log.detail}
                          </td>
                          <td
                            className={`px-6 py-4 text-right font-mono font-bold ${
                              log.amount >= 0
                                ? "text-blue-400"
                                : "text-slate-500"
                            }`}
                          >
                            {log.amount >= 0 ? "+" : ""}
                            {log.amount.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {logs.length === 0 && (
                    <div className="p-20 text-center text-slate-600 italic">
                      尚未有交易歷史
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-black/20">
                    <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
                      <span>📊</span> 持股清單明細
                    </h3>
                    <button
                      onClick={fetchRealTimePrices}
                      disabled={isUpdating}
                      className={`text-[10px] bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition-all font-bold uppercase tracking-widest flex items-center gap-2 ${
                        isUpdating ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      <span
                        className={
                          isUpdating ? "animate-spin inline-block" : ""
                        }
                      >
                        🔄
                      </span>
                      {isUpdating ? "更新中..." : "更新現價"}
                    </button>
                  </div>
                  <table className="w-full text-sm text-left">
                    <thead className="bg-black text-slate-500 uppercase text-[10px] tracking-widest">
                      <tr>
                        <th className="px-6 py-4">標的標籤</th>
                        <th className="px-6 py-4 text-right">現價 / 買價</th>
                        <th className="px-6 py-4 text-right">市值 / 成本</th>
                        <th className="px-6 py-4 text-right">未實現損益</th>
                        <th className="px-6 py-4 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {currentStocks.map((stock) => {
                        const cur = livePrices[stock.ticker] || stock.buyPrice;
                        const cost = stock.buyPrice * stock.shares;
                        const val = cur * stock.shares;
                        const pnl = val - cost;
                        const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

                        return (
                          <tr
                            key={stock.id}
                            className="hover:bg-white/5 transition-all group"
                          >
                            <td className="px-6 py-4">
                              <div className="font-black text-white text-base tracking-widest uppercase">
                                {stock.ticker}
                              </div>
                              <div className="text-[10px] text-slate-500 font-bold flex items-center gap-1 mt-0.5">
                                <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[9px] text-slate-400 font-black">
                                  {stock.owner === "me" ? "我的" : "爸爸"}
                                </span>
                                <span className="font-mono text-blue-400 bg-blue-900/20 px-1.5 py-0.5 rounded">
                                  {stock.shares.toLocaleString()} 股
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right font-mono">
                              <div className="text-white font-bold">
                                {formatMoney(cur)}
                              </div>
                              <div className="text-[10px] text-slate-600 tracking-tighter">
                                Buy: {formatMoney(stock.buyPrice)}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              <div className="text-slate-300 font-medium">
                                {formatMoney(val)}
                              </div>
                              <div className="text-[10px] text-slate-700 tracking-tighter">
                                Cost: {formatMoney(cost)}
                              </div>
                            </td>
                            <td
                              className={`px-6 py-4 text-right font-black ${getPnlColor(
                                pnl
                              )}`}
                            >
                              <div className="flex flex-col">
                                <span>
                                  {pnl >= 0 ? "+" : ""}
                                  {formatMoney(pnl)}
                                </span>
                                <span className="text-[10px] opacity-80 font-bold">
                                  {pnlPct.toFixed(2)}%
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => openSellModal(stock)}
                                className="bg-slate-800 text-slate-300 hover:bg-emerald-600 hover:text-white px-4 py-1.5 rounded-xl text-[10px] font-black tracking-widest transition-all"
                              >
                                賣出
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {currentStocks.length === 0 && (
                    <div className="p-24 text-center text-slate-700 italic font-bold uppercase tracking-widest">
                      目前沒有任何持股
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {sellModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1c23] border border-slate-700 p-6 rounded-3xl shadow-2xl w-full max-w-sm relative">
            <button
              onClick={() => setSellModal({ ...sellModal, isOpen: false })}
              className="absolute top-4 right-4 text-slate-500 hover:text-white text-xl"
            >
              ✖️
            </button>
            <h3 className="text-lg font-black text-white mb-2">
              賣出 {sellModal.ticker}
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              可賣出最大股數:{" "}
              <span className="font-bold text-white">
                {sellModal.maxShares} 股
              </span>
            </p>

            <form onSubmit={handleSellStock} className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest ml-1 mb-1 block">
                  賣出股數
                </label>
                <input
                  required
                  type="number"
                  step="any"
                  min="0.001"
                  max={sellModal.maxShares}
                  value={sellModal.sharesToSell}
                  onChange={(e) =>
                    setSellModal({ ...sellModal, sharesToSell: e.target.value })
                  }
                  className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest ml-1 mb-1 block">
                  賣出單價 (USD)
                </label>
                <input
                  required
                  type="number"
                  step="any"
                  min="0.001"
                  value={sellModal.sellPrice}
                  onChange={(e) =>
                    setSellModal({ ...sellModal, sellPrice: e.target.value })
                  }
                  className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest ml-1 mb-1 block">
                  手續費 (USD)
                </label>
                <input
                  required
                  type="number"
                  step="any"
                  min="0"
                  value={sellModal.commission}
                  onChange={(e) =>
                    setSellModal({ ...sellModal, commission: e.target.value })
                  }
                  placeholder="請輸入手續費 (例: 0)"
                  className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>
              <button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-900/20 active:scale-95 mt-4">
                確認賣出
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
