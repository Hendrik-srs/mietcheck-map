import { createStaticClient } from "@/lib/supabase/static";

export type DataSourceType =
  | "mietspiegel"
  | "destatis"
  | "bbsr"
  | "gutachterausschuss"
  | "public_company_report"
  | "market_report"
  | "open_data"
  | "crowdsourced";

export interface DataSource {
  id: string;
  name: string;
  publisher: string;
  source_url: string | null;
  license: string | null;
  source_type: DataSourceType;
  reference_date: string | null;
  fetched_at: string;
  notes: string | null;
}

/**
 * Fetches every registered data source. Used by /quellen for the
 * transparency table. Sorted by source type so related entries cluster.
 */
export async function getAllDataSources(): Promise<DataSource[]> {
  const supabase = createStaticClient();
  const { data, error } = await supabase
    .from("data_sources")
    .select(
      "id, name, publisher, source_url, license, source_type, reference_date, fetched_at, notes",
    )
    .order("source_type", { ascending: true })
    .order("reference_date", { ascending: false, nullsFirst: false });

  if (error) throw error;
  return (data ?? []) as DataSource[];
}

export const SOURCE_TYPE_LABELS: Record<DataSourceType, string> = {
  mietspiegel: "Mietspiegel",
  destatis: "Statistisches Bundesamt",
  bbsr: "BBSR",
  gutachterausschuss: "Gutachterausschuss",
  public_company_report: "Geschäftsbericht",
  market_report: "Marktbericht",
  open_data: "Open Data",
  crowdsourced: "Crowdsourced",
};
