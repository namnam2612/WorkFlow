import { ConfigService } from '@nestjs/config';
import { asPrisma, createPrismaMock, PrismaMock } from '../test-utils';
import { MailService } from './mail.service';
import { NotificationsService } from './notifications.service';
import { SLACK_WEBHOOK_PATTERN, SlackService } from './slack.service';

const HOOK = 'https://hooks.slack.com/services/T000/B000/abcdefgh';

describe('NotificationsService - kênh email và Slack', () => {
  let prisma: PrismaMock;
  let mail: { isConfigured: jest.Mock; send: jest.Mock };
  let slack: { post: jest.Mock };
  let service: NotificationsService;
  const config = { get: (key: string) => (key === 'APP_URL' ? 'https://app.example.vn/' : undefined) } as unknown as ConfigService;

  beforeEach(() => {
    prisma = createPrismaMock();
    (prisma as unknown as { notification: Record<string, jest.Mock> }).notification.create = jest.fn().mockImplementation(({ data }: { data: object }) => Promise.resolve({ id: 1, ...data }));
    mail = { isConfigured: jest.fn().mockReturnValue(true), send: jest.fn().mockResolvedValue(true) };
    slack = { post: jest.fn().mockResolvedValue(true) };
    prisma.user.findMany.mockResolvedValue([{ id: 20, email: 'a@x.vn' }]);
    prisma.project.findMany.mockResolvedValue([{ id: 1, name: 'Dự án A', slackWebhookUrl: HOOK }]);
    service = new NotificationsService(asPrisma(prisma), mail as unknown as MailService, slack as unknown as SlackService, config);
  });

  it('email chỉ gửi cho người đã bật nhận email, kèm link tuyệt đối', async () => {
    await service.dispatchExternal([
      { userId: 20, type: 'task_assigned', message: 'Bạn được giao việc X', link: '/tasks/5' },
      { userId: 21, type: 'task_assigned', message: 'Bạn được giao việc X', link: '/tasks/5' },
    ]);
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send).toHaveBeenCalledWith({ to: 'a@x.vn', subject: '[TaskFlow] Bạn được giao việc X', text: 'Bạn được giao việc X\n\nhttps://app.example.vn/tasks/5' });
    // truy vấn chỉ lấy người bật emailNotifications và đang hoạt động
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ emailNotifications: true, isActive: true }) as object }));
  });

  it('chưa cấu hình SMTP thì không đụng tới email', async () => {
    mail.isConfigured.mockReturnValue(false);
    await service.dispatchExternal([{ userId: 20, type: 't', message: 'm' }]);
    expect(mail.send).not.toHaveBeenCalled();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('Slack: đăng vào kênh của dự án, mỗi tin một lần dù nhiều người nhận, ưu tiên channelMessage', async () => {
    await service.dispatchExternal([
      { userId: 20, type: 'status_changed', message: 'An chuyển "T" sang "Xong"', link: '/tasks/5', projectId: 1 },
      { userId: 21, type: 'status_changed', message: 'An chuyển "T" sang "Xong"', link: '/tasks/5', projectId: 1 },
      { userId: 22, type: 'task_assigned', message: 'Bạn được giao "T"', channelMessage: 'Bình được giao "T"', link: '/tasks/5', projectId: 1 },
    ]);
    expect(slack.post).toHaveBeenCalledTimes(2);
    expect(slack.post).toHaveBeenCalledWith(HOOK, '*Dự án A* · An chuyển "T" sang "Xong"\nhttps://app.example.vn/tasks/5');
    expect(slack.post).toHaveBeenCalledWith(HOOK, '*Dự án A* · Bình được giao "T"\nhttps://app.example.vn/tasks/5');
  });

  it('dự án chưa cấu hình Slack hoặc tin không gắn dự án thì không gọi Slack', async () => {
    prisma.project.findMany.mockResolvedValue([]);
    await service.dispatchExternal([{ userId: 20, type: 't', message: 'm', projectId: 1 }]);
    await service.dispatchExternal([{ userId: 20, type: 't', message: 'm' }]);
    expect(slack.post).not.toHaveBeenCalled();
  });

  it('một kênh lỗi không làm hỏng kênh còn lại và notify() không ném lỗi', async () => {
    mail.send.mockRejectedValue(new Error('smtp down'));
    await expect(service.dispatchExternal([{ userId: 20, type: 't', message: 'm', projectId: 1 }])).resolves.toBeUndefined();
    expect(slack.post).toHaveBeenCalled();
    await expect(service.notify([{ userId: 20, type: 't', message: 'm' }])).resolves.toBeUndefined();
  });
});

describe('Slack webhook', () => {
  it('chỉ chấp nhận hooks.slack.com (chống SSRF)', () => {
    expect(SLACK_WEBHOOK_PATTERN.test(HOOK)).toBe(true);
    expect(SLACK_WEBHOOK_PATTERN.test('http://hooks.slack.com/services/T000/B000/abcdefgh')).toBe(false);
    expect(SLACK_WEBHOOK_PATTERN.test('https://evil.example.com/services/T000/B000/abcdefgh')).toBe(false);
    expect(SLACK_WEBHOOK_PATTERN.test('https://hooks.slack.com.evil.com/services/T000/B000/abcdefgh')).toBe(false);
    expect(SLACK_WEBHOOK_PATTERN.test('https://169.254.169.254/latest/meta-data')).toBe(false);
  });

  it('post() từ chối URL không hợp lệ mà không gọi mạng', async () => {
    const spy = jest.spyOn(globalThis, 'fetch');
    await expect(new SlackService().post('https://evil.example.com/x', 'hi')).resolves.toBe(false);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('post() trả false khi Slack lỗi hoặc mạng hỏng, không ném', async () => {
    const spy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('no', { status: 500 })).mockRejectedValueOnce(new Error('network'));
    const slack = new SlackService();
    await expect(slack.post(HOOK, 'hi')).resolves.toBe(false);
    await expect(slack.post(HOOK, 'hi')).resolves.toBe(false);
    spy.mockRestore();
  });
});

describe('MailService', () => {
  it('không có SMTP_HOST thì tắt và send() trả false', async () => {
    const mail = new MailService({ get: () => undefined } as unknown as ConfigService);
    expect(mail.isConfigured()).toBe(false);
    await expect(mail.send({ to: 'a@x.vn', subject: 's', text: 't' })).resolves.toBe(false);
  });
});
