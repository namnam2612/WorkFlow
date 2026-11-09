import { Briefcase, GitFork, Globe, Mail, Phone, UserRound, type LucideIcon } from 'lucide-react';
import type { User } from '../../types/api';

type ContactFields = Pick<User, 'jobTitle' | 'phone' | 'contactEmail' | 'email' | 'bio' | 'githubUrl' | 'linkedinUrl' | 'facebookUrl'>;

function shortUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
}

function Row({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.08] text-slate-500">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[1px] text-slate-500">{label}</p>
        <div className="truncate text-slate-800">{children}</div>
      </div>
    </li>
  );
}

const linkClass = 'link-underline !normal-case !tracking-normal hover:text-white';

/** Thông tin liên hệ/hồ sơ hiển thị cho đồng đội. Chỉ hiện những trường đã điền. */
export function ContactInfo({ user }: { user: ContactFields }) {
  const email = user.contactEmail ?? user.email;
  return (
    <div className="grid gap-5 md:grid-cols-[1fr_1.2fr]">
      <div>
        {user.jobTitle && <p className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-800"><UserRound className="h-4 w-4 text-slate-500" aria-hidden />{user.jobTitle}</p>}
        <p className="whitespace-pre-line text-[15px] leading-[1.65] text-muted">{user.bio || 'Chưa có giới thiệu.'}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        <Row icon={Mail} label="Email">
          <a href={`mailto:${email}`} className={linkClass}>
            {email}
          </a>
        </Row>
        {user.phone && (
          <Row icon={Phone} label="Điện thoại">
            <a href={`tel:${user.phone.replace(/[^0-9+]/g, '')}`} className={linkClass}>
              {user.phone}
            </a>
          </Row>
        )}
        {user.githubUrl && (
          <Row icon={GitFork} label="GitHub">
            <a href={user.githubUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {shortUrl(user.githubUrl)}
            </a>
          </Row>
        )}
        {user.linkedinUrl && (
          <Row icon={Briefcase} label="LinkedIn">
            <a href={user.linkedinUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {shortUrl(user.linkedinUrl)}
            </a>
          </Row>
        )}
        {user.facebookUrl && (
          <Row icon={Globe} label="Facebook">
            <a href={user.facebookUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {shortUrl(user.facebookUrl)}
            </a>
          </Row>
        )}
      </ul>
    </div>
  );
}
