import type { Metadata } from "next";
import { AccountSettings } from "@/components/admin/forms";
import { Badge, Notice, PageHeader, Panel } from "@/components/admin/ui";
import { commerce } from "@/content/commerce";
import { brand, copy } from "@/content/copy";
import { formatUzs } from "@/lib/money";
import { requireAdminPage } from "@/server/auth";

export const metadata: Metadata = { title: copy.admin.pages.settings };

const text = copy.admin.settings;

/**
 * The store's configuration as it stands, read-only because it lives in code, and the signed-in
 * member's own account. Nothing here pretends to configure a feature that does not exist.
 */
export default async function AdminSettings() {
  const session = await requireAdminPage();

  return (
    <>
      <PageHeader kicker={text.kicker} title={text.title} lead={text.lead} />
      <div className="admin-grid-2">
        <Panel title={text.store}>
          <dl className="admin-facts">
            <div>
              <dt>{text.storeName}</dt>
              <dd>{brand.name}</dd>
            </div>
            <div>
              <dt>{text.currency}</dt>
              <dd>{commerce.currency} (soʻm)</dd>
            </div>
            <div>
              <dt>{text.locale}</dt>
              <dd>{text.localeValue}</dd>
            </div>
            <div>
              <dt>{text.lowStock}</dt>
              <dd className="tabular-nums">{commerce.lowStockAt}</dd>
            </div>
            <div>
              <dt>{text.delivery}</dt>
              <dd>
                {commerce.deliveryZones.map((zone) => (
                  <span key={zone.id} className="admin-block tabular-nums">
                    {zone.label}: {formatUzs(zone.priceUzs)}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt>{text.payment}</dt>
              <dd>{text.paymentValue}</dd>
            </div>
            <div>
              <dt>{text.notifications}</dt>
              <dd>{text.notificationsValue}</dd>
            </div>
          </dl>
        </Panel>
        <Panel title={text.account}>
          <dl className="admin-facts">
            <div>
              <dt>{copy.admin.team.email}</dt>
              <dd>{session.email}</dd>
            </div>
            <div>
              <dt>{text.role}</dt>
              <dd>
                <Badge tone="info">{copy.admin.roles[session.role]}</Badge> <span className="text-muted">{copy.admin.roleNotes[session.role]}</span>
              </dd>
            </div>
          </dl>
          <AccountSettings />
        </Panel>
      </div>
      <Notice>{text.secrets}</Notice>
    </>
  );
}
