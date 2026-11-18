import type { FC } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAcceptInvitation, useInvitationPreview } from "@/features/organizations/hooks/use-organizations";
import { useSessionBootstrap } from "@/components/layout/session-gate";
import { useAuthStore, AuthStatuses } from "@/stores/auth";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { OrgRoleFormOptions } from "@/config/constants/dropdowns/organizations/organization-form.options";
import { formatDate } from "@/lib/date";
import { Routes } from "@/routes/routes";
import { AuthLayout } from "@/pages/auth/components/auth-layout";

/** §5.2: shows who invited them, the organisation and the role; people without an account create one while accepting. */
const InvitePage: FC = () => {
  const { token = "" } = useParams();
  const status = useSessionBootstrap();
  const user = useAuthStore((s) => s.user);
  const { data, isPending, error } = useInvitationPreview(token);
  const accept = useAcceptInvitation();
  const navigate = useNavigate();
  const here = Routes.invite(token);

  if (isPending || status === AuthStatuses.UNKNOWN)
    return (
      <AuthLayout title="Joining…">
        <div className="space-y-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      </AuthLayout>
    );

  if (error || !data)
    return (
      <AuthLayout title="This invitation can't be used" subtitle={(error as Error)?.message ?? "It may have expired or been cancelled. Ask for a new one."}>
        <Button asChild size="lg" className="w-full">
          <Link to={Routes.home}>Go to Agent Space</Link>
        </Button>
      </AuthLayout>
    );

  const inviter = data.invited_by?.name || data.invited_by?.email;
  return (
    <AuthLayout
      title={`Join ${data.organization.name}`}
      subtitle={
        <>
          {inviter ? <strong className="text-ink">{inviter}</strong> : "You"} invited you as <strong className="text-ink">{getDropdownOptionLabel(OrgRoleFormOptions, data.role)}</strong>. Expires {formatDate(data.expires_at)}.
        </>
      }
    >
      <div className="mb-6 flex items-center gap-3 rounded-[20px] border border-hairline bg-surface p-4 shadow-sticker">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] font-display text-xl font-extrabold text-white" style={{ backgroundColor: data.organization.brand_color || "#1C1633" }}>
          {data.organization.name.slice(0, 1)}
        </span>
        <div>
          <p className="font-bold text-ink">{data.organization.name}</p>
          {data.email && <p className="text-sm text-muted-foreground">Invitation for {data.email}</p>}
        </div>
      </div>
      {status === AuthStatuses.SIGNED_IN ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Signed in as {user?.email}</p>
          <Button size="lg" className="w-full" loading={accept.isPending} onClick={() => accept.mutate(token, { onSuccess: () => navigate(Routes.chat.root, { replace: true }) })}>
            Accept invitation
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Button asChild size="lg" className="w-full">
            <Link to={`${Routes.auth.sign_up}?invitation=${encodeURIComponent(token)}${data.email ? `&email=${encodeURIComponent(data.email)}` : ""}`}>Create an account and join</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full">
            <Link to={`${Routes.auth.sign_in}?next=${encodeURIComponent(here)}`}>I already have an account</Link>
          </Button>
        </div>
      )}
    </AuthLayout>
  );
};

export default InvitePage;
