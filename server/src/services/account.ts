import { ChatReport, User } from "@port-of-mars/server/entity";
import { MoreThan, IsNull, Not, In, Repository, UpdateResult } from "typeorm";
import { settings } from "@port-of-mars/server/settings";
import { BaseService } from "@port-of-mars/server/services/db";
import { generateUsername } from "@port-of-mars/server/util";
import { ModerationActionType, BAN, MUTE } from "@port-of-mars/shared/types";

const logger = settings.logging.getLogger(__filename);

export class AccountService extends BaseService {
  getRepository(): Repository<User> {
    return this.em.getRepository(User);
  }

  isRegisteredAndValid(user: User): boolean {
    return !!user.isVerified && !!user.email && !!user.isActive;
  }

  async getTotalRegisteredUsers(): Promise<number> {
    return await this.getRepository().count({
      where: { isActive: true, isVerified: true },
    });
  }

  async getTotalBannedUsers(): Promise<number> {
    return await this.getRepository().count({
      where: { isBanned: true },
    });
  }

  async getTotalReportedUsers(): Promise<{ resolved: number; unresolved: number }> {
    return {
      resolved: await this.em.getRepository(ChatReport).count({
        where: { resolved: true },
      }),
      unresolved: await this.em.getRepository(ChatReport).count({
        where: { resolved: false },
      }),
    };
  }

  async setAdminByUsername(username: string): Promise<User> {
    const user = await this.findByUsername(username);
    user.isAdmin = true;
    return await this.getRepository().save(user);
  }

  async muteOrBanByUsername(username: string, action: ModerationActionType): Promise<User> {
    const user = await this.findByUsername(username);
    if (action === MUTE) {
      user.isMuted = true;
      user.muteStrikes++;
    } else if (action === BAN) {
      user.isBanned = true;
    }
    return await this.getRepository().save(user);
  }

  async unmuteOrUnbanByUsername(username: string, action: ModerationActionType): Promise<User> {
    const user = await this.findByUsername(username);
    if (action === MUTE) {
      user.isMuted = false;
      user.muteStrikes = Math.max(0, user.muteStrikes - 1);
    } else if (action === BAN) {
      user.isBanned = false;
    }
    return await this.getRepository().save(user);
  }

  async expireMute(username: string): Promise<User> {
    // unapply mute without decrementing mute strikes
    const user = await this.findByUsername(username);
    user.isMuted = false;
    return await this.getRepository().save(user);
  }

  async decrementMuteStrikes(username: string): Promise<User> {
    const user = await this.findByUsername(username);
    user.muteStrikes = Math.max(0, user.muteStrikes - 1);
    return await this.getRepository().save(user);
  }

  async unbanByUsername(username: string): Promise<User> {
    const user = await this.findByUsername(username);
    user.isBanned = false;
    return await this.getRepository().save(user);
  }

  async getBannedUsers(): Promise<Array<User>> {
    return await this.getRepository().find({
      where: { isBanned: true },
    });
  }

  async findByUsername(username: string): Promise<User> {
    return await this.getRepository().findOneOrFail({ username });
  }

  async findUsers(usernames: Array<string>): Promise<Array<User>> {
    return await this.getRepository().find({
      where: {
        username: In(usernames),
      },
    });
  }

  async isEmailAvailable(user: User, email: string): Promise<boolean> {
    const otherUser = await this.getRepository().findOne({ email });
    if (otherUser) {
      return otherUser.id === user.id;
    }
    return true;
  }

  async isUsernameAvailable(username: string, user?: User): Promise<boolean> {
    const otherUser = await this.getRepository().findOne({ username });
    if (otherUser) {
      if (!user) {
        return false;
      }
      return otherUser.id === user.id;
    }
    return true;
  }

  async getActiveUsers(after: Date): Promise<Array<User>> {
    return await this.getRepository().find({
      select: ["name", "email", "username", "dateCreated"],
      where: {
        isActive: true,
        email: Not(IsNull()),
        dateCreated: MoreThan(after),
      },
    });
  }

  async getActiveEmails(after: Date): Promise<Array<string>> {
    const users: Array<User> = await this.getActiveUsers(after);
    return users.map(u => u.email ?? "");
  }

  async deactivateUsers(emails: Array<string>): Promise<number> {
    const repository = this.getRepository();
    const users = await repository.find({
      where: {
        email: In(emails),
      },
    });
    for (const u of users) {
      u.isActive = false;
    }
    await repository.save(users);
    return users.length;
  }

  async findUserById(id: number): Promise<User> {
    return await this.getRepository().findOneOrFail(id);
  }

  async denyConsent(id: number): Promise<UpdateResult> {
    return await this.getRepository().update(id, { dateConsented: undefined });
  }

  async setLastPlayerIp(id: number, ip: string): Promise<UpdateResult> {
    return await this.getRepository().update(id, { lastPlayerIp: ip });
  }

  async getOrCreateTestUser(username: string): Promise<User> {
    let user = await this.getRepository().findOne({ username });
    if (!user) {
      user = new User();
      user.username = username;
      user.name = "";
      user.email = `${username}@email.com`;
      logger.info("getOrCreateTestUser: not found, creating test user %s", user.username);
    } else {
      logger.info("getOrCreateTestUser: test user %s exists", user.username);
    }
    // test user, set fake data so they can immediately join a game
    // FIXME: use run-time configuration / settings to determine what user properties to bypass (passedQuiz, isVerified, hasParticipated, etc)
    user.dateConsented = new Date();
    user.isVerified = true;
    // user.passedQuiz = true;
    await this.getRepository().save(user);
    return user;
  }

  async getOrCreateUser(userData: { email: string; passportId?: string }): Promise<User> {
    let user: User | undefined;
    // try to find user by id
    if (userData.passportId) {
      user = await this.getRepository().findOne({ passportId: userData.passportId });
    }
    // if no id or find by id turned up empty, try to find user by email
    if (!userData.passportId || !user) {
      user = await this.getRepository().findOne({ email: userData.email });
    }
    if (!user) {
      user = new User();
      user.name = "";
      user.email = userData.email;
      user.passportId = userData.passportId ?? "";
      user.username = await generateUsername();
      user.isSystemBot = false;
      logger.info("getOrCreateUser: not found, creating user %s", user.username);
      await this.getRepository().save(user);
    } else {
      logger.info("getOrCreateUser: user %s exists", user.username);
    }
    return user;
  }

  async getOrCreateBotUsers(requiredNumberOfBots: number): Promise<Array<User>> {
    const bots = await this.getRepository().find({
      where: { isSystemBot: true },
      take: requiredNumberOfBots,
    });
    const numberOfBotsToCreate = requiredNumberOfBots - bots.length;
    if (numberOfBotsToCreate > 0) {
      for (let i = 0; i < numberOfBotsToCreate; i++) {
        const bot = new User();
        bot.username = await generateUsername();
        bot.name = `robot ${bot.username}`;
        bot.isSystemBot = true;
        await this.getRepository().save(bot);
        bots.push(bot);
      }
    }
    return bots;
  }
}
