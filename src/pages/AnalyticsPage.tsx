import {readCatalog} from '../lib/catalog';
import { businessDate, businessHour, matchesPeriod, timeBuckets as buildTimeBuckets } from '../lib/businessDate';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  CalendarDays,
  CreditCard,
  FileText,
  Gauge,
  LogOut,
  Package,
  Settings,
  ShoppingCart,
  Store,
  TrendingUp,
  Wallet,
  X,
  XCircle,
  Menu,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase } from "../lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { NavLink } from "react-router-dom";
import { useInventoryRealtime } from "../hooks/useInventoryRealtime";
import { fetchFinancialSnapshot } from "../lib/financialData";
import { SnapshotRequestGuard } from "../lib/financial";
import { FinancialNotice } from "../components/FinancialNotice";

type Business = {
  id: string;
  name: string;
  owner_id: string;
};

type Branch = {
  id: string;
  name: string;
  business_id: string;
};

type Sale = {
  kind: "sale" | "refund";
  settlement_currency: string;
  settlement_amount: number;
  id: string;
  business_id: string;
  branch_id: string;
  total: number;
  subtotal: number;
  cashier_name: string;
  date: string;
  currency: string;
};

type Product = {
  id: string;
  name: string;
  stock: number;
  minimum_stock: number;
  price: number;
  cost: number;
  barcode: string;
  branch_id: string;
  business_id: string;
  category?: string;
};

type SaleItem = {
  id: string;
  sale_id?: string;
  product_name: string;
  quantity: number;
  sale_price: number;
  cost?: number;
  branch_id: string;
  business_id: string;
  category?: string;
  date?: string;
};

