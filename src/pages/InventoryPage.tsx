import SmallWindowNavigation from "../components/SmallWindowNavigation";
import {readCatalog} from '../lib/catalog';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  BarChart3,
  Boxes,
  Building2,
  FileText,
  Gauge,
  LogOut,
  Package,
  Search,
  Settings,
  Store,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import { SnapshotRequestGuard } from "../lib/financial";
import { fetchInventoryProducts } from "../lib/inventory";
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
import { useInventoryRealtime } from "../hooks/useInventoryRealtime";

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
  size?: string;
};

const navItems = [
  { label: "Dashboard", icon: Gauge, href: "/dashboard" },
  { label: "Inventory", icon: Boxes, href: "/inventory" },
  { label: "Analytics", icon: BarChart3, href: "/analytics" },
  { label: "Reports", icon: FileText, href: "/reports" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export default function InventoryPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [loadedProducts, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loadedScope,setLoadedScope]=useState('');
  const products=useMemo(()=>loadedScope===selectedBusiness+'/'+selectedBranch?loadedProducts:[],[loadedScope,selectedBusiness,selectedBranch,loadedProducts]);
  const requestGuard=useRef(new SnapshotRequestGuard());
  useLayoutEffect(()=>{requestGuard.current.activate(selectedBusiness+'/'+selectedBranch);},[selectedBusiness,selectedBranch]);


  async function loadBusinesses() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/login";
      return;
    }

    const {data,error:catalogError}=await readCatalog<Business>('businesses',userData.user.id);
    if(catalogError){setError(catalogError.message);setLoading(false);return;}

    setBusinesses(data || []);

    if (data && data.length > 0) {
      setSelectedBusiness(data[0].id);
    }

    setLoading(false);
  }

  async function loadBranches(businessId: string) {
    const {data,error:catalogError}=await readCatalog<Branch>('branches',businessId);
    if(catalogError){setError(catalogError.message);setBranches([]);return;}

    setBranches(data || []);
  }

  const loadInventory=useCallback(async () => {
    const scope=selectedBusiness+'/'+selectedBranch;const ticket=requestGuard.current.begin(scope);
    setError("");

    if (!selectedBusiness) {
      setProducts([]);
      return;
    }

    const {data:branchData,error:branchError}=await readCatalog<Branch>('branches',selectedBusiness);

    if(!requestGuard.current.isCurrent(ticket))return;
    if(branchError){setError(branchError.message);return;}
    const visibleBranches = branchData || [];
    const visibleBranchIds = visibleBranches.map((branch) => branch.id);

    const { data, error: queryError } = await fetchInventoryProducts<Product>(
      selectedBusiness,
      visibleBranchIds,
      selectedBranch
    );

    if(!requestGuard.current.isCurrent(ticket))return;
    if (queryError) {
      console.error("Inventory query failed", {
        business_id: selectedBusiness,
        branch_id: selectedBranch,
        queryError,
      });
      setError("Failed to load inventory. Please try again.");
      return;
    }

    const validProducts = (data || []).filter((product) => {
      const hasBusinessId = Boolean(product.business_id);
      const hasBranchId = Boolean(product.branch_id);

      if (!hasBusinessId || !hasBranchId) {
        console.warn("Skipping inventory row missing required identifiers", {
          productId: product.id,
          business_id: product.business_id,
          branch_id: product.branch_id,
          name: product.name,
        });
      }

      return hasBusinessId && hasBranchId;
    });

    setProducts(validProducts);setLoadedScope(scope);
  },[selectedBusiness,selectedBranch]);

  useInventoryRealtime(selectedBusiness,branches.map(b=>b.id),loadInventory);
  useEffect(()=>{const timer=window.setTimeout(()=>{void loadBusinesses();},0);return()=>window.clearTimeout(timer);},[]);
  useEffect(()=>{const timer=window.setTimeout(()=>{if(selectedBusiness){void loadBranches(selectedBusiness);void loadInventory();}},0);return()=>window.clearTimeout(timer);},[selectedBusiness,selectedBranch,loadInventory]);

  async function refreshInventory() {
    setRefreshing(true);
    await loadInventory();
    setRefreshing(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category && p.category.trim()) set.add(p.category.trim());
    });
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        (product.barcode || "").toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (category !== "all" && product.category !== category) return false;

      return true;
    });
  }, [products, search, category]);

  const totalStockValue = filteredProducts.reduce(
    (sum, product) => sum + Number(product.stock || 0) * Number(product.cost || 0),
    0
  );

  const lowStockCount = filteredProducts.filter(
    (product) =>
      Number(product.stock || 0) <= Number(product.minimum_stock || 0)
  ).length;

  const branchName = (id: string) =>
    branches.find((branch) => branch.id === id)?.name || "Unknown";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-lg font-medium">
        Loading inventory...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-[#f5f7fb] text-slate-950">
      <Sidebar />

      <main className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur md:px-6 xl:px-8">
          <SmallWindowNavigation />
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-950">Inventory</h1>
              <p className="text-sm text-slate-500">
                Manage products, stock levels, and inventory value.
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
                onClick={refreshInventory}
                disabled={refreshing}
              >
                {refreshing ? "Refreshing..." : "Refresh inventory"}
              </Button>

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
          <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-4">
            <InventoryCard
              icon={Package}
              title="Total Products"
              value={String(filteredProducts.length)}
              description="In selected scope"
              color="bg-indigo-100 text-indigo-600"
            />

            <InventoryCard
              icon={Boxes}
              title="Stock Value"
              value={`$${totalStockValue.toFixed(2)}`}
              description="Stock x cost"
              color="bg-emerald-100 text-emerald-600"
            />

            <InventoryCard
              icon={AlertCircle}
              title="Low Stock Items"
              value={String(lowStockCount)}
              description="At or below minimum"
              color="bg-amber-100 text-amber-600"
            />

            <InventoryCard
              icon={Store}
              title="Branches"
              value={String(branches.length)}
              description="Visible branches"
              color="bg-cyan-100 text-cyan-600"
            />
          </div>

          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_200px_auto]">
              <div className="relative">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                <Input
                  className="h-12 rounded-2xl bg-white pl-12"
                  placeholder="Search by product name or barcode..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {categories.length > 0 && (
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-12 rounded-2xl bg-white">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="flex items-center rounded-2xl border bg-white px-4 text-sm font-medium">
                {filteredProducts.length} item{filteredProducts.length !== 1 ? "s" : ""}
              </div>
            </CardContent>
          </Card>

          {error ? (
            <Card className="rounded-3xl border-red-200 bg-red-50 shadow-sm">
              <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                <AlertCircle className="h-10 w-10 text-red-500" />
                <p className="font-medium text-red-700">{error}</p>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => loadInventory()}
                >
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : filteredProducts.length === 0 ? (
            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                <Package className="h-10 w-10 text-slate-300" />
                <p className="font-medium text-slate-600">No products found</p>
                <p className="text-sm text-slate-500">
                  {search || category !== "all"
                    ? "Try adjusting your search or filters."
                    : "No inventory items exist for this business and branch."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Products</CardTitle>
              </CardHeader>

              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead>
                      <tr className="border-b text-slate-500">
                        <th className="py-3 font-medium">Product</th>
                        <th className="py-3 font-medium">Barcode</th>
                        {categories.length > 0 && (
                          <th className="py-3 font-medium">Category</th>
                        )}
                        <th className="py-3 font-medium">Size</th>
                        <th className="py-3 font-medium">Stock</th>
                        <th className="py-3 font-medium">Price</th>
                        <th className="py-3 font-medium">Cost</th>
                        <th className="py-3 font-medium">Stock Value</th>
                        <th className="py-3 font-medium">Branch</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredProducts.map((product) => {
                        const stockValue =
                          Number(product.stock || 0) * Number(product.cost || 0);
                        const isLowStock =
                          Number(product.stock || 0) <=
                          Number(product.minimum_stock || 0);

                        return (
                          <tr key={product.id} className="border-b last:border-0">
                            <td className="py-4 font-medium">{product.name}</td>
                            <td className="py-4 text-slate-500">
                              {product.barcode || "—"}
                            </td>
                            {categories.length > 0 && (
                              <td className="py-4 text-slate-500">
                                {product.category || "—"}
                              </td>
                            )}
                            <td className="py-4 text-slate-500">
                              {product.size || "—"}
                            </td>
                            <td className="py-4">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">
                                  {Number(product.stock || 0)}
                                </span>
                                {isLowStock && (
                                  <Badge variant="outline" className="text-amber-600">
                                    Low
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="py-4 font-semibold">
                              ${Number(product.price || 0).toFixed(2)}
                            </td>
                            <td className="py-4 text-slate-500">
                              ${Number(product.cost || 0).toFixed(2)}
                            </td>
                            <td className="py-4 font-semibold">
                              ${stockValue.toFixed(2)}
                            </td>
                            <td className="py-4 text-slate-500">
                              {branchName(product.branch_id)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
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
          <p className="mt-1 text-sm text-slate-400">Inventory</p>
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

function InventoryCard({
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