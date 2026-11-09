import { useState } from 'react';
import { useCreateTestCase, useUpdateTestCase } from '../../hooks/useQa';
import { getErrorMessage } from '../../lib/api';
import { PRIORITIES, PRIORITY_META } from '../../lib/constants';
import { inputClass } from '../../lib/styles';
import type { Priority, TestCase } from '../../types/api';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { InlineError } from '../ui/States';
import { useToast } from '../ui/useToast';

/** Viết / sửa một test case: tiền điều kiện, các bước (mỗi bước một dòng), kết quả mong đợi */
export function TestCaseFormModal({ projectId, testCase, onClose }: { projectId: number; testCase?: TestCase; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateTestCase(projectId);
  const update = useUpdateTestCase();
  const [title, setTitle] = useState(testCase?.title ?? '');
  const [pre, setPre] = useState(testCase?.preconditions ?? '');
  const [steps, setSteps] = useState(testCase?.steps ?? '');
  const [expected, setExpected] = useState(testCase?.expected ?? '');
  const [priority, setPriority] = useState<Priority>(testCase?.priority ?? 'medium');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !steps.trim() || !expected.trim()) return setError('Cần nhập tiêu đề, các bước thực hiện và kết quả mong đợi');
    const input = { title: title.trim(), preconditions: pre.trim() || null, steps: steps.trim(), expected: expected.trim(), priority };
    try {
      if (testCase) await update.mutateAsync({ id: testCase.id, ...input });
      else await create.mutateAsync(input);
      toast.show(testCase ? 'Đã cập nhật test case' : 'Đã tạo test case', 'success');
      onClose();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <Modal open onClose={onClose} title={testCase ? 'Sửa test case' : 'Tạo test case'} size="lg">
      <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        <InlineError message={error} />
        <Field label="Tiêu đề" htmlFor="tc-title">
          <input id="tc-title" autoFocus className={inputClass} value={title} maxLength={255} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Tiền điều kiện" htmlFor="tc-pre">
          <textarea id="tc-pre" rows={2} className={inputClass} value={pre} maxLength={5000} onChange={(e) => setPre(e.target.value)} />
        </Field>
        <Field label="Các bước thực hiện (mỗi bước một dòng)" htmlFor="tc-steps">
          <textarea id="tc-steps" rows={5} className={inputClass} value={steps} maxLength={10000} onChange={(e) => setSteps(e.target.value)} placeholder={'1. Mở trang đăng nhập\n2. Nhập email và mật khẩu sai\n3. Bấm Đăng nhập'} />
        </Field>
        <Field label="Kết quả mong đợi" htmlFor="tc-exp">
          <textarea id="tc-exp" rows={3} className={inputClass} value={expected} maxLength={5000} onChange={(e) => setExpected(e.target.value)} />
        </Field>
        <Field label="Mức ưu tiên" htmlFor="tc-prio" hint="Quyết định mức nghiêm trọng của Bug tự sinh khi test fail.">
          <select id="tc-prio" className={inputClass} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_META[p].label}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {testCase ? 'Lưu' : 'Tạo test case'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
