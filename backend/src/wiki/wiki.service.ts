import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { WikiPage } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user';
import { USER_BRIEF_SELECT } from '../common/utils/user-brief';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { CreateWikiPageDto, UpdateWikiPageDto } from './dto/wiki.dto';
import { slugify, uniqueSlug, wouldCreateTreeCycle } from './slug';

/** Chỉ giữ chừng này bản lưu cũ cho mỗi trang */
const MAX_REVISIONS = 30;

/** Trang mẫu tài liệu API, người dùng bấm "Dùng mẫu" khi tạo trang */
export const API_SPEC_TEMPLATE = `# Tên API

Mô tả ngắn gọn mục đích của API.

## Endpoint

\`\`\`
POST /api/duong-dan
\`\`\`

## Yêu cầu

| Tham số | Kiểu | Bắt buộc | Mô tả |
| --- | --- | --- | --- |
| \`name\` | string | có | Tên đối tượng |

\`\`\`json
{ "name": "Ví dụ" }
\`\`\`

## Phản hồi

**201 Created**

\`\`\`json
{ "id": 1, "name": "Ví dụ" }
\`\`\`

## Lỗi

| Mã | Ý nghĩa |
| --- | --- |
| 400 | Dữ liệu không hợp lệ |
| 403 | Không có quyền |
`;

@Injectable()
export class WikiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  /** Cây trang (không kèm nội dung) để dựng thanh điều hướng */
  async tree(user: AuthUser, projectId: number) {
    await this.access.assertCanView(user, projectId);
    return this.prisma.wikiPage.findMany({
      where: { projectId },
      select: { id: true, parentId: true, title: true, slug: true, position: true, updatedAt: true },
      orderBy: [{ position: 'asc' }, { title: 'asc' }],
    });
  }

  async get(user: AuthUser, id: number) {
    const page = await this.findOrThrow(id);
    await this.access.assertCanView(user, page.projectId);
    const authors = await this.prisma.user.findMany({ where: { id: { in: [page.createdById, page.updatedById] } }, select: USER_BRIEF_SELECT });
    const by = (uid: number) => authors.find((a) => a.id === uid) ?? null;
    return { ...page, createdBy: by(page.createdById), updatedBy: by(page.updatedById) };
  }

  /** Mọi thành viên dự án đều soạn được tài liệu (QA, dev, ...) */
  async create(user: AuthUser, projectId: number, dto: CreateWikiPageDto): Promise<WikiPage> {
    await this.access.assertCanView(user, projectId);
    if (dto.parentId !== undefined && dto.parentId !== null) await this.assertParent(projectId, dto.parentId);
    const slug = await this.freeSlug(projectId, slugify(dto.title));
    return this.prisma.wikiPage.create({
      data: { projectId, parentId: dto.parentId ?? null, title: dto.title, slug, content: dto.content ?? '', createdById: user.id, updatedById: user.id },
    });
  }

  async update(user: AuthUser, id: number, dto: UpdateWikiPageDto): Promise<WikiPage> {
    const page = await this.findOrThrow(id);
    await this.access.assertCanView(user, page.projectId);
    if (dto.expectedUpdatedAt && new Date(dto.expectedUpdatedAt).getTime() !== page.updatedAt.getTime()) {
      throw new ConflictException('Trang đã được người khác chỉnh sửa trong lúc bạn soạn. Hãy tải lại để xem thay đổi mới.');
    }
    if (dto.parentId !== undefined && dto.parentId !== page.parentId) {
      if (dto.parentId !== null) await this.assertParent(page.projectId, dto.parentId);
      const all = await this.prisma.wikiPage.findMany({ where: { projectId: page.projectId }, select: { id: true, parentId: true } });
      if (wouldCreateTreeCycle(new Map(all.map((p) => [p.id, p.parentId])), id, dto.parentId)) throw new BadRequestException('Không thể chuyển trang vào chính nó hoặc trang con của nó');
    }

    const titleChanged = dto.title !== undefined && dto.title !== page.title;
    const contentChanged = dto.content !== undefined && dto.content !== page.content;
    if (!titleChanged && !contentChanged && dto.parentId === undefined) return page;

    return this.prisma.$transaction(async (tx) => {
      if (titleChanged || contentChanged) {
        await tx.wikiRevision.create({ data: { pageId: id, title: page.title, content: page.content, authorId: page.updatedById } });
        const old = await tx.wikiRevision.findMany({ where: { pageId: id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: MAX_REVISIONS, select: { id: true } });
        if (old.length > 0) await tx.wikiRevision.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });
      }
      return tx.wikiPage.update({
        where: { id },
        data: { title: dto.title, content: dto.content, parentId: dto.parentId, updatedById: user.id },
      });
    });
  }

  /** Xóa trang: trang con được chuyển lên cấp của trang bị xóa (không mất dữ liệu). Người tạo hoặc leader/admin. */
  async remove(user: AuthUser, id: number): Promise<void> {
    const page = await this.findOrThrow(id);
    const project = await this.access.assertCanView(user, page.projectId);
    if (page.createdById !== user.id && !this.access.canManage(user, project)) throw new ForbiddenException('Chỉ người tạo, trưởng nhóm hoặc quản trị viên mới được xóa trang');
    await this.prisma.$transaction(async (tx) => {
      await tx.wikiPage.updateMany({ where: { parentId: id }, data: { parentId: page.parentId } });
      await tx.wikiPage.delete({ where: { id } });
    });
  }

  async revisions(user: AuthUser, id: number) {
    const page = await this.findOrThrow(id);
    await this.access.assertCanView(user, page.projectId);
    const items = await this.prisma.wikiRevision.findMany({ where: { pageId: id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_REVISIONS });
    const authors = await this.prisma.user.findMany({ where: { id: { in: [...new Set(items.map((r) => r.authorId))] } }, select: USER_BRIEF_SELECT });
    return items.map((r) => ({ ...r, author: authors.find((a) => a.id === r.authorId) ?? null }));
  }

  /** Khôi phục một bản cũ: nội dung hiện tại được lưu thành bản mới trước khi ghi đè */
  async restore(user: AuthUser, id: number, revisionId: number): Promise<WikiPage> {
    const revision = await this.prisma.wikiRevision.findUnique({ where: { id: revisionId } });
    if (!revision || revision.pageId !== id) throw new NotFoundException('Không tìm thấy bản lưu');
    return this.update(user, id, { title: revision.title, content: revision.content });
  }

  // ---------------------------------------------------------------- helpers

  private async findOrThrow(id: number): Promise<WikiPage> {
    const page = await this.prisma.wikiPage.findUnique({ where: { id } });
    if (!page) throw new NotFoundException('Không tìm thấy trang');
    return page;
  }

  private async assertParent(projectId: number, parentId: number): Promise<void> {
    const parent = await this.prisma.wikiPage.findUnique({ where: { id: parentId }, select: { projectId: true } });
    if (!parent || parent.projectId !== projectId) throw new BadRequestException('Trang cha không thuộc dự án này');
  }

  private async freeSlug(projectId: number, base: string): Promise<string> {
    const taken = await this.prisma.wikiPage.findMany({ where: { projectId, slug: { startsWith: base } }, select: { slug: true } });
    return uniqueSlug(base, new Set(taken.map((t) => t.slug)));
  }
}
