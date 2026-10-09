import { useEffect, useRef } from "react";

import { supabase } from "../lib/supabase";

export function useInventoryRealtime(
  businessId: string,
  branchIds: string[],
  onChange: () => void | Promise<void>
) {
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const branchScope = [...new Set(branchIds)].sort().join(",");

  useEffect(() => {
    if (!businessId || !branchScope) return;

    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const requestRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        if (active) void onChangeRef.current();
      }, 75);
    };
    const channels = branchScope.split(",").map((branchId) =>
      supabase
        .channel(`inventory-products-${businessId}-${branchId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "products",
            filter: `branch_id=eq.${branchId}`,
          },
          () => {
            if (active) requestRefresh();
          }
        )
        .subscribe((status) => {
          if (!active) return;
          if (status === "SUBSCRIBED") {
            console.info("Inventory realtime channel subscribed", {
              business_id: businessId,
              branch_id: branchId,
              table: "products",
            });
            requestRefresh();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error("Inventory realtime channel unavailable", {
              business_id: businessId,
              branch_id: branchId,
              status,
            });
          }
        })
    );

    const refreshWhenAvailable = () => {
      if (document.visibilityState === "visible") {
        void onChangeRef.current();
      }
    };

    const poll = window.setInterval(refreshWhenAvailable, 30000);
    window.addEventListener("online", refreshWhenAvailable);
    window.addEventListener("pageshow", refreshWhenAvailable);
    document.addEventListener("visibilitychange", refreshWhenAvailable);

    return () => {
      active = false;
      window.clearInterval(poll);
      if (refreshTimer) clearTimeout(refreshTimer);
      window.removeEventListener("online", refreshWhenAvailable);
      window.removeEventListener("pageshow", refreshWhenAvailable);
      document.removeEventListener("visibilitychange", refreshWhenAvailable);
      channels.forEach((channel) => void supabase.removeChannel(channel));
    };
  }, [businessId, branchScope]);
}