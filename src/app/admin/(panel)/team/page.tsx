import type { Metadata } from "next";
import { AddMemberForm, MemberControls } from "@/components/admin/forms";
import { Badge, formatDate, NoAccess, Notice, PageHeader, Panel } from "@/components/admin/ui";
import { copy } from "@/content/copy";
import { ADMIN_ROLES, can } from "@/lib/admin-roles";
import { teamList } from "@/server/admin/queries";
import { requireAdminPage } from "@/server/auth";

export const metadata: Metadata = { title: copy.admin.pages.team };

const text = copy.admin.team;

/** Who can open the panel and with which role. Owners only; no public sign-up exists. */
export default async function AdminTeam() {
  const session = await requireAdminPage();
  if (!can(session.role, "team")) return <NoAccess />;
  const members = await teamList();

  return (
    <>
      <PageHeader kicker={text.kicker} title={text.title} lead={text.lead} />
      <Notice>{text.bootstrap}</Notice>
      <div className="admin-edit-layout">
        <div className="admin-edit-main">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">{text.columns.member}</th>
                  <th scope="col">{text.columns.role}</th>
                  <th scope="col">{text.columns.since}</th>
                  <th scope="col" className="admin-num">
                    {text.columns.sessions}
                  </th>
                  <th scope="col">
                    <span className="sr-only">{copy.admin.common.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      {member.email}
                      {member.id === session.adminUserId ? (
                        <>
                          {" "}
                          <Badge tone="info">{text.you}</Badge>
                        </>
                      ) : null}
                    </td>
                    <td>
                      <Badge tone={member.role === "owner" ? "ok" : "muted"}>{copy.admin.roles[member.role]}</Badge>
                    </td>
                    <td className="text-muted tabular-nums">{formatDate(member.createdAt)}</td>
                    <td className="admin-num tabular-nums">{member.sessions}</td>
                    <td>{member.id === session.adminUserId ? null : <MemberControls id={member.id} email={member.email} role={member.role} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Panel title={text.permissions}>
            <dl className="admin-facts">
              {ADMIN_ROLES.map((role) => (
                <div key={role}>
                  <dt>{copy.admin.roles[role]}</dt>
                  <dd>{copy.admin.roleNotes[role]}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
        <aside className="admin-edit-side">
          <Panel title={text.add}>
            <AddMemberForm />
          </Panel>
        </aside>
      </div>
    </>
  );
}
