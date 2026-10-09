import { NavLink } from "react-router-dom";
const destinations = [["/dashboard", "Dashboard"], ["/inventory", "Inventory"], ["/analytics", "Analytics"], ["/reports", "Reports"], ["/settings", "Settings"]];
export default function SmallWindowNavigation() {
 return <nav aria-label="Small window navigation" className="mb-4 flex flex-wrap gap-2 lg:hidden">
  {destinations.map(([to,label])=><NavLink key={to} to={to} className={({isActive})=>"rounded-lg border px-3 py-2 text-sm font-medium "+(isActive?"border-indigo-600 bg-indigo-600 text-white":"border-slate-200 bg-white text-slate-700")}>{label}</NavLink>)}
 </nav>;
}
