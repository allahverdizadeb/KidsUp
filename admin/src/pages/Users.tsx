import { useState } from 'react';
import { listStaff } from '../api/users.ts';
import { PageHeader } from '../components/PageHeader.tsx';
import { Card } from '../components/ui/Card.tsx';
import { LoadError, Loading } from '../components/ui/Feedback.tsx';
import { Icon } from '../components/ui/Icon.tsx';
import { Avatar, Pill } from '../components/ui/Pill.tsx';
import { useAsync } from '../hooks/useAsync.ts';
import { useWidth } from '../hooks/useWidth.ts';
import { initials, lastSeen } from '../lib/format.ts';
import { ICON } from '../lib/icons.ts';
import { AVATARS } from '../lib/status.ts';
import { ROLE, ROLE_ORDER } from '../lib/roles.ts';
import { sx } from '../lib/sx.ts';
import { useAdmin } from '../state/useSession.ts';

const ACTIVE = { label: 'Aktiv', fg: '#0F6B43', bg: '#E8F6EE', dot: '#1F9D66' };
const SWITCHED_OFF = { label: 'Deaktiv', fg: '#5C5C5C', bg: '#F1F1F1', dot: '#A3A3A3' };

/**
 * Who has access to the panel. Read-only on purpose: the accounts are made and changed by the operator's command on the
 * server, so that nobody can give themselves, or anybody else, access from inside the panel.
 */
export default function Users() {
  const width = useWidth();
  const me = useAdmin();
  const staff = useAsync(() => listStaff());
  const members = staff.data?.items ?? [];
  const [now] = useState(() => new Date().toISOString());

  return (
    <>
      <PageHeader
        title="İstifadəçilər"
        sub="Admin panelə kimlərin daxil ola biləcəyi və nəyi idarə edə biləcəyi. Hesabları əməliyyat əmri ilə serverdə yaradılır, paneldən dəyişdirilmir."
      />
      {staff.error && !staff.data ? (
        <LoadError error={staff.error} onRetry={staff.reload} />
      ) : !staff.data ? (
        <Loading />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, animation: 'kaFade .25s ease' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: width >= 1000 ? 'repeat(3,minmax(0,1fr))' : 'minmax(0,1fr)',
              gap: 14,
            }}
          >
            {ROLE_ORDER.map((role) => {
              const look = ROLE[role];
              return (
                <Card
                  key={role}
                  labelledBy={`role-${role}`}
                  style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <span
                      id={`role-${role}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                    >
                      <span
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 10,
                          background: look.bg,
                          color: look.fg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon d={look.icon} size={16} strokeWidth={2} />
                      </span>
                      {look.label}
                    </span>
                    <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {members.filter((member) => member.role === role).length}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      lineHeight: 1.5,
                      fontWeight: 600,
                      color: '#6B6B6B',
                      textWrap: 'pretty',
                    }}
                  >
                    {look.description}
                  </span>
                </Card>
              );
            })}
          </div>

          <Card labelledBy="staff-heading" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <h2 id="staff-heading" style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                Panel istifadəçiləri
              </h2>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#6B6B6B' }}>
                {members.length} istifadəçi · {members.filter((member) => !member.is_active).length} deaktiv
              </span>
            </div>
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                padding: '0 12px 12px',
              }}
            >
              {members.map((member, index) => {
                const [background, color] = AVATARS[index % AVATARS.length] as [string, string];
                const mine = member.email === me.email;
                return (
                  <li
                    key={member.id}
                    {...sx(
                      {
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '9px 12px',
                        borderRadius: 12,
                        flexWrap: width >= 900 ? 'nowrap' : 'wrap',
                        transition: 'background .12s',
                      },
                      { background: '#FAFAFA' },
                    )}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 220 }}>
                      <Avatar
                        initials={initials(member.display_name)}
                        background={background}
                        color={color}
                        size={42}
                      />
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 14,
                            fontWeight: 800,
                          }}
                        >
                          <span
                            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {member.display_name}
                          </span>
                          {mine && (
                            <span
                              style={{
                                padding: '2px 7px',
                                borderRadius: 6,
                                background: '#1A1A1A',
                                color: '#FFFFFF',
                                fontSize: 10,
                                fontWeight: 800,
                                flexShrink: 0,
                              }}
                            >
                              Siz
                            </span>
                          )}
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: '#6B6B6B',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {member.email}
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        flexShrink: 0,
                        marginLeft: 'auto',
                      }}
                    >
                      <Pill look={member.is_active ? ACTIVE : SWITCHED_OFF} />
                      {width >= 820 && (
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: '#6B6B6B',
                            whiteSpace: 'nowrap',
                            minWidth: 120,
                            textAlign: 'right',
                          }}
                        >
                          {lastSeen(member.last_login_at, now)}
                        </span>
                      )}
                      <span
                        style={{
                          height: 36,
                          padding: '0 12px',
                          border: '1px solid #E3E3E3',
                          borderRadius: 10,
                          background: '#FFFFFF',
                          fontSize: 13,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        {ROLE[member.role].label}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              padding: '12px 14px',
              borderRadius: 12,
              background: '#FFFFFF',
              border: '1px solid #EDEDED',
              fontSize: 13,
              lineHeight: 1.55,
              fontWeight: 600,
              color: '#4A4A4A',
            }}
          >
            <Icon
              d={ICON.info}
              size={16}
              stroke="#6B6B6B"
              strokeWidth={2}
              style={{ flexShrink: 0, marginTop: 2 }}
            />
            <span>
              Yeni hesab və ya rol dəyişikliyi serverdə əmrlə edilir:{' '}
              <code style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 12 }}>
                docker compose exec panel python -m app.panel.cli
              </code>
              . Hər hesabın şifrəsi və autentifikator kodu var; paylaşılmır.
            </span>
          </div>
        </div>
      )}
    </>
  );
}
