import type { Metadata } from "next";
import { emptyEditorValues, ProductEditor } from "@/components/admin/product-editor";
import { NoAccess, PageHeader } from "@/components/admin/ui";
import { copy } from "@/content/copy";
import { can } from "@/lib/admin-roles";
import { categoryNames } from "@/server/admin/queries";
import { requireAdminPage } from "@/server/auth";

export const metadata: Metadata = { title: copy.admin.editor.newTitle };

export default async function NewProduct() {
  const session = await requireAdminPage();
  if (!can(session.role, "catalog")) return <NoAccess />;
  const categories = await categoryNames();
  const text = copy.admin.editor;
  return (
    <>
      <PageHeader kicker={copy.admin.products.kicker} title={text.newTitle} lead={text.newLead} />
      <ProductEditor mode="create" initial={emptyEditorValues} categories={categories} />
    </>
  );
}
