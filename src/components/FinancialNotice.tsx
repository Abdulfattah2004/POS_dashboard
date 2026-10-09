export function FinancialNotice({error,historical,stockIssues=0}:{error:string;historical:Record<string,unknown[]>|null;stockIssues?:number}) {
 const count=historical?(historical.sales?.length??0)+(historical.refunds?.length??0):0;
 function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(historical,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='unverified-historical-records.json';link.click();URL.revokeObjectURL(url);}
 return <aside className="m-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm" role="status">
 {error?<p role="alert">{error} Reports below may be stale or unavailable.</p>:<p>Financial figures show verified synchronized sales minus refunds in USD base prices. Refunds are dated when issued; settlement currency is retained in exports.</p>}
 {stockIssues>0&&<p>{stockIssues} products have negative recorded stock. Negative stock requires the reviewed branch stock policy. These quantities have been preserved; historical differences still require reconciliation.</p>}
 {count>0&&<p>{count} unverified historical sales/refunds are preserved separately and excluded from verified totals. Their original amounts and items remain available. <button className="underline" onClick={download}>Download original historical records</button></p>}
 </aside>;
}
