import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AttachmentsService } from '../attachments/attachments.service';
import { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { relevance, snippet, termVariants, tokenize } from './search-text';

export type SearchKind = 'task' | 'wiki' | 'testCase' | 'release' | 'file' | 'comment';

export interface SearchHit {
  kind: SearchKind;
  id: number;
  title: string;
  snippet: string;
  projectId: number;
  projectName: string;
  /** Đường dẫn trong ứng dụng */
  link: string;
  score: number;
}

const PER_KIND_FETCH = 30;
const PER_KIND_RETURN = 8;

/** AND giữa các từ khóa; mỗi từ khóa khớp ở BẤT KỲ trường nào. MySQL utf8mb4_unicode_ci cho so khớp không phân biệt hoa/thường và dấu. */
const allTerms = <T>(terms: string[], fields: (keyof T & string)[]): Record<string, unknown>[] =>
  terms.map((term) => ({ OR: termVariants(term).flatMap((variant) => fields.map((f) => ({ [f]: { contains: variant } }))) }));

/** Tìm kiếm xuyên dự án: việc, bình luận, tài liệu wiki, test case, phiên bản, file — chỉ trong những gì người dùng được xem */
@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly attachments: AttachmentsService,
  ) {}

  async search(user: AuthUser, query: string, projectId?: number) {
    const terms = tokenize(query);
    if (terms.length === 0) return { query, terms, total: 0, groups: [] as { kind: SearchKind; hits: SearchHit[] }[] };
    if (projectId !== undefined) await this.access.assertCanView(user, projectId);

    const project: Prisma.ProjectWhereInput = { AND: [this.access.visibleProjectWhere(user), projectId !== undefined ? { id: projectId } : {}] };
    const [tasks, comments, wiki, testCases, releases, files] = await Promise.all([
      this.prisma.task.findMany({
        where: { project, AND: allTerms<Prisma.TaskWhereInput>(terms, ['title', 'description']) },
        select: { id: true, title: true, description: true, projectId: true, project: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: PER_KIND_FETCH,
      }),
      this.prisma.comment.findMany({
        where: { task: { project }, AND: allTerms<Prisma.CommentWhereInput>(terms, ['content']) },
        select: { id: true, content: true, taskId: true, task: { select: { title: true, projectId: true, project: { select: { name: true } } } } },
        orderBy: { id: 'desc' },
        take: PER_KIND_FETCH,
      }),
      this.prisma.wikiPage.findMany({
        where: { project, AND: allTerms<Prisma.WikiPageWhereInput>(terms, ['title', 'content']) },
        select: { id: true, title: true, content: true, projectId: true, project: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: PER_KIND_FETCH,
      }),
      this.prisma.testCase.findMany({
        where: { project, archived: false, AND: allTerms<Prisma.TestCaseWhereInput>(terms, ['title', 'steps', 'expected']) },
        select: { id: true, title: true, steps: true, projectId: true, project: { select: { name: true } } },
        take: PER_KIND_FETCH,
      }),
      this.prisma.release.findMany({
        where: { project, AND: allTerms<Prisma.ReleaseWhereInput>(terms, ['version', 'name', 'description']) },
        select: { id: true, version: true, name: true, description: true, projectId: true, project: { select: { name: true } } },
        take: PER_KIND_FETCH,
      }),
      this.prisma.attachment.findMany({
        where: { AND: [this.attachments.visibleWhere(user), ...(projectId !== undefined ? [{ OR: [{ projectId }, { task: { projectId } }] }] : []), ...allTerms<Prisma.AttachmentWhereInput>(terms, ['originalName'])] },
        select: { id: true, originalName: true, projectId: true, task: { select: { id: true, title: true, projectId: true, project: { select: { name: true } } } }, project: { select: { id: true, name: true } } },
        orderBy: { id: 'desc' },
        take: PER_KIND_FETCH,
      }),
    ]);

    const rank = (hits: SearchHit[]): SearchHit[] => hits.sort((a, b) => b.score - a.score || b.id - a.id).slice(0, PER_KIND_RETURN);
    const all: { kind: SearchKind; hits: SearchHit[] }[] = [
      {
        kind: 'task',
        hits: rank(tasks.map((t) => ({ kind: 'task' as const, id: t.id, title: t.title, snippet: snippet(terms, t.description ?? ''), projectId: t.projectId, projectName: t.project.name, link: `/tasks/${t.id}`, score: relevance(terms, t.title, t.description ?? '') }))),
      },
      {
        kind: 'wiki',
        hits: rank(wiki.map((w) => ({ kind: 'wiki' as const, id: w.id, title: w.title, snippet: snippet(terms, w.content), projectId: w.projectId, projectName: w.project.name, link: `/projects/${w.projectId}/wiki/${w.id}`, score: relevance(terms, w.title, w.content) }))),
      },
      {
        kind: 'comment',
        hits: rank(comments.map((c) => ({ kind: 'comment' as const, id: c.id, title: `Bình luận trong "${c.task.title}"`, snippet: snippet(terms, c.content), projectId: c.task.projectId, projectName: c.task.project.name, link: `/tasks/${c.taskId}`, score: relevance(terms, '', c.content) }))),
      },
      {
        kind: 'testCase',
        hits: rank(testCases.map((t) => ({ kind: 'testCase' as const, id: t.id, title: t.title, snippet: snippet(terms, t.steps), projectId: t.projectId, projectName: t.project.name, link: `/projects/${t.projectId}/qa`, score: relevance(terms, t.title, t.steps) }))),
      },
      {
        kind: 'release',
        hits: rank(releases.map((r) => ({ kind: 'release' as const, id: r.id, title: `${r.version}${r.name ? ` — ${r.name}` : ''}`, snippet: snippet(terms, r.description ?? ''), projectId: r.projectId, projectName: r.project.name, link: `/projects/${r.projectId}/releases/${r.id}`, score: relevance(terms, `${r.version} ${r.name ?? ''}`, r.description ?? '') }))),
      },
      {
        kind: 'file',
        hits: rank(
          files.map((f) => {
            const owner = f.task ? { id: f.task.projectId, name: f.task.project.name, link: `/files/tasks/${f.task.id}`, where: `Công việc "${f.task.title}"` } : { id: f.project?.id ?? 0, name: f.project?.name ?? '', link: `/files/projects/${f.project?.id ?? 0}/common`, where: 'File chung của dự án' };
            return { kind: 'file' as const, id: f.id, title: f.originalName, snippet: owner.where, projectId: owner.id, projectName: owner.name, link: owner.link, score: relevance(terms, f.originalName, '') };
          }),
        ),
      },
    ];
    const groups = all.filter((g) => g.hits.length > 0);
    return { query, terms, total: groups.reduce((s, g) => s + g.hits.length, 0), groups };
  }
}
