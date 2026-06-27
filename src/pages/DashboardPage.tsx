import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bell,
  Box,
  Building2,
  ChartLine,
  CreditCard,
  Gauge,
  LogOut,
  Menu,
  Package,
  Search,
  Settings,
  ShoppingCart,
  Store,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
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
import { Input } from "../components/ui/input";
import { NavLink } from "react-router-dom";

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
};

type SaleItem = {
  id: string;
  product_name: string;
  quantity: number;
  sale_price: number;
  branch_id: string;
};

const navItems = [
  { label: "Dashboard", icon: Gauge, href: "/dashboard" },
  { label: "Reports", icon: CreditCard, href: "/reports" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export default function DashboardPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    loadBusinesses();
  }, []);

  useEffect(() => {
    if (selectedBusiness) {
      loadBranches(selectedBusiness);
      loadData();
    }
  }, [selectedBusiness, selectedBranch]);

  async function loadBusinesses() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/login";
      return;
    }

    const { data } = await supabase
      .from("businesses")
      .select("*")
      .eq("owner_id", userData.user.id);

    setBusinesses(data || []);

    if (data && data.length > 0) {
      setSelectedBusiness(data[0].id);
    }

    setLoading(false);
  }

  async function loadBranches(businessId: string) {
    const { data } = await supabase
      .from("branches")
      .select("*")
      .eq("business_id", businessId);

    setBranches(data || []);
  }

  async function loadData() {
    let salesQuery = supabase
      .from("sales")
      .select("*")
      .eq("business_id", selectedBusiness)
      .order("date", { ascending: false });

    let productsQuery = supabase
      .from("products")
      .select("*")
      .eq("business_id", selectedBusiness);

    let saleItemsQuery = supabase
      .from("sale_items")
      .select("*")
      .eq("business_id", selectedBusiness);

    if (selectedBranch !== "all") {
      salesQuery = salesQuery.eq("branch_id", selectedBranch);
      productsQuery = productsQuery.eq("branch_id", selectedBranch);
      saleItemsQuery = saleItemsQuery.eq("branch_id", selectedBranch);
    }

    const [{ data: salesData }, { data: productsData }, { data: itemsData }] =
      await Promise.all([salesQuery, productsQuery, saleItemsQuery]);

    setSales(salesData || []);
    setProducts(productsData || []);
    setSaleItems(itemsData || []);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const today = new Date().toISOString().slice(0, 10);

  const todaySales = sales.filter((sale) => String(sale.date).startsWith(today));

  const todayRevenue = todaySales.reduce(
    (sum, sale) => sum + Number(sale.total || 0),
    0
  );

  const totalRevenue = sales.reduce(
    (sum, sale) => sum + Number(sale.total || 0),
    0
  );

  const transactions = sales.length;
  const averageOrder = transactions > 0 ? totalRevenue / transactions : 0;

  const lowStock = products.filter(
    (product) =>
      Number(product.stock || 0) <= Number(product.minimum_stock || 0)
  );

  const inventoryValue = products.reduce(
    (sum, product) =>
      sum + Number(product.stock || 0) * Number(product.cost || 0),
    0
  );

  const revenueChartData = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return days.map((day) => {
      const total = sales
        .filter((sale) => {
          const saleDate = new Date(sale.date);
          return days[saleDate.getDay()] === day;
        })
        .reduce((sum, sale) => sum + Number(sale.total || 0), 0);

      return { day, revenue: total };
    });
  }, [sales]);

  const topProducts = useMemo(() => {
    const map = new Map<
      string,
      { name: string; quantity: number; total: number }
    >();

    saleItems.forEach((item) => {
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
      .slice(0, 5);
  }, [saleItems]);

  const branchName = (id: string) =>
    branches.find((branch) => branch.id === id)?.name || "Unknown";

  const categoryData = [
    { name: "Revenue", value: totalRevenue || 1 },
    { name: "Inventory", value: inventoryValue || 1 },
    { name: "Low Stock", value: lowStock.length || 1 },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-lg font-medium">
        Loading dashboard...
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
                <p className="text-xs text-slate-500">Owner Dashboard</p>
              </div>

              <div className="relative hidden w-[360px] md:block xl:w-[430px]">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                <Input
                  className="h-12 rounded-2xl border-slate-200 bg-white pl-12 text-sm"
                  placeholder="Search anything..."
                />
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

              <div className="flex gap-3 sm:col-span-2 xl:col-span-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 rounded-full bg-white"
                >
                  <Bell className="h-5 w-5" />
                </Button>

                <Button
                  variant="outline"
                  className="h-11 flex-1 rounded-full bg-white px-6 xl:flex-none"
                  onClick={logout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </header>

        <section className="w-full flex-1 space-y-6 px-4 py-6 md:px-6 xl:px-8">
          <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 2xl:grid-cols-4">
            <KpiCard
              icon={Wallet}
              title="Today Revenue"
              value={`$${todayRevenue.toFixed(2)}`}
              sub="Synced from POS"
              color="bg-indigo-100 text-indigo-600"
              change="+12.5%"
            />

            <KpiCard
              icon={ChartLine}
              title="Total Revenue"
              value={`$${totalRevenue.toFixed(2)}`}
              sub="All selected sales"
              color="bg-emerald-100 text-emerald-600"
              change="+8.3%"
            />

            <KpiCard
              icon={ShoppingCart}
              title="Transactions"
              value={String(transactions)}
              sub="Total receipts"
              color="bg-amber-100 text-amber-600"
              change="+15.7%"
            />

            <KpiCard
              icon={CreditCard}
              title="Average Order"
              value={`$${averageOrder.toFixed(2)}`}
              sub="Revenue / transaction"
              color="bg-rose-100 text-rose-600"
              change="+3.2%"
            />
          </div>

          <div className="grid w-full grid-cols-1 gap-6 2xl:grid-cols-[1.55fr_1fr]">
            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base md:text-lg">
                  Revenue Overview
                </CardTitle>
                <Badge variant="outline">This Week</Badge>
              </CardHeader>

              <CardContent className="h-[280px] md:h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueChartData}>
                    <defs>
                      <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
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
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} width={45} />
                    <Tooltip />

                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#6366f1"
                      strokeWidth={3}
                      fill="url(#revenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base md:text-lg">
                  Business Breakdown
                </CardTitle>
                <Badge variant="outline">Live</Badge>
              </CardHeader>

              <CardContent className="grid gap-4 md:grid-cols-2 2xl:grid-cols-2">
                <div className="h-[220px] md:h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        dataKey="value"
                        innerRadius="58%"
                        outerRadius="85%"
                        paddingAngle={4}
                      >
                        <Cell fill="#6366f1" />
                        <Cell fill="#10b981" />
                        <Cell fill="#f59e0b" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex flex-col justify-center space-y-4">
                  <BreakdownDot
                    label="Revenue"
                    value={`$${totalRevenue.toFixed(2)}`}
                    color="bg-indigo-500"
                  />
                  <BreakdownDot
                    label="Inventory Value"
                    value={`$${inventoryValue.toFixed(2)}`}
                    color="bg-emerald-500"
                  />
                  <BreakdownDot
                    label="Low Stock Items"
                    value={String(lowStock.length)}
                    color="bg-amber-500"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-2 2xl:grid-cols-[1.2fr_0.85fr_0.95fr]">
            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base md:text-lg">
                  Recent Sales
                </CardTitle>
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  {sales.slice(0, 6).map((sale) => (
                    <div
                      key={sale.id}
                      className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 p-3 text-sm md:grid-cols-[1fr_1fr_1fr_auto]"
                    >
                      <div>
                        <p className="font-medium">#{sale.id.slice(0, 8)}</p>
                        <p className="text-xs text-slate-500">
                          {sale.cashier_name}
                        </p>
                      </div>

                      <p className="text-slate-600">
                        {branchName(sale.branch_id)}
                      </p>

                      <Badge variant="secondary" className="w-fit">
                        {sale.currency}
                      </Badge>

                      <p className="font-semibold">
                        ${Number(sale.total || 0).toFixed(2)}
                      </p>
                    </div>
                  ))}

                  {sales.length === 0 && (
                    <p className="text-sm text-slate-500">No sales yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base md:text-lg">
                  Top Products
                </CardTitle>
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  {topProducts.map((product, index) => (
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

                  {topProducts.length === 0 && (
                    <p className="text-sm text-slate-500">No sale items yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base md:text-lg">
                  Low Stock Alert
                </CardTitle>
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  {lowStock.slice(0, 6).map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3"
                    >
                      <Package className="h-5 w-5 shrink-0 text-amber-500" />

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{product.name}</p>
                        <p className="text-xs text-slate-500">
                          Stock: {product.stock} | Min: {product.minimum_stock}
                        </p>
                      </div>

                      <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
                    </div>
                  ))}

                  {lowStock.length === 0 && (
                    <p className="text-sm text-slate-500">
                      No low stock items.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardContent className="grid gap-6 p-5 sm:grid-cols-2 xl:grid-cols-4">
              <BottomStat
                icon={Box}
                label="Total Products"
                value={String(products.length)}
              />
              <BottomStat icon={Users} label="Total Customers" value="Soon" />
              <BottomStat
                icon={UserRound}
                label="Total Employees"
                value="Soon"
              />
              <BottomStat
                icon={Store}
                label="Total Branches"
                value={String(branches.length)}
              />
            </CardContent>
          </Card>
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
          <p className="mt-1 text-sm text-slate-400">Dashboard</p>
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

function KpiCard({
  icon: Icon,
  title,
  value,
  sub,
  color,
  change,
}: {
  icon: any;
  title: string;
  value: string;
  sub: string;
  color: string;
  change: string;
}) {
  return (
    <Card className="overflow-hidden rounded-3xl border-slate-200 shadow-sm">
      <CardContent className="flex min-h-[150px] items-center gap-4 p-5">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${color}`}
        >
          <Icon className="h-6 w-6" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <Badge className="shrink-0 bg-emerald-50 text-xs text-emerald-600 hover:bg-emerald-50">
              {change}
            </Badge>
          </div>

          <h3 className="mt-2 truncate text-2xl font-bold md:text-3xl">
            {value}
          </h3>

          <p className="mt-1 text-sm text-slate-500">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function BreakdownDot({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className={`h-3 w-3 rounded-full ${color}`} />
        <span className="text-sm text-slate-600">{label}</span>
      </div>

      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function BottomStat({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
        <Icon className="h-5 w-5" />
      </div>

      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}