import { User } from "@port-of-mars/server/entity";
import { settings, getLogger } from "@port-of-mars/server/settings";
import { BaseService } from "@port-of-mars/server/services/db";
import { ServerError } from "@port-of-mars/server/util";
import { UpdateResult } from "typeorm";
import validator from "validator";
import _ from "lodash";

const logger = getLogger(__filename);

export class RegistrationService extends BaseService {
  createVerificationUrl(registrationToken: string) {
    // FIXME: depends on VueRouter hash mode
    return `${settings.host}/#/verify/${registrationToken}`;
  }

  async submitRegistrationMetadata(
    user: User,
    data: { username: string; email: string; name: string }
  ) {
    const repo = this.em.getRepository(User);
    user.username = data.username;
    user.name = data.name;
    user.email = data.email;
    user.dateConsented = new Date();
    await repo.save(user);
    logger.debug("updated registration metadata for user %o", data);
    await this.sendEmailVerification(user);
  }

  async findUnregisteredUserByRegistrationToken(
    registrationToken: string
  ): Promise<User | undefined> {
    return await this.em.getRepository(User).findOne({ registrationToken });
  }

  async sendEmailVerification(u: User): Promise<void> {
    if (_.isEmpty(u.email)) {
      logger.warn("Trying to send email verification to a user with no email.");
      return;
    }
    const verificationUrl = this.createVerificationUrl(u.registrationToken);
    settings.emailer.sendMail(
      {
        from: `Port of Mars <${settings.supportEmail}>`,
        to: u.email,
        bcc: settings.supportEmail,
        subject: "[Port of Mars] Verify your email",
        // FIXME: convert these to a server-side template
        text: `Greetings! Someone signed this email address up (${u.email}) to participate in the Port of Mars.
      If this was you, please complete your registration by going to ${verificationUrl} and clicking on the "Verify" button.
      If you did not request this, there is no need to take any action and you can safely ignore this message.

      Thanks for participating!
      the Port of Mars team`,
        html: `Greetings!
      <p>Someone signed this email address up (${u.email}) to participate in the Port of Mars.
      If this was you, please complete your registration by <a href='${verificationUrl}'>going to ${verificationUrl}</a> 
      and clicking on the "Verify" button.</p>
      <p>If you did not request this, there is no need to take any action and you can safely ignore this message.</p>

      <p>
      Thanks for participating!
      </p>
      the Port of Mars team`,
      },
      function (err, info) {
        if (err) {
          logger.warn(`error : $err`);
          throw new ServerError(err);
        } else {
          logger.info(`Successfully sent? %o`, info);
        }
      }
    );
    return;
  }

  async verifyUnregisteredUser(u: User, registrationToken: string): Promise<UpdateResult> {
    let r: UpdateResult;
    if (!validator.isUUID(registrationToken)) {
      throw new ServerError({
        code: 400,
        message: `Invalid registration token ${registrationToken}`,
        displayMessage: `Sorry, your registration token does not appear to be valid. Please try to verify your account again and contact us if this continues.`,
      });
    }
    try {
      r = await this.em
        .getRepository(User)
        .update({ username: u.username, registrationToken }, { isVerified: true });
    } catch (e) {
      logger.fatal(
        "error while updating user %s registration token %s",
        u.username,
        registrationToken
      );
      throw new ServerError({
        code: 400,
        error: e as Error,
        message: `Invalid user and registration token ${u.username}, ${registrationToken}`,
        displayMessage: `Sorry, your registration token ${registrationToken} does not appear to be valid. Please try to verify your account again and contact us if this continues.`,
      });
    }
    if (r.affected !== 1) {
      logger.debug("affected more than one row in registration update: %s", u.username);
      throw new ServerError({
        code: 404,
        message: `Invalid user and registration token ${u.username}, ${registrationToken}`,
        displayMessage: `Sorry, your registration token does not appear to be valid. Please try to verify your account again and contact us if this continues.`,
      });
    }
    return r;
  }
}
