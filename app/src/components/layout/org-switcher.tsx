import type { FC } from "react";
import { Building2, Check, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import UnsavedChangesDialog from "@/components/ui/unsaved-changes-dialog";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useMe } from "@/features/users/hooks/use-users";
import { useCreateOrganization, useSwitchOrganization } from "@/features/organizations/hooks/use-organizations";
import { useOrganizationStore } from "@/stores/organization";
import { Routes } from "@/routes/routes";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { OrgRoleFormOptions } from "@/config/constants/dropdowns/organizations/organization-form.options";
import { cn } from "@/lib/utils";

const schema = z.object({ name: z.string().trim().min(1, "Give it a name").max(80) });
type Values = z.infer<typeof schema>;

const OrgMarkSizes = { SM: "sm", MD: "md" } as const;
type OrgMarkSize = (typeof OrgMarkSizes)[keyof typeof OrgMarkSizes];

const OrgMark: FC<{ name: string; color?: string | null; size?: OrgMarkSize }> = ({ name, color, size = OrgMarkSizes.MD }) => (
  <span className={cn("inline-flex shrink-0 items-center justify-center rounded-md font-display font-extrabold text-white", size === OrgMarkSizes.MD ? "h-9 w-9 text-base" : "h-7 w-7 text-xs")} style={{ backgroundColor: color || "#1C1633" }}>
    {name.slice(0, 1).toUpperCase()}
  </span>
);

/**
 * Organisation section of the account menu: shows the current organisation and opens a submenu to switch,
 * create one, or open organisation settings. Must be rendered inside a DropdownMenuContent.
 */
export const OrgSubmenu: FC<{ onCreate: () => void }> = ({ onCreate }) => {
  const { data } = useMe();
  const currentId = useOrganizationStore((s) => s.current_id);
  const switchOrg = useSwitchOrganization();
  const navigate = useNavigate();
  const orgs = data?.organizations ?? [];
  const current = orgs.find((o) => o.id === currentId);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2.5 rounded-sm py-1.5">
        <OrgMark name={current?.name ?? "A"} color={current?.brand_color} size={OrgMarkSizes.SM} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{current?.name ?? "Agent Space"}</span>
          <span className="block truncate text-xs text-muted-foreground">{getDropdownOptionLabel(OrgRoleFormOptions, current?.role)}</span>
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-72 rounded-md p-1.5 shadow-pop">
        <DropdownMenuLabel className="eyebrow px-2">Organisations</DropdownMenuLabel>
        {orgs.map((o) => (
          <DropdownMenuItem key={o.id} onSelect={() => o.id !== currentId && (switchOrg(o.id), navigate(Routes.chat.root))} className="gap-2.5 rounded-sm py-2">
            <OrgMark name={o.name} color={o.brand_color} size={OrgMarkSizes.SM} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{o.name}</span>
              <span className="block text-xs text-muted-foreground">
                {getDropdownOptionLabel(OrgRoleFormOptions, o.role)} · {o.member_count} {o.member_count === 1 ? "member" : "members"}
              </span>
            </span>
            {o.id === currentId && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onCreate} className="gap-2 rounded-sm py-2">
          <Plus className="h-4 w-4" /> Create organisation
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate(Routes.settings.organization)} className="gap-2 rounded-sm py-2">
          <Building2 className="h-4 w-4" /> Organisation settings
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};

/** Create-organisation dialog. Lives outside the account menu so it survives the menu closing. */
export const CreateOrganizationDialog: FC<{ open: boolean; onOpenChange: (open: boolean) => void }> = ({ open, onOpenChange }) => {
  const navigate = useNavigate();
  const create = useCreateOrganization();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "" } });
  const { requestClose, dialogProps } = useUnsavedChangesGuard({
    isDirty: form.formState.isDirty,
    disabled: create.isPending,
    onClose: () => {
      form.reset();
      onOpenChange(false);
    },
  });

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : requestClose())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create an organisation</DialogTitle>
            <DialogDescription>A shared space for a company or team, with its own members, bots and connections.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              id="create-org"
              onSubmit={form.handleSubmit((v) =>
                create.mutate(v, {
                  onSuccess: () => {
                    form.reset();
                    onOpenChange(false);
                    navigate(Routes.settings.members);
                  },
                }),
              )}
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={requestClose} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" form="create-org" loading={create.isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
};
