import { err, ok, NotFoundError, ValidationError, type Result } from '../../../errors';
import type { IPresaveRepository } from '../repositories/presave';
import type { Clock } from '../../../platform/ports/effects';

const NOT_PRESAVABLE_MESSAGE = 'Пресейв недоступен: релиз уже вышел или не запланирован';

export interface PresaveServiceDeps {
  now: Clock;
}

export class PresaveService {
  constructor(
    private readonly repo: IPresaveRepository,
    private readonly deps: PresaveServiceDeps,
  ) {}

  async getState(userId: string, releaseId: string): Promise<Result<{ presaved: boolean }, Error>> {
    return ok({ presaved: await this.repo.getState(userId, releaseId) });
  }

  async presaveUser(userId: string, releaseId: string): Promise<Result<void, NotFoundError | ValidationError>> {
    const checked = await this.checkPresavable(releaseId);
    if (!checked.ok) return checked;
    await this.repo.presaveForUser(userId, releaseId);
    return ok(undefined);
  }

  async presaveGuest(email: string, releaseId: string): Promise<Result<void, NotFoundError | ValidationError>> {
    const checked = await this.checkPresavable(releaseId);
    if (!checked.ok) return checked;
    await this.repo.presaveForGuest(email, releaseId);
    return ok(undefined);
  }

  // 1:1 с текущим поведением: без проверки существования пресейва перед удалением.
  async unpresave(userId: string, releaseId: string): Promise<Result<void, Error>> {
    await this.repo.unpresaveForUser(userId, releaseId);
    return ok(undefined);
  }

  async unsubscribeGuest(email: string): Promise<Result<{ deleted: number }, Error>> {
    const deleted = await this.repo.deletePendingGuestByEmail(email);
    return ok({ deleted });
  }

  /** Пресейв доступен только для запланированного релиза с будущей датой выхода. */
  private async checkPresavable(releaseId: string): Promise<Result<void, NotFoundError | ValidationError>> {
    const info = await this.repo.getReleaseInfo(releaseId);
    if (!info) return err(new NotFoundError('Release', releaseId, 'release.notFound'));
    const presavable =
      info.status === 'SCHEDULED' && info.releaseDate != null && new Date(info.releaseDate).getTime() > this.deps.now();
    if (!presavable) return err(new ValidationError(NOT_PRESAVABLE_MESSAGE, 'presave.notPresavable'));
    return ok(undefined);
  }
}
