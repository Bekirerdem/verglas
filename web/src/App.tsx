import { useEffect, useState } from "react";
import {
  fetchDashboard,
  fetchFallbackClearance,
  fetchTreasurer,
  type DashboardData,
  type FreshClearance,
  type TreasurerData,
} from "./lib/data";
import { I18nProvider } from "./lib/i18n";
import { LandingV3 } from "./v3/LandingV3";

const REFRESH_MS = 45_000;

function Page() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [fresh, setFresh] = useState<FreshClearance | null>(null);
  const [treasurer, setTreasurer] = useState<TreasurerData | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      // A failed read keeps the last good data on screen and stays silent —
      // the marketing page never surfaces an RPC error to a visitor.
      fetchDashboard().then(
        (d) => {
          if (!alive) return;
          setData(d);
          // Stale showcase stamp → read the keeper-fresh Fuji record so the
          // hero badge never opens the page on a red light.
          if (!d.cleared) {
            fetchFallbackClearance().then(
              (f) => {
                if (alive) setFresh(f);
              },
              () => {},
            );
          }
        },
        () => {},
      );
      fetchTreasurer().then(
        (v) => {
          if (alive) setTreasurer(v);
        },
        () => {},
      );
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return <LandingV3 data={data} fresh={fresh} treasurer={treasurer} />;
}

export default function App() {
  return (
    <I18nProvider>
      <Page />
    </I18nProvider>
  );
}
