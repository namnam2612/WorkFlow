export interface PptxSlide {
  number: number;
  title: string;
  paragraphs: string[];
  /** data: URL của ảnh trong slide (chỉ ảnh raster nhỏ) */
  images: string[];
}

const IMAGE_MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };
const MAX_SLIDES = 100;
const MAX_IMAGES_PER_SLIDE = 4;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const P_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, 'application/xml');
}

/** Đường dẫn tương đối trong gói OOXML ("../media/a.png" so với "ppt/slides") */
function resolvePath(baseDir: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = baseDir.split('/').filter(Boolean);
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

function paragraphsOf(root: Element): string[] {
  const out: string[] = [];
  for (const p of Array.from(root.getElementsByTagNameNS(A_NS, 'p'))) {
    const text = Array.from(p.getElementsByTagNameNS(A_NS, 't'))
      .map((t) => t.textContent ?? '')
      .join('')
      .trim();
    if (text) out.push(text);
  }
  return out;
}

/**
 * Đọc PowerPoint (.pptx) bằng JSZip: lấy tiêu đề, chữ và ảnh của từng slide theo đúng thứ tự trình chiếu.
 * Không dựng lại bố cục/hiệu ứng gốc — chỉ để xem nhanh nội dung mà không phải tải về.
 */
export async function readPptx(blob: Blob): Promise<PptxSlide[]> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(blob);

  // Thứ tự slide: presentation.xml (sldIdLst) + rels; nếu thiếu thì theo số trong tên file
  let slidePaths: string[] = [];
  const presFile = zip.file('ppt/presentation.xml');
  const presRels = zip.file('ppt/_rels/presentation.xml.rels');
  if (presFile && presRels) {
    const rels = new Map<string, string>();
    for (const rel of Array.from(parseXml(await presRels.async('string')).getElementsByTagName('Relationship'))) {
      const id = rel.getAttribute('Id');
      const target = rel.getAttribute('Target');
      if (id && target) rels.set(id, resolvePath('ppt', target));
    }
    const ids = Array.from(parseXml(await presFile.async('string')).getElementsByTagNameNS(P_NS, 'sldId')).map((n) => n.getAttributeNS(R_NS, 'id'));
    slidePaths = ids.map((id) => (id ? rels.get(id) : undefined)).filter((p): p is string => p !== undefined);
  }
  if (slidePaths.length === 0) {
    slidePaths = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => Number(a.match(/(\d+)\.xml$/)?.[1]) - Number(b.match(/(\d+)\.xml$/)?.[1]));
  }

  const slides: PptxSlide[] = [];
  for (const [index, path] of slidePaths.slice(0, MAX_SLIDES).entries()) {
    const file = zip.file(path);
    if (!file) continue;
    const doc = parseXml(await file.async('string'));

    let title = '';
    const body: string[] = [];
    for (const shape of Array.from(doc.getElementsByTagNameNS(P_NS, 'sp'))) {
      const ph = shape.getElementsByTagNameNS(P_NS, 'ph')[0];
      const type = ph?.getAttribute('type');
      const texts = paragraphsOf(shape);
      if ((type === 'title' || type === 'ctrTitle') && !title) title = texts.join(' ');
      else body.push(...texts);
    }
    // Bảng nằm trong graphicFrame (không phải p:sp)
    for (const frame of Array.from(doc.getElementsByTagNameNS(P_NS, 'graphicFrame'))) body.push(...paragraphsOf(frame));

    const images: string[] = [];
    const relsFile = zip.file(path.replace(/slides\/(slide\d+\.xml)$/, 'slides/_rels/$1.rels'));
    if (relsFile) {
      const dir = path.slice(0, path.lastIndexOf('/'));
      for (const rel of Array.from(parseXml(await relsFile.async('string')).getElementsByTagName('Relationship'))) {
        if (images.length >= MAX_IMAGES_PER_SLIDE) break;
        if (!(rel.getAttribute('Type') ?? '').endsWith('/image')) continue;
        const target = rel.getAttribute('Target');
        const ext = target?.split('.').pop()?.toLowerCase() ?? '';
        const mime = IMAGE_MIME[ext];
        const media = target && mime ? zip.file(resolvePath(dir, target)) : null;
        if (!media || !mime) continue;
        const data = await media.async('base64');
        if (data.length * 0.75 <= MAX_IMAGE_BYTES) images.push(`data:${mime};base64,${data}`);
      }
    }
    slides.push({ number: index + 1, title, paragraphs: body, images });
  }
  return slides;
}
