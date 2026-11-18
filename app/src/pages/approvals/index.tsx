import { CheckCircle2, Coffee, ShieldCheck } from "lucide-react";
import { useState, type FC } from "react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useApprovals } from "@/features/tasks/hooks/use-tasks";
import { ApprovalCard } from "./components/approval-card";
import { ApprovalFilters, type ApprovalFilter } from "@/config/constants/filters";

const FILTERS = [
  { id: ApprovalFilters.PENDING, label: "Waiting for you" },
  { id: ApprovalFilters.ALL, label: "All" },
] as const;

const ApprovalsPage: FC = () => {
  const [status, setStatus] = useState<ApprovalFilter>(ApprovalFilters.PENDING);
  const { data, isPending } = useApprovals(status);
  return (
    <PageContainer>
      <PageHeader title="Approvals" description="Actions your bots want to take that need your OK first." />
      <SegmentedControl ariaLabel="Filter approvals" value={status} options={FILTERS} onChange={setStatus} className="mb-5" />
      {isPending ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-[20px]" />)}</div>
      ) : !data?.length ? (
        <EmptyState title="Nothing to approve" description="When a bot wants to send, post, delete or change something, you'll see it here." stickers={[{ icon: CheckCircle2, color: "#1FC98E" }, { icon: ShieldCheck, color: "#6B4EFF" }, { icon: Coffee, color: "#FF7A3D" }]} />
      ) : (
        <div className="max-w-[760px] space-y-4">{data.map((a) => <ApprovalCard key={a.id} approval={a} />)}</div>
      )}
    </PageContainer>
  );
};

export default ApprovalsPage;
