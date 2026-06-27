import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Building2,
  CalendarDays,
  CreditCard,
  Download,
  FileText,
  Gauge,
  LogOut,
  Package,
  Search,
  Settings,
  Store,
  TrendingUp,
  Wallet,
} from "lucide-react";

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
  cost: number;
  price: number;
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
  { label: "Reports", icon: FileText, href: "/reports", active: true },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export default function ReportsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBusinesses();
  }, []);

  useEffect(() => {
    if (selectedBusiness) {
      loadBranches(selectedBusiness);
      loadReportData();
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

  async function loadReportData() {
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

  const filteredSales = useMemo(() => {
    const now = new Date();

    return sales.filter((sale) => {
      const saleDate = new Date(sale.date);

      const matchesSearch =
        sale.id.toLowerCase().includes(search.toLowerCase()) ||
        sale.cashier_name?.toLowerCase().includes(search.toLowerCase()) ||
        sale.currency?.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (period === "today") {
        return saleDate.toDateString() === now.toDateString();
      }

      if (period === "week") {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        return saleDate >= sevenDaysAgo;
      }

      if (period === "month") {
        return (
          saleDate.getMonth() === now.getMonth() &&
          saleDate.getFullYear() === now.getFullYear()
        );
      }

      return true;
    });
  }, [sales, search, period]);

  const totalRevenue = filteredSales.reduce(
    (sum, sale) => sum + Number(sale.total || 0),
    0
  );

  const expectedRevenue = filteredSales.reduce(
    (sum, sale) => sum + Number(sale.subtotal || sale.total || 0),
    0
  );

  const discounts = Math.max(expectedRevenue - totalRevenue, 0);

  const transactions = filteredSales.length;

  const averageOrder = transactions > 0 ? totalRevenue / transactions : 0;

  const inventoryValue = products.reduce(
    (sum, product) =>
      sum + Number(product.stock || 0) * Number(product.cost || 0),
    0
  );

  const lowStock = products.filter(
    (product) =>
      Number(product.stock || 0) <= Number(product.minimum_stock || 0)
  );

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
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [saleItems]);

  const branchName = (id: string) =>
    branches.find((branch) => branch.id === id)?.name || "Unknown";

  function exportReport() {
    const rows = filteredSales.map((sale) => ({
      Receipt: sale.id,
      Date: sale.date,
      Branch: branchName(sale.branch_id),
      Cashier: sale.cashier_name,
      Currency: sale.currency,
      Subtotal: Number(sale.subtotal || 0).toFixed(2),
      Total: Number(sale.total || 0).toFixed(2),
    }));

    const csv = [
      Object.keys(rows[0] || {}).join(","),
      ...rows.map((row) => Object.values(row).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "sales-report.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-lg font-medium">
        Loading reports...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-[#f5f7fb] text-slate-950">
      <Sidebar />

      <main className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur md:px-6 xl:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-950">Reports</h1>
              <p className="text-sm text-slate-500">
                Track revenue, expected income, discounts, inventory, and sales.
              </p>
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
          <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-5">
            <ReportCard
              icon={Wallet}
              title="Actual Revenue"
              value={`$${totalRevenue.toFixed(2)}`}
              description="After discounts"
              color="bg-indigo-100 text-indigo-600"
            />

            <ReportCard
              icon={TrendingUp}
              title="Expected Revenue"
              value={`$${expectedRevenue.toFixed(2)}`}
              description="Original price before discounts"
              color="bg-emerald-100 text-emerald-600"
            />

            <ReportCard
              icon={CreditCard}
              title="Discounts"
              value={`$${discounts.toFixed(2)}`}
              description="Subtotal - total"
              color="bg-rose-100 text-rose-600"
            />

            <ReportCard
              icon={BarChart3}
              title="Transactions"
              value={String(transactions)}
              description="Total receipts"
              color="bg-amber-100 text-amber-600"
            />

            <ReportCard
              icon={Package}
              title="Inventory Value"
              value={`$${inventoryValue.toFixed(2)}`}
              description="Stock x cost"
              color="bg-cyan-100 text-cyan-600"
            />
          </div>

          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_180px_160px_auto]">
              <div className="relative">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                <Input
                  className="h-12 rounded-2xl bg-white pl-12"
                  placeholder="Search by receipt, cashier, or currency..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="h-12 rounded-2xl bg-white">
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

              <div className="flex items-center rounded-2xl border bg-white px-4 text-sm font-medium">
                Avg: ${averageOrder.toFixed(2)}
              </div>

              <Button className="h-12 rounded-2xl" onClick={exportReport}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Sales Report</CardTitle>
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
                      {filteredSales.slice(0, 12).map((sale) => (
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
                      No sales found for this report.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="rounded-3xl border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Top Products</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  {topProducts.map((product, index) => (
                    <div key={product.name} className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold">
                        {index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{product.name}</p>
                        <p className="text-xs text-slate-500">
                          {product.quantity} pcs sold
                        </p>
                      </div>

                      <p className="font-semibold">${product.total.toFixed(2)}</p>
                    </div>
                  ))}

                  {topProducts.length === 0 && (
                    <p className="text-sm text-slate-500">No products sold yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Low Stock Report</CardTitle>
                </CardHeader>

                <CardContent className="space-y-3">
                  {lowStock.slice(0, 6).map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-3 rounded-2xl border p-3"
                    >
                      <AlertCircle className="h-5 w-5 text-red-500" />

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{product.name}</p>
                        <p className="text-xs text-slate-500">
                          Stock: {product.stock} | Min: {product.minimum_stock}
                        </p>
                      </div>

                      <Badge variant="outline">Low</Badge>
                    </div>
                  ))}

                  {lowStock.length === 0 && (
                    <p className="text-sm text-slate-500">
                      No low stock products.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="hidden h-screen w-[260px] shrink-0 flex-col bg-[#071026] text-white lg:sticky lg:top-0 lg:flex">
      <div className="flex h-20 items-center gap-3 px-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500">
          <Store className="h-6 w-6" />
        </div>

        <div>
          <p className="text-lg font-semibold leading-none">SwiftPOS</p>
          <p className="mt-1 text-sm text-slate-400">Reports</p>
        </div>
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

function ReportCard({
  icon: Icon,
  title,
  value,
  description,
  color,
}: {
  icon: any;
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