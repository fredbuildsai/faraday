import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setFeedback } from "@/lib/opportunities.functions";

export function Thumbs({ type, id, value }: { type: "match" | "opportunity"; id: string; value: number }) {
  const send = useServerFn(setFeedback);
  const qc = useQueryClient();
  async function vote(v: 1 | -1) {
    try { await send({ data: { targetType: type, targetId: id, value: v } }); await qc.invalidateQueries({ queryKey: ["my-feedback"] }); }
    catch { toast.error("Could not save your vote."); }
  }
  return (
    <div className="flex gap-1">
      <Button variant={value === 1 ? "secondary" : "ghost"} size="icon" aria-label="Helpful" onClick={() => vote(1)}><ThumbsUp className="h-4 w-4" /></Button>
      <Button variant={value === -1 ? "secondary" : "ghost"} size="icon" aria-label="Not helpful" onClick={() => vote(-1)}><ThumbsDown className="h-4 w-4" /></Button>
    </div>
  );
}
