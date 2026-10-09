import { useDashboardBranches } from '../hooks/useDashboardBranches';
import SmallWindowNavigation from "../components/SmallWindowNavigation";
import {readCatalog} from '../lib/catalog';
import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  CheckCircle2,
  FileText,
  Gauge,
  LogOut,
  Mail,
  Package,
  Receipt,
  Save,
  Settings,
  Shield,
  Store,
  UserRound,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
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

const navItems = [
  { label: "Dashboard", icon: Gauge, href: "/dashboard" },
  { label: "Inventory", icon: Package, href: "/inventory" },
  { label: "Analytics", icon: BarChart3, href: "/analytics" },
  { label: "Reports", icon: FileText, href: "/reports" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export default function SettingsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const saveBusy=useRef(false);
  const [saved, setSaved] = useState(false);
  const [saveError,setSaveError] = useState("");
  const [loading, setLoading] = useState(true);
  const branches = useDashboardBranches<Branch>(selectedBusiness, setSaveError);

  async function loadSettings() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/login";
      return;
    }

    setOwnerEmail(userData.user.email || "");

    const {data,error:catalogError}=await readCatalog<Business>('businesses',userData.user.id);
    if(catalogError){setSaveError(catalogError.message);setLoading(false);return;}

    setBusinesses(data || []);

    if (data && data.length > 0) {
      setSelectedBusiness(data[0].id);
      setBusinessName(data[0].name);
    }

    setLoading(false);
  }


  useEffect(() => {
    const timer=window.setTimeout(() => { void loadSettings(); },0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const timer=window.setTimeout(() => {
      if(selectedBusiness){setBusinessName(businesses.find(b=>b.id===selectedBusiness)?.name??'');}
    },0);
    return () => window.clearTimeout(timer);
  },[selectedBusiness,businesses]);

  async function saveBusinessProfile() {
    if(saveBusy.current)return;
    const name=businessName.trim();
    if(!selectedBusiness||!name||name.length>255){setSaveError('Enter a business name between 1 and 255 characters.');return;}
    saveBusy.current=true;setSaving(true);setSaved(false);setSaveError('');
    try {
      const {data,error:authError}=await supabase.auth.getUser();
      if(authError||!data.user||!businesses.some(b=>b.id===selectedBusiness&&b.owner_id===data.user!.id))throw new Error('Reconnect the owner of this business before saving.');
      const result=await supabase.from('businesses').update({name}).eq('id',selectedBusiness).eq('owner_id',data.user.id).select('id,name,owner_id').single();
      if(result.error)throw result.error;
      if(!result.data||result.data.id!==selectedBusiness||result.data.owner_id!==data.user.id)throw new Error('The business update was not confirmed.');
      setBusinesses(previous=>previous.map(b=>b.id===selectedBusiness?{...b,name:result.data.name}:b));
      setBusinessName(result.data.name);setSaved(true);
    }catch(error){setSaveError(error instanceof Error?error.message:'Business update failed. Please try again.');}
    finally{saveBusy.current=false;setSaving(false);}
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-lg font-medium">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-[#f5f7fb] text-slate-950">
      <Sidebar />

      {saveError&&<p role="alert">{saveError}</p>}
      <main className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur md:px-6 xl:px-8">
          <SmallWindowNavigation />
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-950">Settings</h1>
              <p className="text-sm text-slate-500">
                Manage your business name and view authorized branches and account settings.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Select value={selectedBusiness} onValueChange={setSelectedBusiness}>
                <SelectTrigger className="h-11 w-full rounded-2xl bg-white sm:w-[260px]">
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
          {saved && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              Settings saved successfully.
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5 text-indigo-500" />
                  Business Profile
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-600">
                      Business Name
                    </label>
                    <Input
                      className="h-12 rounded-2xl bg-white"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Business name"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-600">
                      Owner Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                      <Input
                        className="h-12 rounded-2xl bg-white pl-12"
                        value={ownerEmail}
                        disabled
                      />
                    </div>
                  </div>

                  <p className="text-sm text-slate-600">Verified reports use USD base prices and show the original USD or LBP settlement currency. Exchange rates are set in the POS.</p>
                  <p className="text-sm text-slate-600">The current POS applies zero tax. Tax changes are not supported by this release.</p>
                </div>

                <Button
                  className="h-12 rounded-2xl px-6"
                  onClick={saveBusinessProfile}
                  disabled={saving}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving..." : "Save Business Profile"}
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-indigo-500" />
                  Account & Security
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <SettingRow
                  icon={UserRound}
                  title="Account Role"
                  value="Business Owner"
                />
                <SettingRow icon={Mail} title="Login Email" value={ownerEmail} />
                <SettingRow icon={Shield} title="Security" value="Supabase Auth" />

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="font-medium">Recommended next features</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Add password reset, employee permissions, and activity logs.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Store className="h-5 w-5 text-indigo-500" />
                  Branches
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {branches.map((branch) => (
                  <div
                    key={branch.id}
                    className="flex items-center justify-between rounded-2xl border p-4"
                  >
                    <div>
                      <p className="font-medium">{branch.name}</p>
                      <p className="text-xs text-slate-500">
                        Branch ID: {branch.id.slice(0, 8)}
                      </p>
                    </div>

                    <Badge variant="outline">Active</Badge>
                  </div>
                ))}

                {branches.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No branches added yet.
                  </p>
                )}

                <p className="text-sm text-slate-500">Existing authorized branches are listed here. Branch creation is not available from this dashboard.</p>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Receipt className="h-5 w-5 text-indigo-500" />
                  Receipt & POS Preferences
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-5">
                <p className="text-sm text-slate-600">Barcode checkout and stock alerts are configured in the POS. Receipt footer editing and printer integration are not available in this release.</p>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-3xl border-red-200 bg-red-50 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-semibold text-red-700">Danger Zone</h3>
                <p className="text-sm text-red-600">
                  Log out of this account or later add business deletion protection.
                </p>
              </div>

              <Button variant="destructive" className="rounded-2xl" onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </CardContent>
          </Card>
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
          <p className="mt-1 text-sm text-slate-400">Settings</p>
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

function SettingRow({
  icon: Icon,
  title,
  value,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-slate-500">{value}</p>
      </div>
    </div>
  );
}

