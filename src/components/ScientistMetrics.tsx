import { useQuery } from "@tanstack/react-query";
import { getPublicationMetrics } from "@/lib/publication-metrics.functions";

export function ScientistMetrics({ authorIds, hIndex, citations, recentWorks }: { authorIds: string[]; hIndex: number; citations: number; recentWorks: number }) {
  const ids = [...new Set(authorIds.map((id) => id.split("/").pop() ?? "").filter((id) => /^A\d+$/.test(id)))].sort();
  const { data, isPending } = useQuery({
    queryKey: ["publication-metrics", ids],
    queryFn: () => getPublicationMetrics({ data: { authorIds: ids } }),
    enabled: ids.length > 0,
    staleTime: 86400_000,
  });
  const metrics = [
    { label: "h-index", value: hIndex, title: "h-index" },
    { label: "citations", value: citations.toLocaleString(), title: "Total citations" },
    { label: "papers, 3 yrs", value: data?.total ?? recentWorks, title: data ? `Publications since ${data.since}` : "Publications in the last three years" },
    { label: "OA, 3 yrs", value: data?.percentage != null ? `${data.percentage}%` : ids.length && isPending ? "…" : "—", title: data?.total != null ? `${data.open ?? "Unknown"} open-access publications out of ${data.total} since ${data.since}` : "Open-access percentage over the last three years unavailable" },
  ];
  return <div className="grid grid-cols-4 gap-2 text-center">{metrics.map((metric) => <div key={metric.label} title={metric.title} className="min-w-0 rounded-lg bg-secondary/60 py-2"><p className="break-words font-mono text-base">{metric.value}</p><p className="text-[11px] text-muted-foreground">{metric.label}</p></div>)}</div>;
}