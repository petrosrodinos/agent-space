import type { FC } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PageContainer } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useApproval } from "@/features/tasks/hooks/use-tasks";
import { Routes } from "@/routes/routes";
import { ApprovalCard } from "../../components/approval-card";

const ApprovalDetailPage: FC = () => {
  const { approvalId = "" } = useParams();
  const { data, isPending, isError } = useApproval(approvalId);
  const navigate = useNavigate();
  return (
    <PageContainer>
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate(Routes.approvals.root)}>
        <ArrowLeft /> Approvals
      </Button>
      <div className="max-w-[760px]">
        {isPending ? <Skeleton className="h-56 rounded-[20px]" /> : isError || !data ? <EmptyState title="Approval not found" description="It may belong to someone else or no longer exist." /> : <ApprovalCard approval={data} />}
      </div>
    </PageContainer>
  );
};

export default ApprovalDetailPage;