const navItems = [
  { label: "Dashboard", icon: Gauge, href: "/dashboard" },
  { label: "Inventory", icon: Package, href: "/inventory" },
  { label: "Analytics", icon: BarChart3, href: "/analytics" },
  { label: "Reports", icon: FileText, href: "/reports" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export default function AnalyticsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [loadedSales, setSales] = useState<Sale[]>([]);
  const [loadedItems, setSaleItems] = useState<SaleItem[]>([]);
  const [loadedProducts, setProducts] = useState<Product[]>([]);
  const [period, setPeriod] = useState("all");
  const [loading, setLoading] = useState(true);
  const [dataError,setDataError] = useState("");
  const [loadedHistory,setHistorical] = useState<Record<string,unknown[]>|null>(null);
  const [loadedScope,setLoadedScope] = useState('');
  const scopeMatches=loadedScope===selectedBusiness+'/'+selectedBranch;
  const sales=useMemo(()=>scopeMatches?loadedSales:[],[scopeMatches,loadedSales]);
  const products=scopeMatches?loadedProducts:[];
  const saleItems=useMemo(()=>scopeMatches?loadedItems:[],[scopeMatches,loadedItems]);
  const historical=scopeMatches?loadedHistory:null;
  const requestGuard=useRef(new SnapshotRequestGuard());
  useLayoutEffect(() => { requestGuard.current.activate(selectedBusiness+"/"+selectedBranch); },[selectedBusiness,selectedBranch]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  async function loadBusinesses() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/login";
      return;
    }

    const {data,error:catalogError}=await readCatalog<Business>('businesses',userData.user.id);
    if(catalogError){setDataError(catalogError.message);setLoading(false);return;}

    setBusinesses(data || []);

    if (data && data.length > 0) {
      setSelectedBusiness(data[0].id);
    }

    setLoading(false);
  }

  async function loadBranches(businessId: string) {
    const {data,error:catalogError}=await readCatalog<Branch>('branches',businessId);
    if(catalogError){setDataError(catalogError.message);setBranches([]);return;}

    setBranches(data || []);
  }

  const loadAnalyticsData = useCallback(async () => {
 const scope=selectedBusiness+'/'+selectedBranch;const ticket=requestGuard.current.begin(scope);
 try {
 const data=await fetchFinancialSnapshot(selectedBusiness,selectedBranch);
 if(!requestGuard.current.isCurrent(ticket))return;
 setSales(data.sales);setSaleItems(data.saleItems);setProducts(data.products as unknown as Product[]);setHistorical(data.historical);setLoadedScope(scope);setDataError('');
 } catch(error) {
 if(requestGuard.current.isCurrent(ticket)){setSales([]);setSaleItems([]);setProducts([]);setHistorical(null);setDataError(error instanceof Error?error.message:'Financial data could not be loaded');}
 }
},[selectedBusiness,selectedBranch]);

    useInventoryRealtime(
    selectedBusiness,
    branches.map((branch) => branch.id),
    loadAnalyticsData
  );

  useEffect(() => {
    const timer=window.setTimeout(() => { void loadBusinesses(); },0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (selectedBusiness) {
      const timer=window.setTimeout(() => { void loadBranches(selectedBusiness); void loadAnalyticsData(); },0);
      return () => window.clearTimeout(timer);
    }
  }, [selectedBusiness, selectedBranch, loadAnalyticsData]);


  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => matchesPeriod(new Date(sale.date), period));
  }, [sales, period]);

  const totalRevenue = filteredSales.reduce(
    (sum, sale) => sum + Number(sale.total || 0),
    0
  );

  const expectedRevenue = filteredSales.reduce(
    (sum, sale) => sum + Number(sale.subtotal || sale.total || 0),
    0
  );

  const discounts = Math.max(expectedRevenue - totalRevenue, 0);

  const totalOrders = filteredSales.filter(s=>s.kind==="sale").length;

  const averageOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const inventoryValue = products.reduce(
    (sum, product) =>
      sum + Number(product.stock || 0) * Number(product.cost || 0),
    0
  );

  // Map sale id -> date so we can link sale items to their sale's date
  const saleDateMap = useMemo(() => {
    const map = new Map<string, Date>();
    sales.forEach((sale) => map.set(sale.id, new Date(sale.date)));
    return map;
  }, [sales]);

  // Resolve the date for a sale item (via sale_id link, or its own date field)
  const getItemDate=useCallback((item: SaleItem): Date | null => {
    if (item.sale_id && saleDateMap.has(item.sale_id)) {
      return saleDateMap.get(item.sale_id)!;
    }
    if (item.date) {
      return new Date(item.date);
    }
    return null;
  },[saleDateMap]);

  // Sale items scoped to the selected period when they can be dated
  const periodSaleItems = useMemo(() => {
    if (saleItems.length === 0) return [];

    const canDateItems = saleItems.some((item) => getItemDate(item) !== null);

    if (!canDateItems) {
      // Cannot reliably date items - use all items for the selected branch
      return saleItems;
    }

    return saleItems.filter((item) => {
      const date = getItemDate(item);
      return date ? matchesPeriod(date, period) : false;
    });
  }, [saleItems, period, getItemDate]);

  const grossProfit = useMemo(() => {
    return periodSaleItems.reduce((sum, item) => {
      const revenue = Number(item.quantity || 0) * Number(item.sale_price || 0);
      const cost = Number(item.quantity || 0) * Number(item.cost || 0);
      return sum + (revenue - cost);
    }, 0);
  }, [periodSaleItems]);

  const netProfit = grossProfit - discounts;

  // Build time buckets based on the selected period
  const timeBuckets = useMemo(() => buildTimeBuckets(period,sales.map(sale=>sale.date)),[period,sales]);
  const bucketMatches=useCallback((bucket:{key:string},date:Date):boolean=>period==='today'?businessHour(date)===Number(bucket.key):businessDate(date)===bucket.key,[period]);

  const salesOverTime = useMemo(() => {
    return timeBuckets.map((bucket) => {
      const total = filteredSales
        .filter((sale) => bucketMatches(bucket, new Date(sale.date)))
        .reduce((sum, sale) => sum + Number(sale.total || 0), 0);

      return { ...bucket, revenue: total };
    });
  }, [timeBuckets, filteredSales, bucketMatches]);

  const profitOverTime = useMemo(() => {
    return timeBuckets.map((bucket) => {
      const itemsInBucket = periodSaleItems.filter((item) => {
        const date = getItemDate(item);
        return date ? bucketMatches(bucket, date) : false;
      });

      const revenue = itemsInBucket.reduce(
        (sum, item) =>
          sum + Number(item.quantity || 0) * Number(item.sale_price || 0),
        0
      );

      const cost = itemsInBucket.reduce(
        (sum, item) =>
          sum + Number(item.quantity || 0) * Number(item.cost || 0),
        0
      );

      return { ...bucket, profit: revenue - cost };
    });
  }, [timeBuckets, periodSaleItems, bucketMatches, getItemDate]);

  const totalProductsSold = periodSaleItems.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  const topSellingProducts = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; total: number }>();

    periodSaleItems.forEach((item) => {
      const current = map.get(item.product_name) || {
        name: item.product_name,
        quantity: 0,
        total: 0,
      };

      current.quantity += Number(item.quantity || 0);
      current.total += Number(item.quantity || 0) * Number(item.sale_price || 0);

      map.set(item.product_name, current);
    });

    return Array.from(map.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 6);
  }, [periodSaleItems]);

  const mostProfitableProducts = useMemo(() => {
    const map = new Map<
      string,
      { name: string; quantity: number; profit: number }
    >();

    periodSaleItems.forEach((item) => {
      const current = map.get(item.product_name) || {
        name: item.product_name,
        quantity: 0,
        profit: 0,
      };

      const revenue = Number(item.quantity || 0) * Number(item.sale_price || 0);
      const cost = Number(item.quantity || 0) * Number(item.cost || 0);

      current.quantity += Number(item.quantity || 0);
      current.profit += revenue - cost;

      map.set(item.product_name, current);
    });

    return Array.from(map.values())
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 6);
  }, [periodSaleItems]);

  const salesByCategory = useMemo(() => {
    const map = new Map<string, number>();

    periodSaleItems.forEach((item) => {
      const category = item.category || "Uncategorized";
      const current = map.get(category) || 0;
      map.set(category, current + Number(item.quantity || 0) * Number(item.sale_price || 0));
    });

    return Array.from(map.entries()).map(([name, value]) => ({
      name,
      value: value || 1,
    }));
  }, [periodSaleItems]);

  const branchName = (id: string) =>
    branches.find((branch) => branch.id === id)?.name || "Unknown";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-lg font-medium">
        Loading analytics...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-[#f5f7fb] text-slate-950">
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <Sidebar mobile onClose={() => setMobileSidebarOpen(false)} />
        </div>
      )}

      <Sidebar />

      <main className="flex min-h-screen min-w-0 flex-1 flex-col">
        <FinancialNotice error={dataError} historical={historical} stockIssues={products.filter(p=>p.stock<0).length}/>
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur md:px-6 xl:px-8">
          <div className="flex w-full flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center justify-between gap-3">
              <button
                className="flex h-10 w-10 items-center justify-center rounded-xl border bg-white lg:hidden"
                onClick={() => setMobileSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="lg:hidden">
                <h1 className="text-sm font-semibold">SwiftPOS</h1>
                <p className="text-xs text-slate-500">Analytics</p>
              </div>

              <div className="hidden lg:block">
                <h1 className="text-2xl font-bold text-slate-950">Analytics</h1>
                <p className="text-sm text-slate-500">
                  Track sales, profit, and performance across your business.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:flex xl:items-center">
              <Select value={selectedBusiness} onValueChange={setSelectedBusiness}>
                <SelectTrigger className="h-11 w-full rounded-2xl bg-white sm:w-[240px]">
                  <Building2 className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Business" />
                </SelectTrigger>
                <SelectContent>
                  {businesses.map((business) => (
                    <SelectItem key={business.id} value={business.id}>
                      {business.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="h-11 w-full rounded-2xl bg-white sm:w-[220px]">
                  <Store className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="h-11 w-full rounded-2xl bg-white sm:w-[180px]">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                className="h-11 rounded-full bg-white px-6"
                onClick={logout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </header>

        <section className="w-full flex-1 space-y-6 px-4 py-6 md:px-6 xl:px-8">
          {!dataError && <>
          <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-4">
            <AnalyticsCard
              icon={Wallet}
              title="Total Revenue"
              value={`$${totalRevenue.toFixed(2)}`}
              description="After discounts"
              color="bg-indigo-100 text-indigo-600"
            />

            <AnalyticsCard
              icon={TrendingUp}
              title="Gross Profit"
              value={`$${grossProfit.toFixed(2)}`}
              description="Revenue - cost of goods"
              color="bg-emerald-100 text-emerald-600"
            />

            <AnalyticsCard
              icon={CreditCard}
              title="Net Profit"
              value={`$${netProfit.toFixed(2)}`}
              description="Gross profit - discounts"
              color="bg-cyan-100 text-cyan-600"
            />

            <AnalyticsCard
              icon={ShoppingCart}
              title="Total Orders"
              value={String(totalOrders)}
              description="Total sales"
              color="bg-amber-100 text-amber-600"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-4">
            <AnalyticsCard
              icon={XCircle}
              title="Total Discounts"
              value={`$${discounts.toFixed(2)}`}
              description="Subtotal - total"
              color="bg-rose-100 text-rose-600"
            />

            <AnalyticsCard
              icon={Package}
              title="Inventory Value"
              value={`$${inventoryValue.toFixed(2)}`}
              description="Stock x cost"
              color="bg-violet-100 text-violet-600"
            />

            <AnalyticsCard
              icon={BarChart3}
              title="Average Order"
              value={`$${averageOrder.toFixed(2)}`}
              description="Revenue / orders"
              color="bg-orange-100 text-orange-600"
            />

            <AnalyticsCard
              icon={Store}
              title="Products Sold"
              value={String(totalProductsSold)}
              description="Total units sold"
              color="bg-teal-100 text-teal-600"
            />
          </div>

          <div className="grid w-full grid-cols-1 gap-6 2xl:grid-cols-[1.55fr_1fr]">
            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base md:text-lg">
                  Sales Over Time
                </CardTitle>
                <Badge variant="outline">
                  {period === "today"
                    ? "Hourly"
                    : period === "week"
                      ? "Last 7 Days"
                      : period === "month"
                        ? "This Month"
                        : "Daily"}
                </Badge>
              </CardHeader>

              <CardContent className="h-[280px] md:h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesOverTime}>
                    <defs>
                      <linearGradient id="sales" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="#6366f1"
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="95%"
                          stopColor="#6366f1"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} width={45} />
                    <Tooltip />

                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#6366f1"
                      strokeWidth={3}
                      fill="url(#sales)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base md:text-lg">
                  Profit Over Time
                </CardTitle>
                <Badge variant="outline">
                  {period === "today"
                    ? "Hourly"
                    : period === "week"
                      ? "Last 7 Days"
                      : period === "month"
                        ? "This Month"
                        : "Daily"}
                </Badge>
              </CardHeader>

              <CardContent className="h-[280px] md:h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profitOverTime}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} width={45} />
                    <Tooltip />

                    <Bar dataKey="profit" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-2 2xl:grid-cols-[1.2fr_0.85fr_0.95fr]">
            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base md:text-lg">
                  Top Selling Products
                </CardTitle>
                <Badge variant="outline">By Quantity</Badge>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  {topSellingProducts.map((product, index) => (
                    <div key={product.name} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm">
                        {index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{product.name}</p>
                        <p className="text-xs text-slate-500">
                          {product.quantity} pcs
                        </p>
                      </div>

                      <p className="whitespace-nowrap font-semibold">
                        ${product.total.toFixed(2)}
                      </p>
                    </div>
                  ))}

                  {topSellingProducts.length === 0 && (
                    <p className="text-sm text-slate-500">No sales data yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base md:text-lg">
                  Most Profitable Products
                </CardTitle>
                <Badge variant="outline">By Profit</Badge>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  {mostProfitableProducts.map((product, index) => (
                    <div key={product.name} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-sm font-semibold text-emerald-600">
                        {index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{product.name}</p>
                        <p className="text-xs text-slate-500">
                          {product.quantity} pcs
                        </p>
                      </div>

                      <p className="whitespace-nowrap font-semibold text-emerald-600">
                        ${product.profit.toFixed(2)}
                      </p>
                    </div>
                  ))}

                  {mostProfitableProducts.length === 0 && (
                    <p className="text-sm text-slate-500">No profit data yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base md:text-lg">
                  Sales by Category
                </CardTitle>
                <Badge variant="outline">Revenue</Badge>
              </CardHeader>

              <CardContent>
                {salesByCategory.length > 0 ? (
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={salesByCategory}
                          dataKey="value"
                          nameKey="name"
                          innerRadius="50%"
                          outerRadius="80%"
                          paddingAngle={4}
                        >
                          {salesByCategory.map((_, index) => (
                            <Cell
                              key={index}
                              fill={[
                                "#6366f1",
                                "#10b981",
                                "#f59e0b",
                                "#ef4444",
                                "#06b6d4",
                                "#8b5cf6",
                              ][index % 6]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No category data yet.</p>
                )}

                <div className="mt-4 space-y-2">
                  {salesByCategory.slice(0, 5).map((cat) => (
                    <div
                      key={cat.name}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-slate-600">{cat.name}</span>
                      <span className="font-semibold">
                        ${cat.value.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Recent Sales Performance</CardTitle>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="py-3 font-medium">Receipt</th>
                      <th className="py-3 font-medium">Date</th>
                      <th className="py-3 font-medium">Branch</th>
                      <th className="py-3 font-medium">Cashier</th>
                      <th className="py-3 font-medium">Expected</th>
                      <th className="py-3 font-medium">Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredSales.slice(0, 10).map((sale) => (
                      <tr key={sale.id} className="border-b last:border-0">
                        <td className="py-4 font-medium">
                          #{sale.id.slice(0, 8)}
                        </td>
                        <td className="py-4 text-slate-500">
                          {new Date(sale.date).toLocaleDateString()}
                        </td>
                        <td className="py-4 text-slate-500">
                          {branchName(sale.branch_id)}
                        </td>
                        <td className="py-4 text-slate-500">
                          {sale.cashier_name || "Unknown"}
                        </td>
                        <td className="py-4 font-semibold">
                          ${Number(sale.subtotal || sale.total || 0).toFixed(2)}
                        </td>
                        <td className="py-4 font-semibold">
                          ${Number(sale.total || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredSales.length === 0 && (
                  <div className="py-10 text-center text-sm text-slate-500">
                    No sales data for this period.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
                  </>}
        </section>
      </main>
    </div>
  );
}

function Sidebar({
  mobile = false,
  onClose,
}: {
  mobile?: boolean;
  onClose?: () => void;
}) {
  return (
    <aside
      className={`${
        mobile
          ? "relative z-50 flex w-[280px]"
          : "hidden w-[260px] shrink-0 lg:sticky lg:top-0 lg:flex"
      } h-screen flex-col bg-[#071026] text-white`}
    >
      <div className="flex h-20 items-center gap-3 px-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500">
          <Store className="h-6 w-6" />
        </div>

        <div className="min-w-0">
          <p className="text-lg font-semibold leading-none">SwiftPOS</p>
          <p className="mt-1 text-sm text-slate-400">Analytics</p>
        </div>

        {mobile ? (
          <button className="ml-auto" onClick={onClose}>
            <X className="h-5 w-5 text-slate-300" />
          </button>
        ) : (
          <Menu className="ml-auto h-5 w-5 text-slate-400" />
        )}
      </div>

      <nav className="space-y-2 px-4">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.label}
              to={item.href}
              className={({ isActive }) =>
                `flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/10 p-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-slate-700" />
          <div>
            <p className="text-sm font-medium">Owner Account</p>
            <p className="text-xs text-slate-400">Business Owner</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function AnalyticsCard({
  icon: Icon,
  title,
  value,
  description,
  color,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  description: string;
  color: string;
}) {
  return (
    <Card className="rounded-3xl border-slate-200 shadow-sm">
      <CardContent className="p-5">
        <div
          className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${color}`}
        >
          <Icon className="h-6 w-6" />
        </div>

        <p className="text-sm font-medium text-slate-500">{title}</p>
        <h3 className="mt-2 text-2xl font-bold">{value}</h3>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </CardContent>
    </Card>
  );
}